"""Research / tech tree system."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rimtown.core.world import World


class ResearchStatus(enum.Enum):
    LOCKED = "locked"
    AVAILABLE = "available"
    RESEARCHING = "researching"
    COMPLETE = "complete"


@dataclass
class ResearchProject:
    """A research topic that can be studied."""
    key: str
    name: str
    description: str
    cost: float               # Research points needed
    progress: float = 0
    status: ResearchStatus = ResearchStatus.LOCKED
    prerequisites: list[str] = field(default_factory=list)
    effects: dict = field(default_factory=dict)
    unlocks: list[str] = field(default_factory=list)  # Building keys unlocked

    @property
    def progress_pct(self) -> float:
        return min(1.0, self.progress / self.cost) if self.cost > 0 else 1.0

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "cost": self.cost,
            "progress": round(self.progress, 1),
            "progress_pct": round(self.progress_pct, 2),
            "status": self.status.value,
            "prerequisites": self.prerequisites,
            "effects": self.effects,
            "unlocks": self.unlocks,
        }


# Tech tree definition
RESEARCH_TREE: dict[str, dict] = {
    "agriculture": {
        "name": "Advanced Agriculture",
        "description": "Better farming techniques increase food output by 30%",
        "cost": 50,
        "prerequisites": [],
        "effects": {"farm_bonus": 1.3},
        "unlocks": ["farm_irrigation", "garden"],
    },
    "metallurgy": {
        "name": "Metallurgy",
        "description": "Improved metal smelting and tool quality",
        "cost": 60,
        "prerequisites": [],
        "effects": {"smithing_bonus": 1.2, "tool_durability": 1.3},
        "unlocks": ["forge_bellows"],
    },
    "medicine_research": {
        "name": "Herbal Medicine",
        "description": "Better understanding of healing herbs",
        "cost": 55,
        "prerequisites": [],
        "effects": {"healing_bonus": 1.3},
        "unlocks": ["clinic_upgrade", "garden"],
    },
    "fortification": {
        "name": "Fortification",
        "description": "Knowledge to build defensive structures",
        "cost": 70,
        "prerequisites": [],
        "effects": {"defense_bonus": 2},
        "unlocks": ["watchtower", "training_ground", "town_walls"],
    },
    "commerce": {
        "name": "Commerce",
        "description": "Better trade practices and merchant relations",
        "cost": 45,
        "prerequisites": [],
        "effects": {"trade_bonus": 0.15},
        "unlocks": ["marketplace"],
    },
    "architecture": {
        "name": "Architecture",
        "description": "Advanced building techniques",
        "cost": 65,
        "prerequisites": ["metallurgy"],
        "effects": {"build_speed": 1.3},
        "unlocks": ["school", "town_walls"],
    },
    "brewing": {
        "name": "Brewing",
        "description": "The art of fermentation and brewing",
        "cost": 35,
        "prerequisites": ["agriculture"],
        "effects": {"recreation_bonus": 5},
        "unlocks": ["brewery"],
    },
    "logistics": {
        "name": "Logistics",
        "description": "Better storage and supply chain management",
        "cost": 50,
        "prerequisites": ["commerce"],
        "effects": {"storage_bonus": 1.5},
        "unlocks": ["granary"],
    },
    "education": {
        "name": "Education",
        "description": "Formal education system increases all skill growth",
        "cost": 80,
        "prerequisites": ["architecture"],
        "effects": {"xp_bonus": 1.15},
        "unlocks": ["school"],
    },
    "masonry": {
        "name": "Masonry",
        "description": "Advanced stonework techniques",
        "cost": 55,
        "prerequisites": ["fortification"],
        "effects": {"stone_efficiency": 1.3},
        "unlocks": ["town_walls", "well_upgrade"],
    },
}


class ResearchManager:
    """Manages the research / tech tree."""

    def __init__(self):
        self.projects: dict[str, ResearchProject] = {}
        self.current_research: str | None = None
        self._init_tree()

    def _init_tree(self):
        for key, data in RESEARCH_TREE.items():
            project = ResearchProject(
                key=key,
                name=data["name"],
                description=data["description"],
                cost=data["cost"],
                prerequisites=data.get("prerequisites", []),
                effects=data.get("effects", {}),
                unlocks=data.get("unlocks", []),
            )
            # Projects with no prerequisites start available
            if not project.prerequisites:
                project.status = ResearchStatus.AVAILABLE
            self.projects[key] = project

    def get_available(self) -> list[ResearchProject]:
        return [p for p in self.projects.values()
                if p.status == ResearchStatus.AVAILABLE]

    def start_research(self, key: str) -> bool:
        """Start researching a topic."""
        if key not in self.projects:
            return False
        project = self.projects[key]
        if project.status != ResearchStatus.AVAILABLE:
            return False

        # Cancel current research if any
        if self.current_research and self.current_research in self.projects:
            old = self.projects[self.current_research]
            if old.status == ResearchStatus.RESEARCHING:
                old.status = ResearchStatus.AVAILABLE

        project.status = ResearchStatus.RESEARCHING
        self.current_research = key
        return True

    def add_progress(self, amount: float, world: World):
        """Add research progress from researchers working."""
        if not self.current_research:
            return
        project = self.projects.get(self.current_research)
        if not project or project.status != ResearchStatus.RESEARCHING:
            return

        project.progress += amount

        if project.progress >= project.cost:
            self._complete_research(project, world)

    def _complete_research(self, project: ResearchProject, world: World):
        """Complete a research project and unlock dependents."""
        project.status = ResearchStatus.COMPLETE
        self.current_research = None

        # Apply effects to buildings manager
        if hasattr(world, 'buildings'):
            for key, value in project.effects.items():
                existing = world.buildings.active_effects.get(key, 0)
                if isinstance(value, (int, float)) and isinstance(existing, (int, float)):
                    world.buildings.active_effects[key] = existing + value
                else:
                    world.buildings.active_effects[key] = value

        # Check if any locked projects can now be unlocked
        for other in self.projects.values():
            if other.status == ResearchStatus.LOCKED:
                if all(self.projects[pre].status == ResearchStatus.COMPLETE
                       for pre in other.prerequisites
                       if pre in self.projects):
                    other.status = ResearchStatus.AVAILABLE

        world.log_message(
            "research",
            f"Research complete: {project.name}! {project.description}",
        )

        # Mood boost
        for agent in world.agents.values():
            agent.mood = min(100, agent.mood + 3)

    def daily_update(self, world: World):
        """Process daily research from researchers."""
        if not self.current_research:
            # Auto-select first available if nothing selected
            available = self.get_available()
            if available:
                self.start_research(available[0].key)
            return

        # Count researchers and their effectiveness
        total_points = 0
        for agent in world.agents.values():
            if getattr(agent, 'is_player', False):
                continue
            if agent.job and agent.job.title == "Researcher":
                skill = agent.skills.get("intellectual")
                level = skill.level if skill else 0
                points = 3 + level * 0.5  # 3-13 points per researcher
                total_points += points

        if total_points > 0:
            # Consume research points from stockpile too
            rp = world.stockpile.get("research_points")
            bonus = min(rp, 5)  # Up to 5 bonus from stockpile
            if bonus > 0:
                world.stockpile.consume("research_points", bonus, world.tick_count,
                                        "research consumption")
            self.add_progress(total_points + bonus, world)

    def to_dict(self) -> dict:
        return {
            "current_research": self.current_research,
            "projects": {k: p.to_dict() for k, p in self.projects.items()},
        }
