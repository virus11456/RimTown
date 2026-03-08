"""Load town and resident configurations from YAML files."""

from __future__ import annotations

import os

import yaml

from rimtown.agents.agent import Agent
from rimtown.agents.personality import Personality
from rimtown.jobs.job import create_job


CONFIG_DIR = os.path.dirname(__file__)


def load_residents() -> list[Agent]:
    """Load resident configurations and create Agent instances."""
    config_path = os.path.join(CONFIG_DIR, "residents.yaml")
    with open(config_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    agents = []
    for res in data.get("residents", []):
        personality = Personality(
            traits=res.get("traits", []),
            background=res.get("background", ""),
            values=res.get("values", []),
        )

        job = None
        if res.get("job"):
            job = create_job(res["job"], skill_level=res.get("skill_level", 3))

        agent = Agent(
            agent_id=res["id"],
            name=res["name"],
            age=res.get("age", 25),
            personality=personality,
            job=job,
            home_location=res.get("home", "residential_north"),
        )
        agents.append(agent)

    return agents


def load_town_config() -> dict:
    """Load town simulation configuration."""
    config_path = os.path.join(CONFIG_DIR, "town.yaml")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)
