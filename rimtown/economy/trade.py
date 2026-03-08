"""Trade system - merchant caravans and resource exchange."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rimtown.core.world import World


@dataclass
class TradeOffer:
    """A single buy or sell offer from a merchant."""
    resource: str
    amount: float
    price_per_unit: float  # In silver
    is_buying: bool        # True = merchant buys from you

    def to_dict(self) -> dict:
        return {
            "resource": self.resource,
            "amount": round(self.amount, 1),
            "price_per_unit": round(self.price_per_unit, 1),
            "is_buying": self.is_buying,
            "total_price": round(self.amount * self.price_per_unit, 1),
        }


@dataclass
class Merchant:
    """A visiting merchant with trade offers."""
    name: str
    specialty: str
    offers: list[TradeOffer] = field(default_factory=list)
    days_remaining: int = 2
    reputation: float = 0  # -1 to 1, affects prices

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "specialty": self.specialty,
            "offers": [o.to_dict() for o in self.offers],
            "days_remaining": self.days_remaining,
        }


# Base prices for resources
BASE_PRICES: dict[str, float] = {
    "food": 1.0,
    "wood": 1.5,
    "stone": 2.0,
    "metal": 4.0,
    "cloth": 3.0,
    "herbs": 3.5,
    "meals": 2.5,
    "tools": 8.0,
    "clothing": 6.0,
    "medicine": 10.0,
    "furniture": 7.0,
}

# Merchant types and their specialties
MERCHANT_TYPES: list[dict] = [
    {
        "names": ["張商人 (Zhang the Trader)", "老趙商隊 (Old Zhao's Caravan)",
                  "遊商阿明 (Ming the Peddler)"],
        "specialty": "general",
        "sells": ["food", "cloth", "tools", "wood"],
        "buys": ["meals", "furniture", "clothing"],
    },
    {
        "names": ["礦商老李 (Li the Ore Dealer)", "鐵匠阿強 (Qiang the Ironmonger)"],
        "specialty": "metals",
        "sells": ["metal", "tools", "stone"],
        "buys": ["food", "meals", "silver"],
    },
    {
        "names": ["藥師小雪 (Xue the Herbalist)", "遊醫老陳 (Chen the Physician)"],
        "specialty": "medicine",
        "sells": ["herbs", "medicine"],
        "buys": ["food", "silver", "cloth"],
    },
    {
        "names": ["絲綢商人 (The Silk Trader)", "布匹行 (The Fabric House)"],
        "specialty": "textiles",
        "sells": ["cloth", "clothing"],
        "buys": ["food", "wood", "stone"],
    },
    {
        "names": ["異國商隊 (Exotic Caravan)", "遠方來客 (The Far Traveller)"],
        "specialty": "exotic",
        "sells": ["herbs", "cloth", "metal"],
        "buys": ["meals", "clothing", "furniture", "tools"],
    },
]


class TradeManager:
    """Manages merchant visits and trading."""

    def __init__(self):
        self.current_merchant: Merchant | None = None
        self.trade_history: list[dict] = []
        self._days_since_merchant: int = 0

    def daily_update(self, world: World):
        """Check for merchant arrivals and departures."""
        self._days_since_merchant += 1

        # Handle current merchant
        if self.current_merchant:
            self.current_merchant.days_remaining -= 1
            if self.current_merchant.days_remaining <= 0:
                world.log_message(
                    "trade",
                    f"Merchant {self.current_merchant.name} has departed.",
                )
                self.current_merchant = None
                return

        # Check for marketplace bonus
        merchant_freq = 1.0
        if hasattr(world, 'buildings'):
            merchant_freq = world.buildings.get_effect("merchant_frequency", 1.0)

        # Base 15% daily chance, increases with time since last merchant
        chance = 0.15 * merchant_freq + (self._days_since_merchant - 3) * 0.05
        chance = min(chance, 0.6)

        if self.current_merchant is None and random.random() < chance:
            self._spawn_merchant(world)

    def _spawn_merchant(self, world: World):
        """Create a new visiting merchant."""
        self._days_since_merchant = 0

        merchant_type = random.choice(MERCHANT_TYPES)
        name = random.choice(merchant_type["names"])

        # Generate trade offers
        offers = []
        trade_bonus = 0
        if hasattr(world, 'buildings'):
            trade_bonus = world.buildings.get_effect("trade_bonus", 0)

        # Merchant sells to player (player buys)
        for resource in merchant_type["sells"]:
            base_price = BASE_PRICES.get(resource, 5)
            # Merchant sells at markup
            price = base_price * random.uniform(1.2, 1.8) * (1 - trade_bonus)
            amount = random.uniform(10, 30)
            offers.append(TradeOffer(resource, amount, round(price, 1), is_buying=False))

        # Merchant buys from player (player sells)
        for resource in merchant_type["buys"]:
            base_price = BASE_PRICES.get(resource, 5)
            # Merchant buys at discount
            price = base_price * random.uniform(0.5, 0.8) * (1 + trade_bonus)
            amount = random.uniform(15, 40)
            offers.append(TradeOffer(resource, amount, round(price, 1), is_buying=True))

        merchant = Merchant(
            name=name,
            specialty=merchant_type["specialty"],
            offers=offers,
            days_remaining=random.randint(2, 4),
        )
        self.current_merchant = merchant

        world.log_message(
            "trade",
            f"Merchant {name} has arrived in town! Specializes in {merchant_type['specialty']}.",
        )

    def execute_trade(self, offer_index: int, quantity: float,
                      world: World) -> dict:
        """Execute a trade with the current merchant."""
        if not self.current_merchant:
            return {"error": "No merchant in town"}

        if offer_index < 0 or offer_index >= len(self.current_merchant.offers):
            return {"error": "Invalid offer"}

        offer = self.current_merchant.offers[offer_index]
        quantity = min(quantity, offer.amount)
        if quantity <= 0:
            return {"error": "Invalid quantity"}

        total_price = quantity * offer.price_per_unit
        stockpile = world.stockpile

        if offer.is_buying:
            # Player sells to merchant
            if not stockpile.has(offer.resource, quantity):
                return {"error": f"Not enough {offer.resource}"}
            stockpile.consume(offer.resource, quantity, world.tick_count,
                              f"Sold to {self.current_merchant.name}")
            stockpile.add("silver", total_price, world.tick_count,
                          f"Trade with {self.current_merchant.name}")
            offer.amount -= quantity
        else:
            # Player buys from merchant
            if not stockpile.has("silver", total_price):
                return {"error": "Not enough silver"}
            stockpile.consume("silver", total_price, world.tick_count,
                              f"Bought from {self.current_merchant.name}")
            stockpile.add(offer.resource, quantity, world.tick_count,
                          f"Trade with {self.current_merchant.name}")
            offer.amount -= quantity

        # Record trade
        record = {
            "tick": world.tick_count,
            "merchant": self.current_merchant.name,
            "resource": offer.resource,
            "quantity": quantity,
            "price": total_price,
            "type": "sell" if offer.is_buying else "buy",
        }
        self.trade_history.append(record)
        if len(self.trade_history) > 100:
            self.trade_history = self.trade_history[-50:]

        world.log_message(
            "trade",
            f"{'Sold' if offer.is_buying else 'Bought'} {quantity:.0f} {offer.resource} "
            f"for {total_price:.0f} silver.",
        )

        # Remove depleted offers
        self.current_merchant.offers = [
            o for o in self.current_merchant.offers if o.amount > 0.5
        ]

        return {"ok": True, **record}

    def to_dict(self) -> dict:
        return {
            "merchant": self.current_merchant.to_dict() if self.current_merchant else None,
            "days_since_merchant": self._days_since_merchant,
            "recent_trades": self.trade_history[-10:],
        }
