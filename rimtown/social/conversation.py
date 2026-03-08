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

    async def generate_player_reply(self, player: Agent, npc: Agent, player_message: str,
                                     world: World) -> dict:
        """Generate an NPC reply to a player message using LLM."""
        rel_npc = npc.relationships.get_or_create(player.agent_id, player.name)
        rel_player = player.relationships.get_or_create(npc.agent_id, npc.name)

        # Gather recent chat history for context
        recent_chat = ""
        if hasattr(player, "chat_history"):
            recent_lines = [
                c for c in player.chat_history[-10:]
                if c.get("target") == npc.name or c.get("speaker") == npc.name
            ]
            recent_chat = "\n".join(
                f"{c['speaker']}: {c['text']}" for c in recent_lines
            )

        memories_npc = npc.memory.get_about_agent(player.name, n=5)

        prompt = f"""You are {npc.name}, a resident of a small town called RimTown. A visitor named {player.name} is talking to you. Reply in character as {npc.name}.

TIME: {world.clock.time_str}
LOCATION: {npc.current_location}

=== YOUR CHARACTER: {npc.name} ===
Age: {npc.age}
Job: {npc.job.title if npc.job else 'Unemployed'}
Personality: {npc.personality.describe()}
Background: {npc.personality.background}
Current mood: {npc.mood_description} (mood: {npc.mood})
Current activity: {npc.activity.value}
Your relationship with {player.name}: {rel_npc.relationship_type.value} (affinity: {rel_npc.affinity}, romantic interest: {rel_npc.romantic_interest})
Your memories about {player.name}: {chr(10).join(m.content for m in memories_npc) if memories_npc else "You don't know them well yet."}

=== {player.name} (the visitor) ===
Background: {player.personality.background}
Traits: {', '.join(player.personality.traits)}

=== RECENT CONVERSATION ===
{recent_chat if recent_chat else '(This is the start of the conversation)'}

{player.name}: {player_message}

Reply as {npc.name} with 1-3 sentences. Stay in character. Be natural. Respond in the same language {player.name} used.
After your reply, on a new line write EFFECTS: followed by a JSON object with:
- affinity_change: how your feeling toward {player.name} changed (-5 to 5)
- romantic_change: romantic interest change (0 to 3, only if applicable)
- summary: one sentence describing this exchange

Reply ONLY with {npc.name}'s dialogue and the EFFECTS line. Do not include the name prefix."""

        try:
            response = await self.llm.generate(prompt, max_tokens=300)
            return self._parse_player_reply(response, player, npc, world, player_message,
                                            rel_player, rel_npc)
        except Exception as e:
            logger.error(f"Player conversation failed: {e}")
            return self._fallback_player_reply(player, npc, world, player_message,
                                               rel_player, rel_npc)

    def _parse_player_reply(self, response: str, player: Agent, npc: Agent,
                            world: World, player_message: str,
                            rel_player, rel_npc) -> dict:
        """Parse LLM reply for player conversation."""
        import json as json_mod

        lines = response.strip().split("\n")
        reply_lines = []
        effects = {}

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("EFFECTS:"):
                try:
                    remaining = "\n".join(lines[lines.index(line):])
                    json_start = remaining.find("{")
                    json_end = remaining.rfind("}") + 1
                    if json_start >= 0 and json_end > json_start:
                        effects = json_mod.loads(remaining[json_start:json_end])
                except (json_mod.JSONDecodeError, ValueError):
                    pass
                break
            else:
                # Remove name prefix if LLM added it
                text = stripped
                if text.startswith(f"{npc.name}:"):
                    text = text[len(npc.name) + 1:].strip()
                reply_lines.append(text)

        npc_reply = " ".join(reply_lines).strip() or "..."
        affinity_change = effects.get("affinity_change", random.randint(0, 2))
        romantic_change = effects.get("romantic_change", 0)
        summary = effects.get("summary", f"{npc.name} replied to {player.name}.")

        # Apply effects
        rel_npc.modify_affinity(affinity_change)
        rel_npc.modify_romantic(romantic_change)
        rel_npc.record_interaction(world.tick_count, summary)

        rel_player.modify_affinity(max(0, affinity_change - 1))
        rel_player.record_interaction(world.tick_count, summary)

        # Store memories
        npc.memory.add(
            world.tick_count, world.clock.time_str, "conversation",
            f"{player.name} said: \"{player_message}\" - {summary}",
            importance=5, related_agents=[player.name],
        )
        player.memory.add(
            world.tick_count, world.clock.time_str, "conversation",
            f"Talked with {npc.name}: {summary}",
            importance=4, related_agents=[npc.name],
        )

        # Update player chat history
        if hasattr(player, "chat_history"):
            player.chat_history.append({
                "speaker": player.name, "target": npc.name,
                "text": player_message, "time": world.clock.time_str,
            })
            player.chat_history.append({
                "speaker": npc.name, "target": player.name,
                "text": npc_reply, "time": world.clock.time_str,
            })

        world.log_message("player_chat", f"{player.name} → {npc.name}: {summary}",
                          player.name, npc.name)

        return {
            "npc_name": npc.name,
            "npc_reply": npc_reply,
            "player_message": player_message,
            "effects": {
                "affinity_change": affinity_change,
                "romantic_change": romantic_change,
            },
            "summary": summary,
        }

    def _fallback_player_reply(self, player: Agent, npc: Agent, world: World,
                                player_message: str, rel_player, rel_npc) -> dict:
        """Simple fallback reply when LLM is unavailable."""
        replies_by_affinity = {
            "high": [
                f"It's always great to see you, {player.name}!",
                "I was just thinking about you! What's on your mind?",
                "Of course! I'm happy to chat with you anytime.",
            ],
            "medium": [
                "Oh, hello! What brings you here?",
                "Sure, I have a moment. What's up?",
                "Not a bad day, all things considered. How about you?",
            ],
            "low": [
                "Hmm? What do you want?",
                "I'm a bit busy right now...",
                "...",
            ],
        }

        if rel_npc.affinity > 30:
            pool = replies_by_affinity["high"]
        elif rel_npc.affinity > -10:
            pool = replies_by_affinity["medium"]
        else:
            pool = replies_by_affinity["low"]

        npc_reply = random.choice(pool)
        affinity_change = random.randint(0, 2)

        rel_npc.modify_affinity(affinity_change)
        rel_npc.record_interaction(world.tick_count, f"Chatted with {player.name}")
        rel_player.modify_affinity(affinity_change)
        rel_player.record_interaction(world.tick_count, f"Chatted with {npc.name}")

        npc.memory.add(world.tick_count, world.clock.time_str, "conversation",
                       f"{player.name} talked to me.", importance=4,
                       related_agents=[player.name])
        player.memory.add(world.tick_count, world.clock.time_str, "conversation",
                          f"Talked with {npc.name}.", importance=3,
                          related_agents=[npc.name])

        if hasattr(player, "chat_history"):
            player.chat_history.append({
                "speaker": player.name, "target": npc.name,
                "text": player_message, "time": world.clock.time_str,
            })
            player.chat_history.append({
                "speaker": npc.name, "target": player.name,
                "text": npc_reply, "time": world.clock.time_str,
            })

        world.log_message("player_chat", f"{player.name} chatted with {npc.name}",
                          player.name, npc.name)

        return {
            "npc_name": npc.name,
            "npc_reply": npc_reply,
            "player_message": player_message,
            "effects": {"affinity_change": affinity_change, "romantic_change": 0},
            "summary": f"{player.name} chatted with {npc.name}.",
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
