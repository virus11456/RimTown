"""Gossip system - agents share information and rumors about others."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rimtown.agents.agent import Agent
    from rimtown.core.world import World


@dataclass
class GossipItem:
    about: str          # Name of the agent being gossiped about
    content: str        # The gossip content
    source: str         # Who started this gossip
    spread_count: int = 0
    tick_created: int = 0
    is_true: bool = True


class GossipNetwork:
    """Manages the spread of gossip through the town."""

    def __init__(self):
        self.active_gossip: list[GossipItem] = []

    def create_gossip(self, source: Agent, about: Agent, world: World) -> GossipItem | None:
        """Create new gossip based on observed events."""
        # Check if source has interesting observations
        memories = source.memory.get_about_agent(about.name, n=3)
        if not memories:
            return None

        # Pick something to gossip about
        rel = source.relationships.get_or_create(about.agent_id, about.name)

        templates = []
        if rel.romantic_interest > 20:
            templates.append(f"I think {about.name} is quite attractive, don't you think?")
        if rel.affinity < -10:
            templates.append(f"Between you and me, {about.name} has been acting strange lately.")
        if about.mood < -20:
            templates.append(f"Have you noticed {about.name} seems really down lately?")
        if about.mood > 50:
            templates.append(f"{about.name} has been in such a great mood recently!")

        # Gossip based on relationships
        romantic_interests = about.relationships.get_romantic_interests()
        if romantic_interests:
            ri = random.choice(romantic_interests)
            templates.append(f"I heard {about.name} might have feelings for {ri.target_name}!")

        if not templates:
            templates.append(f"Did you hear what {about.name} was up to yesterday?")

        content = random.choice(templates)
        gossip = GossipItem(
            about=about.name,
            content=content,
            source=source.name,
            tick_created=world.tick_count,
            is_true=random.random() > 0.2,  # 80% chance gossip is true
        )
        self.active_gossip.append(gossip)
        # Keep gossip list manageable
        if len(self.active_gossip) > 30:
            self.active_gossip = self.active_gossip[-20:]

        return gossip

    def spread_gossip(self, speaker: Agent, listener: Agent, world: World) -> GossipItem | None:
        """Attempt to spread existing gossip from speaker to listener."""
        if not self.active_gossip:
            return None

        # Don't gossip about someone to their face
        eligible = [g for g in self.active_gossip if g.about != listener.name]
        if not eligible:
            return None

        # Gossip trait makes agents more likely to spread gossip
        has_gossip_trait = "gossip" in speaker.personality.traits
        if not has_gossip_trait and random.random() > 0.3:
            return None

        gossip = random.choice(eligible)
        gossip.spread_count += 1

        # Listener forms memory and opinion
        listener.memory.add(
            world.tick_count, world.clock.time_str, "social",
            f"{speaker.name} told me: \"{gossip.content}\"",
            importance=4,
            related_agents=[speaker.name, gossip.about],
        )

        world.log_message(
            "gossip",
            f"{speaker.name} gossiped to {listener.name} about {gossip.about}",
            speaker.name, listener.name,
        )

        return gossip

    def get_gossip_about(self, name: str) -> list[GossipItem]:
        return [g for g in self.active_gossip if g.about == name]
