import json
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class FinanceOperation(Base):
    """Tracks all finance operations: REVENUE, EXPENSE, REFUND, TRANSFER, ADJUSTMENT, MERGE.
    Each operation creates a new journal — originals are NEVER modified.
    """
    __tablename__ = "finance_operations"

    id = Column(Integer, primary_key=True)
    # REVENUE | EXPENSE | REFUND | TRANSFER | ADJUSTMENT | MERGE
    type = Column(String(20), nullable=False, index=True)
    # Sub-type: e.g. rent_received, security_deposit, maintenance, salary, etc.
    sub_type = Column(String(50), nullable=True)

    # The journal created by this operation
    journal_id = Column(Integer, ForeignKey("journals.id"), nullable=False)
    # The original journal being referenced (for REFUND / MERGE)
    reference_journal_id = Column(Integer, ForeignKey("journals.id"), nullable=True)

    from_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    to_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)

    amount = Column(Numeric(12, 2), nullable=False)
    reason = Column(Text, nullable=True)
    meta = Column(Text, nullable=True)  # JSON blob for extra info

    # Entity linkage (tenant / property / account)
    entity_type = Column(String(30), nullable=True)  # tenant | property | account
    entity_id = Column(Integer, nullable=True)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    journal = relationship("Journal", foreign_keys=[journal_id])
    reference_journal = relationship("Journal", foreign_keys=[reference_journal_id])
    from_account = relationship("Account", foreign_keys=[from_account_id])
    to_account = relationship("Account", foreign_keys=[to_account_id])
    created_by = relationship("User")

    def get_meta(self) -> dict:
        if self.meta:
            try:
                return json.loads(self.meta)
            except Exception:
                return {}
        return {}
