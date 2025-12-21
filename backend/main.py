# main.py
from decimal import Decimal, InvalidOperation
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
try:
    # When running from project root: `uvicorn backend.main:app`
    from backend.blockchain import DisasterFundClient
except ModuleNotFoundError:
    # When running from backend folder: `uvicorn main:app`
    from blockchain import DisasterFundClient

app = FastAPI(title="Disaster Relief Donation DApp Backend")


allowed_origins_raw = (
    os.getenv("CORS_ALLOW_ORIGINS")
    or "http://localhost:3000,http://127.0.0.1:3000"
)
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client: DisasterFundClient | None = None


@app.on_event("startup")
def _startup_init_blockchain_client():
    global client
    # Don't crash import; fail fast on startup with a clear error
    client = DisasterFundClient()


class CreateCampaignRequest(BaseModel):
    title: str = Field(..., example="Flood Relief Central Region")
    description: str = Field(..., example="Support families affected by flooding")
    # Prefer goal_wei for exactness; goal_eth is a convenience.
    goal_wei: int | None = Field(None, example=1000000000000000000)
    goal_eth: str | None = Field(None, example="1")

    @field_validator("goal_eth")
    @classmethod
    def _validate_goal_eth(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            return None
        try:
            parsed = Decimal(trimmed)
        except InvalidOperation as exc:
            raise ValueError("goal_eth must be a decimal number string") from exc
        if parsed <= 0:
            raise ValueError("goal_eth must be > 0")
        return trimmed


class CreateCampaignResponse(BaseModel):
    tx_hash: str
    status: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/campaigns", response_model=CreateCampaignResponse)
def create_campaign(body: CreateCampaignRequest):
    if client is None:
        raise HTTPException(status_code=500, detail="Blockchain client not initialized")
    try:
        if body.goal_wei is None and body.goal_eth is None:
            raise HTTPException(status_code=422, detail="Provide goal_wei or goal_eth")

        goal_wei = body.goal_wei
        if goal_wei is None:
            # Parse decimal string to wei using web3.py helper
            goal_wei = int(client.web3.to_wei(body.goal_eth, "ether"))

        tx_hash, receipt = client.create_campaign(
            title=body.title,
            description=body.description,
            goal=goal_wei,
        )
        status = "success" if receipt.status == 1 else "failed"
        return CreateCampaignResponse(tx_hash=tx_hash, status=status)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))