from sqlmodel import Session, select
from sqlalchemy import func
from .models import Campaign, Donation, WithdrawLog, AuditLog

def create_campaign(db: Session, *, campaign: Campaign) -> Campaign:
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign

def get_campaign(db: Session, campaign_id: int) -> Campaign | None:
    return db.get(Campaign, campaign_id)

def list_campaigns(db: Session, visible_only: bool = False) -> list[Campaign]:
    """List campaigns, optionally filter by visibility"""
    query = select(Campaign)
    if visible_only:
        query = query.where(Campaign.is_visible == True)
    return list(db.exec(query.order_by(Campaign.id.desc())).all())

def update_contract_tx_hash(db: Session, campaign_id: int, tx_hash: str) -> None:
    c = db.get(Campaign, campaign_id)
    if not c:
        return
    c.contract_tx_hash = tx_hash
    db.add(c)
    db.commit()

def update_onchain_info(
    db: Session,
    campaign_id: int,
    tx_hash: str,
    onchain_id: int,
) -> None:
    c = db.get(Campaign, campaign_id)
    if not c:
        return
    c.contract_tx_hash = tx_hash
    c.onchain_id = onchain_id
    db.add(c)
    db.commit()

def create_donation(db: Session, *, donation: Donation) -> Donation:
    db.add(donation)
    db.commit()
    db.refresh(donation)
    return donation

def get_donations_by_campaign_id(db: Session, campaign_id: int, limit: int = 100) -> list[Donation]:
    return list(
        db.exec(
            select(Donation)
            .where(Donation.campaign_id == campaign_id)
            .order_by(Donation.timestamp.desc())
            .limit(limit)
        ).all()
    )

def get_donation_by_tx_hash(db: Session, tx_hash: str) -> Donation | None:
    return db.exec(select(Donation).where(Donation.tx_hash == tx_hash)).first()

def get_campaign_stats(db: Session, campaign_id: int):
    total_raised = db.exec(
        select(func.sum(Donation.amount_eth))
        .where(Donation.campaign_id == campaign_id)
    ).first() or 0.0

    donor_count = db.exec(
        select(func.count(func.distinct(Donation.donor_address)))
        .where(Donation.campaign_id == campaign_id)
    ).first() or 0

    donation_count = db.exec(
        select(func.count(Donation.id))
        .where(Donation.campaign_id == campaign_id)
    ).first() or 0
    
    return {
        "total_raised": total_raised,
        "donor_count": donor_count,
        "donation_count": donation_count,
    }

def update_campaign_status(db: Session, campaign_id: int, status: str) -> None:
    """Update campaign status (active/closed)"""
    c = db.get(Campaign, campaign_id)
    if not c:
        return
    c.status = status
    db.add(c)
    db.commit()

def update_campaign(db: Session, campaign_id: int, **kwargs) -> Campaign | None:
    """Update campaign fields"""
    c = db.get(Campaign, campaign_id)
    if not c:
        return None
    for key, value in kwargs.items():
        if hasattr(c, key):
            # Cho phép set giá trị False (boolean) và 0 (number)
            # Chỉ skip None và các giá trị không hợp lệ
            if value is not None:
                setattr(c, key, value)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

def get_donations_by_donor(db: Session, donor_address: str, limit: int = 100) -> list[Donation]:
    """Get all donations by a specific donor address (case-insensitive)"""
    # Normalize address to lowercase for comparison
    normalized_address = donor_address.lower().strip()
    return list(
        db.exec(
            select(Donation)
            .where(func.lower(Donation.donor_address) == normalized_address)
            .order_by(Donation.timestamp.desc())
            .limit(limit)
        ).all()
    )

def create_withdraw_log(db: Session, *, withdraw_log: WithdrawLog) -> WithdrawLog:
    """Create a withdraw log entry"""
    db.add(withdraw_log)
    db.commit()
    db.refresh(withdraw_log)
    return withdraw_log

def get_withdraw_logs_by_campaign(db: Session, campaign_id: int, limit: int = 100) -> list[WithdrawLog]:
    """Get withdraw logs for a campaign"""
    return list(
        db.exec(
            select(WithdrawLog)
            .where(WithdrawLog.campaign_id == campaign_id)
            .order_by(WithdrawLog.timestamp.desc())
            .limit(limit)
        ).all()
    )

def create_audit_log(db: Session, *, audit_log: AuditLog) -> AuditLog:
    """Create an audit log entry"""
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log

def get_audit_logs(db: Session, limit: int = 100, action: str | None = None, username: str | None = None) -> list[AuditLog]:
    """Get audit logs with optional filters"""
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action == action)
    if username:
        query = query.where(AuditLog.username == username)
    return list(db.exec(query.order_by(AuditLog.timestamp.desc()).limit(limit)).all())
