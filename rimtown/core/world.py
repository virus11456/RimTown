"""World state - the central hub of the simulation."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from rimtown.core.clock import GameClock
from rimtown.core.events import EventSystem

if TYPE_CHECKING:
    from rimtown.agents.agent import Agent
    from rimtown.town.map import TownMap

logger = logging.getLogger(__name__)


class World:
    """Central world state that holds everything together."""

    def __init__(self):
        self.clock = GameClock()
        self.events = EventSystem()
        self.agents: dict[str, Agent] = {}
        self.town_map: TownMap | None = None
        self.tick_count: int = 0
        self.paused: bool = False
        self.message_log: list[dict] = []
        self._subscribers: list = []

    def add_agent(self, agent: Agent):
        self.agents[agent.agent_id] = agent

    def remove_agent(self, agent_id: str):
        self.agents.pop(agent_id, None)

    def get_agent(self, agent_id: str) -> Agent | None:
        return self.agents.get(agent_id)

    def get_agent_by_name(self, name: str) -> Agent | None:
        for agent in self.agents.values():
            if agent.name == name:
                return agent
        return None

    def get_agents_at_location(self, location_id: str) -> list[Agent]:
        return [a for a in self.agents.values() if a.current_location == location_id]

    def log_message(self, msg_type: str, content: str, agent_name: str = "", target_name: str = ""):
        entry = {
            "time": self.clock.time_str,
            "tick": self.tick_count,
            "type": msg_type,
            "content": content,
            "agent": agent_name,
            "target": target_name,
        }
        self.message_log.append(entry)
        # Keep log manageable
        if len(self.message_log) > 500:
            self.message_log = self.message_log[-300:]

    async def tick(self):
        """Advance the simulation by one step (15 in-game minutes)."""
        if self.paused:
            return

        self.tick_count += 1
        time_events = self.clock.tick()

        # Check for daily random events
        if "new_day" in time_events:
            event = self.events.check_random_event(self)
            if event:
                self.log_message("event", f"[{event.severity.upper()}] {event.name}: {event.description}")
                logger.info(f"Event: {event.name}")

                # Apply mood effects
                if "mood_all" in event.effects:
                    for agent in self.agents.values():
                        agent.mood = max(-100, min(100, agent.mood + event.effects["mood_all"]))

        # Update each agent
        for agent in list(self.agents.values()):
            await agent.update(self)

        # Notify subscribers (websocket clients)
        await self._notify_subscribers()

    async def _notify_subscribers(self):
        for callback in self._subscribers:
            try:
                await callback(self.get_state())
            except Exception as e:
                logger.error(f"Subscriber notification error: {e}")

    def subscribe(self, callback):
        self._subscribers.append(callback)

    def unsubscribe(self, callback):
        self._subscribers = [s for s in self._subscribers if s is not callback]

    def get_state(self) -> dict:
        """Get full world state for the frontend."""
        return {
            "clock": self.clock.to_dict(),
            "tick": self.tick_count,
            "paused": self.paused,
            "agents": {
                aid: agent.to_dict() for aid, agent in self.agents.items()
            },
            "locations": self.town_map.to_dict() if self.town_map else {},
            "recent_events": [
                {"time": t, "name": e.name, "description": e.description, "severity": e.severity}
                for t, e in self.events.get_recent_events()
            ],
            "recent_messages": self.message_log[-30:],
        }
