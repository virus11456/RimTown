class_name SimTalkRecall
extends RefCounted
# Follow-ups use structured outcomes, never interpret free text as proof of an action.
static func key(event: Dictionary) -> String:
	return "%s|%d|%s|%d"%[event.get("npc",""),int(event.get("resolved_tick",-1)),event.get("state",""),int(event.get("due",-1))]
static func appointment_pick(w: SimWorld,id: String,book: Dictionary) -> Dictionary:
	var latest: Dictionary={}
	for event in w.quest_balance.get("appointments",{}).get("history",[]):
		if event.get("npc")==id and event.get("state") in ["met","missed","cancelled"]: latest=event
	if latest.is_empty() or not latest.has("resolved_tick"): return {}
	var age:=int(w.data.tickCount)-int(latest.resolved_tick)
	if age<96 or age>672: return {}
	var token:=key(latest)
	if token in book.get("recalled",[]): return {}
	var place: String=w.data.townMap.locations.get(latest.get("place",""),{}).get("name","約好的地方")
	var text:=""
	match str(latest.state):
		"met": text="我還記得上回我們在"+place+"碰面的事。你今天過得如何？"
		"missed": text="上回我們沒能在約好的地方碰上。今天剛好遇到，打聲招呼。" if latest.get("npc_arrived",false) else "上回我沒能趕到約好的地方，抱歉。今天剛好遇到，想跟你說一聲。"
		"cancelled": text="上回的約定取消了，今天剛好碰到你。最近還好嗎？"
	return {"key":token,"text":text,"source":{"npc":id,"state":latest.state,"time":latest.get("time",""),"resolved_tick":int(latest.resolved_tick)}}

static func pick(w: SimWorld,id: String,book: Dictionary) -> Dictionary:
	var appointment:=appointment_pick(w,id,book)
	if not appointment.is_empty(): return appointment
	var rows: Array=w.data.agents.get(id,{}).get("_careRecoveryResults",[])
	if rows.is_empty(): return {}
	var event: Dictionary=rows.back();var age:=int(w.data.tickCount)-int(event.tick)
	var token:="recovery:%s:%d:%s"%[id,int(event.tick),str(event.state)]
	if age<96 or age>672 or token in book.get("recalled",[]): return {}
	var text:="之前那次返家恢復安排"
	var actions: Array[String]=[]
	if int(event.get("meal_ticks",0))>0: actions.append("在家吃了東西")
	if int(event.get("rest_ticks",0))>0: actions.append("在家休息了一會兒")
	if not actions.is_empty(): text+="，我"+"，也".join(actions)
	text+="，後來中止了。" if event.state=="cancelled" else "，時間到了就結束了。" if event.state=="time_limit" else "，已經結束了。"
	return {"key":token,"text":text,"source":{"npc":id,"state":event.state,"resolved_tick":int(event.tick),"kind":"care_recovery","meal_ticks":int(event.get("meal_ticks",0)),"rest_ticks":int(event.get("rest_ticks",0))}}
