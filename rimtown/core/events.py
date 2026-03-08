"""Random event system for the simulation."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rimtown.core.world import World


@dataclass
class GameEvent:
    name: str
    description: str
    severity: str  # "minor", "moderate", "major"
    effects: dict = field(default_factory=dict)


# Pool of random events that can happen
EVENT_POOL: list[dict] = [
    {
        "name": "Bountiful Harvest",
        "description": "The crops are growing exceptionally well this season!",
        "severity": "minor",
        "effects": {"mood_all": 5, "food_bonus": 20},
        "seasons": ["spring", "summer"],
    },
    {
        "name": "Cold Snap",
        "description": "An unexpected cold front has hit the town. Everyone feels miserable.",
        "severity": "moderate",
        "effects": {"mood_all": -10},
        "seasons": ["winter", "autumn"],
    },
    {
        "name": "Wanderer Joins",
        "description": "A wanderer has arrived at the town seeking shelter.",
        "severity": "minor",
        "effects": {"new_resident": True},
    },
    {
        "name": "Festival Day",
        "description": "The town decides to hold a festival! Everyone gathers to celebrate.",
        "severity": "minor",
        "effects": {"mood_all": 15, "social_gathering": True},
    },
    {
        "name": "Supply Shortage",
        "description": "Trade routes are disrupted. Supplies are running low.",
        "severity": "moderate",
        "effects": {"mood_all": -5, "trade_penalty": True},
    },
    {
        "name": "Strange Lights",
        "description": "Strange lights are seen in the sky. The townsfolk are both fascinated and uneasy.",
        "severity": "minor",
        "effects": {"mood_all": -3, "conversation_topic": "strange lights in the sky"},
    },
    {
        "name": "Plague Outbreak",
        "description": "A mysterious illness is spreading through the town!",
        "severity": "major",
        "effects": {"mood_all": -20, "sick_chance": 0.3},
    },
    {
        "name": "Travelling Merchant",
        "description": "A travelling merchant arrives with rare goods and stories from afar.",
        "severity": "minor",
        "effects": {"mood_all": 5, "conversation_topic": "the travelling merchant's exotic wares"},
    },
    {
        "name": "Beautiful Aurora",
        "description": "A stunning aurora lights up the night sky.",
        "severity": "minor",
        "effects": {"mood_all": 10},
        "seasons": ["winter"],
    },
    {
        "name": "Heatwave",
        "description": "Scorching heat makes outdoor work unbearable.",
        "severity": "moderate",
        "effects": {"mood_all": -8, "work_penalty": True},
        "seasons": ["summer"],
    },
]


class EventSystem:
    """Manages random events in the simulation."""

    def __init__(self):
        self.event_log: list[tuple[str, GameEvent]] = []
        self.active_effects: dict = {}
        self.conversation_topics: list[str] = []

    def check_random_event(self, world: World) -> GameEvent | None:
        """Roll for a random event. Called once per in-game day."""
        if random.random() > 0.25:  # 25% chance per day
            return None

        season = world.clock.season.value
        eligible = [
            e for e in EVENT_POOL
            if "seasons" not in e or season in e["seasons"]
        ]

        if not eligible:
            return None

        event_data = random.choice(eligible)
        event = GameEvent(
            name=event_data["name"],
            description=event_data["description"],
            severity=event_data["severity"],
            effects=event_data.get("effects", {}),
        )

        self.event_log.append((world.clock.time_str, event))

        # Apply effects
        if "conversation_topic" in event.effects:
            self.conversation_topics.append(event.effects["conversation_topic"])
            # Keep only recent topics
            self.conversation_topics = self.conversation_topics[-5:]

        if "mood_all" in event.effects:
            self.active_effects["mood_modifier"] = event.effects["mood_all"]

        return event

    def get_recent_events(self, n: int = 5) -> list[tuple[str, GameEvent]]:
        return self.event_log[-n:]

    def get_gossip_topics(self) -> list[str]:
        topics = list(self.conversation_topics)
        for _, event in self.event_log[-3:]:
            topics.append(event.description)
        return topics
