class_name SimWorkplaces
extends RefCounted
# Completed, explicitly placed facilities supply outdoor work points.
# Existing town facilities retain their original layout and identity.
const FACILITIES={
	"clinic_upgrade":{"id":"clinic","name":"醫療病房入口","description":"已完工醫療病房的入口執勤處；室內治療演出尚未加入。"},
	"watchtower":{"id":"guardpost","name":"瞭望塔值勤處","description":"已完工瞭望塔前的守衛值勤處；登塔與室內演出尚未加入。"}
}
static func sync(w: SimWorld) -> void:
	for p in w.data.buildings.completed:
		var facility: Dictionary=FACILITIES.get(p.get("buildingKey",""),{})
		if facility.is_empty() or w.data.townMap.locations.has(facility.id): continue
		if p.get("status","complete")!="complete" or p.get("siteX")==null or p.get("siteY")==null: continue
		var x:=int(p.siteX);var y:=int(p.siteY)
		if x<2 or x>76 or y<2 or y>56: continue
		w.data.townMap.locations[facility.id]={"id":facility.id,"name":facility.name,"description":facility.description,"category":"work","capacity":2,"x":(x+1)*16,"y":(y+2)*16+8,"_workSite":{"x":x,"y":y+2,"w":2,"h":1,"project":p.id}}

static func context(w: SimWorld,id: String) -> Dictionary:
	return {"schedule":SimAgenda.routine(w,id),"actual":SimAgenda.attendance(w,w.social.observed_motion,id),"rule":"依目前資料說明工作場所；完工不等於本人已到場，不捏造室內治療或未建成設施。"}
