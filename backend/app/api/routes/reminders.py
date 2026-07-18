import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.websocket_manager import ws_manager
from app.models.auth import User
from app.schemas.reminders import (
    ApplyTemplateRequest,
    BulkActionRequest,
    NotificationLogOut,
    ReminderCreate,
    ReminderDashboardOut,
    ReminderOut,
    ReminderUpdate,
    RecoveryOut,
    SchedulerStatusOut,
    SnoozeRequest,
    TemplateCreate,
    TemplateOut,
)
from app.services import reminder_service as svc
from app.services.reminder_scheduler import get_scheduler_status

router = APIRouter()
log = logging.getLogger("reminders-routes")


def _reminder_to_dict(r) -> dict:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "title": r.title,
        "description": r.description,
        "category": r.category,
        "remind_at": r.remind_at,
        "priority": r.priority,
        "repeat": r.repeat,
        "status": r.status,
        "reminder_before": r.reminder_before,
        "notification_sent": r.notification_sent,
        "snoozed_until": r.snoozed_until,
        "completed_at": r.completed_at,
        "template_id": r.template_id,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


@router.websocket("/ws")
async def reminders_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return
    user_id_str = payload.get("sub", "")
    from app.models.auth import User as UserModel
    import logging as _logging
    _log = _logging.getLogger("reminders-routes")
    user = None
    try:
        db = next(get_db())
        user = db.query(UserModel).filter(UserModel.email == user_id_str).first()
    except Exception:
        db = None
    finally:
        if db:
            db.close()
    if not user:
        await websocket.close(code=4001)
        return
    uid = user.id
    await ws_manager.connect(websocket, uid)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, uid)
    except Exception:
        await websocket.close(code=1011)
        ws_manager.disconnect(websocket, uid)


@router.get("/dashboard", response_model=ReminderDashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = svc.get_dashboard(db, current_user.id)
    return ReminderDashboardOut(
        upcoming_24h=[ReminderOut.model_validate(r) for r in data["upcoming_24h"]],
        overdue=[ReminderOut.model_validate(r) for r in data["overdue"]],
        today_total=data["today_total"],
        today_completed=data["today_completed"],
        today_pending=data["today_pending"],
    )


@router.get("/recovery", response_model=RecoveryOut)
def recovery(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.get_recovery_data(db, current_user.id)


@router.get("/scheduler-status", response_model=SchedulerStatusOut)
def scheduler_status(
    _: User = Depends(get_current_user),
):
    return get_scheduler_status()


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    filter_by: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("remind_at"),
    sort_dir: str = Query("asc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reminders = svc.list_reminders(db, current_user.id, filter_by, search, sort_by, sort_dir)
    return [ReminderOut.model_validate(r) for r in reminders]


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    body: ReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = svc.create_reminder(db, current_user.id, body.model_dump())
    return ReminderOut.model_validate(r)


@router.get("/{reminder_id}", response_model=ReminderOut)
def get_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = svc.get_reminder(db, current_user.id, reminder_id)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return ReminderOut.model_validate(r)


@router.put("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: int,
    body: ReminderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    r = svc.update_reminder(db, current_user.id, reminder_id, data)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return ReminderOut.model_validate(r)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not svc.delete_reminder(db, current_user.id, reminder_id):
        raise HTTPException(status_code=404, detail="Reminder not found")


@router.post("/{reminder_id}/snooze", response_model=ReminderOut)
def snooze_reminder(
    reminder_id: int,
    body: SnoozeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = svc.snooze_reminder(db, current_user.id, reminder_id, body.minutes)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return ReminderOut.model_validate(r)


@router.post("/{reminder_id}/complete", response_model=ReminderOut)
def complete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = svc.complete_reminder(db, current_user.id, reminder_id)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return ReminderOut.model_validate(r)


@router.post("/{reminder_id}/cancel", response_model=ReminderOut)
def cancel_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = svc.cancel_reminder(db, current_user.id, reminder_id)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return ReminderOut.model_validate(r)


@router.post("/bulk")
def bulk_action(
    body: BulkActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    affected = svc.bulk_action(db, current_user.id, body.ids, body.action)
    return {"affected": affected}


@router.get("/templates/list", response_model=list[TemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [TemplateOut.model_validate(t) for t in svc.list_templates(db, current_user.id)]


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(
    body: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = svc.create_template(db, current_user.id, body.model_dump())
    return TemplateOut.model_validate(t)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not svc.delete_template(db, current_user.id, template_id):
        raise HTTPException(status_code=404, detail="Template not found")


@router.post("/templates/{template_id}/apply", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def apply_template(
    template_id: int,
    body: ApplyTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = svc.apply_template(db, current_user.id, template_id, body.remind_at, body.variables)
    if not r:
        raise HTTPException(status_code=404, detail="Template not found")
    return ReminderOut.model_validate(r)


@router.get("/notifications/logs", response_model=list[NotificationLogOut])
def get_logs(
    reminder_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    limit: int = Query(200, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.get_logs(db, current_user.id, reminder_id, status, search, limit)


@router.get("/notifications/logs/export", response_class=PlainTextResponse)
def export_logs_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    csv = svc.export_logs_csv(db, current_user.id)
    return PlainTextResponse(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=notification_logs.csv"},
    )
