from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.core.websocket_manager import ws_manager

router = APIRouter()


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token or decode_access_token(token) is None:
        await websocket.close(code=1008)
        return
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
