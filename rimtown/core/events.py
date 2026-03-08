"""Random event system with raids, event chains, and travel departures."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rimtown.core.world import World


@dataclass
class GameEvent:
    name: str
    description: str
    severity: str  # "minor", "moderate", "major"
    effects: dict = field(default_factory=dict)
    event_type: str = "random"  # "random", "raid", "chain", "departure", "arrival"


# --- Event Chain Definitions ---
# Each chain is a sequence: triggering one event may lead to the next after N days
EVENT_CHAINS: dict[str, list[dict]] = {
    "drought_famine_riot": [
        {
            "name": "Drought",
            "description": "The wells are running dry and crops are withering under the relentless sun.",
            "severity": "moderate",
            "effects": {"mood_all": -8, "conversation_topic": "the terrible drought"},
            "seasons": ["summer"],
            "duration_days": 3,
        },
        {
            "name": "Famine",
            "description": "Food supplies are critically low. The drought has devastated the harvest.",
            "severity": "major",
            "effects": {"mood_all": -15, "conversation_topic": "the worsening famine"},
            "delay_days": 3,
            "duration_days": 4,
        },
        {
            "name": "Riot",
            "description": "Desperate and hungry, some townsfolk have started fighting over the last supplies!",
            "severity": "major",
            "effects": {"mood_all": -20, "conversation_topic": "the riot in the town square"},
            "delay_days": 4,
            "duration_days": 2,
        },
    ],
    "plague_quarantine_recovery": [
        {
            "name": "Mysterious Illness",
            "description": "Several residents are showing signs of a strange illness.",
            "severity": "moderate",
            "effects": {"mood_all": -10, "conversation_topic": "the mysterious illness spreading"},
            "duration_days": 2,
        },
        {
            "name": "Quarantine",
            "description": "The doctor has ordered a quarantine. No one leaves their homes.",
            "severity": "major",
            "effects": {"mood_all": -15, "conversation_topic": "the quarantine lockdown"},
            "delay_days": 2,
            "duration_days": 3,
        },
        {
            "name": "Recovery",
            "description": "The illness has passed! The townsfolk celebrate their survival.",
            "severity": "minor",
            "effects": {"mood_all": 15, "conversation_topic": "recovering from the illness"},
            "delay_days": 3,
            "duration_days": 1,
        },
    ],
    "storm_damage_rebuild": [
        {
            "name": "Great Storm",
            "description": "A terrible storm is battering the town with fierce winds and rain!",
            "severity": "major",
            "effects": {"mood_all": -12, "conversation_topic": "the devastating storm"},
            "seasons": ["autumn", "winter"],
            "duration_days": 1,
        },
        {
            "name": "Storm Damage",
            "description": "The storm has passed but left significant damage to buildings and roads.",
            "severity": "moderate",
            "effects": {"mood_all": -8, "conversation_topic": "repairing storm damage"},
            "delay_days": 1,
            "duration_days": 3,
        },
        {
            "name": "Community Rebuild",
            "description": "Everyone pitches in to rebuild. The shared effort brings people closer.",
            "severity": "minor",
            "effects": {"mood_all": 10, "social_bonus": True, "conversation_topic": "the community rebuild effort"},
            "delay_days": 3,
            "duration_days": 2,
        },
    ],
}

# --- Raid Definitions ---
RAID_POOL: list[dict] = [
    {
        "name": "Bandit Raid",
        "description": "A group of bandits has been spotted approaching the town!",
        "severity": "major",
        "threat_level": 3,  # 1-5
        "attacker": "bandits",
        "effects": {"mood_all": -15, "conversation_topic": "the bandit attack"},
    },
    {
        "name": "Wild Beast Attack",
        "description": "A pack of wild wolves has come down from the mountains!",
        "severity": "moderate",
        "threat_level": 2,
        "attacker": "wolves",
        "effects": {"mood_all": -10, "conversation_topic": "the wolf attack"},
    },
    {
        "name": "Marauder Incursion",
        "description": "Armed marauders are raiding the outskirts of town!",
        "severity": "major",
        "threat_level": 4,
        "attacker": "marauders",
        "effects": {"mood_all": -18, "conversation_topic": "the marauder incursion"},
    },
    {
        "name": "Wild Boar Rampage",
        "description": "A group of enraged wild boars is charging through town!",
        "severity": "moderate",
        "threat_level": 2,
        "attacker": "boars",
        "effects": {"mood_all": -8, "conversation_topic": "the wild boar rampage"},
    },
]

# --- Standalone Random Events ---
EVENT_POOL: list[dict] = [
    {
        "name": "Bountiful Harvest",
        "description": "The crops are growing exceptionally well this season!",
        "severity": "minor",
        "effects": {"mood_all": 5, "food_bonus": 20},
        "seasons": ["spring", "summer"],
    },
    {
        "name": "Cold Snap",
        "description": "An unexpected cold front has hit the town. Everyone feels miserable.",
        "severity": "moderate",
        "effects": {"mood_all": -10},
        "seasons": ["winter", "autumn"],
    },
    {
        "name": "Festival Day",
        "description": "The town decides to hold a festival! Everyone gathers to celebrate.",
        "severity": "minor",
        "effects": {"mood_all": 15, "social_gathering": True},
    },
    {
        "name": "Supply Shortage",
        "description": "Trade routes are disrupted. Supplies are running low.",
        "severity": "moderate",
        "effects": {"mood_all": -5, "trade_penalty": True},
    },
    {
        "name": "Strange Lights",
        "description": "Strange lights are seen in the sky. The townsfolk are both fascinated and uneasy.",
        "severity": "minor",
        "effects": {"mood_all": -3, "conversation_topic": "strange lights in the sky"},
    },
    {
        "name": "Travelling Merchant",
        "description": "A travelling merchant arrives with rare goods and stories from afar.",
        "severity": "minor",
        "effects": {"mood_all": 5, "conversation_topic": "the travelling merchant's exotic wares"},
    },
    {
        "name": "Beautiful Aurora",
        "description": "A stunning aurora lights up the night sky.",
        "severity": "minor",
        "effects": {"mood_all": 10},
        "seasons": ["winter"],
    },
    {
        "name": "Heatwave",
        "description": "Scorching heat makes outdoor work unbearable.",
        "severity": "moderate",
        "effects": {"mood_all": -8, "work_penalty": True},
        "seasons": ["summer"],
    },
    {
        "name": "Lucky Find",
        "description": "Someone discovered a cache of valuable materials near the quarry!",
        "severity": "minor",
        "effects": {"mood_all": 8, "conversation_topic": "the lucky discovery at the quarry"},
    },
    {
        "name": "Stargazing Night",
        "description": "The sky is exceptionally clear tonight. Perfect for stargazing.",
        "severity": "minor",
        "effects": {"mood_all": 5, "conversation_topic": "the beautiful starry sky"},
    },
]

# --- Travel / Departure reasons ---
DEPARTURE_REASONS: list[str] = [
    "decided to go on a trading expedition to a distant town",
    "left to visit family in the city",
    "embarked on a pilgrimage to a sacred site",
    "went on an adventure to explore the wilderness",
    "left to study at a faraway academy",
    "departed to seek fortune in the capital",
    "went travelling to broaden their horizons",
    "left for a supply run to a neighbouring settlement",
]

# --- Immigration names & backgrounds pool ---
IMMIGRANT_POOL: list[dict] = [
    {"name": "周明 (Zhou Ming)", "age": 27, "traits": ["hardworking", "optimist"], "job": "farmer",
     "background": "A cheerful young farmer from a neighbouring village, seeking new opportunities."},
    {"name": "李雪 (Li Xue)", "age": 31, "traits": ["kind", "perfectionist"], "job": "tailor",
     "background": "A skilled seamstress who heard RimTown needed her talents."},
    {"name": "鄭強 (Zheng Qiang)", "age": 35, "traits": ["stoic", "hardworking"], "job": "miner",
     "background": "A veteran miner who has worked in quarries across the region."},
    {"name": "何芳 (He Fang)", "age": 24, "traits": ["charismatic", "romantic"], "job": "cook",
     "background": "An enthusiastic cook who dreams of opening the best tavern in the land."},
    {"name": "蔡文 (Cai Wen)", "age": 42, "traits": ["creative", "neurotic"], "job": "researcher",
     "background": "An eccentric scholar drawn by rumours of ancient ruins near the town."},
    {"name": "呂嵐 (Lv Lan)", "age": 29, "traits": ["shy", "early_bird"], "job": "carpenter",
     "background": "A quiet carpenter who prefers to let their craftsmanship speak."},
    {"name": "丁傑 (Ding Jie)", "age": 38, "traits": ["abrasive", "hardworking"], "job": "blacksmith",
     "background": "A rough-spoken but masterful blacksmith from the frontier."},
    {"name": "蕭瑜 (Xiao Yu)", "age": 23, "traits": ["optimist", "gossip"], "job": "trader",
     "background": "A young merchant with a knack for finding bargains and spreading news."},
    {"name": "唐琳 (Tang Lin)", "age": 33, "traits": ["kind", "night_owl"], "job": "doctor",
     "background": "A compassionate healer who travels where they are needed most."},
    {"name": "曹峰 (Cao Feng)", "age": 44, "traits": ["stoic", "pessimist"], "job": "guard",
     "background": "A seasoned warrior looking for a quieter life guarding a peaceful town."},
    {"name": "邱雅 (Qiu Ya)", "age": 21, "traits": ["creative", "shy"], "job": "tailor",
     "background": "A young artisan with a gift for beautiful embroidery."},
    {"name": "范浩 (Fan Hao)", "age": 36, "traits": ["lazy", "charismatic"], "job": "priest",
     "background": "A laid-back spiritual guide who believes in taking life slowly."},
]


class EventSystem:
    """Manages random events, raids, event chains, departures, and arrivals."""

    TARGET_POPULATION = 12

    def __init__(self):
        self.event_log: list[tuple[str, GameEvent]] = []
        self.active_effects: dict = {}
        self.conversation_topics: list[str] = []

        # Event chain tracking
        self._active_chains: list[dict] = []
        # { "chain_id": str, "stage": int, "days_until_next": int }

        # Travel tracking
        self._travelling_agents: list[dict] = []
        # { "agent_data": dict, "return_tick": int, "reason": str }

        # Cooldowns
        self._days_since_raid: int = 5
        self._days_since_chain: int = 5
        self._days_since_departure: int = 3

        # Immigration queue
        self._pending_immigrants: list[dict] = []
        self._used_immigrant_names: set[str] = set()

    def daily_update(self, world: World):
        """Called once per in-game day. Handles all event logic."""
        self._days_since_raid += 1
        self._days_since_chain += 1
        self._days_since_departure += 1

        # 1. Progress active event chains
        self._progress_chains(world)

        # 2. Check for returning travellers
        self._check_returning_travellers(world)

        # 3. Roll for new events
        event = self._roll_daily_event(world)

        # 4. Population management
        self._manage_population(world)

        return event

    def _roll_daily_event(self, world: World) -> GameEvent | None:
        """Roll for daily random event, raid, or chain start."""
        roll = random.random()

        # 10% chance for raid (cooldown: 5+ days)
        if roll < 0.10 and self._days_since_raid >= 5:
            return self._trigger_raid(world)

        # 8% chance for event chain start (cooldown: 7+ days)
        if roll < 0.18 and self._days_since_chain >= 7 and not self._active_chains:
            return self._start_event_chain(world)

        # 20% chance for standalone random event
        if roll < 0.38:
            return self._trigger_random_event(world)

        # 5% chance for voluntary departure (if population > TARGET)
        npc_count = sum(1 for a in world.agents.values() if not getattr(a, 'is_player', False))
        if roll < 0.43 and self._days_since_departure >= 4 and npc_count > self.TARGET_POPULATION:
            self._trigger_departure(world)

        return None

    def _trigger_random_event(self, world: World) -> GameEvent | None:
        """Trigger a standalone random event."""
        season = world.clock.season.value
        eligible = [
            e for e in EVENT_POOL
            if "seasons" not in e or season in e["seasons"]
        ]
        if not eligible:
            return None

        event_data = random.choice(eligible)
        event = GameEvent(
            name=event_data["name"],
            description=event_data["description"],
            severity=event_data["severity"],
            effects=event_data.get("effects", {}),
            event_type="random",
        )

        self.event_log.append((world.clock.time_str, event))
        self._apply_effects(event, world)
        return event

    def _trigger_raid(self, world: World) -> GameEvent:
        """Trigger a raid event. Guards defend, raiders may cause someone to flee."""
        self._days_since_raid = 0

        raid_data = random.choice(RAID_POOL)
        event = GameEvent(
            name=raid_data["name"],
            description=raid_data["description"],
            severity=raid_data["severity"],
            effects=raid_data.get("effects", {}),
            event_type="raid",
        )

        self.event_log.append((world.clock.time_str, event))
        self._apply_effects(event, world)

        # Resolve raid: guards defend
        threat = raid_data["threat_level"]
        attacker = raid_data["attacker"]
        guards = [a for a in world.agents.values()
                  if a.job and a.job.title == "Guard" and not getattr(a, 'is_player', False)]

        # Building defense bonus
        building_defense = 0
        if hasattr(world, 'buildings'):
            building_defense = world.buildings.get_effect("defense_bonus", 0) or 0

        defense_power = len(guards) * 2 + random.randint(1, 3) + building_defense

        if defense_power >= threat:
            # Successful defense
            result_msg = f"The town successfully defended against the {attacker}!"
            world.log_message("raid", result_msg)
            for g in guards:
                g.mood = min(100, g.mood + 10)
                g.memory.add(
                    world.tick_count, world.clock.time_str, "raid",
                    f"Helped defend the town against {attacker}!",
                    importance=8,
                )
        else:
            # Raid causes damage - one random NPC gets scared and leaves temporarily
            result_msg = f"The {attacker} overwhelmed our defenses!"
            world.log_message("raid", result_msg)

            # Raiders steal resources
            if hasattr(world, 'stockpile'):
                stolen_food = min(world.stockpile.get("food"), random.randint(10, 30))
                stolen_silver = min(world.stockpile.get("silver"), random.randint(5, 20))
                if stolen_food > 0:
                    world.stockpile.consume("food", stolen_food, world.tick_count, f"stolen by {attacker}")
                if stolen_silver > 0:
                    world.stockpile.consume("silver", stolen_silver, world.tick_count, f"stolen by {attacker}")
                world.log_message("raid", f"The {attacker} stole {stolen_food:.0f} food and {stolen_silver:.0f} silver!")

            # Someone might flee temporarily
            npcs = [a for a in world.agents.values()
                    if not getattr(a, 'is_player', False) and a.job and a.job.title != "Guard"]
            if npcs and random.random() < 0.4:
                fleeing = random.choice(npcs)
                reason = f"fled town after the {attacker} attack to recover"
                self._send_agent_travelling(world, fleeing, reason, travel_days=3)

        return event

    def _start_event_chain(self, world: World) -> GameEvent | None:
        """Start a new event chain."""
        season = world.clock.season.value

        eligible_chains = []
        for chain_id, stages in EVENT_CHAINS.items():
            first = stages[0]
            if "seasons" not in first or season in first["seasons"]:
                eligible_chains.append(chain_id)

        if not eligible_chains:
            return None

        chain_id = random.choice(eligible_chains)
        stages = EVENT_CHAINS[chain_id]
        first_stage = stages[0]

        self._days_since_chain = 0
        self._active_chains.append({
            "chain_id": chain_id,
            "stage": 0,
            "days_until_next": first_stage.get("duration_days", 2),
        })

        event = GameEvent(
            name=first_stage["name"],
            description=first_stage["description"],
            severity=first_stage["severity"],
            effects=first_stage.get("effects", {}),
            event_type="chain",
        )

        self.event_log.append((world.clock.time_str, event))
        self._apply_effects(event, world)

        world.log_message("chain_event", f"Event chain started: {first_stage['name']}")
        return event

    def _progress_chains(self, world: World):
        """Progress active event chains by one day."""
        completed = []
        for chain in self._active_chains:
            chain["days_until_next"] -= 1
            if chain["days_until_next"] <= 0:
                chain_id = chain["chain_id"]
                stages = EVENT_CHAINS[chain_id]
                next_stage_idx = chain["stage"] + 1

                if next_stage_idx >= len(stages):
                    # Chain completed
                    completed.append(chain)
                    world.log_message("chain_event", f"Event chain '{chain_id}' has concluded.")
                else:
                    # Trigger next stage
                    stage = stages[next_stage_idx]
                    chain["stage"] = next_stage_idx
                    chain["days_until_next"] = stage.get("duration_days", 2)

                    event = GameEvent(
                        name=stage["name"],
                        description=stage["description"],
                        severity=stage["severity"],
                        effects=stage.get("effects", {}),
                        event_type="chain",
                    )
                    self.event_log.append((world.clock.time_str, event))
                    self._apply_effects(event, world)

                    world.log_message(
                        "chain_event",
                        f"[{event.severity.upper()}] {event.name}: {event.description}",
                    )

        for c in completed:
            self._active_chains.remove(c)

    def _trigger_departure(self, world: World):
        """A random NPC decides to leave town for travel."""
        self._days_since_departure = 0
        npcs = [a for a in world.agents.values() if not getattr(a, 'is_player', False)]
        if not npcs:
            return

        traveller = random.choice(npcs)
        reason = random.choice(DEPARTURE_REASONS)
        self._send_agent_travelling(world, traveller, reason, travel_days=random.randint(3, 7))

    def _send_agent_travelling(self, world: World, agent, reason: str, travel_days: int):
        """Remove an agent temporarily — they're travelling."""
        agent_data = {
            "agent_id": agent.agent_id,
            "name": agent.name,
            "age": agent.age,
            "job_title": agent.job.title if agent.job else None,
            "personality_traits": agent.personality.traits,
            "personality_values": agent.personality.values,
            "background": agent.personality.background,
            "home_location": agent.home_location,
        }

        return_tick = world.tick_count + (travel_days * 96)  # 96 ticks per day

        self._travelling_agents.append({
            "agent_data": agent_data,
            "return_tick": return_tick,
            "reason": reason,
        })

        # Notify everyone
        world.log_message(
            "departure",
            f"{agent.name} {reason}. They'll be back in a few days.",
            agent.name,
        )

        event = GameEvent(
            name="Resident Departure",
            description=f"{agent.name} {reason}.",
            severity="minor",
            effects={"conversation_topic": f"{agent.name} leaving town"},
            event_type="departure",
        )
        self.event_log.append((world.clock.time_str, event))
        self.conversation_topics.append(f"{agent.name} leaving town")

        # Add memory to nearby agents
        for other in world.agents.values():
            if other.agent_id != agent.agent_id:
                other.memory.add(
                    world.tick_count, world.clock.time_str, "departure",
                    f"{agent.name} {reason}.",
                    importance=5, related_agents=[agent.name],
                )

        # Remove from world
        world.remove_agent(agent.agent_id)

    def _check_returning_travellers(self, world: World):
        """Check if any travelling agents should return."""
        returned = []
        for travel in self._travelling_agents:
            if world.tick_count >= travel["return_tick"]:
                returned.append(travel)

        for travel in returned:
            self._travelling_agents.remove(travel)
            self._return_agent(world, travel)

    def _return_agent(self, world: World, travel: dict):
        """Bring a travelling agent back to town."""
        from rimtown.agents.agent import Agent
        from rimtown.agents.personality import Personality
        from rimtown.jobs.job import create_job, JOB_DEFINITIONS

        data = travel["agent_data"]
        personality = Personality(
            traits=data["personality_traits"],
            background=data.get("background", ""),
            values=data.get("personality_values", []),
        )

        job = None
        if data.get("job_title"):
            for k, v in JOB_DEFINITIONS.items():
                if v["title"] == data["job_title"]:
                    job = create_job(k)
                    break

        agent = Agent(
            agent_id=data["agent_id"],
            name=data["name"],
            age=data["age"],
            personality=personality,
            job=job,
            home_location=data.get("home_location", "residential_north"),
        )

        world.add_agent(agent)
        world.log_message(
            "arrival",
            f"{agent.name} has returned from their travels!",
            agent.name,
        )

        event = GameEvent(
            name="Resident Returns",
            description=f"{agent.name} has returned from their travels with stories to tell!",
            severity="minor",
            effects={"mood_all": 3, "conversation_topic": f"{agent.name}'s travel stories"},
            event_type="arrival",
        )
        self.event_log.append((world.clock.time_str, event))

        # Everyone is happy to see them back
        for other in world.agents.values():
            if other.agent_id != agent.agent_id:
                other.memory.add(
                    world.tick_count, world.clock.time_str, "arrival",
                    f"{agent.name} returned from travelling!",
                    importance=4, related_agents=[agent.name],
                )

    def _manage_population(self, world: World):
        """Ensure population stays around TARGET_POPULATION."""
        npc_count = sum(1 for a in world.agents.values() if not getattr(a, 'is_player', False))
        travelling_count = len(self._travelling_agents)

        # Count total (in town + travelling)
        total = npc_count + travelling_count

        if total < self.TARGET_POPULATION:
            deficit = self.TARGET_POPULATION - total
            for _ in range(deficit):
                self._spawn_immigrant(world)

    def _spawn_immigrant(self, world: World):
        """Create a new immigrant to fill population."""
        from rimtown.agents.agent import Agent
        from rimtown.agents.personality import Personality
        from rimtown.jobs.job import create_job

        # Pick from pool, avoiding duplicates
        available = [p for p in IMMIGRANT_POOL if p["name"] not in self._used_immigrant_names]
        if not available:
            # Reset pool if exhausted
            self._used_immigrant_names.clear()
            available = list(IMMIGRANT_POOL)

        immigrant_data = random.choice(available)
        self._used_immigrant_names.add(immigrant_data["name"])

        # Generate unique ID
        base_id = immigrant_data["name"].split("(")[1].rstrip(")").strip().lower().replace(" ", "_")
        agent_id = f"imm_{base_id}_{world.tick_count}"

        personality = Personality(
            traits=immigrant_data["traits"],
            background=immigrant_data["background"],
        )
        personality.values = random.sample(
            ["family", "freedom", "knowledge", "wealth", "power", "art", "nature", "community", "adventure", "peace"],
            k=random.randint(1, 3),
        )

        job = create_job(immigrant_data["job"])

        homes = ["residential_north", "residential_south", "residential_east"]
        home = random.choice(homes)

        agent = Agent(
            agent_id=agent_id,
            name=immigrant_data["name"],
            age=immigrant_data["age"],
            personality=personality,
            job=job,
            home_location=home,
        )

        world.add_agent(agent)

        # Announce arrival
        world.log_message(
            "immigration",
            f"A new resident has arrived: {agent.name}, a {job.title}!",
            agent.name,
        )

        event = GameEvent(
            name="New Resident",
            description=f"{agent.name} has arrived in town as a new {job.title}!",
            severity="minor",
            effects={"mood_all": 5, "conversation_topic": f"the new resident {agent.name}"},
            event_type="arrival",
        )
        self.event_log.append((world.clock.time_str, event))
        self.conversation_topics.append(f"the new resident {agent.name}")

        for other in world.agents.values():
            if other.agent_id != agent.agent_id:
                other.memory.add(
                    world.tick_count, world.clock.time_str, "immigration",
                    f"A new resident named {agent.name} arrived in town!",
                    importance=5, related_agents=[agent.name],
                )

    def _apply_effects(self, event: GameEvent, world: World):
        """Apply event effects to the world."""
        if "conversation_topic" in event.effects:
            self.conversation_topics.append(event.effects["conversation_topic"])
            self.conversation_topics = self.conversation_topics[-5:]

        if "mood_all" in event.effects:
            self.active_effects["mood_modifier"] = event.effects["mood_all"]

        # Economy effects
        if hasattr(world, 'stockpile'):
            if "food_bonus" in event.effects:
                world.stockpile.add("food", event.effects["food_bonus"],
                                    world.tick_count, event.name)
                world.log_message("economy", f"Gained {event.effects['food_bonus']} food from {event.name}!")

    def get_recent_events(self, n: int = 10) -> list[tuple[str, GameEvent]]:
        return self.event_log[-n:]

    def get_gossip_topics(self) -> list[str]:
        topics = list(self.conversation_topics)
        for _, event in self.event_log[-3:]:
            topics.append(event.description)
        return topics

    def get_travelling_agents(self) -> list[dict]:
        """Return info about agents currently travelling."""
        return [
            {
                "name": t["agent_data"]["name"],
                "reason": t["reason"],
                "return_tick": t["return_tick"],
            }
            for t in self._travelling_agents
        ]

    def get_active_chains(self) -> list[dict]:
        """Return info about active event chains."""
        result = []
        for chain in self._active_chains:
            chain_id = chain["chain_id"]
            stages = EVENT_CHAINS[chain_id]
            current = stages[chain["stage"]]
            result.append({
                "chain": chain_id,
                "current_event": current["name"],
                "stage": chain["stage"] + 1,
                "total_stages": len(stages),
            })
        return result
