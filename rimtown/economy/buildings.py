"""Building and upgrade system."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rimtown.core.world import World


class BuildingStatus(enum.Enum):
    PLANNED = "planned"
    BUILDING = "building"
    COMPLETE = "complete"


@dataclass
class BuildingProject:
    """An active building or upgrade project."""
    project_id: str
    name: str
    description: str
    location_id: str
    costs: dict[str, float]          # Resources required
    work_required: int               # Work ticks needed
    work_done: int = 0
    status: BuildingStatus = BuildingStatus.PLANNED
    effects: dict = field(default_factory=dict)
    required_skill: str = "construction"
    required_level: int = 0

    @property
    def progress(self) -> float:
        if self.work_required == 0:
            return 1.0
        return self.work_done / self.work_required

    def to_dict(self) -> dict:
        return {
            "project_id": self.project_id,
            "name": self.name,
            "description": self.description,
            "location_id": self.location_id,
            "costs": self.costs,
            "work_required": self.work_required,
            "work_done": self.work_done,
            "status": self.status.value,
            "progress": round(self.progress, 2),
            "effects": self.effects,
        }


# Building project templates
BUILDING_TEMPLATES: dict[str, dict] = {
    # New buildings
    "watchtower": {
        "name": "Watchtower",
        "description": "Improves town defense and early raid warning",
        "costs": {"wood": 40, "stone": 30},
        "work_required": 20,
        "effects": {"defense_bonus": 3, "raid_warning": True},
        "required_skill": "construction",
        "required_level": 5,
    },
    "granary": {
        "name": "Granary",
        "description": "Increases food storage capacity and reduces spoilage",
        "costs": {"wood": 30, "stone": 20},
        "work_required": 15,
        "effects": {"food_capacity": 500, "spoilage_reduction": 0.5},
        "required_skill": "construction",
        "required_level": 3,
    },
    "marketplace": {
        "name": "Marketplace",
        "description": "Attracts more merchants and improves trade prices",
        "costs": {"wood": 25, "stone": 15, "silver": 50},
        "work_required": 18,
        "effects": {"trade_bonus": 0.2, "merchant_frequency": 1.5},
        "required_skill": "construction",
        "required_level": 4,
    },
    "well_upgrade": {
        "name": "Deep Well",
        "description": "Better water supply, reduces drought impact",
        "costs": {"stone": 25, "tools": 3},
        "work_required": 12,
        "effects": {"drought_resistance": 0.5},
        "required_skill": "mining",
        "required_level": 4,
    },
    "training_ground": {
        "name": "Training Ground",
        "description": "Guards train faster, improving town defense",
        "costs": {"wood": 20, "stone": 10, "tools": 2},
        "work_required": 10,
        "effects": {"combat_xp_bonus": 1.5, "defense_bonus": 2},
        "required_skill": "construction",
        "required_level": 3,
    },
    "brewery": {
        "name": "Brewery",
        "description": "Produces ale, boosting tavern mood bonuses",
        "costs": {"wood": 15, "metal": 5, "silver": 30},
        "work_required": 14,
        "effects": {"recreation_bonus": 10, "tavern_mood": 5},
        "required_skill": "construction",
        "required_level": 3,
    },
    "garden": {
        "name": "Herb Garden",
        "description": "Produces herbs for medicine",
        "costs": {"wood": 10, "silver": 15},
        "work_required": 8,
        "effects": {"herbs_production": 2},
        "required_skill": "plants",
        "required_level": 3,
    },
    "school": {
        "name": "School",
        "description": "Increases all skill XP gain for the town",
        "costs": {"wood": 30, "stone": 20, "silver": 40},
        "work_required": 22,
        "effects": {"xp_bonus": 1.2},
        "required_skill": "construction",
        "required_level": 6,
    },

    # Upgrades to existing buildings
    "farm_irrigation": {
        "name": "Farm Irrigation",
        "description": "Irrigate the farm for better crop yield",
        "costs": {"stone": 15, "wood": 10, "tools": 2},
        "work_required": 12,
        "effects": {"farm_bonus": 1.3},
        "required_skill": "construction",
        "required_level": 4,
    },
    "forge_bellows": {
        "name": "Forge Bellows",
        "description": "Upgrade the workshop forge for faster metalwork",
        "costs": {"metal": 10, "stone": 5},
        "work_required": 10,
        "effects": {"smithing_bonus": 1.3},
        "required_skill": "crafting",
        "required_level": 5,
    },
    "clinic_upgrade": {
        "name": "Medical Ward",
        "description": "Upgrade the clinic for better healing",
        "costs": {"wood": 15, "cloth": 10, "silver": 25},
        "work_required": 14,
        "effects": {"healing_bonus": 1.5, "plague_resistance": 0.3},
        "required_skill": "construction",
        "required_level": 5,
    },
    "town_walls": {
        "name": "Town Walls",
        "description": "Build defensive walls around the town",
        "costs": {"stone": 80, "wood": 30, "tools": 5},
        "work_required": 40,
        "effects": {"defense_bonus": 8, "raid_damage_reduction": 0.5},
        "required_skill": "construction",
        "required_level": 8,
    },
}


class BuildingManager:
    """Manages building projects for the town."""

    def __init__(self):
        self.projects: list[BuildingProject] = []
        self.completed: list[BuildingProject] = []
        self.active_effects: dict = {}  # Accumulated effects from completed buildings
        self._project_counter: int = 0

    def get_available_projects(self, world: World) -> list[dict]:
        """Get list of projects that can be started."""
        completed_names = {p.name for p in self.completed}
        in_progress_names = {p.name for p in self.projects}

        available = []
        for key, template in BUILDING_TEMPLATES.items():
            if template["name"] in completed_names:
                continue
            if template["name"] in in_progress_names:
                continue

            can_afford = world.stockpile.can_afford(template["costs"])
            available.append({
                "key": key,
                "name": template["name"],
                "description": template["description"],
                "costs": template["costs"],
                "can_afford": can_afford,
                "work_required": template["work_required"],
                "required_skill": template.get("required_skill", "construction"),
                "required_level": template.get("required_level", 0),
                "effects": template.get("effects", {}),
            })

        return available

    def start_project(self, project_key: str, world: World) -> BuildingProject | None:
        """Start a new building project if affordable."""
        if project_key not in BUILDING_TEMPLATES:
            return None

        template = BUILDING_TEMPLATES[project_key]

        # Check if already built or in progress
        all_names = {p.name for p in self.completed} | {p.name for p in self.projects}
        if template["name"] in all_names:
            return None

        # Pay costs
        if not world.stockpile.pay(template["costs"], world.tick_count,
                                    f"Building: {template['name']}"):
            return None

        self._project_counter += 1
        project = BuildingProject(
            project_id=f"build_{self._project_counter}",
            name=template["name"],
            description=template["description"],
            location_id=template.get("location_id", "town_square"),
            costs=template["costs"],
            work_required=template["work_required"],
            effects=template.get("effects", {}),
            required_skill=template.get("required_skill", "construction"),
            required_level=template.get("required_level", 0),
        )
        project.status = BuildingStatus.BUILDING
        self.projects.append(project)

        world.log_message(
            "building",
            f"Construction started: {project.name}!",
        )
        return project

    def process_daily_construction(self, world: World):
        """Advance construction progress based on available workers."""
        completed_this_tick = []

        for project in self.projects:
            if project.status != BuildingStatus.BUILDING:
                continue

            # Find workers with construction skill
            workers = []
            for agent in world.agents.values():
                if getattr(agent, 'is_player', False):
                    continue
                if not agent.job:
                    continue
                # Carpenters and miners contribute to construction
                if agent.job.title in ("Carpenter", "Miner", "Blacksmith"):
                    skill = agent.skills.get(project.required_skill)
                    skill_level = skill.level if skill else 0
                    if skill_level >= project.required_level:
                        workers.append((agent, skill_level))

            if not workers:
                continue

            # Each qualified worker contributes work
            for agent, skill_level in workers:
                contribution = 1 + skill_level // 5  # 1-5 work points per worker
                project.work_done += contribution

            if project.work_done >= project.work_required:
                project.status = BuildingStatus.COMPLETE
                completed_this_tick.append(project)

        for project in completed_this_tick:
            self.projects.remove(project)
            self.completed.append(project)
            self._apply_effects(project)

            world.log_message(
                "building",
                f"Construction complete: {project.name}!",
            )
            # Mood boost for everyone
            for agent in world.agents.values():
                agent.mood = min(100, agent.mood + 5)

    def _apply_effects(self, project: BuildingProject):
        """Apply completed building effects."""
        for key, value in project.effects.items():
            if key in self.active_effects:
                if isinstance(value, (int, float)):
                    self.active_effects[key] = self.active_effects[key] + value
                else:
                    self.active_effects[key] = value
            else:
                self.active_effects[key] = value

    def get_effect(self, key: str, default=None):
        return self.active_effects.get(key, default)

    def to_dict(self) -> dict:
        return {
            "in_progress": [p.to_dict() for p in self.projects],
            "completed": [p.to_dict() for p in self.completed],
            "active_effects": dict(self.active_effects),
            "completed_count": len(self.completed),
        }
