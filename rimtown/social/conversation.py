"""Conversation engine - generates dialogues between agents using LLM."""

from __future__ import annotations

import logging
import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rimtown.agents.agent import Agent
    from rimtown.core.world import World

logger = logging.getLogger(__name__)


class ConversationEngine:
    """Generates and manages conversations between agents."""

    def __init__(self, llm_client):
        self.llm = llm_client

    async def generate_conversation(self, agent_a: Agent, agent_b: Agent, world: World,
                                     context: str = "") -> dict:
        """Generate a conversation between two agents."""
        rel_a = agent_a.relationships.get_or_create(agent_b.agent_id, agent_b.name)
        rel_b = agent_b.relationships.get_or_create(agent_a.agent_id, agent_a.name)

        # Get gossip topics
        gossip = world.events.get_gossip_topics()
        gossip_str = ", ".join(gossip[-3:]) if gossip else "nothing special happening"

        # Build context for LLM
        memories_a = agent_a.memory.get_about_agent(agent_b.name, n=3)
        memories_b = agent_b.memory.get_about_agent(agent_a.name, n=3)

        prompt = f"""You are simulating a conversation between two residents of a small town called RimTown.

TIME: {world.clock.time_str}
LOCATION: {agent_a.current_location}

=== PERSON A: {agent_a.name} ===
Job: {agent_a.job.title if agent_a.job else 'Unemployed'}
Personality: {agent_a.personality.describe()}
Background: {agent_a.personality.background}
Current mood: {agent_a.mood_description}
Relationship with {agent_b.name}: {rel_a.relationship_type.value} (affinity: {rel_a.affinity}, romantic interest: {rel_a.romantic_interest})
Recent memories about {agent_b.name}: {chr(10).join(m.content for m in memories_a) if memories_a else 'None'}

=== PERSON B: {agent_b.name} ===
Job: {agent_b.job.title if agent_b.job else 'Unemployed'}
Personality: {agent_b.personality.describe()}
Background: {agent_b.personality.background}
Current mood: {agent_b.mood_description}
Relationship with {agent_a.name}: {rel_b.relationship_type.value} (affinity: {rel_b.affinity}, romantic interest: {rel_b.romantic_interest})
Recent memories about {agent_a.name}: {chr(10).join(m.content for m in memories_b) if memories_b else 'None'}

TOWN GOSSIP/TOPICS: {gossip_str}
{f'CONTEXT: {context}' if context else ''}

Generate a natural, brief conversation (3-6 exchanges total) between {agent_a.name} and {agent_b.name}. The conversation should:
- Reflect their personalities and relationship
- Feel natural for the time of day and location
- Maybe include gossip, work talk, or personal topics
- Show genuine character through dialogue

After the conversation, on a new line write EFFECTS: and describe in JSON format:
- affinity_change_a: how much A's feeling toward B changed (-10 to 10)
- affinity_change_b: how much B's feeling toward A changed (-10 to 10)
- romantic_change_a: romantic interest change for A (0 to 5, only if applicable)
- romantic_change_b: romantic interest change for B (0 to 5, only if applicable)
- summary: one sentence summary of what happened in this conversation

Format each line as "NAME: dialogue"."""

        try:
            response = await self.llm.generate(prompt, max_tokens=600)
            return self._parse_conversation(response, agent_a, agent_b, world, rel_a, rel_b)
        except Exception as e:
            logger.error(f"Conversation generation failed: {e}")
            return self._fallback_conversation(agent_a, agent_b, world, rel_a, rel_b)

    def _parse_conversation(self, response: str, agent_a: Agent, agent_b: Agent,
                            world: World, rel_a, rel_b) -> dict:
        """Parse LLM response into conversation data."""
        lines = response.strip().split("\n")
        dialogue = []
        effects = {}

        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith("EFFECTS:"):
                try:
                    import json
                    effects_str = line[8:].strip()
                    # Try to find JSON in remaining lines too
                    remaining = "\n".join(lines[lines.index(line.strip()):])
                    json_start = remaining.find("{")
                    json_end = remaining.rfind("}") + 1
                    if json_start >= 0 and json_end > json_start:
                        effects = json.loads(remaining[json_start:json_end])
                except (json.JSONDecodeError, ValueError):
                    pass
                break
            elif ":" in line:
                parts = line.split(":", 1)
                speaker = parts[0].strip().strip("*")
                text = parts[1].strip()
                if speaker and text:
                    dialogue.append({"speaker": speaker, "text": text})

        # Apply effects
        affinity_a = effects.get("affinity_change_a", random.randint(-2, 5))
        affinity_b = effects.get("affinity_change_b", random.randint(-2, 5))
        romantic_a = effects.get("romantic_change_a", 0)
        romantic_b = effects.get("romantic_change_b", 0)
        summary = effects.get("summary", f"{agent_a.name} and {agent_b.name} had a chat.")

        rel_a.modify_affinity(affinity_a)
        rel_a.modify_romantic(romantic_a)
        rel_a.record_interaction(world.tick_count, summary)

        rel_b.modify_affinity(affinity_b)
        rel_b.modify_romantic(romantic_b)
        rel_b.record_interaction(world.tick_count, summary)

        # Store memories
        agent_a.memory.add(
            world.tick_count, world.clock.time_str, "conversation",
            f"Talked with {agent_b.name}: {summary}",
            importance=min(8, 4 + abs(affinity_a)),
            related_agents=[agent_b.name],
        )
        agent_b.memory.add(
            world.tick_count, world.clock.time_str, "conversation",
            f"Talked with {agent_a.name}: {summary}",
            importance=min(8, 4 + abs(affinity_b)),
            related_agents=[agent_a.name],
        )

        world.log_message(
            "conversation", summary,
            agent_name=agent_a.name, target_name=agent_b.name,
        )

        return {
            "dialogue": dialogue,
            "summary": summary,
            "effects": {
                "affinity_a": affinity_a,
                "affinity_b": affinity_b,
                "romantic_a": romantic_a,
                "romantic_b": romantic_b,
            },
        }

    def _fallback_conversation(self, agent_a: Agent, agent_b: Agent, world: World,
                                rel_a, rel_b) -> dict:
        """Generate a simple fallback conversation without LLM."""
        greetings = ["Hey", "Hi there", "Hello", "Good to see you", "Oh, hey"]
        topics = [
            f"How's the {agent_b.job.title if agent_b.job else 'day'} going?",
            "Nice weather today, isn't it?",
            "Have you heard any news lately?",
            "I've been so busy lately.",
            "This town is really something, huh?",
        ]

        dialogue = [
            {"speaker": agent_a.name, "text": f"{random.choice(greetings)}, {agent_b.name}!"},
            {"speaker": agent_b.name, "text": f"{random.choice(greetings)}! {random.choice(topics)}"},
            {"speaker": agent_a.name, "text": "Yeah, I know what you mean. Take care!"},
        ]

        summary = f"{agent_a.name} and {agent_b.name} had a brief chat."
        affinity_change = random.randint(0, 3)

        rel_a.modify_affinity(affinity_change)
        rel_a.record_interaction(world.tick_count, summary)
        rel_b.modify_affinity(affinity_change)
        rel_b.record_interaction(world.tick_count, summary)

        agent_a.memory.add(world.tick_count, world.clock.time_str, "conversation",
                           summary, importance=3, related_agents=[agent_b.name])
        agent_b.memory.add(world.tick_count, world.clock.time_str, "conversation",
                           summary, importance=3, related_agents=[agent_a.name])

        world.log_message("conversation", summary, agent_a.name, agent_b.name)

        return {"dialogue": dialogue, "summary": summary, "effects": {"affinity_a": affinity_change, "affinity_b": affinity_change}}
