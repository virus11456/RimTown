# RimTown - AI Town Simulation

A RimWorld-inspired AI town simulation where every resident is an autonomous AI agent with unique personality, background, job, relationships, and daily life.

## Features

- **Autonomous AI Agents**: Each resident has personality traits, memories, moods, and psychological needs
- **Social Simulation**: Agents chat, gossip, form friendships, rivalries, and romantic relationships
- **Job System**: RimWorld-inspired jobs including farming, mining, cooking, crafting, doctoring, research, and more
- **Dynamic Events**: Random events, seasons, and emergencies that affect the town
- **Memory & Relationships**: Agents remember interactions and form opinions about each other
- **Web Visualization**: Real-time browser-based town visualization

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the simulation
python -m rimtown.main

# Open browser at http://localhost:8000
```

## Architecture

```
rimtown/
├── core/           # Simulation engine (world, time, events)
├── agents/         # AI agent system (personality, memory, behavior)
├── social/         # Social interactions (chat, gossip, relationships)
├── jobs/           # Job and economy system
├── town/           # Town map and locations
├── llm/            # LLM integration for agent conversations
├── web/            # Web visualization frontend
└── config/         # Town and agent configurations
```

## Configuration

Set your LLM API key in `.env`:

```
ANTHROPIC_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
```

Customize your town in `config/town.yaml` and residents in `config/residents.yaml`.
