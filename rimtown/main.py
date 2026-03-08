"""Main entry point for the RimTown simulation."""

from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv

from rimtown.config.loader import load_residents, load_town_config
from rimtown.core.world import World
from rimtown.llm.client import create_llm_client
from rimtown.social.conversation import ConversationEngine
from rimtown.social.gossip import GossipNetwork
from rimtown.town.map import create_default_town, generate_random_town
from rimtown.web.server import WebServer

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def run_simulation(world: World, tick_interval: float = 2.0):
    """Main simulation loop."""
    logger.info("Simulation started!")
    while True:
        try:
            await world.tick()

            # Broadcast state to WebSocket clients
            if hasattr(world, '_web_server'):
                await world._web_server.broadcast_state(world.get_state())

        except Exception as e:
            logger.error(f"Simulation error: {e}", exc_info=True)

        await asyncio.sleep(tick_interval)


async def main():
    logger.info("=== RimTown - AI Town Simulation ===")

    # Load configuration
    town_config = load_town_config()
    tick_interval = town_config.get("simulation", {}).get("tick_interval_seconds", 2.0)

    # Create world with map
    world = World()
    map_mode = os.getenv("MAP_MODE", town_config.get("settings", {}).get("map_mode", "random"))
    map_seed = os.getenv("MAP_SEED", "")

    if map_mode == "fixed":
        world.town_map = create_default_town()
        logger.info("Using fixed default town map")
    else:
        seed = int(map_seed) if map_seed.isdigit() else None
        world.town_map = generate_random_town(seed)
        logger.info(f"Generated random town map (seed: {world.town_map.seed}, terrain: {world.town_map.terrain})")

    # Setup LLM client and engines
    llm_client = create_llm_client()
    world._conversation_engine = ConversationEngine(llm_client)
    world._gossip_network = GossipNetwork()

    # Load residents
    residents = load_residents()
    for agent in residents:
        world.add_agent(agent)
    logger.info(f"Loaded {len(residents)} residents")

    # Create player agent
    from rimtown.agents.player import PlayerAgent
    player = PlayerAgent(name="Traveler")
    world.add_agent(player)
    logger.info("Player agent created - you start at the tavern")

    # Start web server
    web_server = WebServer(world)
    world._web_server = web_server
    world.subscribe(web_server.broadcast_state)
    await web_server.start()

    logger.info(f"Open http://localhost:8000 in your browser")
    logger.info(f"Tick interval: {tick_interval}s (each tick = 15 in-game minutes)")

    # Run simulation
    await run_simulation(world, tick_interval)


def entry():
    """CLI entry point."""
    asyncio.run(main())


if __name__ == "__main__":
    entry()
