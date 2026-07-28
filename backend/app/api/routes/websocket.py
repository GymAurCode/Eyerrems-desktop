import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.core.websocket_manager import ws_manager

log = logging.getLogger("rems.ws")

router = APIRouter()


def _authenticate(websocket: WebSocket) -> dict | None:
    """Extract and validate JWT from WebSocket query param.

    Returns decoded token payload on success, None on failure.
    Logs the specific reason for failure so debugging is easier.
    """
    token = websocket.query_params.get("token")
    if not token:
        log.warning("[WS] Auth failed: no token in query params")
        return None
    payload = decode_access_token(token)
    if payload is None:
        log.warning("[WS] Auth failed: invalid or expired token")
        return None
    return payload


async def _handle_ws(websocket: WebSocket, name: str):
    """Common WebSocket handler: accept, auth, then listen."""
    await websocket.accept()
    user_id = None
    company_id = None
    try:
        payload = _authenticate(websocket)
        if payload is None:
            await websocket.close(code=4401)
            return
        user_id = payload.get("user_id") or payload.get("sub")
        company_id = payload.get("company_id")
        log.info("[%s] Connected user %s company %s", name, user_id, company_id)
        await ws_manager.connect(websocket, user_id=user_id, company_id=company_id)
        while True:
            data = await websocket.receive_text()
            if data:
                try:
                    import json
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                except Exception:
                    pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id=user_id, company_id=company_id)
    except Exception as exc:
        log.warning("[%s] Error: %s", name, exc)
        ws_manager.disconnect(websocket, user_id=user_id, company_id=company_id)


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await _handle_ws(websocket, "ws")


@router.websocket("/reminders/ws")
async def reminders_ws_endpoint(websocket: WebSocket):
    await _handle_ws(websocket, "reminders-ws")
