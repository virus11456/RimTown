extends "res://tests/test_careers_expansion_ui.gd"
func run() -> void:
	for choice in ["practice","cooperate"]:
		var viewport:=SubViewport.new();viewport.size=Vector2i(375,812);viewport.own_world_3d=true;root.add_child(viewport)
		var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
		var w: SimWorld=app.simulation;SimCareers.enroll(w,"guard");stand(app,"quarry");SimCareers.start(w,"patrol:quarry")
		for i in 4: w.tick()
		for a in w.data.agents.values():
			if not a.get("isPlayer",false): a.jobKey="farmer"
		var a: Dictionary=w.data.agents.lin_mei;a.jobKey="guard";a.activity="idle";a.currentLocation="town_square";a.age=30
		app.show_careers();press(app.drawer_body,"職涯回饋交流");await settle();check(has_text(app.drawer_body,"守衛 · 入門"),"earned review shown")
		var label: String=a.name+"："+("討論方法（技能 +3）" if choice=="practice" else "分享經驗（對方好感 +1）")
		stand(app,"tavern");press(app.drawer_body,label);await settle();check(SimCareerReviews.next_stage(w,"guard")==1,"remote player cannot review")
		app.motion.positions.lin_mei.x=app.motion.positions.player.x;app.motion.positions.lin_mei.y=app.motion.positions.player.y
		stand(app,"town_square");press(app.drawer_body,label);await settle();check(SimCareerReviews.next_stage(w,"guard")==1,"logical destination alone does not mean NPC arrived")
		app.motion.positions.lin_mei.x=app.motion.positions.player.x;app.motion.positions.lin_mei.y=app.motion.positions.player.y
		press(app.drawer_body,label);await settle()
		check(SimCareerReviews.next_stage(w,"guard")==0,"physically present pair completes review")
		check(w.quest_balance.career_reviews.guard["1"].choice==choice,"selected branch saved")
		check(has_text(app.drawer_body,SimCareerReviews.reply("guard",1,choice)),"actual response visible")
		w.data.tickCount+=4;w.data.clock.hour=20;w.data.clock.minute=0;w.event_comments.clear()
		for resident in w.data.agents.values():resident.activity="sleeping"
		a.activity="idle";a.jobKey="";a.needs.rest=80;a.needs.hunger=80;a.needs.social=30;a.relationships.player={"affinity":0}
		w.data.agents.player.activity="wandering"
		var skills: Dictionary=w.data.agents.player.skills.duplicate(true);var stock: Dictionary=w.data.stockpile.duplicate(true)
		app.drawer.hide();app.active_tab="";app._process_daily_talk();await settle()
		var entry: Dictionary=w.data.agents.player.chatHistory.back()
		check(entry.get("_godotRecall",{}).get("kind")=="career_review","real app recalls completed review")
		check(("工作方法" if choice=="practice" else "合作經驗") in entry.text,"actual chat preserves branch")
		check(equal(skills,w.data.agents.player.skills) and equal(stock,w.data.stockpile),"greeting gives no extra reward")
		app.show_tab("居民",true);await settle();press(app.drawer_body,"最近搭話："+str(a.name));await settle()
		check(has_text(app.drawer_body,entry.text),"recent greeting opens full conversation")
		app.chat_drafts.lin_mei="還沒送出的問題"
		var source_before: Dictionary=app.progress_snapshot().duplicate(true)
		press(app.drawer_body,"查看這段職涯交流紀錄");await settle()
		check(app.resident_page=="review_source" and has_text(app.drawer_body,"當時回覆："),"chat link opens verified original exchange")
		check(has_text(app.drawer_body,"已完成："+("討論工作方法" if choice=="practice" else "分享合作經驗")),"source displays actual choice")
		check(equal(source_before,app.progress_snapshot()),"reading source changes no progress")
		var source_fits:=true
		for child in app.drawer_body.get_children():
			if child is Control and child.size.x>app.drawer.size.x:source_fits=false
		check(source_fits,"source fits mobile width")
		app._tick_simulation();await settle()
		check(app.resident_page=="review_source" and has_text(app.drawer_body,"這段回憶的交流紀錄"),"world tick preserves source page")
		press(app.drawer_body,"返回原對話");await settle()
		check(app.resident_page=="chat" and app.chat_drafts.lin_mei=="還沒送出的問題","return preserves unsent draft")
		app.chat_drafts.clear()
		var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"review chat reload");w=app.simulation
		var loaded: Dictionary=app.progress_snapshot()
		check(w.data.agents.player.chatHistory.back().text==entry.text,"reload retains actual recalled conversation")
		app.drawer.hide();app.active_tab="";app._process_daily_talk()
		check(equal(loaded,app.progress_snapshot()),"actual app reload cannot repeat greeting")
		app.show_tab("居民",true);app.show_player_chat("lin_mei");await settle()
		for child in app.drawer_body.get_children():
			if child is Control: check(child.size.x<=app.drawer.size.x,"375px review fits")
		viewport.queue_free();await settle()
	var report:={"checks":checks,"failures":failures,"scope":"375px earned review UI, both branch buttons, player and NPC actual scene zone checks, response/history and saved choice; configured positions"}
	FileAccess.open("res://docs/REVIEW_SOURCE_UI_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)
