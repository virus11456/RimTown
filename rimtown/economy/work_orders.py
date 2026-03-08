"""Work order / task system - player commands for NPC work priorities."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rimtown.core.world import World


class OrderPriority(enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class OrderStatus(enum.Enum):
    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class WorkOrder:
    """A player-issued work order."""
    order_id: str
    title: str
    description: str
    order_type: str            # "produce", "gather", "build", "research"
    target_resource: str = ""
    target_amount: float = 0
    current_amount: float = 0
    priority: OrderPriority = OrderPriority.NORMAL
    status: OrderStatus = OrderStatus.QUEUED
    assigned_agents: list[str] = field(default_factory=list)
    created_tick: int = 0

    @property
    def progress(self) -> float:
        if self.target_amount <= 0:
            return 1.0
        return min(1.0, self.current_amount / self.target_amount)

    def to_dict(self) -> dict:
        return {
            "order_id": self.order_id,
            "title": self.title,
            "description": self.description,
            "order_type": self.order_type,
            "target_resource": self.target_resource,
            "target_amount": self.target_amount,
            "current_amount": round(self.current_amount, 1),
            "progress": round(self.progress, 2),
            "priority": self.priority.value,
            "status": self.status.value,
            "assigned_agents": self.assigned_agents,
        }


class WorkOrderManager:
    """Manages player-issued work orders."""

    def __init__(self):
        self.orders: list[WorkOrder] = []
        self._order_counter: int = 0

    def create_order(self, order_type: str, target_resource: str,
                     target_amount: float, priority: str = "normal",
                     tick: int = 0) -> WorkOrder:
        """Create a new work order."""
        self._order_counter += 1
        priority_enum = OrderPriority(priority) if priority in [p.value for p in OrderPriority] else OrderPriority.NORMAL

        title_map = {
            "produce": f"Produce {target_amount:.0f} {target_resource}",
            "gather": f"Gather {target_amount:.0f} {target_resource}",
        }

        order = WorkOrder(
            order_id=f"order_{self._order_counter}",
            title=title_map.get(order_type, f"{order_type}: {target_resource}"),
            description=f"{'Produce' if order_type == 'produce' else 'Gather'} "
                        f"{target_amount:.0f} units of {target_resource}",
            order_type=order_type,
            target_resource=target_resource,
            target_amount=target_amount,
            priority=priority_enum,
            created_tick=tick,
        )
        self.orders.append(order)
        return order

    def cancel_order(self, order_id: str) -> bool:
        """Cancel a work order."""
        for order in self.orders:
            if order.order_id == order_id and order.status in (OrderStatus.QUEUED, OrderStatus.IN_PROGRESS):
                self.orders.remove(order)
                return True
        return False

    def update_progress(self, resource: str, amount: float):
        """Update progress on orders that target this resource."""
        for order in self.orders:
            if order.status in (OrderStatus.COMPLETE, OrderStatus.FAILED):
                continue
            if order.target_resource == resource:
                order.current_amount += amount
                if order.status == OrderStatus.QUEUED:
                    order.status = OrderStatus.IN_PROGRESS
                if order.current_amount >= order.target_amount:
                    order.status = OrderStatus.COMPLETE

    def get_active_orders(self) -> list[WorkOrder]:
        return [o for o in self.orders if o.status in (OrderStatus.QUEUED, OrderStatus.IN_PROGRESS)]

    def cleanup(self):
        """Remove old completed orders."""
        self.orders = [o for o in self.orders
                       if o.status not in (OrderStatus.COMPLETE, OrderStatus.FAILED)
                       or len(self.orders) <= 20]
        # Keep at most the last 20 completed
        completed = [o for o in self.orders if o.status in (OrderStatus.COMPLETE, OrderStatus.FAILED)]
        if len(completed) > 20:
            for old in completed[:-20]:
                self.orders.remove(old)

    def to_dict(self) -> dict:
        return {
            "active": [o.to_dict() for o in self.get_active_orders()],
            "all_orders": [o.to_dict() for o in self.orders[-30:]],
        }
