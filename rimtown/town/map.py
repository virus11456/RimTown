"""Town map and location system with random generation."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field


@dataclass
class Location:
    location_id: str
    name: str
    description: str
    x: int = 0
    y: int = 0
    category: str = "general"  # residential, work, social, nature
    capacity: int = 10

    def to_dict(self) -> dict:
        return {
            "id": self.location_id,
            "name": self.name,
            "description": self.description,
            "x": self.x,
            "y": self.y,
            "category": self.category,
            "capacity": self.capacity,
        }


class TownMap:
    """Manages the town layout and locations."""

    def __init__(self, seed: int | None = None):
        self.locations: dict[str, Location] = {}
        self.width: int = 800
        self.height: int = 600
        self.seed: int = seed if seed is not None else random.randint(0, 999999)
        self.terrain: str = "plains"  # Set during generation

    def add_location(self, location: Location):
        self.locations[location.location_id] = location

    def get_location(self, location_id: str) -> Location | None:
        return self.locations.get(location_id)

    def get_locations_by_category(self, category: str) -> list[Location]:
        return [loc for loc in self.locations.values() if loc.category == category]

    def to_dict(self) -> dict:
        return {
            "width": self.width,
            "height": self.height,
            "seed": self.seed,
            "terrain": self.terrain,
            "locations": {lid: loc.to_dict() for lid, loc in self.locations.items()},
        }


# ===== Location Templates for Random Generation =====

# Each template: (id_prefix, name_variants, description_variants, category, capacity_range)
CORE_LOCATIONS = [
    # Every town must have these
    ("town_square", ["Town Square", "Central Plaza", "Market Square", "Village Green"],
     "The heart of the settlement", "social", (15, 25)),
    ("tavern", ["The Rusty Pickaxe", "Dragon's Rest Inn", "The Golden Tankard", "Moonlight Tavern",
                "The Wanderer's Haven", "The Tipsy Goat"],
     "Food, drink, and socializing", "social", (10, 18)),
    ("town_hall", ["Town Hall", "Council Hall", "Mayor's Office", "Elder's Lodge"],
     "Where the town is governed", "work", (5, 10)),
]

WORK_LOCATIONS = [
    ("farm", ["Sunny Fields", "Green Acres", "Harvest Moon Farm", "Golden Wheat Farm", "Willow Creek Farm"],
     "Fertile land for growing crops", "work", (4, 8)),
    ("quarry", ["Deep Rock Quarry", "Iron Ridge Mine", "Stonecutter's Pit", "Crystal Cavern Mine"],
     "Rich mineral deposits", "work", (4, 8)),
    ("workshop", ["Crafter's Workshop", "The Forge & Anvil", "Tinker's Bench", "Artisan's Hall"],
     "Where goods are crafted", "work", (5, 10)),
    ("general_store", ["General Store", "Trading Post", "Merchant's Corner", "Supply Depot"],
     "Trade and supplies", "work", (4, 8)),
    ("clinic", ["Town Clinic", "Healer's Hut", "Apothecary", "Herbalist's Cabin"],
     "Medical care for all", "work", (3, 6)),
    ("library", ["The Old Library", "Scholar's Archive", "Book Tower", "Hall of Records"],
     "Knowledge and research", "work", (4, 8)),
    ("guardpost", ["Guard Post", "Watchtower", "Militia Barracks", "Sentinel's Keep"],
     "Watching over the town", "work", (3, 5)),
    ("bakery", ["Town Bakery", "The Flour Mill", "Sweet Hearth Bakery", "Golden Crust"],
     "Fresh bread and pastries", "work", (3, 6)),
    ("lumber_mill", ["Lumber Mill", "Sawyer's Yard", "Woodcutter's Camp", "Timber Works"],
     "Processing wood from the forest", "work", (4, 7)),
    ("stable", ["Town Stables", "Horse Paddock", "The Hitching Post", "Rider's Rest"],
     "Animals and transport", "work", (3, 6)),
]

SOCIAL_LOCATIONS = [
    ("chapel", ["Chapel of Light", "Stone Temple", "Shrine of Harmony", "Prayer Garden"],
     "A place of peace and reflection", "social", (8, 15)),
    ("park", ["Town Park", "Blossom Garden", "Sunlit Meadow", "Memorial Gardens"],
     "A peaceful green space", "social", (10, 18)),
    ("well", ["Town Well", "Spring Fountain", "Water Mill", "Stone Well"],
     "Fresh water and chance encounters", "social", (3, 6)),
    ("market", ["Open Market", "Bazaar Square", "Farmer's Market", "Night Market"],
     "Where goods are bought and sold", "social", (8, 15)),
    ("bathhouse", ["Public Baths", "Hot Springs", "Steam House", "Riverside Baths"],
     "Relaxation and cleanliness", "social", (5, 10)),
]

RESIDENTIAL_LOCATIONS = [
    ("residential_north", ["North Quarter", "Hilltop Houses", "Upper District", "Maple Lane"],
     "Residential area", "residential", (8, 12)),
    ("residential_south", ["South Quarter", "Riverside Homes", "Lower District", "Oak Street"],
     "Residential area", "residential", (8, 12)),
    ("residential_east", ["East Quarter", "Sunrise Houses", "Garden District", "Elm Row"],
     "Residential area", "residential", (8, 12)),
]

NATURE_LOCATIONS = [
    ("forest", ["Whispering Woods", "Dark Pines", "Eldergrove", "Moonlit Forest", "Cedar Thicket"],
     "Dense forest at the settlement's edge", "nature", (6, 10)),
    ("river", ["Crystal River", "Silverbrook", "Rushing Creek", "Still Waters", "Blue Bend River"],
     "A calm river nearby", "nature", (4, 8)),
    ("hill", ["Outlook Hill", "Windswept Ridge", "Eagle's Peak", "Sunset Bluff"],
     "High ground with a view", "nature", (3, 6)),
    ("cave", ["Shadow Cave", "Echo Cavern", "Old Mine Shaft", "Hollow Rock"],
     "A mysterious opening in the rock", "nature", (2, 5)),
    ("lake", ["Mirror Lake", "Lily Pond", "Deep Pool", "Glacial Tarn"],
     "A body of still water", "nature", (4, 7)),
    ("meadow", ["Wildflower Meadow", "Rolling Fields", "Clover Flats", "Butterfly Meadow"],
     "Open grasslands", "nature", (5, 10)),
]

# Terrain types affect which nature locations appear and town name flavor
TERRAIN_TYPES = [
    {"name": "plains", "nature_bonus": ["meadow", "river"], "nature_remove": ["cave"], "desc": "flat grasslands"},
    {"name": "forest", "nature_bonus": ["forest", "cave"], "nature_remove": ["meadow"], "desc": "dense woodlands"},
    {"name": "mountain", "nature_bonus": ["cave", "hill"], "nature_remove": ["lake"], "desc": "rocky highlands"},
    {"name": "riverside", "nature_bonus": ["river", "lake"], "nature_remove": ["cave"], "desc": "river valley"},
    {"name": "coastal", "nature_bonus": ["lake", "hill"], "nature_remove": ["forest"], "desc": "near the coast"},
]


def _place_locations(locations: list[Location], width: int, height: int, rng: random.Random):
    """Distribute locations across the map using a force-directed approach."""
    margin = 60
    center_x, center_y = width // 2, height // 2

    # Initial placement: category-based zones with randomness
    zone_map = {
        "social": (center_x, center_y),
        "work": (center_x, center_y),
        "residential": (center_x, center_y),
        "nature": (center_x, center_y),
    }

    for loc in locations:
        zx, zy = zone_map.get(loc.category, (center_x, center_y))

        # Category-based placement bias
        if loc.category == "social":
            # Social near center
            loc.x = rng.randint(center_x - 150, center_x + 150)
            loc.y = rng.randint(center_y - 100, center_y + 100)
        elif loc.category == "work":
            # Work spread around
            angle = rng.uniform(0, math.pi * 2)
            dist = rng.randint(80, 250)
            loc.x = int(center_x + math.cos(angle) * dist)
            loc.y = int(center_y + math.sin(angle) * dist)
        elif loc.category == "residential":
            # Residential in clusters
            angle = rng.uniform(0, math.pi * 2)
            dist = rng.randint(120, 220)
            loc.x = int(center_x + math.cos(angle) * dist)
            loc.y = int(center_y + math.sin(angle) * dist)
        elif loc.category == "nature":
            # Nature on edges
            angle = rng.uniform(0, math.pi * 2)
            dist = rng.randint(200, 350)
            loc.x = int(center_x + math.cos(angle) * dist)
            loc.y = int(center_y + math.sin(angle) * dist)

    # Force-directed repulsion to avoid overlap (simple version)
    for _ in range(50):
        for i, a in enumerate(locations):
            for j, b in enumerate(locations):
                if i >= j:
                    continue
                dx = b.x - a.x
                dy = b.y - a.y
                dist = max(1, math.sqrt(dx * dx + dy * dy))
                min_dist = 90  # Minimum distance between locations

                if dist < min_dist:
                    force = (min_dist - dist) / 2
                    nx, ny = dx / dist, dy / dist
                    a.x -= int(nx * force)
                    a.y -= int(ny * force)
                    b.x += int(nx * force)
                    b.y += int(ny * force)

    # Clamp to bounds
    for loc in locations:
        loc.x = max(margin, min(width - margin, loc.x))
        loc.y = max(margin, min(height - margin, loc.y))


def generate_random_town(seed: int | None = None) -> TownMap:
    """Generate a randomly laid out town with varied locations.

    Args:
        seed: Random seed for reproducible generation. None = random.
    """
    rng = random.Random(seed)
    town = TownMap(seed=seed if seed is not None else rng.randint(0, 999999))

    # Pick terrain type
    terrain = rng.choice(TERRAIN_TYPES)
    town.terrain = terrain["name"]

    all_locations: list[Location] = []

    # Core locations (always present)
    for loc_id, names, desc, category, cap_range in CORE_LOCATIONS:
        name = rng.choice(names)
        capacity = rng.randint(*cap_range)
        all_locations.append(Location(loc_id, name, desc, 0, 0, category, capacity))

    # Work locations: pick 4-6
    work_pool = list(WORK_LOCATIONS)
    rng.shuffle(work_pool)
    n_work = rng.randint(4, min(6, len(work_pool)))
    for loc_id, names, desc, category, cap_range in work_pool[:n_work]:
        name = rng.choice(names)
        capacity = rng.randint(*cap_range)
        all_locations.append(Location(loc_id, name, desc, 0, 0, category, capacity))

    # Social locations: pick 2-3
    social_pool = list(SOCIAL_LOCATIONS)
    rng.shuffle(social_pool)
    n_social = rng.randint(2, min(3, len(social_pool)))
    for loc_id, names, desc, category, cap_range in social_pool[:n_social]:
        name = rng.choice(names)
        capacity = rng.randint(*cap_range)
        all_locations.append(Location(loc_id, name, desc, 0, 0, category, capacity))

    # Residential: always all 3
    for loc_id, names, desc, category, cap_range in RESIDENTIAL_LOCATIONS:
        name = rng.choice(names)
        capacity = rng.randint(*cap_range)
        all_locations.append(Location(loc_id, name, desc, 0, 0, category, capacity))

    # Nature locations: pick 2-4, biased by terrain
    nature_pool = list(NATURE_LOCATIONS)
    # Boost terrain-preferred locations by adding duplicates
    for bonus_id in terrain.get("nature_bonus", []):
        for n in nature_pool:
            if n[0] == bonus_id:
                nature_pool.append(n)
                break
    # Remove terrain-incompatible
    remove_ids = set(terrain.get("nature_remove", []))
    nature_pool = [n for n in nature_pool if n[0] not in remove_ids]
    rng.shuffle(nature_pool)

    # Deduplicate (may have added duplicates for weighting)
    seen = set()
    unique_nature = []
    for n in nature_pool:
        if n[0] not in seen:
            seen.add(n[0])
            unique_nature.append(n)

    n_nature = rng.randint(2, min(4, len(unique_nature)))
    for loc_id, names, desc, category, cap_range in unique_nature[:n_nature]:
        name = rng.choice(names)
        capacity = rng.randint(*cap_range)
        all_locations.append(Location(loc_id, name, desc, 0, 0, category, capacity))

    # Place locations on the map
    _place_locations(all_locations, town.width, town.height, rng)

    for loc in all_locations:
        town.add_location(loc)

    return town


def create_default_town() -> TownMap:
    """Create the default RimTown map layout (fixed, non-random)."""
    town = TownMap(seed=0)
    town.terrain = "plains"

    locations = [
        # Central area
        Location("town_square", "Town Square", "The heart of RimTown", 400, 300, "social", 20),
        Location("town_hall", "Town Hall", "Where the mayor governs", 400, 220, "work", 8),
        Location("tavern", "The Rusty Pickaxe Tavern", "Food, drink, and socializing", 480, 340, "social", 15),

        # Work locations
        Location("farm", "Sunny Fields Farm", "Fertile farmland on the edge of town", 200, 150, "work", 6),
        Location("quarry", "Deep Rock Quarry", "Rich mineral deposits", 100, 450, "work", 6),
        Location("workshop", "The Crafters' Workshop", "Where goods are made", 550, 250, "work", 8),
        Location("general_store", "General Store", "Trade and supplies", 350, 350, "work", 6),
        Location("clinic", "Town Clinic", "Medical care for all", 300, 250, "work", 5),
        Location("library", "The Old Library", "Knowledge and research", 500, 180, "work", 6),
        Location("guardpost", "Guard Post", "Watching over the town", 650, 400, "work", 4),

        # Social/spiritual
        Location("chapel", "Chapel of Light", "A place of peace and reflection", 320, 180, "social", 12),
        Location("park", "Town Park", "A peaceful green space", 550, 400, "social", 15),
        Location("well", "Town Well", "Fresh water and chance encounters", 420, 320, "social", 5),

        # Residential area
        Location("residential_north", "North Houses", "Residential area", 250, 100, "residential", 10),
        Location("residential_south", "South Houses", "Residential area", 300, 450, "residential", 10),
        Location("residential_east", "East Houses", "Residential area", 600, 300, "residential", 10),

        # Nature
        Location("forest", "Whispering Woods", "Dense forest at the town's edge", 700, 150, "nature", 8),
        Location("river", "Crystal River", "A calm river running through", 150, 300, "nature", 6),
    ]

    for loc in locations:
        town.add_location(loc)

    return town
