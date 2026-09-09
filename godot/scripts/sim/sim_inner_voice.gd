class_name SimInnerVoice
extends RefCounted
## Original Agent._generateThought: currentThought is transient prose, not a mood modifier.
static var ties: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://assets/data/cross_town_ties.json"))
static func _valid_name(value: Variant) -> bool:
	if value==null or str(value).is_empty(): return false
	for c in str(value):
		if c.unicode_at(0)<48 or c.unicode_at(0)>57: return true
	return false
static func generate(a: Dictionary,w: SimWorld) -> void:
	var lines: Array=[]
	var hour:=int(w.data.clock.hour);var night:=hour>=21 or hour<5
	if a.mood>60:
		var town: String=w.data.get("townName","");if town.is_empty(): town="邊境鎮"
		lines.append_array([town+"的生活還不錯。","今天感覺很好！"])
	elif a.mood<20: lines.append_array(["事情可以更好的...","我感覺不太好。"])
	if a.needs.hunger<30: lines.append("肚子好餓...")
	if a.needs.rest<30: lines.append("好想睡覺...")
	if a.needs.social<30: lines.append("應該找人聊聊天...")
	match a.activity:
		"stargazing":
			lines.append_array(["今晚的星空真美...","那顆星星特別亮。","仰望星空讓人感覺渺小...","流星！快許願！"])
			if w.data.clock.season=="冬季": lines.append("冬天的星空格外清晰。")
		"night_stroll":
			lines.append_array(["夜裡的鎮上好安靜...","月光下散步真舒服。","夜風吹來很涼爽。"])
			if a.mood<30: lines.append_array(["睡不著...出來走走吧。","夜裡比較容易想事情..."])
		"mourning":
			lines.append_array(["願逝者安息...","站在墓前，心裡百感交集。","我不會忘記你的。"])
			if not a.get("_annualMourning",[]).is_empty(): lines.append(a._annualMourning[0].name+"...我來看你了。")
		"night_mischief": lines.append_array(["嘿嘿，趁大家都睡了...","沒人看到的話...","夜裡做點小惡作劇。"])
	if night and "night_owl" in a.personality.traits: lines.append_array(["夜晚才是我的主場。","安靜的夜晚最適合思考。"])
	if night and not "night_owl" in a.personality.traits and a.activity!="sleeping": lines.append_array(["這麼晚了還沒睡...","明天會很累吧。"])
	if ties.has(a.id) and w.rng.next_float()<.3: lines.append(w.rng.pick(ties[a.id].thoughts))
	var manager:=SimRelationships.new();manager.relationships=a.get("relationships",{})
	var friend:=manager.best_friend()
	if not friend.is_empty() and _valid_name(friend.get("targetName")): lines.append("該去找"+str(friend.targetName)+"敘敘舊了。")
	var romantic: Array=manager.romantic_interests().filter(func(r): return _valid_name(r.get("targetName")))
	if not romantic.is_empty(): lines.append("一直在想"+str(w.rng.pick(romantic).targetName)+"...")
	var best_name:="";var best_xp:=-1.0;var best_level:=-1
	for category in a.skills:
		var xp:=float(a.skills[category].xp);var level:=SimWorld.skill_level(xp)
		if level>best_level or (level==best_level and xp>=best_xp): best_name=category;best_xp=xp;best_level=level
	if best_level>0: lines.append(best_name+"技能進步中...")
	if w.data.get("stockpile") is Dictionary:
		var resources: Dictionary=w.data.stockpile.get("resources",{})
		if resources.get("food",0)<30: lines.append("食物快不夠了...")
		if resources.get("silver",0)>300: lines.append("鎮上的國庫很充裕！")
		if resources.get("meals",0)<10: lines.append("廚師需要多準備一些餐食。")
	var projects: Array=w.data.get("buildings",{}).get("projects",[])
	if not projects.is_empty():
		var p: Dictionary=projects[0]
		if float(p.workRequired)!=0: lines.append(str(p.name)+"已完成"+str(floori(float(p.workDone)/float(p.workRequired)*100+.5))+"%！")
	var merchant: Variant=w.data.get("trade",{}).get("merchant")
	if merchant is Dictionary: lines.append("去看看"+str(merchant.name)+"在賣什麼吧。")
	var news: Array=w.data.get("news",{}).get("bulletins",[])
	if not news.is_empty():
		var latest: Dictionary=news.back()
		if latest.severity=="danger": lines.append("「"+str(latest.headline)+"」的消息令人擔憂...")
		elif latest.severity=="good": lines.append("好消息："+str(latest.headline)+"！")
	if not lines.is_empty(): a.currentThought=w.rng.pick(lines)
