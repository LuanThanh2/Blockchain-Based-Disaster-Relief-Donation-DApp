# Backend (minimal)

This is a minimal FastAPI backend scaffold for the Disaster Relief Dapp.

Usage (from repo root):

1. Create a `.env` file (copy from `.env.example`) and set `DATABASE_URL` and `RPC_URL`.
2. Create and activate a virtualenv:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

3. Run the app:

```powershell
cd backend
python -m app.main
```

Endpoint:
- POST `/api/v1/campaigns` — create a campaign (JSON body matching `CampaignCreate`).

On-chain creation (Sepolia)
 - If you set `DISASTER_FUND_ADDRESS` in your `.env` and `DEPLOYER_PRIVATE_KEY` (backend secret), you can request on-chain creation by including `"createOnChain": true` in the POST body. The backend will call `createCampaign(title, description, goal)` on the `DisasterFund` contract and store the transaction hash in `contract_tx_hash` on the campaign record.

Environment variables required for on-chain calls:
 - `RPC_URL` or `SEPOLIA_RPC_URL` (Sepolia RPC endpoint)
 - `DEPLOYER_PRIVATE_KEY` (private key used by backend to sign txs) — keep secret
 - `DISASTER_FUND_ADDRESS` (deployed contract address)

Note: Storing private keys on the backend is sensitive. For production use, use a secrets manager and restrict the on-chain endpoints.
