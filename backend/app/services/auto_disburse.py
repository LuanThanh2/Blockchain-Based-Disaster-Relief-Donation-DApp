"""
Background job để tự động rút tiền khi campaign đạt threshold
"""
import logging
import time
import threading
from sqlmodel import Session, select
from sqlalchemy import func
from ..database import engine
from ..models import Campaign, WithdrawLog, AuditLog
from ..crud import get_campaign_stats, create_withdraw_log, create_audit_log, get_campaign
from ..services.web3_service import make_service
from datetime import datetime

logger = logging.getLogger("uvicorn.error")


def auto_disburse_job(poll_interval: int = 60):
    """
    Background job: Kiểm tra campaigns có auto_disburse=True
    và tự động rút tiền khi đạt threshold
    """
    logger.info("Starting auto-disburse background job")
    
    while True:
        try:
            with Session(engine) as db:
                # Lấy tất cả campaigns có auto_disburse=True và status=active
                campaigns = db.exec(
                    select(Campaign)
                    .where(Campaign.auto_disburse == True)
                    .where(Campaign.status == "active")
                    .where(Campaign.onchain_id.isnot(None))
                ).all()
                
                for campaign in campaigns:
                    try:
                        # Lấy stats
                        stats = get_campaign_stats(db, campaign.id)
                        total_raised = stats["total_raised"] or 0.0
                        
                        # Tính threshold
                        threshold_amount = campaign.target_amount * campaign.disburse_threshold
                        
                        # Kiểm tra nếu đã đạt threshold
                        if total_raised >= threshold_amount:
                            # Kiểm tra xem đã rút chưa (tránh rút nhiều lần)
                            # Lấy tổng đã rút
                            total_withdrawn = db.exec(
                                select(func.sum(WithdrawLog.amount_eth))
                                .where(WithdrawLog.campaign_id == campaign.id)
                            ).first() or 0.0
                            
                            available = total_raised - total_withdrawn
                            
                            # Nếu còn tiền để rút và chưa rút hết
                            if available > 0.01:  # Tối thiểu 0.01 ETH
                                logger.info(
                                    f"Auto-disburse triggered for campaign {campaign.id}: "
                                    f"raised={total_raised}, threshold={threshold_amount}, available={available}"
                                )
                                
                                try:
                                    svc = make_service()
                                    # Rút toàn bộ số tiền available
                                    tx_hash = svc.withdraw(campaign.onchain_id, available)
                                    
                                    # Lấy withdraw event để lưu log
                                    withdraw_events = svc.get_withdraw_events(campaign.onchain_id)
                                    latest_withdraw = withdraw_events[0] if withdraw_events else None
                                    
                                    if latest_withdraw:
                                        withdraw_log = WithdrawLog(
                                            campaign_id=campaign.id,
                                            onchain_campaign_id=campaign.onchain_id,
                                            owner_address=latest_withdraw['owner'],
                                            amount_eth=latest_withdraw['amount_eth'],
                                            amount_wei=str(latest_withdraw['amount']),
                                            tx_hash=latest_withdraw['tx_hash'],
                                            block_number=latest_withdraw['block_number'],
                                            timestamp=datetime.fromtimestamp(latest_withdraw['timestamp']),
                                        )
                                        create_withdraw_log(db, withdraw_log=withdraw_log)
                                    
                                    # Audit log
                                    audit = AuditLog(
                                        action="auto_disburse",
                                        username="system",
                                        details=f"campaign_id={campaign.id}, amount={available} ETH, tx={tx_hash}"
                                    )
                                    create_audit_log(db, audit_log=audit)
                                    
                                    logger.info(f"Auto-disburse successful: campaign {campaign.id}, tx={tx_hash}")
                                    
                                except Exception as e:
                                    logger.exception(f"Auto-disburse failed for campaign {campaign.id}: {e}")
                                    
                    except Exception as e:
                        logger.exception(f"Error processing campaign {campaign.id} for auto-disburse: {e}")
                        continue
                        
        except Exception as e:
            logger.exception(f"Auto-disburse job error: {e}")
        
        time.sleep(poll_interval)


def start_auto_disburse_thread(poll_interval: int = 60):
    """Start auto-disburse job in background thread"""
    t = threading.Thread(target=auto_disburse_job, args=(poll_interval,), daemon=True)
    t.start()
    logger.info("Auto-disburse background thread started")

