"""Skills and talents system - RimWorld-inspired skill progression.

Each agent has 12 skills that grow through practice. Talents (passions)
give bonus XP rates and affect skill ceilings.
"""

from __future__ import annotations

import enum
import math
import random
from dataclasses import dataclass, field


class SkillCategory(enum.Enum):
    """The 12 core skills, inspired by RimWorld."""
    SHOOTING = "shooting"
    MELEE = "melee"
    CONSTRUCTION = "construction"
    MINING = "mining"
    COOKING = "cooking"
    PLANTS = "plants"
    ANIMALS = "animals"
    CRAFTING = "crafting"
    MEDICINE = "medicine"
    SOCIAL = "social"
    INTELLECTUAL = "intellectual"
    ARTISTIC = "artistic"


class Passion(enum.Enum):
    """Passion level for a skill - affects XP gain rate."""
    INCAPABLE = "incapable"   # Cannot do this at all
    NONE = "none"             # Normal XP rate (x1)
    MINOR = "minor"           # Interested - faster learning (x1.5)
    MAJOR = "major"           # Passionate - much faster learning (x2.5)
    BURNING = "burning"       # Obsessed - fastest learning (x4) + mood bonus


# XP required for each level (cumulative)
# Level 0 = 0 XP, Level 1 = 100 XP, ..., Level 20 = 52000 XP
def _xp_for_level(level: int) -> int:
    if level <= 0:
        return 0
    return int(100 * level * (1 + level * 0.2))


# Map jobs to their primary and secondary skills
JOB_SKILL_MAP: dict[str, dict[str, list[str]]] = {
    "farmer":      {"primary": ["plants"],      "secondary": ["animals", "cooking"]},
    "miner":       {"primary": ["mining"],       "secondary": ["construction", "melee"]},
    "cook":        {"primary": ["cooking"],      "secondary": ["plants", "social"]},
    "blacksmith":  {"primary": ["crafting"],     "secondary": ["mining", "construction"]},
    "doctor":      {"primary": ["medicine"],     "secondary": ["intellectual", "social"]},
    "researcher":  {"primary": ["intellectual"], "secondary": ["medicine", "crafting"]},
    "trader":      {"primary": ["social"],       "secondary": ["intellectual", "crafting"]},
    "guard":       {"primary": ["shooting"],     "secondary": ["melee", "medicine"]},
    "carpenter":   {"primary": ["construction"], "secondary": ["crafting", "plants"]},
    "tailor":      {"primary": ["crafting"],     "secondary": ["artistic", "social"]},
    "priest":      {"primary": ["social"],       "secondary": ["artistic", "intellectual"]},
    "mayor":       {"primary": ["social"],       "secondary": ["intellectual", "artistic"]},
}

# Activities that train skills passively
ACTIVITY_SKILL_MAP: dict[str, list[str]] = {
    "socializing": ["social"],
    "eating": [],
    "sleeping": [],
    "recreation": ["artistic"],
    "wandering": ["animals", "plants"],
}

# Passion distribution weights for random generation
PASSION_WEIGHTS = {
    Passion.INCAPABLE: 5,
    Passion.NONE: 45,
    Passion.MINOR: 25,
    Passion.MAJOR: 18,
    Passion.BURNING: 7,
}


@dataclass
class Skill:
    """A single skill with level, XP, and passion."""
    category: SkillCategory
    xp: int = 0
    passion: Passion = Passion.NONE

    @property
    def level(self) -> int:
        """Calculate level from XP."""
        lvl = 0
        while lvl < 20 and self.xp >= _xp_for_level(lvl + 1):
            lvl += 1
        return lvl

    @property
    def xp_to_next(self) -> int:
        """XP needed to reach next level."""
        next_lvl = min(self.level + 1, 20)
        return max(0, _xp_for_level(next_lvl) - self.xp)

    @property
    def level_progress(self) -> float:
        """Progress to next level as 0-1 float."""
        lvl = self.level
        if lvl >= 20:
            return 1.0
        current_req = _xp_for_level(lvl)
        next_req = _xp_for_level(lvl + 1)
        if next_req == current_req:
            return 1.0
        return (self.xp - current_req) / (next_req - current_req)

    @property
    def xp_multiplier(self) -> float:
        """XP gain multiplier based on passion."""
        return {
            Passion.INCAPABLE: 0.0,
            Passion.NONE: 1.0,
            Passion.MINOR: 1.5,
            Passion.MAJOR: 2.5,
            Passion.BURNING: 4.0,
        }[self.passion]

    @property
    def is_incapable(self) -> bool:
        return self.passion == Passion.INCAPABLE

    @property
    def passion_icon(self) -> str:
        """Return a text icon for the passion level."""
        return {
            Passion.INCAPABLE: "X",
            Passion.NONE: "",
            Passion.MINOR: "*",
            Passion.MAJOR: "**",
            Passion.BURNING: "***",
        }[self.passion]

    def add_xp(self, amount: int) -> bool:
        """Add XP with passion multiplier. Returns True if leveled up."""
        if self.is_incapable:
            return False
        old_level = self.level
        self.xp += int(amount * self.xp_multiplier)
        return self.level > old_level

    def to_dict(self) -> dict:
        return {
            "name": self.category.value,
            "level": self.level,
            "xp": self.xp,
            "xp_to_next": self.xp_to_next,
            "progress": round(self.level_progress, 2),
            "passion": self.passion.value,
            "passion_icon": self.passion_icon,
            "incapable": self.is_incapable,
        }


class SkillSet:
    """Complete set of skills for an agent."""

    def __init__(self):
        self.skills: dict[str, Skill] = {
            cat.value: Skill(category=cat) for cat in SkillCategory
        }

    def get(self, skill_name: str) -> Skill:
        return self.skills[skill_name]

    def add_xp(self, skill_name: str, amount: int) -> bool:
        """Add XP to a skill. Returns True if leveled up."""
        if skill_name not in self.skills:
            return False
        return self.skills[skill_name].add_xp(amount)

    @property
    def best_skill(self) -> Skill:
        """Return the highest-level skill."""
        return max(self.skills.values(), key=lambda s: (s.level, s.xp))

    @property
    def passions(self) -> list[Skill]:
        """Return skills with any passion."""
        return [s for s in self.skills.values()
                if s.passion in (Passion.MINOR, Passion.MAJOR, Passion.BURNING)]

    @property
    def incapable(self) -> list[Skill]:
        """Return incapable skills."""
        return [s for s in self.skills.values() if s.is_incapable]

    @property
    def total_level(self) -> int:
        return sum(s.level for s in self.skills.values())

    def to_dict(self) -> dict:
        return {
            "skills": {name: s.to_dict() for name, s in self.skills.items()},
            "total_level": self.total_level,
            "best_skill": self.best_skill.category.value,
        }

    def to_summary(self) -> str:
        """One-line summary of notable skills."""
        notable = sorted(
            [s for s in self.skills.values() if s.level > 0 or s.passion != Passion.NONE],
            key=lambda s: s.level,
            reverse=True,
        )[:5]
        parts = []
        for s in notable:
            icon = s.passion_icon
            parts.append(f"{s.category.value} {s.level}{icon}")
        return ", ".join(parts) if parts else "No notable skills"


def generate_random_skills(
    job_key: str | None = None,
    age: int = 25,
    trait_list: list[str] | None = None,
    rng: random.Random | None = None,
) -> SkillSet:
    """Generate a randomized skill set for a new agent.

    Takes into account:
    - Job: primary/secondary skills get bonus starting XP
    - Age: older characters have more total XP
    - Traits: certain personality traits boost certain passions
    """
    rng = rng or random.Random()
    skills = SkillSet()
    trait_list = trait_list or []

    # 1. Assign random passions (2-4 passions, 0-1 incapable)
    all_cats = list(SkillCategory)
    rng.shuffle(all_cats)

    # Determine number of each passion type
    n_burning = 1 if rng.random() < 0.15 else 0
    n_major = rng.randint(0, 2)
    n_minor = rng.randint(1, 3)
    n_incapable = 1 if rng.random() < 0.25 else 0

    passion_assignments: list[tuple[SkillCategory, Passion]] = []

    idx = 0
    for _ in range(n_burning):
        if idx < len(all_cats):
            passion_assignments.append((all_cats[idx], Passion.BURNING))
            idx += 1
    for _ in range(n_major):
        if idx < len(all_cats):
            passion_assignments.append((all_cats[idx], Passion.MAJOR))
            idx += 1
    for _ in range(n_minor):
        if idx < len(all_cats):
            passion_assignments.append((all_cats[idx], Passion.MINOR))
            idx += 1
    # Incapable goes at the end
    for _ in range(n_incapable):
        if idx < len(all_cats):
            passion_assignments.append((all_cats[idx], Passion.INCAPABLE))
            idx += 1

    for cat, passion in passion_assignments:
        skills.skills[cat.value].passion = passion

    # 2. Trait-based passion overrides
    trait_passion_map = {
        "kind": "social",
        "charismatic": "social",
        "creative": "artistic",
        "hardworking": "construction",
        "romantic": "artistic",
        "gossip": "social",
    }
    for trait in trait_list:
        if trait in trait_passion_map:
            skill_name = trait_passion_map[trait]
            s = skills.get(skill_name)
            # Boost passion if it's currently NONE
            if s.passion == Passion.NONE:
                s.passion = Passion.MINOR
            elif s.passion == Passion.MINOR:
                s.passion = Passion.MAJOR

    # 3. Starting XP based on age (more life experience = more skills)
    base_xp_pool = max(0, (age - 16)) * rng.randint(30, 60)

    # Distribute across all non-incapable skills with some randomness
    capable_skills = [s for s in skills.skills.values() if not s.is_incapable]
    if capable_skills:
        weights = []
        for s in capable_skills:
            w = 1.0
            if s.passion == Passion.BURNING:
                w = 5.0
            elif s.passion == Passion.MAJOR:
                w = 3.5
            elif s.passion == Passion.MINOR:
                w = 2.0
            weights.append(w)

        # Distribute XP pool
        remaining = base_xp_pool
        while remaining > 0:
            s = rng.choices(capable_skills, weights=weights, k=1)[0]
            chunk = min(remaining, rng.randint(10, 50))
            s.xp += chunk
            remaining -= chunk

    # 4. Job-based bonus XP
    if job_key and job_key in JOB_SKILL_MAP:
        mapping = JOB_SKILL_MAP[job_key]
        for skill_name in mapping.get("primary", []):
            s = skills.get(skill_name)
            if not s.is_incapable:
                bonus = rng.randint(200, 600)
                s.xp += bonus
                # Ensure job-relevant skills have at least minor passion
                if s.passion == Passion.NONE:
                    s.passion = Passion.MINOR
        for skill_name in mapping.get("secondary", []):
            s = skills.get(skill_name)
            if not s.is_incapable:
                s.xp += rng.randint(50, 250)

    # 5. Make sure incapable skills for job aren't incapable
    #    (you can't be an incapable-cooking cook)
    if job_key and job_key in JOB_SKILL_MAP:
        for skill_name in JOB_SKILL_MAP[job_key].get("primary", []):
            s = skills.get(skill_name)
            if s.is_incapable:
                s.passion = Passion.MINOR

    return skills
