"""Town map and location system."""

from __future__ import annotations

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

    def __init__(self):
        self.locations: dict[str, Location] = {}
        self.width: int = 800
        self.height: int = 600

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
            "locations": {lid: loc.to_dict() for lid, loc in self.locations.items()},
        }


def create_default_town() -> TownMap:
    """Create the default RimTown map layout."""
    town = TownMap()

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
