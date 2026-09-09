class_name SimThoughts
extends RefCounted
## World._processThoughts: expire first, then apply each remaining directed opinion.
static func daily(w: SimWorld) -> void:
	var today:=SimClock.total_days(w.data.clock)
	for a in w.data.agents.values():
		if a.get("isPlayer",false) or a.get("isDead",false): continue
		if not a.get("thoughts") is Array or a.thoughts.is_empty(): continue
		a.thoughts=a.thoughts.filter(func(th): return today-float(th.start)<float(th.days))
		for thought in a.thoughts:
			if not thought.get("opinion") or not thought.get("targetId"): continue
			var relation: Dictionary=a.get("relationships",{}).get(thought.targetId,{})
			if not relation.is_empty(): SimRelationships.modify(relation,"affinity",float(thought.opinion))
static func mood_effect(thought: Dictionary,today: int) -> float:
	var days:=float(thought.get("days",0))
	if days<=0: return 0
	return float(thought.get("mood",0))*maxf(0,1.0-(today-float(thought.get("start",today)))/days)
