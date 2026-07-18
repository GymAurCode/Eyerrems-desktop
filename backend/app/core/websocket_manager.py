import asyncio
import logging

from fastapi import WebSocket, WebSocketDisconnect

log = logging.getLogger("ws-manager")


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._legacy_connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, user_id: int | None = None) -> None:
        await ws.accept()
        if user_id is not None:
            if user_id not in self._connections:
                self._connections[user_id] = set()
            self._connections[user_id].add(ws)
            log.info("[WS] User %s connected (total: %s)", user_id, sum(len(v) for v in self._connections.values()))
        else:
            async with self._lock:
                self._legacy_connections.append(ws)
            log.info("[WS] Legacy connection added (total: %s)", len(self._legacy_connections))

    def disconnect(self, ws: WebSocket, user_id: int | None = None) -> None:
        if user_id is not None and user_id in self._connections:
            self._connections[user_id].discard(ws)
            if not self._connections[user_id]:
                del self._connections[user_id]
            log.info("[WS] User %s disconnected.", user_id)
        else:
            if ws in self._legacy_connections:
                self._legacy_connections.remove(ws)
                log.info("[WS] Legacy connection removed (remaining: %s)", len(self._legacy_connections))

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        if user_id not in self._connections:
            return
        dead: list[WebSocket] = []
        for ws in list(self._connections[user_id]):
            try:
                await ws.send_json(payload)
            except (WebSocketDisconnect, RuntimeError):
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast(self, event: str, payload: dict | None = None) -> None:
        if payload is None:
            msg = event
        else:
            msg = {"event": event, "payload": payload}
        async with self._lock:
            connections = list(self._legacy_connections)
        dead: list[WebSocket] = []
        for ws in connections:
            try:
                if isinstance(msg, dict):
                    await ws.send_json(msg)
                else:
                    await ws.send_json(msg)
            except (WebSocketDisconnect, RuntimeError):
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def active_user_ids(self) -> list[int]:
        return list(self._connections.keys())


ws_manager = ConnectionManager()
