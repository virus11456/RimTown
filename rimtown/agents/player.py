"""Player agent - a human-controlled resident of RimTown."""

from __future__ import annotations

from typing import TYPE_CHECKING

from rimtown.agents.agent import Activity, Agent
from rimtown.agents.personality import Personality

if TYPE_CHECKING:
    from rimtown.core.world import World


class PlayerAgent(Agent):
    """A player-controlled agent. Does not auto-decide activities or move."""

    is_player = True

    def __init__(
        self,
        name: str = "Traveler",
        age: int = 25,
        personality: Personality | None = None,
        home_location: str = "tavern",
    ):
        super().__init__(
            agent_id="player",
            name=name,
            age=age,
            personality=personality or Personality(
                traits=["curious", "kind"],
                background="A mysterious traveler who recently arrived in RimTown.",
                values=["adventure", "friendship"],
            ),
            job=None,
            home_location=home_location,
        )
        self.activity = Activity.IDLE
        self.chat_history: list[dict] = []  # Full chat log for the UI

    async def update(self, world: World):
        """Player update - only tick needs, no auto-behavior."""
        self.needs.tick_decay(
            is_sleeping=self.activity == Activity.SLEEPING,
            is_eating=self.activity == Activity.EATING,
            is_socializing=self.activity == Activity.SOCIALIZING,
            is_recreating=self.activity == Activity.RECREATION,
        )

        need_mood = self.needs.mood_contribution
        self.mood = max(-100, min(100, 50 + self.personality.mood_base + int(need_mood)))

    def move_to(self, location_id: str, world: World) -> bool:
        """Player manually moves to a location."""
        if world.town_map and location_id not in world.town_map.locations:
            return False
        old = self.current_location
        self.current_location = location_id
        self.activity = Activity.WANDERING
        world.log_message("player_move", f"You moved to {location_id}", self.name)
        return True

    def to_dict(self) -> dict:
        d = super().to_dict()
        d["is_player"] = True
        d["chat_history"] = self.chat_history[-50:]
        return d
