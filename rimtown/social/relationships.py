"""Relationship system between agents."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field


class RelationshipType(enum.Enum):
    STRANGER = "stranger"
    ACQUAINTANCE = "acquaintance"
    FRIEND = "friend"
    CLOSE_FRIEND = "close_friend"
    RIVAL = "rival"
    ENEMY = "enemy"
    CRUSH = "crush"
    PARTNER = "partner"
    EX = "ex"


@dataclass
class Relationship:
    """One-directional relationship from one agent to another."""

    target_id: str
    target_name: str
    affinity: int = 0           # -100 to 100
    trust: int = 0              # -100 to 100
    romantic_interest: int = 0  # 0 to 100
    interaction_count: int = 0
    last_interaction_tick: int = 0
    shared_memories: list[str] = field(default_factory=list)

    @property
    def relationship_type(self) -> RelationshipType:
        if self.romantic_interest > 60 and self.affinity > 50:
            return RelationshipType.PARTNER
        if self.romantic_interest > 30:
            return RelationshipType.CRUSH
        if self.affinity > 60:
            return RelationshipType.CLOSE_FRIEND
        if self.affinity > 20:
            return RelationshipType.FRIEND
        if self.affinity > -20:
            if self.interaction_count > 0:
                return RelationshipType.ACQUAINTANCE
            return RelationshipType.STRANGER
        if self.affinity > -60:
            return RelationshipType.RIVAL
        return RelationshipType.ENEMY

    def modify_affinity(self, delta: int):
        self.affinity = max(-100, min(100, self.affinity + delta))

    def modify_trust(self, delta: int):
        self.trust = max(-100, min(100, self.trust + delta))

    def modify_romantic(self, delta: int):
        self.romantic_interest = max(0, min(100, self.romantic_interest + delta))

    def record_interaction(self, tick: int, summary: str):
        self.interaction_count += 1
        self.last_interaction_tick = tick
        self.shared_memories.append(summary)
        if len(self.shared_memories) > 20:
            self.shared_memories = self.shared_memories[-15:]

    def to_dict(self) -> dict:
        return {
            "target_id": self.target_id,
            "target_name": self.target_name,
            "type": self.relationship_type.value,
            "affinity": self.affinity,
            "trust": self.trust,
            "romantic_interest": self.romantic_interest,
            "interaction_count": self.interaction_count,
        }


class RelationshipManager:
    """Manages all relationships for one agent."""

    def __init__(self):
        self.relationships: dict[str, Relationship] = {}

    def get_or_create(self, target_id: str, target_name: str) -> Relationship:
        if target_id not in self.relationships:
            self.relationships[target_id] = Relationship(
                target_id=target_id,
                target_name=target_name,
            )
        return self.relationships[target_id]

    def get_friends(self) -> list[Relationship]:
        return [r for r in self.relationships.values() if r.affinity > 20]

    def get_romantic_interests(self) -> list[Relationship]:
        return [r for r in self.relationships.values() if r.romantic_interest > 20]

    def get_rivals(self) -> list[Relationship]:
        return [r for r in self.relationships.values() if r.affinity < -20]

    def get_best_friend(self) -> Relationship | None:
        friends = self.get_friends()
        return max(friends, key=lambda r: r.affinity) if friends else None

    def describe_relationships(self) -> str:
        if not self.relationships:
            return "Doesn't know anyone yet."
        lines = []
        for r in sorted(self.relationships.values(), key=lambda x: x.affinity, reverse=True):
            label = r.relationship_type.value.replace("_", " ")
            lines.append(f"- {r.target_name}: {label} (affinity: {r.affinity})")
        return "\n".join(lines)

    def to_dict(self) -> list[dict]:
        return [r.to_dict() for r in self.relationships.values()]
