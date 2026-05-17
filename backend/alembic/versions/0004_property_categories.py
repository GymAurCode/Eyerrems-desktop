"""Property categories table and category_id FK on properties"""

from alembic import op
import sqlalchemy as sa

revision = "0004_property_categories"
down_revision = "0003_property_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "property_categories",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("name",       sa.String(120),  nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(),   server_default=sa.text("now()"), nullable=False),
    )

    # Add category_id FK (nullable so existing rows are unaffected)
    op.add_column(
        "properties",
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("property_categories.id"), nullable=True),
    )

    # Seed common categories
    conn = op.get_bind()
    for name in ["Residential", "Commercial", "Industrial", "Mixed Use", "Land", "Retail"]:
        conn.execute(
            sa.text("INSERT INTO property_categories (name, created_at) VALUES (:name, now())"),
            {"name": name},
        )


def downgrade() -> None:
    op.drop_column("properties", "category_id")
    op.drop_table("property_categories")
