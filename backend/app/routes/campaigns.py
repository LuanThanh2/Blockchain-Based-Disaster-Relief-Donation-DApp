import logging
import csv
import io
from datetime import datetime
from app.dependencies.auth import require_roles, admin_required, get_current_user
from app.utils.roles import CAMPAIGN_CREATOR_ROLES

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, Query
from fastapi.responses import JSONResponse, StreamingResponse
from app.database import get_session, engine
from app.schemas import (
    CampaignCreate,
    CampaignRead,
    CampaignUpdate,
    CampaignWithStats,
    DonationRead,
    WithdrawRead,
    AuditLogRead,
    ReportSummary,
)
from app.models import Campaign, Donation, AuditLog, WithdrawLog
from ..crud import (
    create_campaign,
    get_campaign,
    list_campaigns,
    update_onchain_info,
    create_donation,
    get_donations_by_campaign_id,
    get_campaign_stats,
    get_donation_by_tx_hash,
    update_campaign_status,
    update_campaign,
    get_donations_by_donor,
    create_withdraw_log,
    get_withdraw_logs_by_campaign,
    create_audit_log,
    get_audit_logs,
)
from app.services.web3_service import make_service
from sqlmodel import Session as SyncSession, Session, select

logger = logging.getLogger("uvicorn.error")

router = APIRouter(
    prefix="/api/v1/campaigns",
    tags=["campaigns"],
)

# =========================================================
# Background task: create campaign on blockchain
# =========================================================
def _create_onchain_campaign(campaign_id: int):
    try:
        with SyncSession(engine) as db:
            campaign = db.get(Campaign, campaign_id)
            if not campaign:
                logger.error("Campaign not found: %s", campaign_id)
                return

            svc = make_service()
            tx_hash, onchain_id = svc.create_campaign(
                title=campaign.title,
                description=campaign.description or "",
                goal_eth=float(campaign.target_amount),
            )

            update_onchain_info(db, campaign_id, tx_hash, onchain_id)
            logger.info(
                "On-chain campaign created | id=%s onchain_id=%s tx=%s",
                campaign_id,
                onchain_id,
                tx_hash,
            )
            # record audit
            try:
                audit = AuditLog(action="create_onchain", user_address=campaign.owner or "server", details=f"tx={tx_hash} onchain_id={onchain_id}")
                db.add(audit)
                db.commit()
            except Exception:
                logger.warning("Failed to write audit log for on-chain create campaign %s", campaign_id)
    except Exception as e:
        logger.exception("Create on-chain campaign failed: %s", e)
        # write audit of failure
        try:
            with SyncSession(engine) as db:
                audit = AuditLog(action="create_onchain_failed", user_address="server", details=str(e))
                db.add(audit)
                db.commit()
        except Exception:
            logger.warning("Failed to write audit log for on-chain create failure")


# =========================================================
# ADMIN: Create campaign
# =========================================================
@router.post(
    "",
    response_model=CampaignRead,
    status_code=201,
    dependencies=[Depends(require_roles("admin"))],
)
async def create_campaign_api(
    request: Request,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    payload = CampaignCreate(**await request.json())
    username = user.get("sub")

    campaign = Campaign(
        title=payload.title,
        short_desc=payload.short_desc,
        description=payload.description,
        image_url=payload.image_url,
        target_amount=payload.target_amount,
        currency=payload.currency,
        beneficiary=payload.beneficiary,
        deadline=payload.deadline,
        status="active",
        owner=username,  # Lưu owner
        auto_disburse=payload.auto_disburse,
        disburse_threshold=payload.disburse_threshold,
    )

    saved = create_campaign(db, campaign=campaign)
    
    # Audit log
    try:
        audit = AuditLog(
            action="create_campaign",
            username=username,
            details=f"campaign_id={saved.id}, title={saved.title}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception:
        logger.warning("Failed to write audit log for campaign creation")

    if payload.createOnChain:
        background_tasks.add_task(_create_onchain_campaign, saved.id)

    return saved


# =========================================================
# ADMIN (sync): Force create campaign on-chain and return result/errors
# =========================================================
@router.post("/{campaign_id}/create-onchain", dependencies=[Depends(require_roles("admin"))])
def create_campaign_onchain_api(campaign_id: int, db: Session = Depends(get_session)):
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    if campaign.onchain_id:
        return JSONResponse(status_code=400, content={"detail": "Campaign already on-chain", "onchain_id": campaign.onchain_id})

    svc = make_service()
    try:
        tx_hash, onchain_id = svc.create_campaign(
            title=campaign.title,
            description=campaign.description or "",
            goal_eth=float(campaign.target_amount),
        )

        # update DB
        update_onchain_info(db, campaign_id, tx_hash, onchain_id)

        # audit
        try:
            with SyncSession(engine) as s:
                a = AuditLog(action="create_onchain", user_address=campaign.owner or "server", details=f"tx={tx_hash} onchain_id={onchain_id}")
                s.add(a)
                s.commit()
        except Exception:
            logger.warning("Failed to persist audit log for onchain create")

        return {"tx_hash": tx_hash, "onchain_id": onchain_id}
    except Exception as e:
        logger.exception("Synchronous on-chain create failed for campaign %s: %s", campaign_id, e)
        # persist failure audit
        try:
            with SyncSession(engine) as s:
                a = AuditLog(action="create_onchain_failed", user_address="server", details=str(e))
                s.add(a)
                s.commit()
        except Exception:
            logger.warning("Failed to persist audit failure log")

        return JSONResponse(status_code=500, content={"detail": "On-chain create failed", "error": str(e)})


# =========================================================
# PUBLIC APIs
# =========================================================
@router.get("", response_model=list[CampaignRead])
def list_campaigns_api(
    visible_only: bool = True,  # Default: chỉ hiển thị campaigns visible cho public
    db: Session = Depends(get_session)
):
    """List campaigns. visible_only=True filters to only visible campaigns (for guests)"""
    return list_campaigns(db, visible_only=visible_only)


# =========================================================
# USER: Get my donations (MUST be before /{campaign_id} route!)
# =========================================================
@router.get(
    "/my-donations",
    response_model=list[DonationRead],
    dependencies=[Depends(get_current_user)],
)
def get_my_donations_api(
    donor_address: str = Query(..., description="Ethereum wallet address of the donor"),
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Get donations by donor address (user's donation history)"""
    
    # Normalize address (lowercase) for case-insensitive matching
    normalized_address = donor_address.strip()
    
    # Validate address format
    if not normalized_address.startswith("0x"):
        raise HTTPException(status_code=400, detail="Address must start with 0x")
    
    if len(normalized_address) != 42:
        raise HTTPException(status_code=400, detail=f"Address must be 42 characters (got {len(normalized_address)})")
    
    # Convert to lowercase for database query
    normalized_address = normalized_address.lower()
    
    # Optional: verify donor_address belongs to user (if you store wallet addresses)
    try:
        donations = get_donations_by_donor(db, normalized_address, limit=100)
        return donations
    except Exception as e:
        logger.exception("Error fetching donations for donor %s: %s", normalized_address, e)
        raise HTTPException(status_code=500, detail="Failed to fetch donations")


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_campaign_api(campaign_id: int, db: Session = Depends(get_session)):
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    return campaign


@router.get("/{campaign_id}/stats", response_model=CampaignWithStats)
def campaign_stats_api(campaign_id: int, db: Session = Depends(get_session)):
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})

    stats = get_campaign_stats(db, campaign_id)
    donations = get_donations_by_campaign_id(db, campaign_id, limit=5)

    return CampaignWithStats(
        **campaign.dict(),
        total_raised=stats["total_raised"],
        donor_count=stats["donor_count"],
        donation_count=stats["donation_count"],
        recent_donations=donations,
    )


@router.get("/{campaign_id}/donations", response_model=list[DonationRead])
def list_donations_api(campaign_id: int, db: Session = Depends(get_session)):
    """Get all donations for a campaign (public - for transparency)"""
    return get_donations_by_campaign_id(db, campaign_id, limit=100)


# =========================================================
# USER: Export donations only (Public data - no withdrawals)
# =========================================================
@router.get(
    "/{campaign_id}/export/donations",
    dependencies=[Depends(get_current_user)],  # Cần đăng nhập nhưng không cần admin
)
def export_donations_api(
    campaign_id: int,
    format: str = Query("csv", regex="^(csv|json)$"),
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Xuất báo cáo donations cho campaign (CHỈ donations, KHÔNG có withdrawals)
    Dành cho user đã đăng nhập để verify và minh bạch về donations
    """
    try:
        campaign = get_campaign(db, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        username = user.get("sub") if user else "unknown"
        
        # Audit log
        try:
            audit = AuditLog(
                action="export_donations",
                username=username,
                details=f"campaign_id={campaign_id}, format={format}"
            )
            create_audit_log(db, audit_log=audit)
        except Exception as e:
            logger.warning(f"Failed to write audit log for export_donations: {e}")
        
        # Chỉ lấy donations (public data)
        donations = get_donations_by_campaign_id(db, campaign_id, limit=10000)
        logger.info(f"Found {len(donations)} donations for campaign {campaign_id}")
        
        # Tạo danh sách giao dịch donations
        transactions = []
        total_donated = 0.0
        
        for donation in donations:
            try:
                total_donated += float(donation.amount_eth) if donation.amount_eth else 0.0
                # Xử lý timestamp an toàn
                date_str = ""
                if donation.timestamp:
                    if isinstance(donation.timestamp, datetime):
                        date_str = donation.timestamp.isoformat()
                    elif isinstance(donation.timestamp, str):
                        date_str = donation.timestamp
                    else:
                        date_str = str(donation.timestamp)
                
                # Xử lý donor_address an toàn
                donor_addr = donation.donor_address or ""
                desc = f"Quyên góp từ {donor_addr[:10]}...{donor_addr[-8:]}" if len(donor_addr) > 18 else f"Quyên góp từ {donor_addr}"
                
                transactions.append({
                    "date": date_str,
                    "description": desc,
                    "amount_eth": float(donation.amount_eth) if donation.amount_eth else 0.0,
                    "tx_hash": donation.tx_hash or "",
                    "block_number": int(donation.block_number) if donation.block_number else 0,
                    "donor_address": donor_addr,
                })
            except Exception as e:
                logger.warning(f"Error processing donation {donation.id}: {e}")
                continue
        
        # Sắp xếp theo thời gian (cũ nhất trước)
        transactions.sort(key=lambda x: x["date"])
        
        # Tính số dư chạy (chỉ từ donations)
        balance = 0.0
        for tx in transactions:
            balance += tx["amount_eth"]
            tx["balance"] = balance
        
        if format == "csv":
            # Tạo CSV file
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow([
                "Ngày giờ",
                "Mô tả",
                "Số tiền (ETH)",
                "Số dư tích lũy (ETH)",
                "Transaction Hash",
                "Block Number",
                "Địa chỉ ví người quyên góp",
            ])
            
            # Data rows
            for tx in transactions:
                writer.writerow([
                    tx["date"],
                    tx["description"],
                    f"{tx['amount_eth']:.6f}",
                    f"{tx['balance']:.6f}",
                    tx["tx_hash"],
                    tx["block_number"],
                    tx["donor_address"],
                ])
            
            # Footer với tổng kết
            writer.writerow([])
            writer.writerow(["TỔNG KẾT"])
            writer.writerow(["Tổng quyên góp:", f"{total_donated:.6f} ETH"])
            writer.writerow(["Số lượng donations:", len(donations)])
            writer.writerow(["Số lượng donors:", len(set(d.donor_address for d in donations if d.donor_address))])
            writer.writerow([])
            writer.writerow(["Lưu ý: Báo cáo này chỉ bao gồm donations (quyên góp)."])
            writer.writerow(["Thông tin về withdrawals (rút tiền) chỉ dành cho admin."])
            
            output.seek(0)
            
            # Tạo filename với timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"campaign_{campaign_id}_donations_{timestamp}.csv"
            
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Content-Type": "text/csv; charset=utf-8",
                }
            )
        
        else:  # JSON
            # Tạo JSON response
            import json
            result = {
                "campaign": {
                    "id": campaign.id,
                    "title": campaign.title or "",
                    "onchain_id": campaign.onchain_id,
                    "target_amount": float(campaign.target_amount) if campaign.target_amount else 0.0,
                },
                "summary": {
                    "total_donations": len(donations),
                    "total_donated": total_donated,
                    "total_donors": len(set(d.donor_address for d in donations if d.donor_address)),
                    "note": "This report only includes donations. Withdrawal information is admin-only.",
                },
                "donations": transactions,
            }
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"campaign_{campaign_id}_donations_{timestamp}.json"
            
            json_str = json.dumps(result, indent=2, ensure_ascii=False, default=str)
            
            return StreamingResponse(
                iter([json_str]),
                media_type="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Content-Type": "application/json; charset=utf-8",
                }
            )
    except Exception as e:
        logger.exception(f"Error exporting donations for campaign {campaign_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export donations: {str(e)}")


# =========================================================
# ADMIN: Update campaign metadata
# =========================================================
@router.put(
    "/{campaign_id}",
    response_model=CampaignRead,
    dependencies=[Depends(require_roles("admin"))],
)
async def update_campaign_api(
    campaign_id: int,
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Update campaign metadata (off-chain only)"""
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Check permission: owner or admin
    username = user.get("sub")
    role = user.get("role")
    if campaign.owner != username and role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Parse request body
    body = await request.json()
    
    # Validate payload
    payload = CampaignUpdate(**body)
    
    # Pydantic v2: dùng model_dump() thay vì dict()
    try:
        update_data = payload.model_dump(exclude_unset=True)
    except AttributeError:
        # Fallback cho Pydantic v1
        update_data = payload.dict(exclude_unset=True)
    
    # Update campaign
    updated = update_campaign(db, campaign_id, **update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Campaign not found after update")
    
    # Audit log (non-blocking)
    try:
        audit = AuditLog(
            action="update_campaign",
            username=username,
            user_address=None,
            details=f"campaign_id={campaign_id}, fields={list(update_data.keys())}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning("Failed to write audit log for campaign update: %s", e)
    
    # Return updated campaign - FastAPI will serialize via response_model=CampaignRead
    return updated


# =========================================================
# ADMIN: Toggle campaign visibility
# =========================================================
@router.post(
    "/{campaign_id}/toggle-visibility",
    response_model=CampaignRead,
    dependencies=[Depends(require_roles("admin"))],
)
async def toggle_visibility_api(
    campaign_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Toggle campaign visibility (show/hide from public)"""
    
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    
    username = user.get("sub")
    role = user.get("role")
    if campaign.owner != username and role != "admin":
        return JSONResponse(status_code=403, content={"detail": "Not authorized"})
    
    updated = update_campaign(db, campaign_id, is_visible=not campaign.is_visible)
    
    # Audit log
    try:
        audit = AuditLog(
            action="toggle_visibility",
            username=username,
            details=f"campaign_id={campaign_id}, visible={updated.is_visible}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception:
        logger.warning("Failed to write audit log for visibility toggle")
    
    return updated


# =========================================================
# ADMIN: Get withdraw logs
# =========================================================
@router.get(
    "/{campaign_id}/withdraws",
    response_model=list[WithdrawRead],
    dependencies=[Depends(admin_required)],
)
def get_withdraw_logs_api(campaign_id: int, db: Session = Depends(get_session)):
    """Get withdraw history for a campaign"""
    return get_withdraw_logs_by_campaign(db, campaign_id, limit=100)


# =========================================================
# ADMIN: Export campaign statement (Sao kê ngân hàng)
# =========================================================
@router.get(
    "/{campaign_id}/export/statement",
    dependencies=[Depends(admin_required)],
)
def export_campaign_statement_api(
    campaign_id: int,
    format: str = Query("csv", regex="^(csv|json)$"),
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """
    Xuất báo cáo sao kê ngân hàng cho campaign
    Bao gồm tất cả donations và withdrawals với đầy đủ thông tin on-chain
    """
    try:
        campaign = get_campaign(db, campaign_id)
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        username = user.get("sub") if user else "admin"
        
        # Audit log
        try:
            audit = AuditLog(
                action="export_statement",
                username=username,
                details=f"campaign_id={campaign_id}, format={format}"
            )
            create_audit_log(db, audit_log=audit)
        except Exception as e:
            logger.warning(f"Failed to write audit log for export_statement: {e}")
        
        # Lấy tất cả donations
        donations = get_donations_by_campaign_id(db, campaign_id, limit=10000)
        logger.info(f"Found {len(donations)} donations for campaign {campaign_id}")
        
        # Lấy tất cả withdrawals
        withdrawals = get_withdraw_logs_by_campaign(db, campaign_id, limit=10000)
        logger.info(f"Found {len(withdrawals)} withdrawals for campaign {campaign_id}")
        
        # Tạo danh sách giao dịch (combine donations và withdrawals)
        transactions = []
        
        # Thêm donations
        for donation in donations:
            try:
                # Xử lý timestamp an toàn
                date_str = ""
                if donation.timestamp:
                    if isinstance(donation.timestamp, datetime):
                        date_str = donation.timestamp.isoformat()
                    elif isinstance(donation.timestamp, str):
                        date_str = donation.timestamp
                    else:
                        date_str = str(donation.timestamp)
                
                # Xử lý donor_address an toàn
                donor_addr = donation.donor_address or ""
                desc = f"Quyên góp từ {donor_addr[:10]}...{donor_addr[-8:]}" if len(donor_addr) > 18 else f"Quyên góp từ {donor_addr}"
                
                transactions.append({
                    "date": date_str,
                    "description": desc,
                    "amount_eth": float(donation.amount_eth) if donation.amount_eth else 0.0,
                    "type": "Donation",
                    "tx_hash": donation.tx_hash or "",
                    "block_number": int(donation.block_number) if donation.block_number else 0,
                    "donor_address": donor_addr,
                })
            except Exception as e:
                logger.warning(f"Error processing donation {donation.id}: {e}")
                continue
        
        # Thêm withdrawals
        for withdraw in withdrawals:
            try:
                # Xử lý timestamp an toàn
                date_str = ""
                if withdraw.timestamp:
                    if isinstance(withdraw.timestamp, datetime):
                        date_str = withdraw.timestamp.isoformat()
                    elif isinstance(withdraw.timestamp, str):
                        date_str = withdraw.timestamp
                    else:
                        date_str = str(withdraw.timestamp)
                
                # Xử lý owner_address an toàn
                owner_addr = withdraw.owner_address or ""
                desc = f"Rút tiền đến {owner_addr[:10]}...{owner_addr[-8:]}" if len(owner_addr) > 18 else f"Rút tiền đến {owner_addr}"
                
                transactions.append({
                    "date": date_str,
                    "description": desc,
                    "amount_eth": -float(withdraw.amount_eth) if withdraw.amount_eth else 0.0,  # Số âm cho withdrawal
                    "type": "Withdrawal",
                    "tx_hash": withdraw.tx_hash or "",
                    "block_number": int(withdraw.block_number) if withdraw.block_number else 0,
                    "owner_address": owner_addr,
                })
            except Exception as e:
                logger.warning(f"Error processing withdrawal {withdraw.id}: {e}")
                continue
        
        # Sắp xếp theo thời gian (cũ nhất trước)
        transactions.sort(key=lambda x: x["date"])
        
        # Tính số dư chạy (running balance)
        balance = 0.0
        for tx in transactions:
            balance += tx["amount_eth"]
            tx["balance"] = balance
        
        if format == "csv":
            # Tạo CSV file
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow([
                "Ngày giờ",
                "Mô tả",
                "Loại giao dịch",
                "Số tiền (ETH)",
                "Số dư (ETH)",
                "Transaction Hash",
                "Block Number",
                "Địa chỉ ví",
            ])
            
            # Data rows
            for tx in transactions:
                writer.writerow([
                    tx["date"],
                    tx["description"],
                    tx["type"],
                    f"{tx['amount_eth']:.6f}",
                    f"{tx['balance']:.6f}",
                    tx["tx_hash"],
                    tx["block_number"],
                    tx.get("donor_address") or tx.get("owner_address", ""),
                ])
            
            # Footer với tổng kết
            writer.writerow([])
            writer.writerow(["TỔNG KẾT"])
            total_donated = sum(float(d.amount_eth) if d.amount_eth else 0.0 for d in donations)
            total_withdrawn = sum(float(w.amount_eth) if w.amount_eth else 0.0 for w in withdrawals)
            writer.writerow(["Tổng quyên góp:", f"{total_donated:.6f} ETH"])
            writer.writerow(["Tổng rút tiền:", f"{total_withdrawn:.6f} ETH"])
            writer.writerow(["Số dư hiện tại:", f"{balance:.6f} ETH"])
            writer.writerow(["Số lượng donations:", len(donations)])
            writer.writerow(["Số lượng withdrawals:", len(withdrawals)])
            
            output.seek(0)
            
            # Tạo filename với timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"campaign_{campaign_id}_statement_{timestamp}.csv"
            
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Content-Type": "text/csv; charset=utf-8",
                }
            )
        
        else:  # JSON
            # Tạo JSON response
            import json
            total_donated = sum(float(d.amount_eth) if d.amount_eth else 0.0 for d in donations)
            total_withdrawn = sum(float(w.amount_eth) if w.amount_eth else 0.0 for w in withdrawals)
            
            result = {
                "campaign": {
                    "id": campaign.id,
                    "title": campaign.title or "",
                    "onchain_id": campaign.onchain_id,
                    "target_amount": float(campaign.target_amount) if campaign.target_amount else 0.0,
                },
                "summary": {
                    "total_donations": len(donations),
                    "total_withdrawals": len(withdrawals),
                    "total_donated": total_donated,
                    "total_withdrawn": total_withdrawn,
                    "current_balance": balance,
                },
                "transactions": transactions,
            }
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"campaign_{campaign_id}_statement_{timestamp}.json"
            
            json_str = json.dumps(result, indent=2, ensure_ascii=False, default=str)
            
            return StreamingResponse(
                iter([json_str]),
                media_type="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Content-Type": "application/json; charset=utf-8",
                }
            )
    except Exception as e:
        logger.exception(f"Error exporting statement for campaign {campaign_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export statement: {str(e)}")


# =========================================================
# ADMIN: Sync donations from blockchain
# =========================================================
def _sync_donations(campaign_id: int, onchain_id: int, username: str = "admin"):
    try:
        with SyncSession(engine) as db:
            svc = make_service()
            events = svc.get_donation_events(onchain_id)
            
            synced_count = 0
            for ev in events:
                if get_donation_by_tx_hash(db, ev["tx_hash"]):
                    continue

                donation = Donation(
                    campaign_id=campaign_id,
                    onchain_campaign_id=onchain_id,
                    donor_address=ev["donor"],
                    amount_eth=ev["amount_eth"],
                    amount_wei=str(ev["amount"]),
                    tx_hash=ev["tx_hash"],
                    block_number=ev["block_number"],
                    timestamp=datetime.fromtimestamp(ev["timestamp"]),
                )
                create_donation(db, donation)
                synced_count += 1

            logger.info("Donation sync completed for campaign %s, synced %d donations", campaign_id, synced_count)
            
            # Audit log sau khi sync xong
            try:
                audit = AuditLog(
                    action="sync_donations_completed",
                    username=username,
                    details=f"campaign_id={campaign_id}, synced_count={synced_count}"
                )
                db.add(audit)
                db.commit()
            except Exception as e:
                logger.warning(f"Failed to write audit log for sync_donations_completed: {e}")
    except Exception as e:
        logger.exception("Sync donation failed: %s", e)


@router.post(
    "/{campaign_id}/sync-donations",
    status_code=202,
    dependencies=[Depends(admin_required)],
)
async def sync_donations_api(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    campaign = get_campaign(db, campaign_id)
    if not campaign or not campaign.onchain_id:
        return JSONResponse(status_code=400, content={"detail": "Campaign not on-chain"})

    username = user.get("sub") if user else "admin"
    
    # Audit log - bắt đầu sync
    try:
        audit = AuditLog(
            action="sync_donations",
            username=username,
            details=f"campaign_id={campaign_id}, onchain_id={campaign.onchain_id}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for sync donations: {e}")

    background_tasks.add_task(
        _sync_donations,
        campaign_id,
        campaign.onchain_id,
        username,
    )
    return {"message": "Sync started"}


# =========================================================
# ADMIN: Withdraw funds
# =========================================================
@router.post(
    "/{campaign_id}/withdraw",
    status_code=202,
    dependencies=[Depends(admin_required)],
)
async def withdraw_api(
    campaign_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    amount_eth = float((await request.json()).get("amount_eth", 0))
    if amount_eth <= 0:
        return JSONResponse(status_code=400, content={"detail": "Invalid amount"})

    campaign = get_campaign(db, campaign_id)
    if not campaign or not campaign.onchain_id:
        return JSONResponse(status_code=400, content={"detail": "Campaign not on-chain"})

    username = user.get("sub") if user else "admin"
    
    # Send transaction synchronously to get tx_hash immediately
    try:
        svc = make_service()
        logger.info(f"Starting withdraw for campaign {campaign_id}, onchain_id={campaign.onchain_id}, amount={amount_eth} ETH")
        
        # Execute withdraw transaction (this waits for receipt)
        tx_hash = svc.withdraw(campaign.onchain_id, amount_eth)
        logger.info(f"Withdraw transaction confirmed: {tx_hash}")
        
        # Audit log immediately (before background task)
        try:
            audit = AuditLog(
                action="withdraw",
                username=username,
                details=f"campaign_id={campaign_id}, amount={amount_eth} ETH, tx={tx_hash}"
            )
            create_audit_log(db, audit_log=audit)
        except Exception as e:
            logger.warning(f"Failed to write audit log for withdraw: {e}")
        
        # Background task to save event details and audit log
        def _save_withdraw_details():
            try:
                with SyncSession(engine) as s:
                    import time
                    time.sleep(2)  # Wait 2 seconds for event to be indexed
                    
                    # Get withdraw event to get details
                    latest_withdraw = None
                    for attempt in range(3):
                        try:
                            withdraw_events = svc.get_withdraw_events(campaign.onchain_id)
                            # Find the event matching our tx_hash
                            for event in withdraw_events:
                                if event.get('tx_hash') == tx_hash:
                                    latest_withdraw = event
                                    break
                            
                            if latest_withdraw:
                                break
                        except Exception as e:
                            logger.warning(f"Attempt {attempt + 1} to get withdraw event failed: {e}")
                        
                        if attempt < 2:
                            time.sleep(2)  # Wait 2 more seconds before retry
                    
                    if latest_withdraw:
                        logger.info(f"Found withdraw event: {latest_withdraw}")
                        # Check if already exists
                        existing = s.exec(
                            select(WithdrawLog).where(WithdrawLog.tx_hash == latest_withdraw['tx_hash'])
                        ).first()
                        
                        if not existing:
                            withdraw_log = WithdrawLog(
                                campaign_id=campaign_id,
                                onchain_campaign_id=campaign.onchain_id,
                                owner_address=latest_withdraw['owner'],
                                amount_eth=latest_withdraw['amount_eth'],
                                amount_wei=str(latest_withdraw['amount']),
                                tx_hash=latest_withdraw['tx_hash'],
                                block_number=latest_withdraw['block_number'],
                                timestamp=datetime.fromtimestamp(latest_withdraw['timestamp']),
                            )
                            create_withdraw_log(s, withdraw_log=withdraw_log)
                            logger.info(f"Saved withdraw log: campaign_id={campaign_id}, tx={latest_withdraw['tx_hash']}")
                        else:
                            logger.info(f"Withdraw log already exists: {latest_withdraw['tx_hash']}")
                    else:
                        logger.warning(f"Could not find withdraw event for tx={tx_hash}. Event will be indexed by background poller.")
                    
                    # Note: Audit log đã được tạo ở trên (trước background task)
                        
            except Exception as e:
                logger.exception(f"Failed to save withdraw details for campaign {campaign_id}: {e}")
        
        background_tasks.add_task(_save_withdraw_details)
        
        # Return success with tx_hash immediately
        return {
            "message": "Withdraw successful",
            "success": True,
            "tx_hash": tx_hash,
            "amount_eth": amount_eth,
            "campaign_id": campaign_id,
        }
        
    except Exception as e:
        logger.exception(f"Withdraw failed for campaign {campaign_id}: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "message": "Withdraw failed",
                "success": False,
                "detail": str(e)
            }
        )


# =========================================================
# ADMIN: Enable / Disable campaign
# =========================================================
@router.post(
    "/{campaign_id}/set-active",
    status_code=202,
    dependencies=[Depends(admin_required)],
)
async def set_active_api(
    campaign_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db: Session = Depends(get_session),
):
    active = bool((await request.json()).get("active", True))

    campaign = get_campaign(db, campaign_id)
    if not campaign or not campaign.onchain_id:
        return JSONResponse(status_code=400, content={"detail": "Campaign not on-chain"})

    username = user.get("sub") if user else "admin"
    
    # Audit log
    try:
        audit = AuditLog(
            action="set_active",
            username=username,
            details=f"campaign_id={campaign_id}, active={active}, onchain_id={campaign.onchain_id}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for set_active: {e}")

    def _set_active():
        svc = make_service()
        svc.set_active(campaign.onchain_id, active)
        update_campaign_status(
            db,
            campaign_id,
            "active" if active else "closed",
        )

    background_tasks.add_task(_set_active)
    return {"message": "Status updating"}


# =========================================================
# ADMIN: Reports & Analytics
# =========================================================
@router.get(
    "/admin/reports",
    response_model=ReportSummary,
    dependencies=[Depends(admin_required)],
)
def get_reports_api(db: Session = Depends(get_session)):
    """Get comprehensive reports for admin dashboard"""
    try:
        from sqlalchemy import func
        
        logger.info("Starting to generate reports...")
        
        # Total campaigns
        total_campaigns = db.exec(select(func.count(Campaign.id))).first() or 0
        logger.debug(f"Total campaigns: {total_campaigns}")
        
        active_campaigns = db.exec(
            select(func.count(Campaign.id)).where(Campaign.status == "active")
        ).first() or 0
        logger.debug(f"Active campaigns: {active_campaigns}")
        
        # Total raised and withdrawn
        total_raised = db.exec(select(func.sum(Donation.amount_eth))).first() or 0.0
        logger.debug(f"Total raised: {total_raised}")
        
        total_withdrawn = db.exec(select(func.sum(WithdrawLog.amount_eth))).first() or 0.0
        logger.debug(f"Total withdrawn: {total_withdrawn}")
        
        # Total donors and donations
        total_donors = db.exec(select(func.count(func.distinct(Donation.donor_address)))).first() or 0
        logger.debug(f"Total donors: {total_donors}")
        
        total_donations = db.exec(select(func.count(Donation.id))).first() or 0
        logger.debug(f"Total donations: {total_donations}")
        
        # Recent campaigns
        logger.debug("Fetching recent campaigns...")
        recent_campaigns = list_campaigns(db, visible_only=False)[:10]
        logger.debug(f"Found {len(recent_campaigns)} recent campaigns")
        
        # Top campaigns by raised amount
        logger.debug("Calculating top campaigns...")
        campaigns_with_stats = []
        all_campaigns = list_campaigns(db, visible_only=False)
        logger.debug(f"Processing {len(all_campaigns)} campaigns for top list")
        
        for c in all_campaigns[:10]:
            try:
                stats = get_campaign_stats(db, c.id)
                donations = get_donations_by_campaign_id(db, c.id, limit=5)
                # Pydantic v1/v2 compatibility
                c_dict = c.model_dump() if hasattr(c, 'model_dump') else c.dict()
                campaigns_with_stats.append(
                    CampaignWithStats(
                        **c_dict,
                        total_raised=stats["total_raised"],
                        donor_count=stats["donor_count"],
                        donation_count=stats["donation_count"],
                        recent_donations=donations,
                    )
                )
            except Exception as e:
                logger.exception(f"Error processing campaign {c.id} for top list: {e}")
                continue
        
        # Sort by total_raised
        campaigns_with_stats.sort(key=lambda x: x.total_raised, reverse=True)
        logger.debug(f"Top campaigns sorted, count: {len(campaigns_with_stats)}")
        
        # Pydantic v1/v2 compatibility for recent_campaigns
        recent_campaigns_data = []
        for c in recent_campaigns:
            try:
                c_dict = c.model_dump() if hasattr(c, 'model_dump') else c.dict()
                recent_campaigns_data.append(CampaignRead(**c_dict))
            except Exception as e:
                logger.exception(f"Error converting campaign {c.id} to CampaignRead: {e}")
                continue
        
        logger.info("Reports generated successfully")
        
        result = ReportSummary(
            total_campaigns=total_campaigns,
            active_campaigns=active_campaigns,
            total_raised=total_raised or 0.0,
            total_withdrawn=total_withdrawn or 0.0,
            total_donors=total_donors,
            total_donations=total_donations,
            recent_campaigns=recent_campaigns_data,
            top_campaigns=campaigns_with_stats[:5],
        )
        
        return result
        
    except Exception as e:
        logger.exception(f"Error generating reports: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate reports: {str(e)}"
        )


# =========================================================
# ADMIN: Audit Logs
# =========================================================
@router.get(
    "/admin/audit-logs",
    response_model=list[AuditLogRead],
    dependencies=[Depends(admin_required)],
)
def get_audit_logs_api(
    action: str | None = None,
    username: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_session),
):
    """Get audit logs with optional filters"""
    return get_audit_logs(db, limit=limit, action=action, username=username)


# =========================================================
# DEBUG
# =========================================================
@router.post("/debug/echo")
async def debug_echo(request: Request):
    return {
        "body": (await request.body()).decode(),
        "headers": dict(request.headers),
    }
