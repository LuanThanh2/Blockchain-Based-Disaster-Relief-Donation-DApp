import logging
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.background import BackgroundTasks
from sqlmodel import Session

from ..database import get_session, engine
from ..schemas import CampaignCreate, CampaignRead
from ..models import Campaign
from ..crud import (
    create_campaign,
    get_campaign,
    list_campaigns,
    update_contract_tx_hash,
    update_onchain_info,   # ✅ THÊM
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


@router.post("/debug/echo")
async def debug_echo(request: Request):
    raw = await request.body()
    return {"raw_body": raw.decode("utf-8", errors="replace"), "headers": dict(request.headers)}
