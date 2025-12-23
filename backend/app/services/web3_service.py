import json
import logging
from pathlib import Path
from web3 import Web3
from eth_account import Account

from ..config import RPC_URL, DEPLOYER_PRIVATE_KEY, CHAIN_ID, DISASTER_FUND_ADDRESS

logger = logging.getLogger("uvicorn.error")

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
                            logging.getLogger("uvicorn.error").info(f"Parsed onchain_id from event: {onchain_id}")
            except Exception as e:
                logging.getLogger("uvicorn.error").warning(f"Failed to parse event: {e}")
                # Fallback: get from campaignCount
                try:
                    # The campaignCount after creation is the onchain_id
                    onchain_id = contract.functions.campaignCount().call()
                    logging.getLogger("uvicorn.error").info(f"Got onchain_id from campaignCount: {onchain_id}")
                except Exception as e2:
                    logging.getLogger("uvicorn.error").error(f"Failed to get campaignCount: {e2}")

            # If still None, try fallback: get campaignCount
            if onchain_id is None:
                try:
                    onchain_id = contract.functions.campaignCount().call()
                    logging.getLogger("uvicorn.error").info(f"Fallback: Got onchain_id from campaignCount: {onchain_id}")
                except Exception as e:
                    logging.getLogger("uvicorn.error").error(f"Fallback failed to get campaignCount: {e}")

            return tx_hex, onchain_id
        except Exception as e:
            logging.getLogger("uvicorn.error").error(f"Error waiting for receipt or parsing: {e}")
            # If waiting or parsing failed, return tx hash with None onchain id
            return tx_hex, None

    def get_donation_events(self, campaign_onchain_id: int, from_block: int = 0) -> list[dict]:
        """
        Lấy tất cả DonationReceived events cho một campaign
        
        Returns:
            List of dicts với keys: campaignId, donor, amount, tx_hash, block_number, timestamp
        """
        contract = self._contract()
        
        # Lấy event ABI cho DonationReceived
        donation_event_abi = next(
            (abi for abi in CONTRACT_ABI if abi.get('name') == 'DonationReceived' and abi.get('type') == 'event'),
            None
        )
        if not donation_event_abi:
            raise ValueError("DonationReceived event ABI not found")
        
        # Tính toán topic hash cho DonationReceived
        # Đảm bảo có prefix 0x
        event_signature_hash = self.w3.keccak(text="DonationReceived(uint256,address,uint256)")
        event_signature_hash_hex = self.w3.to_hex(event_signature_hash)

        try:
            # Lấy block number hiện tại
            latest_block = self.w3.eth.block_number
            # Giới hạn range để tránh lỗi RPC node
            _from_block = max(0, latest_block - 40000)  # Query 40,000 blocks ngược về

            logging.getLogger("uvicorn.error").info(f"Querying donation events for campaign onchain_id={campaign_onchain_id}, from_block={_from_block}")
            
            # Query tất cả DonationReceived events trước (không filter campaignId)
            # Sau đó filter trong code để tránh lỗi format topic
            logs = self.w3.eth.get_logs({
                "fromBlock": _from_block,
                "toBlock": "latest",
                "address": Web3.to_checksum_address(DISASTER_FUND_ADDRESS),
                "topics": [
                    event_signature_hash_hex,  # Chỉ filter theo event signature (có prefix 0x)
                ]
            })
            
            logging.getLogger("uvicorn.error").info(f"Found {len(logs)} total DonationReceived events")
            
            donations = []
            for log in logs:
                try:
                    # Decode log entry
                    from web3._utils.events import get_event_data
                    event_data = get_event_data(self.w3.codec, donation_event_abi, log)
                    
                    # Filter theo campaignId trong code
                    event_campaign_id = event_data['args']['campaignId']
                    if event_campaign_id != campaign_onchain_id:
                        continue  # Skip events không phải cho campaign này
                    
                    # Get transaction details để lấy timestamp
                    block = self.w3.eth.get_block(event_data['blockNumber'])
                    
                    donations.append({
                        'campaignId': event_campaign_id,
                        'donor': event_data['args']['donor'],
                        'amount': event_data['args']['amount'],  # wei
                        'amount_eth': float(self.w3.from_wei(event_data['args']['amount'], 'ether')),  # ETH
                        'tx_hash': event_data['transactionHash'].hex(),
                        'block_number': event_data['blockNumber'],
                        'timestamp': block['timestamp']
                    })
                except Exception as e:
                    logging.getLogger("uvicorn.error").warning(f"Failed to decode log {log.get('transactionHash', 'unknown')}: {e}")
                    continue
            
            logging.getLogger("uvicorn.error").info(f"Filtered to {len(donations)} donations for campaign onchain_id={campaign_onchain_id}")
            
            return donations
        except Exception as e:
            logging.getLogger("uvicorn.error").error(f"Error getting donation events: {e}")
            return []

    def withdraw(self, campaign_onchain_id: int, amount_eth: float) -> str:
        """
        Rút tiền từ campaign (server-signed)
        
        Args:
            campaign_onchain_id: On-chain campaign ID
            amount_eth: Số tiền muốn rút (ETH)
        
        Returns:
            Transaction hash
        """
        contract = self._contract()
        
        amount_wei = self.w3.to_wei(amount_eth, "ether")
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        
        tx = contract.functions.withdraw(campaign_onchain_id, amount_wei).build_transaction({
            "from": self.account.address,
            "nonce": nonce,
            "chainId": self.chain_id,
            "gas": 200000,
            "gasPrice": self.w3.eth.gas_price,
        })
        
        signed = self.account.sign_transaction(tx)
        raw = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction")
        tx_hash = self.w3.eth.send_raw_transaction(raw)
        tx_hex = self.w3.to_hex(tx_hash)
        
        # Wait for receipt
        try:
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            logging.getLogger("uvicorn.error").info(f"Withdraw successful: campaign_id={campaign_onchain_id}, amount={amount_eth} ETH, tx={tx_hex}")
        except Exception as e:
            logging.getLogger("uvicorn.error").warning(f"Withdraw tx sent but receipt wait failed: {e}")
        
        return tx_hex

    def set_active(self, campaign_onchain_id: int, active: bool) -> str:
        """
        Bật/tắt campaign (server-signed)
        
        Args:
            campaign_onchain_id: On-chain campaign ID
            active: True để bật, False để tắt
        
        Returns:
            Transaction hash
        """
        contract = self._contract()
        
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        
        tx = contract.functions.setActive(campaign_onchain_id, active).build_transaction({
            "from": self.account.address,
            "nonce": nonce,
            "chainId": self.chain_id,
            "gas": 100000,
            "gasPrice": self.w3.eth.gas_price,
        })
        
        signed = self.account.sign_transaction(tx)
        raw = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction")
        tx_hash = self.w3.eth.send_raw_transaction(raw)
        tx_hex = self.w3.to_hex(tx_hash)
        
        # Wait for receipt
        try:
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            logging.getLogger("uvicorn.error").info(f"SetActive successful: campaign_id={campaign_onchain_id}, active={active}, tx={tx_hex}")
        except Exception as e:
            logging.getLogger("uvicorn.error").warning(f"SetActive tx sent but receipt wait failed: {e}")
        
        return tx_hex

    def get_campaign_onchain(self, campaign_onchain_id: int) -> dict:
        """
        Lấy thông tin campaign từ blockchain
        
        Returns:
            Dict với keys: owner, title, description, goal, raised, withdrawn, active
        """
        contract = self._contract()
        try:
            result = contract.functions.getCampaign(campaign_onchain_id).call()
            return {
                "owner": result[0],
                "title": result[1],
                "description": result[2],
                "goal": float(self.w3.from_wei(result[3], "ether")),
                "raised": float(self.w3.from_wei(result[4], "ether")),
                "withdrawn": float(self.w3.from_wei(result[5], "ether")),
                "active": result[6],
            }
        except Exception as e:
            logging.getLogger("uvicorn.error").error(f"Error getting campaign onchain: {e}")
            raise

    def get_withdraw_events(self, campaign_onchain_id: int, from_block: int = 0) -> list[dict]:
        """
        Lấy tất cả FundsWithdrawn events cho một campaign
        
        Returns:
            List of dicts với keys: campaignId, owner, amount, tx_hash, block_number, timestamp
        """
        contract = self._contract()
        
        # Lấy event ABI cho FundsWithdrawn
        withdraw_event_abi = next(
            (abi for abi in CONTRACT_ABI if abi.get('name') == 'FundsWithdrawn' and abi.get('type') == 'event'),
            None
        )
        if not withdraw_event_abi:
            raise ValueError("FundsWithdrawn event ABI not found")
        
        # Tính toán topic hash cho FundsWithdrawn
        event_signature_hash = self.w3.keccak(text="FundsWithdrawn(uint256,address,uint256)")
        event_signature_hash_hex = self.w3.to_hex(event_signature_hash)

        try:
            # Lấy block number hiện tại
            latest_block = self.w3.eth.block_number
            # Giới hạn range để tránh lỗi RPC node
            _from_block = max(0, latest_block - 40000)  # Query 40,000 blocks ngược về

            logging.getLogger("uvicorn.error").info(f"Querying withdraw events for campaign onchain_id={campaign_onchain_id}, from_block={_from_block}")
            
            # Query tất cả FundsWithdrawn events trước (không filter campaignId)
            logs = self.w3.eth.get_logs({
                "fromBlock": _from_block,
                "toBlock": "latest",
                "address": Web3.to_checksum_address(DISASTER_FUND_ADDRESS),
                "topics": [
                    event_signature_hash_hex,  # Chỉ filter theo event signature
                ]
            })
            
            logging.getLogger("uvicorn.error").info(f"Found {len(logs)} total FundsWithdrawn events")
            
            withdraws = []
            for log in logs:
                try:
                    # Decode log entry
                    from web3._utils.events import get_event_data
                    event_data = get_event_data(self.w3.codec, withdraw_event_abi, log)
                    
                    # Filter theo campaignId trong code
                    event_campaign_id = event_data['args']['campaignId']
                    if event_campaign_id != campaign_onchain_id:
                        continue  # Skip events không phải cho campaign này
                    
                    # Get transaction details để lấy timestamp
                    block = self.w3.eth.get_block(event_data['blockNumber'])
                    
                    # Ensure tx_hash has 0x prefix - use w3.to_hex() to normalize
                    tx_hash_raw = event_data['transactionHash']
                    tx_hash = self.w3.to_hex(tx_hash_raw)
                    
                    withdraws.append({
                        'campaignId': event_campaign_id,
                        'owner': event_data['args']['owner'],
                        'amount': event_data['args']['amount'],  # wei
                        'amount_eth': float(self.w3.from_wei(event_data['args']['amount'], 'ether')),  # ETH
                        'tx_hash': tx_hash,
                        'block_number': event_data['blockNumber'],
                        'timestamp': block['timestamp']
                    })
                except Exception as e:
                    logging.getLogger("uvicorn.error").warning(f"Failed to decode withdraw log {log.get('transactionHash', 'unknown')}: {e}")
                    continue
            
            logging.getLogger("uvicorn.error").info(f"Filtered to {len(withdraws)} withdraws for campaign onchain_id={campaign_onchain_id}")
            
            return withdraws
        except Exception as e:
            logging.getLogger("uvicorn.error").error(f"Error getting withdraw events: {e}")
            return []

def make_service():
    return Web3Service(rpc_url=RPC_URL, private_key=DEPLOYER_PRIVATE_KEY, chain_id=CHAIN_ID)
