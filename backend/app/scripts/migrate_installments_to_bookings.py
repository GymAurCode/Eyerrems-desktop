"""
Data migration: re-link InstallmentPlans from deals → bookings.

Run AFTER alembic upgrade 0023 and BEFORE making booking_id NOT NULL.

Strategy:
  For each InstallmentPlan that has a deal_id:
    1. Find the Deal
    2. Find a Booking that was converted from that Deal
       (booking.deal_id == deal.id  OR  booking was created via convert_to_sale
        which set booking.status = 'converted_to_sale' and deal matches)
    3. If found → set installment_plan.booking_id = booking.id
    4. If not found → create a stub Booking from the Deal's data so no data is lost

Usage:
    cd backend
    python -m app.scripts.migrate_installments_to_bookings
"""
import sys
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import text

from app.core.database import SessionLocal
from app.models.crm import Deal, InstallmentPlan, Client
from app.models.booking import Booking, BookingLog


def run():
    db = SessionLocal()
    migrated = 0
    stubs_created = 0
    skipped = 0

    try:
        plans = db.query(InstallmentPlan).filter(
            InstallmentPlan.booking_id.is_(None)
        ).all()

        print(f"Found {len(plans)} installment plans to migrate.")

        for plan in plans:
            # Plans already migrated or without deal_id
            if not hasattr(plan, 'deal_id') or plan.deal_id is None:
                skipped += 1
                continue

            deal = db.query(Deal).filter(Deal.id == plan.deal_id).first()
            if not deal:
                print(f"  WARN: Plan {plan.id} references missing deal {plan.deal_id} — skipping")
                skipped += 1
                continue

            # Try to find an existing booking linked to this deal
            booking = db.query(Booking).filter(
                Booking.deal_id == deal.id
            ).first()

            if not booking:
                # Try legacy: booking created via old convert_to_sale
                # (old system set booking.status = 'converted_to_sale' and
                #  matched by client + property/unit)
                booking = db.query(Booking).filter(
                    Booking.client_id == deal.client_id,
                    Booking.status == "converted_to_sale",
                ).order_by(Booking.created_at.desc()).first()

            if not booking:
                # Create a stub booking to preserve the financial data
                print(f"  Creating stub booking for deal {deal.deal_id} (plan {plan.id})")
                count = db.query(Booking).count()
                booking = Booking(
                    booking_id=f"BKG-MIG-{count + 1:04d}",
                    deal_id=deal.id,
                    client_id=deal.client_id,
                    property_id=deal.property_id,
                    unit_id=deal.unit_id,
                    property_price=deal.deal_value,
                    final_price=deal.deal_value,
                    booking_amount=Decimal(str(plan.down_payment or 0)),
                    down_payment=Decimal(str(plan.down_payment or 0)),
                    down_payment_status=plan.down_payment_status,
                    booking_date=deal.deal_date or deal.created_at,
                    expiry_date=datetime.utcnow() + timedelta(days=3650),  # 10yr — stub
                    holding_days=7,
                    status="active",  # migrated bookings are active
                    notes=f"[MIGRATED] From deal {deal.deal_id}",
                    active_at=deal.created_at,
                )
                db.add(booking)
                db.flush()

                db.add(BookingLog(
                    booking_id=booking.id,
                    action="migrated",
                    new_value="active",
                    notes=f"Auto-created during installment migration from deal {deal.deal_id}",
                ))
                stubs_created += 1

            # Link the plan
            plan.booking_id = booking.id
            migrated += 1
            print(f"  Plan {plan.id} → Booking {booking.booking_id} ✓")

        db.commit()
        print(f"\nMigration complete:")
        print(f"  {migrated} plans linked to bookings")
        print(f"  {stubs_created} stub bookings created")
        print(f"  {skipped} plans skipped")
        print("\nNext steps:")
        print("  1. Verify data in installment_plans.booking_id")
        print("  2. Run: ALTER TABLE installment_plans ALTER COLUMN booking_id SET NOT NULL;")
        print("  3. Optionally drop deal_id from installment_plans after verification")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
