"""Town stockpile - centralized resource tracking."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field


class Resource(enum.Enum):
    FOOD = "food"
    WOOD = "wood"
    STONE = "stone"
    METAL = "metal"
    CLOTH = "cloth"
    HERBS = "herbs"
    SILVER = "silver"
    MEALS = "meals"          # Cooked food (from raw food)
    TOOLS = "tools"          # Crafted tools (from metal + wood)
    CLOTHING = "clothing"    # Made from cloth
    MEDICINE = "medicine"    # Made from herbs
    FURNITURE = "furniture"  # Made from wood
    RESEARCH_POINTS = "research_points"


# Starting resources for a new town
DEFAULT_STOCKPILE: dict[str, float] = {
    Resource.FOOD.value: 200,
    Resource.WOOD.value: 100,
    Resource.STONE.value: 80,
    Resource.METAL.value: 30,
    Resource.CLOTH.value: 40,
    Resource.HERBS.value: 20,
    Resource.SILVER.value: 150,
    Resource.MEALS.value: 50,
    Resource.TOOLS.value: 10,
    Resource.CLOTHING.value: 15,
    Resource.MEDICINE.value: 5,
    Resource.FURNITURE.value: 5,
    Resource.RESEARCH_POINTS.value: 0,
}


@dataclass
class ResourceChange:
    """Tracks a single resource change for history/logging."""
    tick: int
    resource: str
    amount: float
    reason: str
    source: str = ""  # agent name or system


class Stockpile:
    """Town-wide resource storage."""

    def __init__(self):
        self.resources: dict[str, float] = dict(DEFAULT_STOCKPILE)
        self.history: list[ResourceChange] = []
        self._capacity: dict[str, float] = {}  # Optional per-resource caps

    def get(self, resource: str | Resource) -> float:
        key = resource.value if isinstance(resource, Resource) else resource
        return self.resources.get(key, 0)

    def add(self, resource: str | Resource, amount: float, tick: int = 0,
            reason: str = "", source: str = ""):
        key = resource.value if isinstance(resource, Resource) else resource
        self.resources[key] = self.resources.get(key, 0) + amount
        if key in self._capacity:
            self.resources[key] = min(self.resources[key], self._capacity[key])
        self.history.append(ResourceChange(tick, key, amount, reason, source))
        self._trim_history()

    def consume(self, resource: str | Resource, amount: float, tick: int = 0,
                reason: str = "", source: str = "") -> bool:
        """Try to consume resources. Returns False if not enough."""
        key = resource.value if isinstance(resource, Resource) else resource
        current = self.resources.get(key, 0)
        if current < amount:
            return False
        self.resources[key] = current - amount
        self.history.append(ResourceChange(tick, key, -amount, reason, source))
        self._trim_history()
        return True

    def has(self, resource: str | Resource, amount: float) -> bool:
        key = resource.value if isinstance(resource, Resource) else resource
        return self.resources.get(key, 0) >= amount

    def can_afford(self, costs: dict[str, float]) -> bool:
        return all(self.has(r, a) for r, a in costs.items())

    def pay(self, costs: dict[str, float], tick: int = 0,
            reason: str = "", source: str = "") -> bool:
        """Pay multiple resources at once. All-or-nothing."""
        if not self.can_afford(costs):
            return False
        for r, a in costs.items():
            self.consume(r, a, tick, reason, source)
        return True

    def set_capacity(self, resource: str, cap: float):
        self._capacity[resource] = cap

    def _trim_history(self):
        if len(self.history) > 500:
            self.history = self.history[-300:]

    def get_recent_changes(self, n: int = 20) -> list[dict]:
        return [
            {"tick": c.tick, "resource": c.resource, "amount": c.amount,
             "reason": c.reason, "source": c.source}
            for c in self.history[-n:]
        ]

    def to_dict(self) -> dict:
        return {
            "resources": dict(self.resources),
            "recent_changes": self.get_recent_changes(10),
        }
