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
        # Player endpoints
        self.app.router.add_post("/api/player/move", self._handle_player_move)
        self.app.router.add_post("/api/player/chat", self._handle_player_chat)
        self.app.router.add_get("/api/player/nearby", self._handle_player_nearby)
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

    # --- Player endpoints ---

    async def _handle_player_move(self, request: web.Request) -> web.Response:
        """Move the player to a new location."""
        data = await request.json()
        location_id = data.get("location")
        if not location_id:
            return web.json_response({"error": "Missing 'location' field"}, status=400)

        player = self.world.get_agent("player")
        if not player:
            return web.json_response({"error": "No player in this world"}, status=404)

        success = player.move_to(location_id, self.world)
        if not success:
            return web.json_response({"error": f"Unknown location: {location_id}"}, status=400)

        # Return agents at the new location
        nearby = self._get_nearby_agents(player)
        return web.json_response({
            "ok": True,
            "location": location_id,
            "nearby_agents": nearby,
        })

    async def _handle_player_chat(self, request: web.Request) -> web.Response:
        """Player sends a message to an NPC."""
        data = await request.json()
        target_id = data.get("target_id")
        message = data.get("message", "").strip()

        if not target_id or not message:
            return web.json_response({"error": "Missing 'target_id' or 'message'"}, status=400)

        player = self.world.get_agent("player")
        if not player:
            return web.json_response({"error": "No player in this world"}, status=404)

        npc = self.world.get_agent(target_id)
        if not npc:
            return web.json_response({"error": f"Agent '{target_id}' not found"}, status=404)

        # Check if NPC is at the same location
        if npc.current_location != player.current_location:
            return web.json_response({
                "error": f"{npc.name} is not here. They are at {npc.current_location}."
            }, status=400)

        # Generate reply using conversation engine
        conv_engine = getattr(self.world, "_conversation_engine", None)
        if conv_engine:
            result = await conv_engine.generate_player_reply(player, npc, message, self.world)
        else:
            result = {
                "npc_name": npc.name,
                "npc_reply": "...",
                "player_message": message,
                "effects": {"affinity_change": 0, "romantic_change": 0},
                "summary": "",
            }

        return web.json_response(result)

    async def _handle_player_nearby(self, request: web.Request) -> web.Response:
        """Get list of agents near the player."""
        player = self.world.get_agent("player")
        if not player:
            return web.json_response({"error": "No player in this world"}, status=404)

        nearby = self._get_nearby_agents(player)
        return web.json_response({
            "location": player.current_location,
            "agents": nearby,
        })

    def _get_nearby_agents(self, player) -> list[dict]:
        """Get agents at the player's current location."""
        agents = self.world.get_agents_at_location(player.current_location)
        return [
            {
                "id": a.agent_id,
                "name": a.name,
                "activity": a.activity.value,
                "mood": a.mood_description,
                "job": a.job.title if a.job else "Unemployed",
            }
            for a in agents
            if a.agent_id != "player"
        ]

    # --- WebSocket ---

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
