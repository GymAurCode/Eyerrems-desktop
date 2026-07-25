import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text as sa_text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import hash_password
from app.models.auth import User

router = APIRouter(prefix="/users", tags=["users"])
log = logging.getLogger("rems.users")


@router.get("")
def list_users(
    status: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = ["u.id IS NOT NULL"]
    params: dict = {}

    if status:
        conditions.append("u.status = :status")
        params["status"] = status
    if search:
        conditions.append("(u.full_name ILIKE :search OR u.email ILIKE :search)")
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions)

    rows = db.execute(
        sa_text(f"""
            SELECT u.id, u.email, u.full_name, u.status, u.is_active, u.is_approved,
                   u.created_at, u.approved_by, u.approved_at, u.company_id
            FROM users u
            WHERE {where}
            ORDER BY u.created_at DESC
            LIMIT :lim OFFSET :off
        """),
        {**params, "lim": limit, "off": skip},
    ).fetchall()

    result = []
    for r in rows:
        created_by = None
        if r[7]:
            cb = db.execute(
                sa_text("SELECT full_name, email FROM users WHERE id = :id"),
                {"id": r[7]},
            ).fetchone()
            if cb:
                created_by = {"id": r[7], "name": cb[0], "email": cb[1]}

        result.append({
            "id": r[0],
            "email": r[1],
            "full_name": r[2],
            "status": r[3],
            "is_active": r[4],
            "is_approved": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "created_by": created_by,
            "approved_by": r[7],
            "approved_at": r[8].isoformat() if r[8] else None,
        })

    return result


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    full_name = (body.get("full_name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or body.get("temp_password")
    send_invite = body.get("send_invite", False)

    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not password and not send_invite:
        raise HTTPException(status_code=400, detail="Password or send_invite flag is required")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    pw_hash = hash_password(password) if password else ""

    auto_approve = False
    if current_user.company_id:
        try:
            row = db.execute(
                sa_text("SELECT auto_approve_admin_created FROM companies WHERE id = :cid"),
                {"cid": current_user.company_id},
            ).fetchone()
            if row and row[0]:
                auto_approve = True
        except Exception:
            db.rollback()

    initial_status = "active" if auto_approve else "pending"

    now = datetime.utcnow()
    db.execute(
        sa_text("""
            INSERT INTO users (email, full_name, hashed_password, company_id,
                               is_super_admin, status, is_approved, is_active,
                               approval_status, created_at, approved_by, approved_at)
            VALUES (:email, :name, :pw, :cid, FALSE, :status, :approved, TRUE,
                    :approval_status, :now, :appr_by, :appr_at)
        """),
        {
            "email": email, "name": full_name, "pw": pw_hash,
            "cid": current_user.company_id,
            "status": initial_status,
            "approved": auto_approve,
            "approval_status": initial_status,
            "now": now,
            "appr_by": current_user.id if auto_approve else None,
            "appr_at": now if auto_approve else None,
        },
    )
    db.commit()

    return {
        "id": None,
        "email": email,
        "full_name": full_name,
        "status": initial_status,
        "is_approved": auto_approve,
        "is_active": True,
    }


@router.put("/{user_id}")
def update_user(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if "full_name" in body:
        user.full_name = body["full_name"].strip()
    if "email" in body:
        user.email = body["email"].strip().lower()
    if "password" in body and body["password"]:
        user.hashed_password = hash_password(body["password"])

    db.flush()
    db.commit()

    return {"ok": True, "message": "User updated"}


@router.put("/{user_id}/suspend")
def suspend_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.status = "suspended"
    user.is_active = False
    user.is_approved = False

    db.flush()
    db.commit()
    return {"ok": True, "message": "User suspended"}


@router.put("/{user_id}/reactivate")
def reactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.status = "active"
    user.is_active = True
    user.is_approved = True

    db.flush()
    db.commit()
    return {"ok": True, "message": "User reactivated"}


@router.get("/pending")
def list_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.execute(
        sa_text("""
            SELECT u.id, u.email, u.full_name, u.status, u.created_at,
                   u.approved_by, u.approved_at, u.company_id
            FROM users u
            WHERE u.status = 'pending'
            ORDER BY u.created_at ASC
        """),
    ).fetchall()

    result = []
    for r in rows:
        created_by = None
        if r[5]:
            cb = db.execute(
                sa_text("SELECT full_name, email FROM users WHERE id = :id"),
                {"id": r[5]},
            ).fetchone()
            if cb:
                created_by = {"id": r[5], "name": cb[0], "email": cb[1]}

        result.append({
            "id": r[0],
            "email": r[1],
            "full_name": r[2],
            "status": r[3],
            "created_at": r[4].isoformat() if r[4] else None,
            "created_by": created_by,
        })

    return result


@router.post("/{user_id}/approve")
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.status != "pending":
        raise HTTPException(status_code=400, detail=f"User is not pending (current status: {user.status})")

    now = datetime.utcnow()
    user.status = "active"
    user.is_approved = True
    user.is_active = True
    user.approval_status = "approved"
    user.approved_by = current_user.id
    user.approved_at = now

    db.flush()
    db.commit()

    return {"ok": True, "message": "User approved and activated"}


@router.post("/{user_id}/reject")
def reject_user(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.status != "pending":
        raise HTTPException(status_code=400, detail=f"User is not pending (current status: {user.status})")

    reason = (body.get("reason") or "").strip()

    user.status = "rejected"
    user.is_approved = False
    user.is_active = False
    user.approval_status = "rejected"

    db.flush()
    db.commit()

    return {"ok": True, "message": "User rejected"}
