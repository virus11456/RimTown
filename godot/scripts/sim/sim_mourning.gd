class_name SimMourning
extends RefCounted
## Agent._doMourning: recent queue first, then one overdue annual visit.
static func process(a: Dictionary,w: SimWorld) -> void:
	if w.rng.next_float()>.15: return
	var year: int=int(w.data.clock.year)
	if not a.get("_mourningTargets",[]).is_empty():
		var target: Dictionary=a._mourningTargets[0]
		a.currentThought=target.name+"...我會記得你的。"
		a.needs.social=minf(100,a.needs.social+.5)
		SimFeuds._mood(a,w,.3)
		SimFeuds._memory(a,w,"mourning","前往墓園弔念"+target.name+"。",7,[target.name])
		SimSocial.log_message(w.data,"mourning","🕯️ "+a.name+"前往墓園弔念"+target.name+"。",a.name,"")
		if not a.has("_annualMourning"): a._annualMourning=[]
		if target.get("isFamily",false) and not a._annualMourning.any(func(m): return m.name==target.name):
			a._annualMourning.append({"name":target.name,"lastVisitYear":year})
		a._mourningTargets.pop_front()
		return
	for visit in a.get("_annualMourning",[]):
		if visit.get("lastVisitYear",year)<year:
			visit.lastVisitYear=year
			a.currentThought="又到了一年...去看看"+visit.name+"吧。"
			SimFeuds._mood(a,w,-2)
			a.needs.social=minf(100,a.needs.social+1)
			SimFeuds._memory(a,w,"mourning","每年都會來墓園看望"+visit.name+"。",6,[visit.name])
			SimSocial.log_message(w.data,"mourning","🕯️ "+a.name+"來到墓園，緬懷已故的親人"+visit.name+"。",a.name,"")
			return
