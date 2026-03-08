"""Core Agent class - an autonomous AI resident of RimTown."""

from __future__ import annotations

import enum
import logging
import random
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from rimtown.agents.memory import Memory
from rimtown.agents.needs import Needs
from rimtown.agents.personality import Personality
from rimtown.agents.skills import SkillSet, generate_random_skills, JOB_SKILL_MAP, ACTIVITY_SKILL_MAP
from rimtown.jobs.job import Job
from rimtown.social.relationships import RelationshipManager

if TYPE_CHECKING:
    from rimtown.core.world import World

logger = logging.getLogger(__name__)


class Activity(enum.Enum):
    SLEEPING = "sleeping"
    EATING = "eating"
    WORKING = "working"
    SOCIALIZING = "socializing"
    WANDERING = "wandering"
    RECREATION = "recreation"
    IDLE = "idle"


class Agent:
    """An autonomous AI agent living in RimTown."""

    def __init__(
        self,
        agent_id: str,
        name: str,
        age: int = 25,
        personality: Personality | None = None,
        job: Job | None = None,
        home_location: str = "residential_north",
        skills: SkillSet | None = None,
    ):
        self.agent_id = agent_id
        self.name = name
        self.age = age
        self.personality = personality or Personality.random()
        self.job = job
        self.home_location = home_location
        self.current_location: str = home_location
        self.target_location: str | None = None

        # State
        self.mood: int = 50 + self.personality.mood_base
        self.activity: Activity = Activity.IDLE
        self.needs = Needs()
        self.memory = Memory()
        self.relationships = RelationshipManager()

        # Skills - generate based on job/age/traits if not provided
        if skills:
            self.skills = skills
        else:
            job_key = None
            if self.job:
                # Reverse lookup job key from title
                from rimtown.jobs.job import JOB_DEFINITIONS
                for k, v in JOB_DEFINITIONS.items():
                    if v["title"] == self.job.title:
                        job_key = k
                        break
            self.skills = generate_random_skills(
                job_key=job_key,
                age=self.age,
                trait_list=self.personality.traits,
            )

        # Interaction cooldown (prevent constant chatting)
        self._last_interaction_tick: int = 0
        self._interaction_cooldown: int = 4  # 4 ticks = 1 hour

        # Internal thought
        self.current_thought: str = ""

    @property
    def mood_description(self) -> str:
        if self.mood >= 80:
            return "ecstatic"
        elif self.mood >= 60:
            return "happy"
        elif self.mood >= 40:
            return "content"
        elif self.mood >= 20:
            return "unhappy"
        elif self.mood >= 0:
            return "stressed"
        else:
            return "miserable"

    async def update(self, world: World):
        """Main update loop - called every tick (15 in-game minutes)."""
        hour = world.clock.hour
        time_of_day = world.clock.time_of_day.value

        # Decide activity based on needs, time, and schedule
        old_activity = self.activity
        self._decide_activity(hour)

        # Update needs based on current activity
        self.needs.tick_decay(
            is_sleeping=self.activity == Activity.SLEEPING,
            is_eating=self.activity == Activity.EATING,
            is_socializing=self.activity == Activity.SOCIALIZING,
            is_recreating=self.activity == Activity.RECREATION,
        )

        # Update mood from needs
        need_mood = self.needs.mood_contribution
        self.mood = max(-100, min(100, 50 + self.personality.mood_base + int(need_mood)))

        # Gain skill XP from current activity
        self._gain_skill_xp(world)

        # Move to appropriate location
        self._decide_location(hour)
        if self.target_location and self.target_location != self.current_location:
            self.current_location = self.target_location
            self.target_location = None

        # Social interactions
        if self.activity == Activity.SOCIALIZING:
            await self._try_social_interaction(world)

        # Generate internal thought occasionally
        if random.random() < 0.1:
            self._generate_thought(world)

    def _gain_skill_xp(self, world: World):
        """Gain skill XP based on current activity."""
        activity_name = self.activity.value
        xp_amount = random.randint(3, 8)

        # Working gives XP in job-related skills
        if self.activity == Activity.WORKING and self.job:
            from rimtown.jobs.job import JOB_DEFINITIONS
            job_key = None
            for k, v in JOB_DEFINITIONS.items():
                if v["title"] == self.job.title:
                    job_key = k
                    break
            if job_key and job_key in JOB_SKILL_MAP:
                mapping = JOB_SKILL_MAP[job_key]
                for skill_name in mapping.get("primary", []):
                    leveled = self.skills.add_xp(skill_name, xp_amount * 2)
                    if leveled:
                        lvl = self.skills.get(skill_name).level
                        world.log_message(
                            "skill_up",
                            f"{self.name}'s {skill_name} reached level {lvl}!",
                            self.name,
                        )
                        self.current_thought = f"I'm getting better at {skill_name}!"
                for skill_name in mapping.get("secondary", []):
                    self.skills.add_xp(skill_name, xp_amount)

        # Other activities give smaller passive XP
        elif activity_name in ACTIVITY_SKILL_MAP:
            for skill_name in ACTIVITY_SKILL_MAP[activity_name]:
                leveled = self.skills.add_xp(skill_name, xp_amount)
                if leveled:
                    lvl = self.skills.get(skill_name).level
                    world.log_message(
                        "skill_up",
                        f"{self.name}'s {skill_name} reached level {lvl}!",
                        self.name,
                    )

    def _decide_activity(self, hour: int):
        """Decide what to do based on time and needs."""
        # Check for schedule traits
        is_night_owl = "night_owl" in self.personality.traits
        is_early_bird = "early_bird" in self.personality.traits

        sleep_start = 23 if is_night_owl else (20 if is_early_bird else 22)
        sleep_end = 8 if is_night_owl else (5 if is_early_bird else 6)

        # Sleep schedule
        if hour >= sleep_start or hour < sleep_end:
            if self.needs.rest < 90:  # Stay sleeping until rested
                self.activity = Activity.SLEEPING
                return

        # Urgent needs override
        if self.needs.hunger < 15:
            self.activity = Activity.EATING
            return
        if self.needs.rest < 10:
            self.activity = Activity.SLEEPING
            return

        # Work hours
        if self.job:
            work_start, work_end = self.job.work_hours
            if work_start <= hour < work_end:
                # Occasional break for food
                if self.needs.hunger < 30 and random.random() < 0.3:
                    self.activity = Activity.EATING
                    return
                self.activity = Activity.WORKING
                return

        # Free time activities
        urgent_need = self.needs.most_urgent
        if urgent_need == "hunger":
            self.activity = Activity.EATING
        elif urgent_need == "social":
            self.activity = Activity.SOCIALIZING
        elif urgent_need == "recreation":
            self.activity = Activity.RECREATION
        else:
            # Random free-time choice
            choices = [Activity.SOCIALIZING, Activity.WANDERING, Activity.RECREATION]
            weights = [3, 2, 2]
            # Social personality is more social
            if self.personality.social_modifier > 0:
                weights[0] += 2
            self.activity = random.choices(choices, weights=weights, k=1)[0]

    def _decide_location(self, hour: int):
        """Decide where to go based on current activity."""
        if self.activity == Activity.SLEEPING:
            self.target_location = self.home_location
        elif self.activity == Activity.EATING:
            self.target_location = "tavern"
        elif self.activity == Activity.WORKING and self.job:
            self.target_location = self.job.workplace
        elif self.activity == Activity.SOCIALIZING:
            social_spots = ["tavern", "town_square", "park", "well", "chapel"]
            self.target_location = random.choice(social_spots)
        elif self.activity == Activity.RECREATION:
            rec_spots = ["park", "library", "forest", "river", "tavern"]
            self.target_location = random.choice(rec_spots)
        elif self.activity == Activity.WANDERING:
            all_spots = [
                "town_square", "park", "forest", "river", "well",
                "general_store", "chapel",
            ]
            self.target_location = random.choice(all_spots)

    async def _try_social_interaction(self, world: World):
        """Try to interact with another agent at the same location."""
        if world.tick_count - self._last_interaction_tick < self._interaction_cooldown:
            return

        others = [
            a for a in world.get_agents_at_location(self.current_location)
            if a.agent_id != self.agent_id
            and a.activity not in (Activity.SLEEPING,)
        ]

        if not others:
            return

        # Pick someone to interact with
        target = self._pick_interaction_target(others)
        if not target:
            return

        self._last_interaction_tick = world.tick_count

        # Try gossip first (30% chance)
        if random.random() < 0.3 and hasattr(world, '_gossip_network'):
            world._gossip_network.spread_gossip(self, target, world)

        # Have a conversation if conversation engine is available
        if hasattr(world, '_conversation_engine'):
            await world._conversation_engine.generate_conversation(self, target, world)
        else:
            # Simple fallback interaction
            rel = self.relationships.get_or_create(target.agent_id, target.name)
            rel.modify_affinity(random.randint(-1, 3))
            rel.record_interaction(world.tick_count, f"Chatted at {self.current_location}")

            target_rel = target.relationships.get_or_create(self.agent_id, self.name)
            target_rel.modify_affinity(random.randint(-1, 3))
            target_rel.record_interaction(world.tick_count, f"Chatted at {self.current_location}")

            self.memory.add(
                world.tick_count, world.clock.time_str, "conversation",
                f"Had a chat with {target.name} at {self.current_location}",
                importance=3, related_agents=[target.name],
            )
            target.memory.add(
                world.tick_count, world.clock.time_str, "conversation",
                f"Had a chat with {self.name} at {self.current_location}",
                importance=3, related_agents=[self.name],
            )

            world.log_message(
                "conversation",
                f"{self.name} chatted with {target.name} at {self.current_location}",
                self.name, target.name,
            )

    def _pick_interaction_target(self, others: list[Agent]) -> Agent | None:
        """Pick who to talk to, preferring friends and romantic interests."""
        if not others:
            return None

        weights = []
        for other in others:
            rel = self.relationships.get_or_create(other.agent_id, other.name)
            weight = 5  # base weight
            weight += max(0, rel.affinity // 10)  # prefer friends
            weight += rel.romantic_interest // 10  # prefer crushes
            if rel.affinity < -30:
                weight = max(1, weight - 5)  # avoid enemies (but not zero)
            weights.append(max(1, weight))

        return random.choices(others, weights=weights, k=1)[0]

    def _generate_thought(self, world: World):
        """Generate an internal thought."""
        thoughts = []

        if self.mood > 60:
            thoughts.append("Life in RimTown is pretty good.")
            thoughts.append("I feel great today!")
        elif self.mood < 20:
            thoughts.append("Things could be better...")
            thoughts.append("I'm not feeling so great.")

        if self.needs.hunger < 30:
            thoughts.append("I'm getting hungry...")
        if self.needs.rest < 30:
            thoughts.append("I could really use some sleep...")
        if self.needs.social < 30:
            thoughts.append("I should talk to someone...")

        # Think about relationships
        best_friend = self.relationships.get_best_friend()
        if best_friend:
            thoughts.append(f"I should catch up with {best_friend.target_name}.")

        romantic = self.relationships.get_romantic_interests()
        if romantic:
            r = random.choice(romantic)
            thoughts.append(f"I keep thinking about {r.target_name}...")

        # Think about skills
        best = self.skills.best_skill
        if best.level > 0:
            thoughts.append(f"I've been improving at {best.category.value}...")
        passions = self.skills.passions
        if passions:
            p = random.choice(passions)
            thoughts.append(f"I really enjoy practicing {p.category.value}.")

        if thoughts:
            self.current_thought = random.choice(thoughts)

    def to_dict(self) -> dict:
        return {
            "id": self.agent_id,
            "name": self.name,
            "age": self.age,
            "job": self.job.to_dict() if self.job else None,
            "personality": self.personality.to_dict(),
            "mood": self.mood,
            "mood_description": self.mood_description,
            "activity": self.activity.value,
            "current_location": self.current_location,
            "current_thought": self.current_thought,
            "needs": self.needs.to_dict(),
            "skills": self.skills.to_dict(),
            "relationships": self.relationships.to_dict(),
            "recent_memories": self.memory.to_dict(),
        }
