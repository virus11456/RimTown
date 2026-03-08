"""Production system - jobs produce resources, town consumes them."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rimtown.core.world import World


@dataclass
class ProductionRecipe:
    """What a job produces per work-day."""
    job_key: str
    inputs: dict[str, float]    # Resources consumed
    outputs: dict[str, float]   # Resources produced
    skill_name: str             # Skill that affects output quality
    base_efficiency: float = 1.0


# What each job produces/consumes per day when working
JOB_PRODUCTION: dict[str, ProductionRecipe] = {
    "farmer": ProductionRecipe(
        job_key="farmer",
        inputs={},
        outputs={"food": 12},
        skill_name="plants",
    ),
    "miner": ProductionRecipe(
        job_key="miner",
        inputs={"tools": 0.1},
        outputs={"stone": 6, "metal": 3},
        skill_name="mining",
    ),
    "cook": ProductionRecipe(
        job_key="cook",
        inputs={"food": 8},
        outputs={"meals": 12},
        skill_name="cooking",
    ),
    "blacksmith": ProductionRecipe(
        job_key="blacksmith",
        inputs={"metal": 3, "wood": 1},
        outputs={"tools": 3},
        skill_name="crafting",
    ),
    "carpenter": ProductionRecipe(
        job_key="carpenter",
        inputs={"wood": 4},
        outputs={"furniture": 2},
        skill_name="construction",
    ),
    "tailor": ProductionRecipe(
        job_key="tailor",
        inputs={"cloth": 3},
        outputs={"clothing": 2},
        skill_name="crafting",
    ),
    "doctor": ProductionRecipe(
        job_key="doctor",
        inputs={"herbs": 2},
        outputs={"medicine": 2},
        skill_name="medicine",
    ),
    "researcher": ProductionRecipe(
        job_key="researcher",
        inputs={},
        outputs={"research_points": 5},
        skill_name="intellectual",
    ),
    "trader": ProductionRecipe(
        job_key="trader",
        inputs={},
        outputs={"silver": 8},
        skill_name="social",
    ),
    "guard": ProductionRecipe(
        job_key="guard",
        inputs={},
        outputs={},  # Guards don't produce resources, they provide defense
        skill_name="shooting",
    ),
    "priest": ProductionRecipe(
        job_key="priest",
        inputs={},
        outputs={},  # Priest provides mood bonus instead
        skill_name="social",
    ),
    "mayor": ProductionRecipe(
        job_key="mayor",
        inputs={},
        outputs={"silver": 3},  # Tax collection
        skill_name="social",
    ),
}

# Daily consumption per resident
DAILY_CONSUMPTION = {
    "meals": 1.5,  # Each person eats 1.5 meals/day
}

# Seasonal modifiers for farming
SEASON_FARM_MODIFIER = {
    "spring": 1.2,
    "summer": 1.5,
    "autumn": 0.8,
    "winter": 0.2,
}

# Natural resource gathering (from nature locations)
NATURE_GATHERING: dict[str, dict[str, float]] = {
    "forest": {"wood": 3},
    "river": {"food": 2},     # Fishing
    "meadow": {"herbs": 1, "cloth": 0.5},  # Flax/cotton
    "cave": {"stone": 2, "metal": 1},
    "lake": {"food": 1.5},    # Fishing
}


def calculate_efficiency(agent, recipe: ProductionRecipe) -> float:
    """Calculate production efficiency based on agent's skill level."""
    skill = agent.skills.get(recipe.skill_name)
    if not skill:
        return recipe.base_efficiency

    # Skill level 0-20 maps to 0.5x - 2.5x efficiency
    level_bonus = 0.5 + (skill.level / 20) * 2.0

    # Passion bonus
    from rimtown.agents.skills import Passion
    passion_bonus = {
        Passion.INCAPABLE: 0,
        Passion.NONE: 1.0,
        Passion.MINOR: 1.1,
        Passion.MAJOR: 1.25,
        Passion.BURNING: 1.4,
    }.get(skill.passion, 1.0)

    # Mood bonus (-20% to +10%)
    mood_bonus = 1.0 + (agent.mood - 50) / 500

    # Random variance ±10%
    variance = random.uniform(0.9, 1.1)

    return recipe.base_efficiency * level_bonus * passion_bonus * mood_bonus * variance


def process_daily_production(world: World):
    """Process all production at end of day."""
    from rimtown.agents.agent import Activity

    stockpile = world.stockpile

    # 1. Each working agent produces resources
    for agent in world.agents.values():
        if getattr(agent, 'is_player', False):
            continue
        if not agent.job:
            continue

        # Get job key
        from rimtown.jobs.job import JOB_DEFINITIONS
        job_key = None
        for k, v in JOB_DEFINITIONS.items():
            if v["title"] == agent.job.title:
                job_key = k
                break

        if not job_key or job_key not in JOB_PRODUCTION:
            continue

        recipe = JOB_PRODUCTION[job_key]
        efficiency = calculate_efficiency(agent, recipe)

        # Season modifier for farmers
        if job_key == "farmer":
            season = world.clock.season.value
            efficiency *= SEASON_FARM_MODIFIER.get(season, 1.0)

        # Check if inputs are available
        can_produce = True
        for resource, amount in recipe.inputs.items():
            if not stockpile.has(resource, amount):
                can_produce = False
                break

        if not can_produce:
            # Log shortage
            world.log_message(
                "economy",
                f"{agent.name} couldn't work - not enough materials!",
                agent.name,
            )
            agent.mood = max(-100, agent.mood - 3)
            continue

        # Consume inputs
        for resource, amount in recipe.inputs.items():
            stockpile.consume(resource, amount, world.tick_count,
                              f"{agent.name}'s production", agent.name)

        # Produce outputs
        for resource, amount in recipe.outputs.items():
            produced = round(amount * efficiency, 1)
            stockpile.add(resource, produced, world.tick_count,
                          f"{agent.name} ({agent.job.title})", agent.name)

        # Priest mood bonus
        if job_key == "priest":
            for other in world.agents.values():
                if other.agent_id != agent.agent_id:
                    other.mood = min(100, other.mood + 1)

    # 2. Daily consumption
    npc_count = sum(1 for a in world.agents.values() if not getattr(a, 'is_player', False))
    for resource, per_person in DAILY_CONSUMPTION.items():
        total = per_person * npc_count
        if not stockpile.consume(resource, total, world.tick_count, "daily consumption"):
            # Not enough meals - people eat raw food instead
            deficit = total - stockpile.get(resource)
            if resource == "meals":
                # Fall back to raw food (less efficient)
                raw_needed = deficit * 2
                if stockpile.consume("food", raw_needed, world.tick_count, "emergency food"):
                    world.log_message("economy", "Not enough meals! Residents eating raw food.")
                else:
                    world.log_message("economy", "FOOD SHORTAGE! Residents are going hungry!")
                    # Mood penalty for everyone
                    for agent in world.agents.values():
                        agent.mood = max(-100, agent.mood - 10)
                        agent.needs.hunger = max(0, agent.needs.hunger - 20)

    # 3. Natural resource trickle from nature locations
    if world.town_map:
        for loc_id, gathering in NATURE_GATHERING.items():
            if world.town_map.get_location(loc_id):
                for resource, amount in gathering.items():
                    # Small daily passive income from nature
                    stockpile.add(resource, amount * 0.5, world.tick_count,
                                  f"natural ({loc_id})")

    # 4. Tool and clothing degradation
    stockpile.consume("tools", npc_count * 0.05, world.tick_count, "tool wear")
    stockpile.consume("clothing", npc_count * 0.03, world.tick_count, "clothing wear")

    # 5. Winter heating cost
    if world.clock.season.value == "winter":
        wood_cost = npc_count * 0.3
        if not stockpile.consume("wood", wood_cost, world.tick_count, "winter heating"):
            world.log_message("economy", "Not enough wood for heating! The cold is unbearable.")
            for agent in world.agents.values():
                agent.mood = max(-100, agent.mood - 8)
                agent.needs.comfort = max(0, agent.needs.comfort - 15)
