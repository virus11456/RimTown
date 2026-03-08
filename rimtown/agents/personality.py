"""Personality traits and psychological model for agents."""

from __future__ import annotations

import random
from dataclasses import dataclass, field


# RimWorld-inspired personality traits
TRAIT_POOL = {
    # Social traits
    "kind": {"social": 2, "description": "Naturally kind and empathetic"},
    "abrasive": {"social": -2, "description": "Tends to rub people the wrong way"},
    "shy": {"social": -1, "description": "Uncomfortable in social situations"},
    "charismatic": {"social": 3, "description": "Naturally draws people in"},
    "gossip": {"social": 1, "description": "Loves to share and hear rumors"},

    # Work traits
    "hardworking": {"work": 2, "description": "Finds satisfaction in hard work"},
    "lazy": {"work": -2, "description": "Avoids work whenever possible"},
    "perfectionist": {"work": 1, "description": "Must do everything just right"},
    "creative": {"work": 1, "description": "Thinks outside the box"},

    # Mental traits
    "optimist": {"mood_base": 10, "description": "Always sees the bright side"},
    "pessimist": {"mood_base": -10, "description": "Expects the worst"},
    "neurotic": {"mood_sensitivity": 1.5, "description": "Emotions swing wildly"},
    "stoic": {"mood_sensitivity": 0.5, "description": "Rarely shows emotion"},
    "romantic": {"romance": 2, "description": "Falls in love easily"},
    "jealous": {"romance": -1, "description": "Prone to jealousy"},

    # Quirky traits
    "night_owl": {"schedule": "late", "description": "Prefers staying up late"},
    "early_bird": {"schedule": "early", "description": "Rises with the sun"},
    "glutton": {"food": 1.5, "description": "Loves food more than most"},
    "ascetic": {"comfort": -1, "description": "Prefers a simple life"},
}

# Incompatible trait pairs
INCOMPATIBLE = [
    ("optimist", "pessimist"),
    ("hardworking", "lazy"),
    ("shy", "charismatic"),
    ("night_owl", "early_bird"),
]


@dataclass
class Personality:
    traits: list[str] = field(default_factory=list)
    background: str = ""
    values: list[str] = field(default_factory=list)

    @classmethod
    def random(cls, num_traits: int = 3) -> Personality:
        available = list(TRAIT_POOL.keys())
        traits = []
        for _ in range(num_traits):
            if not available:
                break
            t = random.choice(available)
            traits.append(t)
            available.remove(t)
            # Remove incompatible traits
            for a, b in INCOMPATIBLE:
                if t == a and b in available:
                    available.remove(b)
                elif t == b and a in available:
                    available.remove(a)

        values = random.sample(
            ["family", "freedom", "knowledge", "wealth", "power", "art", "nature", "community", "adventure", "peace"],
            k=random.randint(1, 3),
        )

        return cls(traits=traits, values=values)

    @property
    def social_modifier(self) -> int:
        return sum(TRAIT_POOL[t].get("social", 0) for t in self.traits if t in TRAIT_POOL)

    @property
    def work_modifier(self) -> int:
        return sum(TRAIT_POOL[t].get("work", 0) for t in self.traits if t in TRAIT_POOL)

    @property
    def mood_base(self) -> int:
        return sum(TRAIT_POOL[t].get("mood_base", 0) for t in self.traits if t in TRAIT_POOL)

    @property
    def mood_sensitivity(self) -> float:
        vals = [TRAIT_POOL[t]["mood_sensitivity"] for t in self.traits if t in TRAIT_POOL and "mood_sensitivity" in TRAIT_POOL[t]]
        return vals[0] if vals else 1.0

    def describe(self) -> str:
        descriptions = [TRAIT_POOL[t]["description"] for t in self.traits if t in TRAIT_POOL]
        return "; ".join(descriptions)

    def to_dict(self) -> dict:
        return {
            "traits": self.traits,
            "background": self.background,
            "values": self.values,
            "description": self.describe(),
        }
