class_name ResidentCarePerformance
extends RefCounted
# Presentation of an existing NPC conversation, not a new treatment/reward engine.
const JOBS := ["doctor","priest"]
var pairs: Dictionary={}
static func target(w: SimWorld,m: SimMotion,id: String) -> String:
	if not OutdoorWorkPerformance.at_work(w,m,id,JOBS): return ""
	var a: Dictionary=w.data.agents[id]
	if float(a.needs.hunger)<20 or float(a.needs.rest)<10: return ""
	if not SimWorkSchedule.working(SimWorkSchedule.job(a,w.rules.jobs),int(w.data.clock.hour)) or a.has("_raidShelterUntil"): return ""
	if int(a.get("_lastInteractionTick",-1))!=int(w.data.tickCount): return ""
	# The last conversation initiated by this resident must belong to this tick.
	var rows: Array=w.data.get("npcConversationLog",[])
	var other:=""
	for index in range(rows.size()-1,-1,-1):
		var row: Dictionary=rows[index]
		if row.get("agentAId","")!=id: continue
		if row.get("time","")==SimSocial.time_string(w.data.clock): other=str(row.get("agentBId",""))
		break
	if other.is_empty() or other=="player" or other==id or not w.data.agents.has(other): return ""
	var b: Dictionary=w.data.agents[other];var p: Dictionary=m.positions.get(other,{})
	if p.is_empty() or p.get("walking",false) or p.get("doorPhase")!=null: return ""
	if b.get("activity","") not in ["idle","wandering","socializing","recreation"]: return ""
	if b.get("_serviceStay",false) or not SimServiceStay.priority(w,other).is_empty(): return ""
	for key in ["_appointmentDestination","_leisureDestination","_hangoutDestination"]:
		if not str(b.get(key,"")).is_empty(): return ""
	var active: Dictionary=w.quest_balance.get("careers",{}).get("active",{})
	if active.get("target","")==other: return "" # Never visually take over the player's service.
	if a.jobKey=="doctor" and (float(b.needs.rest)>40 or float(b.needs.rest)<10): return ""
	if a.jobKey=="priest" and float(b.mood)>=0: return ""
	if not m.layout._walkable(Vector2(p.x,p.y)) or SimCareerPresence.at_threshold(m,id) or SimCareerPresence.at_threshold(m,other): return ""
	if not SimCareerPresence.together(m,id,other,str(a.currentLocation)) or b.get("currentLocation","")!=a.currentLocation: return ""
	var provider: Dictionary=m.positions[id]
	var distance:=Vector2(provider.x,provider.y).distance_to(Vector2(p.x,p.y))
	return other if distance>=12 and distance<=48 else ""

func update(town,w: SimWorld,m: SimMotion,delta: float) -> void:
	for actor in town.actors.values():
		var label: Label3D=actor.get_node_or_null("ResidentCareStatus")
		if label!=null: label.visible=false
	var next: Dictionary={};var used: Dictionary={};var ids: Array=town.resident_gaits.keys();ids.sort()
	for id in ids:
		if used.has(id): continue
		var other:=target(w,m,str(id))
		if other.is_empty() or used.has(other) or not town.actors.has(other): continue
		var job: String=w.data.agents[id].jobKey
		var old: Dictionary=pairs.get(id,{})
		var phase: float=(float(old.get("phase",0)) if old.get("target","")==other and old.get("job","")==job and old.get("tick",-1)==w.data.tickCount else 0)+maxf(0,delta)
		next[id]={"target":other,"job":job,"phase":phase,"tick":w.data.tickCount};used[id]=true;used[other]=true
		var actor: Node3D=town.actors[id];var recipient: Node3D=town.actors[other]
		var direction:=recipient.position-actor.position
		actor.rotation=Vector3(0,atan2(direction.x,direction.z),0)
		recipient.rotation=Vector3(0,atan2(-direction.x,-direction.z),0)
		var right: Node3D=actor.get_node("Body/ServiceRight");var left: Node3D=actor.get_node("Body/ServiceLeft")
		var blend:=smoothstep(0,.45,phase)
		right.rotation.x=(-.70+sin(phase*(2.2 if job=="doctor" else 1.5))*.10)*blend
		right.rotation.z=-.15*blend;left.rotation.x=-.25*blend
		recipient.get_node("Body/ServiceRight").rotation.x=(-.18+sin(phase*1.5)*.035)*blend
		var label: Label3D=actor.get_node_or_null("ResidentCareStatus")
		if label==null:
			label=Label3D.new();label.name="ResidentCareStatus";label.font=load("res://assets/fonts/NotoSansTC.ttf")
			label.font_size=24;label.pixel_size=.007;label.position.y=2.1;label.billboard=BaseMaterial3D.BILLBOARD_ENABLED
			label.modulate=Color("e6f5d5");actor.add_child(label)
		label.text="關懷交流" if job=="doctor" else "談心陪伴";label.visible=true
	pairs=next
