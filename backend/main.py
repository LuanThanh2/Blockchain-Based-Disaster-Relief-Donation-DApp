# main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
try:
    # When running from project root: `uvicorn backend.main:app`
    from backend.blockchain import DisasterFundClient
except ModuleNotFoundError:
    # When running from backend folder: `uvicorn main:app`
    from blockchain import DisasterFundClient

app = FastAPI(title="Disaster Relief Donation DApp Backend")

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))