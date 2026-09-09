class_name SimNeeds
extends RefCounted
static func decay(n: Dictionary, activity: String, hour: int) -> void:
	var night := hour>=21 or hour<6
	n.hunger = minf(100,n.hunger+20) if activity=="eating" else maxf(0,n.hunger-(1.2 if night else 2.0))
	n.rest = minf(100,n.rest+8) if activity=="sleeping" else maxf(0,n.rest-(0.6 if night else 1.5))
	n.social = minf(100,n.social+10) if activity=="socializing" else maxf(0,n.social-1)
	n.recreation = minf(100,n.recreation+15) if activity=="recreation" else maxf(0,n.recreation-0.8)
static func mood(n: Dictionary) -> int:
	var result := -15 if n.hunger<10 else -8 if n.hunger<25 else 5 if n.hunger>80 else 0
	result += -18 if n.rest<10 else -8 if n.rest<25 else 5 if n.rest>80 else 0
	result += -8 if n.social<15 else 5 if n.social>70 else 0
	result += -6 if n.recreation<10 else 3 if n.recreation>70 else 0
	return result
static func urgent(n: Dictionary) -> String:
	var result := "hunger"
	for key in ["rest","social","recreation"]:
		if n[result] >= n[key]: result=key
	return result
