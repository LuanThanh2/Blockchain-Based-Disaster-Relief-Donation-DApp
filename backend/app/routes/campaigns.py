import logging
import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from fastapi.background import BackgroundTasks
from sqlmodel import Session

from ..database import get_session, engine
from ..schemas import CampaignCreate, CampaignRead, CampaignWithStats, DonationRead, WithdrawRead
from ..models import Campaign, Donation
from ..crud import (
    create_campaign,
    get_campaign,
    list_campaigns,
    update_contract_tx_hash,
    update_onchain_info,
    create_donation,
    get_donations_by_campaign_id,
    get_campaign_stats,
    get_donation_by_tx_hash,
    update_campaign_status,
)
from ..services.web3_service import make_service

from sqlmodel import Session as SyncSession

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])


def _create_onchain_and_update(campaign_id: int):
    """
    Runs in background:
    - read campaign from DB
    - send on-chain tx
    - update contract_tx_hash + onchain_id
    """
    try:
        with SyncSession(engine) as db:
            c = db.get(Campaign, campaign_id)
            if not c:
                logger.error("BG task: campaign not found: %s", campaign_id)
                return

            svc = make_service()

            # ✅ CHỖ SỬA CHÍNH: create_campaign trả về (tx_hash, onchain_id)
            tx_hash, onchain_id = svc.create_campaign(
                title=c.title,
                description=c.description or "",
                goal_eth=float(c.target_amount),
            )

            # ✅ Update cả 2 field
            update_onchain_info(db, campaign_id, tx_hash, onchain_id)

            logger.info(
                "BG task: on-chain success. campaign_id=%s onchain_id=%s tx=%s",
                campaign_id,
                onchain_id,
                tx_hash,
            )

    except Exception as e:
        logger.exception("BG task: on-chain failed. campaign_id=%s err=%s", campaign_id, e)


@router.post("/", response_model=CampaignRead, status_code=201)
async def create_campaign_api(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
):
    # Read raw json safely
    try:
        payload_raw = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={"detail": "Invalid JSON body", "error": str(e)})

    # Validate payload
    try:
        payload = CampaignCreate(**payload_raw)
    except Exception as e:
        return JSONResponse(
            status_code=422,
            content={"detail": "Validation error", "error": str(e), "received": payload_raw},
        )

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
    )
    saved = create_campaign(db, campaign=campaign)

    if payload.createOnChain:
        background_tasks.add_task(_create_onchain_and_update, saved.id)

    return saved


@router.get("/", response_model=list[CampaignRead])
def list_campaigns_api(db: Session = Depends(get_session)):
    return list_campaigns(db)


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_campaign_api(campaign_id: int, db: Session = Depends(get_session)):
    c = get_campaign(db, campaign_id)
    if not c:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    return c

@router.get("/{campaign_id}/stats", response_model=CampaignWithStats)
def get_campaign_stats_api(campaign_id: int, db: Session = Depends(get_session)):
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    
    stats = get_campaign_stats(db, campaign_id)
    recent_donations = get_donations_by_campaign_id(db, campaign_id, limit=5)
    
    return CampaignWithStats(
        **campaign.dict(),
        total_raised=stats["total_raised"],
        donor_count=stats["donor_count"],
        donation_count=stats["donation_count"],
        recent_donations=recent_donations,
    )

@router.get("/{campaign_id}/donations", response_model=list[DonationRead])
def list_donations_api(campaign_id: int, db: Session = Depends(get_session)):
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    return get_donations_by_campaign_id(db, campaign_id, limit=100)

def _sync_donations_from_blockchain(campaign_id: int, onchain_campaign_id: int):
    """
    Background task to fetch DonationReceived events and save to DB.
    """
    try:
        from datetime import datetime
        with SyncSession(engine) as db:
            svc = make_service()
            events = svc.get_donation_events(onchain_campaign_id)

            for event in events:
                tx_hash = event['tx_hash']
                if get_donation_by_tx_hash(db, tx_hash):
                    logger.debug("Donation with tx_hash %s already exists, skipping.", tx_hash)
                    continue

                donation = Donation(
                    campaign_id=campaign_id,
                    onchain_campaign_id=onchain_campaign_id,
                    donor_address=event['donor'],
                    amount_eth=event['amount_eth'],
                    amount_wei=str(event['amount']),
                    tx_hash=tx_hash,
                    block_number=event['block_number'],
                    timestamp=datetime.fromtimestamp(event['timestamp']),
                )
                create_donation(db, donation=donation)
                logger.info(
                    "BG task: Saved donation %s from %s for campaign %s",
                    tx_hash, event['donor'], campaign_id
                )
            logger.info("BG task: Sync completed for campaign %s. Found %d events.", campaign_id, len(events))
    except Exception as e:
        logger.exception("BG task: Failed to sync donations for campaign %s. Error: %s", campaign_id, e)

@router.post("/{campaign_id}/sync-donations", status_code=202)
async def sync_donations_api(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
):
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    if campaign.onchain_id is None:
        return JSONResponse(status_code=400, content={"detail": "Campaign not created on-chain yet."})
    
    background_tasks.add_task(_sync_donations_from_blockchain, campaign_id, campaign.onchain_id)
    return {"message": "Đang đồng bộ donations từ blockchain...", "campaign_id": campaign_id, "onchain_id": campaign.onchain_id}

@router.post("/{campaign_id}/withdraw", status_code=202)
async def withdraw_funds_api(
    campaign_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
):
    """
    Rút tiền từ campaign (server-signed)
    Body: {"amount_eth": 1.5}
    """
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    if campaign.onchain_id is None:
        return JSONResponse(status_code=400, content={"detail": "Campaign not created on-chain yet."})
    
    try:
        payload = await request.json()
        amount_eth = float(payload.get("amount_eth", 0))
        if amount_eth <= 0:
            return JSONResponse(status_code=400, content={"detail": "amount_eth must be > 0"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"detail": f"Invalid request body: {e}"})
    
    def _withdraw_and_update(campaign_id: int, onchain_id: int, amount_eth: float):
        try:
            with SyncSession(engine) as db:
                svc = make_service()
                tx_hash = svc.withdraw(onchain_id, amount_eth)
                logger.info(f"BG task: Withdraw success. campaign_id={campaign_id} amount={amount_eth} ETH tx={tx_hash}")
        except Exception as e:
            logger.exception(f"BG task: Withdraw failed. campaign_id={campaign_id} err={e}")
    
    background_tasks.add_task(_withdraw_and_update, campaign_id, campaign.onchain_id, amount_eth)
    return {
        "message": f"Đang rút {amount_eth} ETH từ campaign...",
        "campaign_id": campaign_id,
        "onchain_id": campaign.onchain_id,
        "amount_eth": amount_eth,
    }

@router.post("/{campaign_id}/set-active", status_code=202)
async def set_active_api(
    campaign_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
):
    """
    Bật/tắt campaign (server-signed)
    Body: {"active": true} hoặc {"active": false}
    """
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    if campaign.onchain_id is None:
        return JSONResponse(status_code=400, content={"detail": "Campaign not created on-chain yet."})
    
    try:
        payload = await request.json()
        active = bool(payload.get("active", True))
    except Exception as e:
        return JSONResponse(status_code=400, content={"detail": f"Invalid request body: {e}"})
    
    def _set_active_and_update(campaign_id: int, onchain_id: int, active: bool):
        try:
            with SyncSession(engine) as db:
                svc = make_service()
                tx_hash = svc.set_active(onchain_id, active)
                # Update DB status
                update_campaign_status(db, campaign_id, "active" if active else "closed")
                logger.info(f"BG task: SetActive success. campaign_id={campaign_id} active={active} tx={tx_hash}")
        except Exception as e:
            logger.exception(f"BG task: SetActive failed. campaign_id={campaign_id} err={e}")
    
    background_tasks.add_task(_set_active_and_update, campaign_id, campaign.onchain_id, active)
    return {
        "message": f"Đang {'bật' if active else 'tắt'} campaign...",
        "campaign_id": campaign_id,
        "onchain_id": campaign.onchain_id,
        "active": active,
    }

@router.get("/{campaign_id}/withdraws", response_model=list[WithdrawRead])
def list_withdraws_api(campaign_id: int, db: Session = Depends(get_session)):
    """
    Lấy lịch sử giao dịch rút tiền từ blockchain
    """
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    if campaign.onchain_id is None:
        return JSONResponse(status_code=400, content={"detail": "Campaign not created on-chain yet."})
    
    try:
        svc = make_service()
        events = svc.get_withdraw_events(campaign.onchain_id)
        
        # Convert to WithdrawRead format
        withdraws = []
        for event in events:
            withdraws.append(WithdrawRead(
                campaign_id=campaign_id,
                campaign_onchain_id=campaign.onchain_id,
                owner=event['owner'],
                amount_eth=event['amount_eth'],
                tx_hash=event['tx_hash'],
                block_number=event['block_number'],
                timestamp=event['timestamp'],
            ))
        
        return withdraws
    except Exception as e:
        logger.exception(f"Error getting withdraw events: {e}")
        return JSONResponse(status_code=500, content={"detail": f"Error getting withdraw events: {e}"})

@router.get("/{campaign_id}/donations/export")
def export_donations_api(
    campaign_id: int,
    format: str = "json",  # "json" or "csv"
    db: Session = Depends(get_session),
):
    """
    Xuất donations ra CSV hoặc JSON
    
    Query params:
        format: "json" hoặc "csv" (default: "json")
    """
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(status_code=404, content={"detail": "Campaign not found"})
    
    donations = get_donations_by_campaign_id(db, campaign_id, limit=10000)  # Large limit for export
    
    if format.lower() == "csv":
        # Export CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "ID",
            "Campaign ID",
            "Donor Address",
            "Amount (ETH)",
            "Amount (Wei)",
            "Transaction Hash",
            "Block Number",
            "Timestamp",
            "Created At"
        ])
        
        # Data rows
        for donation in donations:
            writer.writerow([
                donation.id,
                donation.campaign_id,
                donation.donor_address,
                donation.amount_eth,
                donation.amount_wei,
                donation.tx_hash,
                donation.block_number,
                donation.timestamp.isoformat() if donation.timestamp else "",
                donation.created_at.isoformat() if donation.created_at else "",
            ])
        
        csv_content = output.getvalue()
        output.close()
        
        filename = f"donations_campaign_{campaign_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    else:
        # Export JSON
        donations_data = [
            {
                "id": d.id,
                "campaign_id": d.campaign_id,
                "donor_address": d.donor_address,
                "amount_eth": d.amount_eth,
                "amount_wei": d.amount_wei,
                "tx_hash": d.tx_hash,
                "block_number": d.block_number,
                "timestamp": d.timestamp.isoformat() if d.timestamp else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in donations
        ]
        
        filename = f"donations_campaign_{campaign_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        return Response(
            content=JSONResponse(content=donations_data).body,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

@router.get("/export/all")
def export_all_campaigns_api(
    format: str = "json",  # "json" or "csv"
    db: Session = Depends(get_session),
):
    """
    Xuất tất cả campaigns với stats ra CSV hoặc JSON
    
    Query params:
        format: "json" hoặc "csv" (default: "json")
    """
    campaigns = list_campaigns(db)
    
    # Get stats for each campaign
    campaigns_with_stats = []
    for campaign in campaigns:
        stats = get_campaign_stats(db, campaign.id)
        campaigns_with_stats.append({
            "id": campaign.id,
            "title": campaign.title,
            "short_desc": campaign.short_desc,
            "description": campaign.description,
            "image_url": campaign.image_url,
            "target_amount": campaign.target_amount,
            "currency": campaign.currency,
            "beneficiary": campaign.beneficiary,
            "deadline": campaign.deadline.isoformat() if campaign.deadline else None,
            "owner": campaign.owner,
            "contract_tx_hash": campaign.contract_tx_hash,
            "onchain_id": campaign.onchain_id,
            "status": campaign.status,
            "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
            "total_raised": stats["total_raised"],
            "donor_count": stats["donor_count"],
            "donation_count": stats["donation_count"],
        })
    
    if format.lower() == "csv":
        # Export CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "ID",
            "Title",
            "Short Description",
            "Description",
            "Image URL",
            "Target Amount (ETH)",
            "Currency",
            "Beneficiary",
            "Deadline",
            "Owner",
            "Contract TX Hash",
            "On-chain ID",
            "Status",
            "Created At",
            "Total Raised (ETH)",
            "Donor Count",
            "Donation Count"
        ])
        
        # Data rows
        for c in campaigns_with_stats:
            writer.writerow([
                c["id"],
                c["title"],
                c["short_desc"] or "",
                c["description"] or "",
                c["image_url"] or "",
                c["target_amount"],
                c["currency"],
                c["beneficiary"] or "",
                c["deadline"] or "",
                c["owner"] or "",
                c["contract_tx_hash"] or "",
                c["onchain_id"] or "",
                c["status"],
                c["created_at"] or "",
                c["total_raised"],
                c["donor_count"],
                c["donation_count"],
            ])
        
        csv_content = output.getvalue()
        output.close()
        
        filename = f"campaigns_all_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    else:
        # Export JSON
        filename = f"campaigns_all_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        return Response(
            content=JSONResponse(content=campaigns_with_stats).body,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

@router.post("/debug/echo")
async def debug_echo(request: Request):
    raw = await request.body()
    return {"raw_body": raw.decode("utf-8", errors="replace"), "headers": dict(request.headers)}
