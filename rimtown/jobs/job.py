"""Job system - RimWorld-inspired occupations for agents."""

from __future__ import annotations

import enum
import random
from dataclasses import dataclass, field


class JobCategory(enum.Enum):
    PRODUCTION = "production"
    SERVICE = "service"
    INTELLECTUAL = "intellectual"
    SOCIAL = "social"
    COMBAT = "combat"


@dataclass
class Job:
    title: str
    category: JobCategory
    description: str
    workplace: str        # Location ID where they work
    work_hours: tuple[int, int] = (8, 17)  # Start and end hour
    skill_level: int = 1  # 1-10
    daily_output: str = ""
    required_traits: list[str] = field(default_factory=list)

    @property
    def is_work_time(self) -> bool:
        """Check based on current hour - caller should pass hour."""
        return True  # Placeholder, checked in agent.update()

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "category": self.category.value,
            "description": self.description,
            "workplace": self.workplace,
            "work_hours": list(self.work_hours),
            "skill_level": self.skill_level,
        }


# All available jobs in RimTown
JOB_DEFINITIONS: dict[str, dict] = {
    "farmer": {
        "title": "Farmer",
        "category": JobCategory.PRODUCTION,
        "description": "Grows crops and tends to the fields",
        "workplace": "farm",
        "work_hours": (6, 16),
        "daily_output": "food and produce",
    },
    "miner": {
        "title": "Miner",
        "category": JobCategory.PRODUCTION,
        "description": "Extracts stone and ore from the quarry",
        "workplace": "quarry",
        "work_hours": (7, 16),
        "daily_output": "stone and minerals",
    },
    "cook": {
        "title": "Cook",
        "category": JobCategory.SERVICE,
        "description": "Prepares meals at the tavern for the town",
        "workplace": "tavern",
        "work_hours": (5, 14),
        "daily_output": "meals",
    },
    "blacksmith": {
        "title": "Blacksmith",
        "category": JobCategory.PRODUCTION,
        "description": "Forges tools and equipment at the workshop",
        "workplace": "workshop",
        "work_hours": (8, 17),
        "daily_output": "tools and equipment",
    },
    "doctor": {
        "title": "Doctor",
        "category": JobCategory.INTELLECTUAL,
        "description": "Treats the sick and injured at the clinic",
        "workplace": "clinic",
        "work_hours": (8, 18),
        "daily_output": "medical care",
    },
    "researcher": {
        "title": "Researcher",
        "category": JobCategory.INTELLECTUAL,
        "description": "Studies and discovers new knowledge at the library",
        "workplace": "library",
        "work_hours": (9, 17),
        "daily_output": "research findings",
    },
    "trader": {
        "title": "Trader",
        "category": JobCategory.SOCIAL,
        "description": "Manages the general store and trade relations",
        "workplace": "general_store",
        "work_hours": (8, 18),
        "daily_output": "trade goods",
    },
    "guard": {
        "title": "Guard",
        "category": JobCategory.COMBAT,
        "description": "Patrols and protects the town",
        "workplace": "guardpost",
        "work_hours": (6, 18),
        "daily_output": "security",
    },
    "carpenter": {
        "title": "Carpenter",
        "category": JobCategory.PRODUCTION,
        "description": "Builds and repairs structures at the workshop",
        "workplace": "workshop",
        "work_hours": (7, 16),
        "daily_output": "wooden structures and furniture",
    },
    "tailor": {
        "title": "Tailor",
        "category": JobCategory.PRODUCTION,
        "description": "Makes clothing and textiles",
        "workplace": "workshop",
        "work_hours": (8, 17),
        "daily_output": "clothing",
    },
    "priest": {
        "title": "Priest",
        "category": JobCategory.SOCIAL,
        "description": "Tends to the spiritual needs of the community at the chapel",
        "workplace": "chapel",
        "work_hours": (7, 19),
        "daily_output": "spiritual guidance",
    },
    "mayor": {
        "title": "Mayor",
        "category": JobCategory.SOCIAL,
        "description": "Leads the town from the town hall",
        "workplace": "town_hall",
        "work_hours": (9, 17),
        "daily_output": "governance and decisions",
    },
}


def create_job(job_key: str, skill_level: int = 1) -> Job:
    defn = JOB_DEFINITIONS[job_key]
    return Job(
        title=defn["title"],
        category=defn["category"],
        description=defn["description"],
        workplace=defn["workplace"],
        work_hours=defn.get("work_hours", (8, 17)),
        skill_level=skill_level,
        daily_output=defn.get("daily_output", ""),
    )
