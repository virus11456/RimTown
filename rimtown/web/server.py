"""Web server for the RimTown visualization."""

from __future__ import annotations

import asyncio
import json
import logging
import os

from aiohttp import web

logger = logging.getLogger(__name__)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")


class WebServer:
    """Serves the web frontend and provides WebSocket for live updates."""

    def __init__(self, world, host: str = "0.0.0.0", port: int = 8000):
        self.world = world
        self.host = host
        self.port = port
        self.app = web.Application()
        self.websockets: list[web.WebSocketResponse] = []
        self._setup_routes()

    def _setup_routes(self):
        self.app.router.add_get("/", self._handle_index)
        self.app.router.add_get("/ws", self._handle_websocket)
        self.app.router.add_get("/api/state", self._handle_state)
        self.app.router.add_post("/api/pause", self._handle_pause)
        self.app.router.add_post("/api/resume", self._handle_resume)
        self.app.router.add_get("/api/agent/{agent_id}", self._handle_agent_detail)
        self.app.router.add_static("/static", STATIC_DIR)

    async def _handle_index(self, request: web.Request) -> web.Response:
        index_path = os.path.join(TEMPLATE_DIR, "index.html")
        with open(index_path, "r", encoding="utf-8") as f:
            return web.Response(text=f.read(), content_type="text/html")

    async def _handle_state(self, request: web.Request) -> web.Response:
        return web.json_response(self.world.get_state())

    async def _handle_pause(self, request: web.Request) -> web.Response:
        self.world.paused = True
        return web.json_response({"paused": True})

    async def _handle_resume(self, request: web.Request) -> web.Response:
        self.world.paused = False
        return web.json_response({"paused": False})

    async def _handle_agent_detail(self, request: web.Request) -> web.Response:
        agent_id = request.match_info["agent_id"]
        agent = self.world.get_agent(agent_id)
        if not agent:
            return web.json_response({"error": "Agent not found"}, status=404)
        return web.json_response(agent.to_dict())

    async def _handle_websocket(self, request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        self.websockets.append(ws)
        logger.info("WebSocket client connected")

        try:
            # Send initial state
            await ws.send_json(self.world.get_state())

            async for msg in ws:
                if msg.type == web.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    if data.get("action") == "pause":
                        self.world.paused = True
                    elif data.get("action") == "resume":
                        self.world.paused = False
                elif msg.type == web.WSMsgType.ERROR:
                    logger.error(f"WebSocket error: {ws.exception()}")
        finally:
            self.websockets.remove(ws)
            logger.info("WebSocket client disconnected")

        return ws

    async def broadcast_state(self, state: dict):
        """Send state update to all connected WebSocket clients."""
        dead = []
        for ws in self.websockets:
            try:
                await ws.send_json(state)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.websockets.remove(ws)

    async def start(self):
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        logger.info(f"Web server started at http://{self.host}:{self.port}")
