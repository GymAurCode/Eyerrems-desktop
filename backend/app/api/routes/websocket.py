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


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    payload = _authenticate(websocket)
    if payload is None:
        await websocket.close(code=1008)
        return
    user_id = payload.get("user_id") or payload.get("sub")
    log.info("[WS] Connection accepted for user %s", user_id)
    await ws_manager.connect(websocket, user_id=payload.get("user_id"))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id=payload.get("user_id"))
    except Exception as exc:
        log.warning("[WS] Unexpected error: %s", exc)
        ws_manager.disconnect(websocket, user_id=payload.get("user_id"))


@router.websocket("/reminders/ws")
async def reminders_ws_endpoint(websocket: WebSocket):
    payload = _authenticate(websocket)
    if payload is None:
        await websocket.close(code=4001)
        return
    user_id = payload.get("user_id") or payload.get("sub")
    log.info("[reminders-ws] Connection accepted for user %s", user_id)
    await ws_manager.connect(websocket, user_id=payload.get("user_id"))
    try:
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
        ws_manager.disconnect(websocket, user_id=payload.get("user_id"))
    except Exception as exc:
        log.warning("[reminders-ws] Unexpected error: %s", exc)
        ws_manager.disconnect(websocket, user_id=payload.get("user_id"))
