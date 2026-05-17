"""
Duplicate Detection Engine.

Uses string similarity (Levenshtein / Jaro-Winkler approximation) to find
near-duplicate records across:
  - tenants   (name + phone + cnic)
  - clients   (name + phone + cnic)
  - properties (name + address)

No external library required — uses a pure-Python similarity function.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.ai_intelligence import AIDuplicateMatch
from app.models.crm import Client
from app.models.property import Property
from app.models.tenant import Tenant

log = logging.getLogger("rems.ai.duplicate")


# ── String similarity ─────────────────────────────────────────────────────────

def _normalize(s: Optional[str]) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s.strip().lower())


def _similarity(a: str, b: str) -> float:
    """Simple character-level Jaccard similarity on bigrams."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0

    def bigrams(s: str) -> set[str]:
        return {s[i:i+2] for i in range(len(s) - 1)}

    bg_a = bigrams(a)
    bg_b = bigrams(b)
    if not bg_a or not bg_b:
        return 0.0
    intersection = len(bg_a & bg_b)
    union = len(bg_a | bg_b)
    return intersection / union if union else 0.0


def _field_similarity(a: Optional[str], b: Optional[str]) -> float:
    return _similarity(_normalize(a), _normalize(b))


def _phone_match(a: Optional[str], b: Optional[str]) -> bool:
    """Exact match after stripping non-digits."""
    if not a or not b:
        return False
    da = re.sub(r"\D", "", a)
    db_ = re.sub(r"\D", "", b)
    return bool(da and db_ and da == db_)


def _cnic_match(a: Optional[str], b: Optional[str]) -> bool:
    if not a or not b:
        return False
    da = re.sub(r"\D", "", a)
    db_ = re.sub(r"\D", "", b)
    return bool(da and db_ and len(da) >= 10 and da == db_)


# ── Save duplicate match ──────────────────────────────────────────────────────

def _save_match(
    db: Session,
    company_id: int,
    entity_type: str,
    id_a: int,
    id_b: int,
    confidence: float,
    match_fields: list[str],
) -> None:
    # Avoid duplicate of the duplicate
    existing = db.query(AIDuplicateMatch).filter(
        AIDuplicateMatch.company_id  == company_id,
        AIDuplicateMatch.entity_type == entity_type,
        AIDuplicateMatch.entity_id_a == min(id_a, id_b),
        AIDuplicateMatch.entity_id_b == max(id_a, id_b),
    ).first()
    if existing:
        return

    match = AIDuplicateMatch(
        company_id   = company_id,
        entity_type  = entity_type,
        entity_id_a  = min(id_a, id_b),
        entity_id_b  = max(id_a, id_b),
        confidence   = round(confidence, 3),
        match_fields = json.dumps(match_fields),
        status       = "pending",
        created_at   = datetime.utcnow(),
    )
    db.add(match)


# ── Tenant duplicates ─────────────────────────────────────────────────────────

def detect_tenant_duplicates(db: Session, company_id: int, threshold: float = 0.75) -> int:
    try:
        tenants = db.query(Tenant).all()
        count = 0

        for i in range(len(tenants)):
            for j in range(i + 1, len(tenants)):
                a, b = tenants[i], tenants[j]
                matched_fields: list[str] = []
                scores: list[float] = []

                # Phone exact match — strong signal
                if _phone_match(a.phone, b.phone):
                    matched_fields.append("phone")
                    scores.append(0.9)

                # CNIC exact match — very strong
                if _cnic_match(getattr(a, "cnic", None), getattr(b, "cnic", None)):
                    matched_fields.append("cnic")
                    scores.append(0.95)

                # Name similarity
                name_sim = _field_similarity(a.name, b.name)
                if name_sim >= 0.7:
                    matched_fields.append("name")
                    scores.append(name_sim)

                if not scores:
                    continue

                confidence = min(1.0, sum(scores) / len(scores) + (0.1 * (len(scores) - 1)))
                if confidence >= threshold:
                    _save_match(db, company_id, "tenant", a.id, b.id, confidence, matched_fields)
                    count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        log.warning("detect_tenant_duplicates failed: %s", exc)
        db.rollback()
        return 0


# ── Client duplicates ─────────────────────────────────────────────────────────

def detect_client_duplicates(db: Session, company_id: int, threshold: float = 0.75) -> int:
    try:
        clients = db.query(Client).all()
        count = 0

        for i in range(len(clients)):
            for j in range(i + 1, len(clients)):
                a, b = clients[i], clients[j]
                matched_fields: list[str] = []
                scores: list[float] = []

                if _phone_match(a.phone, b.phone):
                    matched_fields.append("phone")
                    scores.append(0.9)

                if _cnic_match(a.cnic, b.cnic):
                    matched_fields.append("cnic")
                    scores.append(0.95)

                name_sim = _field_similarity(a.name, b.name)
                if name_sim >= 0.7:
                    matched_fields.append("name")
                    scores.append(name_sim)

                email_sim = _field_similarity(a.email, b.email)
                if email_sim >= 0.9 and a.email:
                    matched_fields.append("email")
                    scores.append(email_sim)

                if not scores:
                    continue

                confidence = min(1.0, sum(scores) / len(scores) + (0.1 * (len(scores) - 1)))
                if confidence >= threshold:
                    _save_match(db, company_id, "client", a.id, b.id, confidence, matched_fields)
                    count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        log.warning("detect_client_duplicates failed: %s", exc)
        db.rollback()
        return 0


# ── Property duplicates ───────────────────────────────────────────────────────

def detect_property_duplicates(db: Session, company_id: int, threshold: float = 0.80) -> int:
    try:
        properties = db.query(Property).all()
        count = 0

        for i in range(len(properties)):
            for j in range(i + 1, len(properties)):
                a, b = properties[i], properties[j]
                matched_fields: list[str] = []
                scores: list[float] = []

                name_sim = _field_similarity(a.name, b.name)
                if name_sim >= 0.8:
                    matched_fields.append("name")
                    scores.append(name_sim)

                addr_a = getattr(a, "address", None) or getattr(a, "location", None)
                addr_b = getattr(b, "address", None) or getattr(b, "location", None)
                if addr_a and addr_b:
                    addr_sim = _field_similarity(str(addr_a), str(addr_b))
                    if addr_sim >= 0.75:
                        matched_fields.append("address")
                        scores.append(addr_sim)

                if not scores:
                    continue

                confidence = min(1.0, sum(scores) / len(scores))
                if confidence >= threshold:
                    _save_match(db, company_id, "property", a.id, b.id, confidence, matched_fields)
                    count += 1

        if count:
            db.commit()
        return count

    except Exception as exc:
        log.warning("detect_property_duplicates failed: %s", exc)
        db.rollback()
        return 0


def run_all_duplicate_checks(db: Session, company_id: int) -> dict[str, int]:
    return {
        "tenants":    detect_tenant_duplicates(db, company_id),
        "clients":    detect_client_duplicates(db, company_id),
        "properties": detect_property_duplicates(db, company_id),
    }
