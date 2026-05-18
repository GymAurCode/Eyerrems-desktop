"""Commission calculation and dealer context helpers."""
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models.crm import Deal, Dealer
from app.models.property import Property


def calculate_commission_amount(
    sale_amount: Decimal,
    commission_type: str,
    commission_rate: Decimal | None,
) -> Decimal:
    if sale_amount <= 0:
        return Decimal("0")
    rate = commission_rate or Decimal("0")
    if commission_type == "percentage":
        return (sale_amount * rate / Decimal("100")).quantize(Decimal("0.01"))
    return rate.quantize(Decimal("0.01"))


def get_dealer_context(db: Session, dealer_id: int) -> dict:
    dealer = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not dealer:
        return None

    deals = (
        db.query(Deal)
        .options(joinedload(Deal.client))
        .filter(Deal.dealer_id == dealer_id)
        .order_by(Deal.created_at.desc())
        .limit(100)
        .all()
    )

    property_ids = {d.property_id for d in deals if d.property_id}
    props_by_id: dict[int, Property] = {}
    if property_ids:
        for p in db.query(Property).filter(Property.id.in_(property_ids)).all():
            props_by_id[p.id] = p

    properties = []
    seen = set()
    for d in deals:
        if d.property_id and d.property_id not in seen:
            seen.add(d.property_id)
            p = props_by_id.get(d.property_id)
            if p:
                properties.append({
                    "id": p.id,
                    "code": p.tid,
                    "name": p.name,
                    "sale_price": float(p.sale_price) if p.sale_price else None,
                    "status": p.status,
                })

    return {
        "dealer": {
            "id": dealer.id,
            "dealer_id": dealer.dealer_id,
            "name": dealer.name,
            "phone": dealer.phone,
            "email": dealer.email,
            "company": dealer.company,
            "commission_type": dealer.commission_type,
            "commission_rate": float(dealer.commission_rate) if dealer.commission_rate else None,
        },
        "properties": properties,
        "deals": [
            {
                "id": d.id,
                "deal_id": d.deal_id,
                "deal_title": d.deal_title,
                "client_name": d.client.name if d.client else None,
                "property_id": d.property_id,
                "property_name": props_by_id[d.property_id].name if d.property_id and d.property_id in props_by_id else None,
                "deal_value": float(d.deal_value),
                "status": d.status,
            }
            for d in deals
        ],
    }
