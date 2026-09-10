class_name SimCareerReviews
extends RefCounted
const TOPICS: Dictionary={"farmer":"留意土壤水分，別把照料和催產混為一談。","guard":"完整巡查各處，比只守在熟悉的地方更有幫助。","doctor":"先觀察誰真的需要休息，也要尊重對方的作息。","carpenter":"先確認工程需要什麼構件，再安排工房的時間。","researcher":"把資料對準正在研究的問題，避免堆積用不到的筆記。","priest":"先聽完對方的感受，不急著替他下結論。","miner":"先看石材和金屬的缺口，再決定是否出工。","cook":"依需要備餐，留意公共食材的用量。","blacksmith":"核對材料與工具需求，做好一批再安排下一批。","tailor":"庫存夠用時先停工，把材料留給真正的需求。","trader":"先看庫存與報價，再確認核准內容，別急著成交。"}
static func next_stage(w: SimWorld,job: String) -> int:
	var earned:=int(SimCareerProgress.progress(w,job).stage)
	var done: Dictionary=w.quest_balance.get("career_reviews",{}).get(job,{})
	for stage in range(1,earned+1):
		if not done.has(str(stage)): return stage
	return 0
static func people(w: SimWorld,job: String) -> Array:
	var result: Array=[];var fallback: Array=[]
	for a in w.data.agents.values():
		if a.get("isPlayer",false) or a.get("isDead",false) or int(a.get("age",0))<18 or a.activity=="sleeping" or not SimProcessing.can_work(a) or not w.data.townMap.locations.has(a.currentLocation): continue
		if a.get("jobKey")==job: result.append(a.id)
		elif a.get("jobKey")=="mayor": fallback.append(a.id)
	return result if not result.is_empty() else fallback
static func reply(job: String,stage: int,choice: String) -> String:
	var milestone: String=SimCareerProgress.STAGES[stage]
	return "你已經達到「"+milestone+"」了。"+(str(TOPICS[job]) if choice=="practice" else "謝謝你願意分享工作經驗，讓大家更了解彼此的付出。")
static func choose(w: SimWorld,job: String,stage: int,id: String,choice: String) -> Dictionary:
	if not TOPICS.has(job) or choice not in ["practice","cooperate"] or stage<=0 or next_stage(w,job)!=stage: return {"ok":false,"message":"這段交流尚未開放，或已完成。"}
	if not id in people(w,job): return {"ok":false,"message":"對方目前無法交流，請稍後重新查看。"}
	var a: Dictionary=w.data.agents[id];var player: Dictionary=w.data.agents.player
	if player.currentLocation!=a.currentLocation: return {"ok":false,"message":"請先親自前往對方所在場所。"}
	if not SimCareers.book(w).active.is_empty(): return {"ok":false,"message":"請先完成或取消正在進行的值勤。"}
	var skill: String=SimCareers.JOBS[job].skill
	if choice=="practice":
		if not player.skills.has(skill): player.skills[skill]={"xp":0,"passion":"無"}
		player.skills[skill].xp+=3
	else: SimRelationships.modify(SimSocial.relationship(a,player),"affinity",1)
	var words:=reply(job,stage,choice);var subject: String=SimCareers.JOBS[job].name+" · "+SimCareerProgress.STAGES[stage]
	if not w.quest_balance.has("career_reviews"): w.quest_balance.career_reviews={}
	if not w.quest_balance.career_reviews.has(job): w.quest_balance.career_reviews[job]={}
	w.quest_balance.career_reviews[job][str(stage)]={"npc":id,"name":a.name,"choice":choice,"reply":words,"tick":w.data.tickCount}
	SimFeuds._memory(a,w,"career",str(player.name)+"完成了"+subject+"，我們"+("一起討論工作方法。" if choice=="practice" else "交流了合作經驗。"),6,["player"])
	SimFeuds._memory(player,w,"career","與"+str(a.name)+"回顧"+subject+"："+words,6,[id])
	var chat: Array=player.get("chatHistory",[])
	chat.append({"speaker":player.name,"target":a.name,"text":"我想"+("討論工作方法。" if choice=="practice" else "分享合作經驗。"),"time":SimSocial.time_string(w.data.clock)})
	chat.append({"speaker":a.name,"target":player.name,"text":words,"time":SimSocial.time_string(w.data.clock)});player.chatHistory=chat.slice(-10000)
	SimSocial.log_message(w.data,"career",str(player.name)+"與"+str(a.name)+"完成職涯交流："+subject,player.name,a.name)
	return {"ok":true,"message":words}
