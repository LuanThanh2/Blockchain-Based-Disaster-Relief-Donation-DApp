import json
from pathlib import Path
from web3 import Web3
from eth_account import Account

from ..config import RPC_URL, DEPLOYER_PRIVATE_KEY, CHAIN_ID, DISASTER_FUND_ADDRESS

def _find_abi_path() -> Path | None:
    """
    Find <repo_root>/abi/DisasterFund.json by walking up parent folders.
    Your repo has: E:\\Disaster_Relief_Dapp\\abi\\DisasterFund.json
    """
    here = Path(__file__).resolve()
    for p in here.parents:
        candidate = p / "abi" / "DisasterFund.json"
        if candidate.exists():
            return candidate
    return None

ABI_PATH = _find_abi_path()
CONTRACT_ABI = []
if ABI_PATH:
    artifact = json.loads(ABI_PATH.read_text(encoding="utf-8"))
    CONTRACT_ABI = artifact.get("abi", [])

class Web3Service:
    def __init__(self, rpc_url: str, private_key: str, chain_id: int):
        if not rpc_url:
            raise ValueError("RPC_URL is missing")
        if not private_key:
            raise ValueError("DEPLOYER_PRIVATE_KEY is missing")

        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise RuntimeError("Cannot connect to RPC_URL")

        self.chain_id = int(chain_id)
        self.account = Account.from_key(private_key)

    def _contract(self):
        if not DISASTER_FUND_ADDRESS:
            raise ValueError("DISASTER_FUND_ADDRESS is missing")
        if not CONTRACT_ABI:
            raise ValueError(
                "Contract ABI not found. Expected abi/DisasterFund.json at repo root. "
                f"ABI_PATH tried: {ABI_PATH}"
            )
        return self.w3.eth.contract(
            address=Web3.to_checksum_address(DISASTER_FUND_ADDRESS),
            abi=CONTRACT_ABI,
        )

    def create_campaign(self, title: str, description: str, goal_eth: float) -> tuple[str, int | None]:
        contract = self._contract()

        goal_wei = self.w3.to_wei(goal_eth, "ether")
        nonce = self.w3.eth.get_transaction_count(self.account.address)

        tx = contract.functions.createCampaign(title, description, goal_wei).build_transaction({
            "from": self.account.address,
            "nonce": nonce,
            "chainId": self.chain_id,
            "gas": 300000,
            "gasPrice": self.w3.eth.gas_price,
        })

        signed = self.account.sign_transaction(tx)

        raw = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction")
        tx_hash = self.w3.eth.send_raw_transaction(raw)
        tx_hex = self.w3.to_hex(tx_hash)

        # wait for receipt and try to parse CampaignCreated event to get on-chain campaignId
        try:
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            # Try to extract event using contract.events if available
            onchain_id = None
            try:
                # web3.py exposes event classes under contract.events
                events = contract.events.CampaignCreated().processReceipt(receipt)
                if events and len(events) > 0:
                    ev = events[0]
                    # campaignId may be in args or returnValues depending on web3 version
                    args = getattr(ev, "args", None) or ev.get("args") or ev.get("returnValues")
                    if args:
                        # args may be a dict-like with 'campaignId'
                        cid = args.get("campaignId") if isinstance(args, dict) else None
                        if cid is None:
                            # try attribute access
                            cid = getattr(args, "campaignId", None)
                        if cid is not None:
                            onchain_id = int(cid)
            except Exception:
                # Fallback: try to parse logs manually via ABI
                try:
                    # decode logs using contract.events if available
                    evt_abi = None
                    for a in CONTRACT_ABI:
                        if a.get("type") == "event" and a.get("name") == "CampaignCreated":
                            evt_abi = a
                            break
                    if evt_abi:
                        # use Web3 codec to get event data
                        from eth_abi import decode_abi
                        # Simpler approach: rely on contract.events to process receipt; if unavailable, skip
                        pass
                except Exception:
                    pass

            return tx_hex, onchain_id
        except Exception:
            # If waiting or parsing failed, return tx hash with None onchain id
            return tx_hex, None

def make_service():
    return Web3Service(rpc_url=RPC_URL, private_key=DEPLOYER_PRIVATE_KEY, chain_id=CHAIN_ID)
