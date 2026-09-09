class_name SimMischief
extends RefCounted
## Original Agent._doNightMischief. Witnesses may be anywhere in town.
static func process(a: Dictionary,w: SimWorld) -> void:
	if w.rng.next_float()>.08: return
	var types: Array=[
		["偷偷在鎮公所牆上塗鴉",5], ["把別人晾的衣服藏起來",3],
		["偷吃了酒館儲藏室的食物",8], ["在水井裡放了無害的染料",5],
		["偷偷移動了路標的方向",3], ["在廣場放了一堆假蜘蛛",8]]
	var event: Array=w.rng.pick(types)
	SimFeuds._mood(a,w,event[1])
	SimSocial.log_message(w.data,"mischief",a.name+"趁著夜色"+event[0]+"！",a.name,"")
	SimFeuds._memory(a,w,"mischief","我趁夜裡"+event[0],6,[])
	a.currentThought="嘿嘿...成功了。"
	w.data.events.conversationTopics.append("有人在夜裡"+event[0])
	var awake: Array=w.data.agents.values().filter(func(b): return b.id!=a.id and b.activity!="sleeping" and not b.get("isPlayer",false))
	if not awake.is_empty() and w.rng.next_float()<.3:
		var witness: Dictionary=w.rng.pick(awake)
		SimRelationships.modify(SimSocial.relationship(witness,a),"affinity",-5)
		SimSocial.log_message(w.data,"mischief",witness.name+"撞見了"+a.name+"的惡作劇！",witness.name,a.name)
		SimFeuds._memory(witness,w,"witness","撞見"+a.name+"在"+event[0],7,[a.name])
		SimFeuds._mood(a,w,-5)
		a.currentThought="糟糕，被"+witness.name+"看到了..."
