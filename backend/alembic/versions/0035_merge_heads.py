"""
Alembic merge revision to resolve multiple head issue after adding 0022_fix_duplicate_indexes.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0035_merge_heads'
# This merge revision depends on both prior heads.
# Using a tuple informs Alembic that this revision follows multiple branches.
# Adjust the order if needed.

# Note: Replace the below identifiers with the actual revision IDs present in your project.
# 0022_fix_duplicate_indexes is the new corrective migration.
# 0034_commission_dealer_upgrade is the existing head.

down_revision = ('0022_fix_duplicate_indexes', '0034_commission_dealer_upgrade')
branch_labels = None
depends_on = None

def upgrade():
    # No schema changes needed; this revision simply merges the two branches.
    pass

def downgrade():
    # Downgrade is a no‑op as no changes were applied.
    pass
