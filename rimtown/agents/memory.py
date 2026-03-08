"""Agent memory system - stores experiences, conversations, and observations."""

from __future__ import annotations

from dataclasses import dataclass, field
from collections import deque


@dataclass
class MemoryEntry:
    tick: int
    time_str: str
    category: str  # "conversation", "observation", "emotion", "work", "social"
    content: str
    importance: int = 5  # 1-10, higher = more memorable
    related_agents: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "tick": self.tick,
            "time": self.time_str,
            "category": self.category,
            "content": self.content,
            "importance": self.importance,
            "related_agents": self.related_agents,
        }


class Memory:
    """Stores and retrieves agent memories."""

    def __init__(self, capacity: int = 100):
        self.entries: deque[MemoryEntry] = deque(maxlen=capacity)
        self.capacity = capacity

    def add(self, tick: int, time_str: str, category: str, content: str,
            importance: int = 5, related_agents: list[str] | None = None):
        entry = MemoryEntry(
            tick=tick,
            time_str=time_str,
            category=category,
            content=content,
            importance=importance,
            related_agents=related_agents or [],
        )
        self.entries.append(entry)

    def get_recent(self, n: int = 10) -> list[MemoryEntry]:
        return list(self.entries)[-n:]

    def get_by_category(self, category: str, n: int = 5) -> list[MemoryEntry]:
        matching = [e for e in self.entries if e.category == category]
        return matching[-n:]

    def get_about_agent(self, agent_name: str, n: int = 5) -> list[MemoryEntry]:
        matching = [e for e in self.entries if agent_name in e.related_agents]
        return matching[-n:]

    def get_important(self, min_importance: int = 7, n: int = 10) -> list[MemoryEntry]:
        matching = [e for e in self.entries if e.importance >= min_importance]
        return matching[-n:]

    def summarize_recent(self, n: int = 5) -> str:
        recent = self.get_recent(n)
        if not recent:
            return "No recent memories."
        lines = [f"- [{m.time_str}] {m.content}" for m in recent]
        return "\n".join(lines)

    def to_dict(self) -> list[dict]:
        return [e.to_dict() for e in list(self.entries)[-20:]]
