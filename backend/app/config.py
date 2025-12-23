import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env at repo root: E:\Disaster_Relief_Dapp\.env
root = Path(__file__).resolve().parents[2]
env_path = root / ".env"
if env_path.exists():
    load_dotenv(env_path)

RPC_URL = os.getenv("RPC_URL") or os.getenv("SEPOLIA_RPC_URL")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
DEPLOYER_PRIVATE_KEY = os.getenv("DEPLOYER_PRIVATE_KEY")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 5050))
CHAIN_ID = int(os.getenv("CHAIN_ID", 11155111))

# Contract address (required when createOnChain=true)
DISASTER_FUND_ADDRESS = os.getenv("DISASTER_FUND_ADDRESS")

# CORS origins (comma-separated)
FRONTEND_ORIGINS = [
    o.strip()
    for o in (os.getenv("FRONTEND_ORIGINS") or "http://localhost:3000").split(",")
    if o.strip()
]
