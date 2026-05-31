import asyncio
from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, event: str, payload: dict) -> None:
        async with self._lock:
            connections = list(self.active_connections)
        for connection in connections:
            try:
                await connection.send_json({"event": event, "payload": payload})
            except (WebSocketDisconnect, RuntimeError):
                self.disconnect(connection)


ws_manager = ConnectionManager()
