"""Game clock and time management for the simulation."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field


class Season(enum.Enum):
    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"


class TimeOfDay(enum.Enum):
    DAWN = "dawn"          # 5-7
    MORNING = "morning"    # 7-12
    AFTERNOON = "afternoon"  # 12-17
    EVENING = "evening"    # 17-21
    NIGHT = "night"        # 21-5


@dataclass
class GameClock:
    """Tracks in-game time. One tick = 15 in-game minutes."""

    day: int = 1
    hour: int = 6
    minute: int = 0
    season: Season = Season.SPRING
    year: int = 1

    # Each season lasts 15 days
    DAYS_PER_SEASON: int = field(default=15, repr=False)

    def tick(self) -> list[str]:
        """Advance 15 minutes. Returns list of triggered events like 'new_hour', 'new_day'."""
        events = []
        self.minute += 15
        if self.minute >= 60:
            self.minute = 0
            self.hour += 1
            events.append("new_hour")
        if self.hour >= 24:
            self.hour = 0
            self.day += 1
            events.append("new_day")
        if self.day > self.DAYS_PER_SEASON:
            self.day = 1
            seasons = list(Season)
            idx = seasons.index(self.season)
            if idx == len(seasons) - 1:
                self.season = seasons[0]
                self.year += 1
                events.append("new_year")
            else:
                self.season = seasons[idx + 1]
            events.append("new_season")
        return events

    @property
    def time_of_day(self) -> TimeOfDay:
        if 5 <= self.hour < 7:
            return TimeOfDay.DAWN
        elif 7 <= self.hour < 12:
            return TimeOfDay.MORNING
        elif 12 <= self.hour < 17:
            return TimeOfDay.AFTERNOON
        elif 17 <= self.hour < 21:
            return TimeOfDay.EVENING
        else:
            return TimeOfDay.NIGHT

    @property
    def time_str(self) -> str:
        return f"Year {self.year}, {self.season.value.title()}, Day {self.day}, {self.hour:02d}:{self.minute:02d}"

    @property
    def short_time(self) -> str:
        return f"{self.hour:02d}:{self.minute:02d}"

    def reset(self):
        self.day = 1
        self.hour = 6
        self.minute = 0
        self.season = Season.SPRING
        self.year = 1

    def to_dict(self) -> dict:
        return {
            "day": self.day,
            "hour": self.hour,
            "minute": self.minute,
            "season": self.season.value,
            "year": self.year,
            "time_of_day": self.time_of_day.value,
            "time_str": self.time_str,
        }
