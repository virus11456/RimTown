class_name SimPerception
extends RefCounted
## Agent._perceiveSurroundings; counters live in the Godot runtime save extension.
static func process(a: Dictionary,w: SimWorld) -> void:
	if a.activity=="sleeping": return
	var run: Dictionary=w.runtime[a.id];var day:=SimTrace.day_key(w.data.clock)
	if run.get("obs_day","")!=day: run.obs_day=day;run.obs_count=0
	if int(run.get("obs_count",0))>=6: return
	if int(w.data.tickCount)%4!=0 or w.rng.next_float()>.18: return
	var others: Array=w.data.agents.values().filter(func(b): return b.id!=a.id and not b.get("isDead",false) and not b.get("isPlayer",false) and b.currentLocation==a.currentLocation and b.activity!="sleeping")
	if others.is_empty(): return
	var other: Dictionary=w.rng.pick(others)
	var step:=SimTrace.plan(other,w.data.clock)
	var doing: String=str(step.step) if not step.is_empty() and not str(step.step).is_empty() else SimTrace.activity_label(other)
	run.obs_count=int(run.get("obs_count",0))+1
	SimFeuds._memory(a,w,"observation","看到"+other.name+"正忙著"+doing,2,[other.name])
