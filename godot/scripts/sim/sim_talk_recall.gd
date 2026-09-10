class_name SimTalkRecall
extends RefCounted
# Follow-ups use structured outcomes, never interpret free text as proof of an action.
static func key(event: Dictionary) -> String:
	return "%s|%d|%s|%d"%[event.get("npc",""),int(event.get("resolved_tick",-1)),event.get("state",""),int(event.get("due",-1))]
static func pick(w: SimWorld,id: String,book: Dictionary) -> Dictionary:
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
