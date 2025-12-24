import logging
import csv
import io
from datetime import datetime
from fastapi import (
    APIRouter,
    Depends,
    Request,
    BackgroundTasks,
)
from fastapi.responses import JSONResponse, Response
from sqlmodel import Session

from app.dependencies.auth import admin_required
from ..database import get_session, engine
from ..schemas import (
    CampaignCreate,
    CampaignRead,
    CampaignWithStats,
    DonationRead,
    WithdrawRead,
)
from ..models import Campaign, Donation
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
)
from ..services.web3_service import make_service
from sqlmodel import Session as SyncSession

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
    except Exception as e:
        logger.exception("Create on-chain campaign failed: %s", e)


# =========================================================
# ADMIN: Create campaign
# =========================================================
@router.post(
    "",
    response_model=CampaignRead,
    status_code=201,
    dependencies=[Depends(admin_required)],
)
async def create_campaign_api(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
):
    payload = CampaignCreate(**await request.json())

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

    saved = create_campaign(db, campaign)

    if payload.createOnChain:
        background_tasks.add_task(_create_onchain_campaign, saved.id)

    return saved


# =========================================================
# PUBLIC APIs
# =========================================================
@router.get("", response_model=list[CampaignRead])
def list_campaigns_api(db: Session = Depends(get_session)):
    return list_campaigns(db)


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_campaign_api(campaign_id: int, db: Session = Depends(get_session)):
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(404, {"detail": "Campaign not found"})
    return campaign


@router.get("/{campaign_id}/stats", response_model=CampaignWithStats)
def campaign_stats_api(campaign_id: int, db: Session = Depends(get_session)):
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        return JSONResponse(404, {"detail": "Campaign not found"})

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
    return get_donations_by_campaign_id(db, campaign_id, limit=100)


# =========================================================
# ADMIN: Sync donations from blockchain
# =========================================================
def _sync_donations(campaign_id: int, onchain_id: int):
    try:
        with SyncSession(engine) as db:
            svc = make_service()
            events = svc.get_donation_events(onchain_id)

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

            logger.info("Donation sync completed for campaign %s", campaign_id)
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
    db: Session = Depends(get_session),
):
    campaign = get_campaign(db, campaign_id)
    if not campaign or not campaign.onchain_id:
        return JSONResponse(400, {"detail": "Campaign not on-chain"})

    background_tasks.add_task(
        _sync_donations,
        campaign_id,
        campaign.onchain_id,
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
    db: Session = Depends(get_session),
):
    amount_eth = float((await request.json()).get("amount_eth", 0))
    if amount_eth <= 0:
        return JSONResponse(400, {"detail": "Invalid amount"})

    campaign = get_campaign(db, campaign_id)
    if not campaign or not campaign.onchain_id:
        return JSONResponse(400, {"detail": "Campaign not on-chain"})

    def _withdraw():
        svc = make_service()
        svc.withdraw(campaign.onchain_id, amount_eth)

    background_tasks.add_task(_withdraw)
    return {"message": "Withdraw processing"}


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
    db: Session = Depends(get_session),
):
    active = bool((await request.json()).get("active", True))

    campaign = get_campaign(db, campaign_id)
    if not campaign or not campaign.onchain_id:
        return JSONResponse(400, {"detail": "Campaign not on-chain"})

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
# DEBUG
# =========================================================
@router.post("/debug/echo")
async def debug_echo(request: Request):
    return {
        "body": (await request.body()).decode(),
        "headers": dict(request.headers),
    }
