"""Agent needs system - inspired by RimWorld's needs bars."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Needs:
    """Tracks agent psychological and physical needs (0-100 scale)."""

    hunger: float = 70.0       # High = well-fed
    rest: float = 80.0         # High = well-rested
    social: float = 60.0       # High = socially fulfilled
    comfort: float = 60.0      # High = comfortable
    recreation: float = 50.0   # High = entertained
    beauty: float = 50.0       # Environmental beauty

    def tick_decay(self, is_sleeping: bool = False, is_eating: bool = False,
                   is_socializing: bool = False, is_recreating: bool = False):
        """Decay needs each tick (15 min)."""
        # Hunger decays unless eating
        if is_eating:
            self.hunger = min(100, self.hunger + 20)
        else:
            self.hunger = max(0, self.hunger - 2)

        # Rest decays unless sleeping
        if is_sleeping:
            self.rest = min(100, self.rest + 8)
        else:
            self.rest = max(0, self.rest - 1.5)

        # Social decays unless socializing
        if is_socializing:
            self.social = min(100, self.social + 10)
        else:
            self.social = max(0, self.social - 1)

        # Recreation
        if is_recreating:
            self.recreation = min(100, self.recreation + 15)
        else:
            self.recreation = max(0, self.recreation - 0.8)

    @property
    def mood_contribution(self) -> float:
        """Calculate mood contribution from needs."""
        score = 0
        if self.hunger < 20:
            score -= 15
        elif self.hunger > 80:
            score += 5

        if self.rest < 20:
            score -= 20
        elif self.rest > 80:
            score += 5

        if self.social < 20:
            score -= 10
        elif self.social > 70:
            score += 5

        if self.recreation < 15:
            score -= 8
        elif self.recreation > 70:
            score += 3

        return score

    @property
    def most_urgent(self) -> str:
        """Return the most urgent unmet need."""
        needs = {
            "hunger": self.hunger,
            "rest": self.rest,
            "social": self.social,
            "recreation": self.recreation,
        }
        return min(needs, key=needs.get)

    def to_dict(self) -> dict:
        return {
            "hunger": round(self.hunger, 1),
            "rest": round(self.rest, 1),
            "social": round(self.social, 1),
            "comfort": round(self.comfort, 1),
            "recreation": round(self.recreation, 1),
            "beauty": round(self.beauty, 1),
            "most_urgent": self.most_urgent,
        }
