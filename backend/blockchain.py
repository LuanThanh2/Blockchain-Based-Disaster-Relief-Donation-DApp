# blockchain.py
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

try:
    # web3.py v7+
    from web3.middleware import ExtraDataToPOAMiddleware as _poa_middleware
except ImportError:  # pragma: no cover
    # web3.py v5/v6
    from web3.middleware import geth_poa_middleware as _poa_middleware

BASE_DIR = Path(__file__).resolve().parent


def _normalize_private_key(value: str) -> str:
    trimmed = (value or "").strip()
    if not trimmed:
        return ""
    if trimmed.startswith("0x"):
        return trimmed
    # common when copy/pasting from MetaMask / .env
    if len(trimmed) == 64:
        return f"0x{trimmed}"
    return trimmed


def _select_rpc_url(chain_id: int) -> str:
    # Prefer explicit RPC_URL if present
    direct = (os.getenv("RPC_URL") or "").strip()
    if direct:
        return direct

    if chain_id == 11155111:
        return (os.getenv("SEPOLIA_RPC_URL") or "").strip()

    if chain_id in (80002, 80001, 137):
        return (os.getenv("AMOY_RPC_URL") or "").strip()

    # Fallback: try any known var in order
    return (
        (os.getenv("SEPOLIA_RPC_URL") or "").strip()
        or (os.getenv("AMOY_RPC_URL") or "").strip()
    )


def _find_env_path() -> Path:
    configured = os.getenv("DOTENV_PATH")
    if configured:
        return Path(configured)

    candidates = [
        BASE_DIR / ".env",
        BASE_DIR.parent / ".env",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    # Default to backend/.env for clearer instructions
    return candidates[0]


def _find_abi_path() -> Path:
    # Prefer explicit env var if provided
    configured = os.getenv("DISASTER_FUND_ABI_PATH")
    if configured:
        return Path(configured)

    candidates = [
        BASE_DIR / "abi" / "DisasterFund.json",
        BASE_DIR.parent / "abi" / "DisasterFund.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    # Default to first path for clearer error messages
    return candidates[0]


def _load_abi(abi_path: Path):
    with open(abi_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Hardhat artifact shape: { "abi": [...], ... }
    if isinstance(data, dict) and "abi" in data:
        return data["abi"]

    # Raw ABI shape: [ ... ]
    if isinstance(data, list):
        return data

    raise ValueError(f"Unsupported ABI JSON format in {abi_path}")


class DisasterFundClient:
    def __init__(self) -> None:
        # Load .env (backend/.env or project-root/.env)
        env_path = _find_env_path()
        load_dotenv(dotenv_path=env_path, override=False)

        chain_id = int((os.getenv("CHAIN_ID") or "11155111").strip())
        rpc_url = _select_rpc_url(chain_id)
        private_key = _normalize_private_key(
            os.getenv("PRIVATE_KEY") or os.getenv("DEPLOYER_PRIVATE_KEY") or ""
        )
        contract_address = (os.getenv("DISASTER_FUND_ADDRESS") or "").strip()

        missing = [
            name
            for name, value in {
                "RPC_URL": rpc_url,
                "PRIVATE_KEY": private_key,
                "DISASTER_FUND_ADDRESS": contract_address,
            }.items()
            if not value
        ]
        if missing:
            raise RuntimeError(
                "Missing required env vars in .env: "
                + ", ".join(missing)
                + f". Loaded dotenv from: '{env_path}'."
            )

        self.web3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.web3.is_connected():
            raise RuntimeError(
                f"Failed to connect to RPC_URL='{rpc_url}'. Loaded dotenv from: '{env_path}'."
            )

        # Inject PoA middleware only for Polygon-family networks (not Sepolia).
        if chain_id in (80002, 80001, 137):
            self.web3.middleware_onion.inject(_poa_middleware, layer=0)

        self.account = self.web3.eth.account.from_key(private_key)
        self.chain_id = chain_id

        abi_path = _find_abi_path()
        if not abi_path.exists():
            raise FileNotFoundError(
                f"ABI file not found. Expected at '{abi_path}'. "
                "Create it or set DISASTER_FUND_ABI_PATH in .env"
            )

        abi = _load_abi(abi_path)

        self.contract = self.web3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=abi,
        )

    def _build_and_send_tx(self, bound_function):
        nonce = self.web3.eth.get_transaction_count(self.account.address)
        tx = bound_function.build_transaction(
            {
                "from": self.account.address,
                "nonce": nonce,
                "chainId": self.chain_id,
                "gas": 500000,
                "maxFeePerGas": self.web3.to_wei("30", "gwei"),
                "maxPriorityFeePerGas": self.web3.to_wei("1", "gwei"),
            }
        )
        signed = self.account.sign_transaction(tx)
        tx_hash = self.web3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.hex(), receipt

    def create_campaign(self, title: str, description: str, goal: int):
        """Calls contract: createCampaign(string title, string description, uint256 goal)."""
        bound = self.contract.functions.createCampaign(title, description, int(goal))
        return self._build_and_send_tx(bound)