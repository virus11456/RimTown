extends Node3D
const Fixture=preload("res://tests/resident_care_fixture.gd")
func _ready() -> void:call_deferred("capture")
func capture() -> void:
	var cases: Array=[]
	for mode in ["waiting","serving","hours","followup"]:
		var mobile: bool=mode in ["serving","followup"]
		var viewport:=SubViewport.new();viewport.size=Vector2i(375,812) if mobile else Vector2i(1280,800);viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(viewport)
		var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await get_tree().process_frame;app.set_process(false)
		var pair: Dictionary=Fixture.prepare(app,"harbor","doctor");var w: SimWorld=app.simulation;var m: SimMotion=app.motion
		w.social_enabled=true;w.social.observe_positions(m);w.data.agents[pair.provider].needs.hunger=100;w.data.agents[pair.provider].needs.rest=100
		SimWorkSchedule.refresh(w,m);SimShiftSleep.refresh(w,m)
		app.has_simulated=true
		app.active_tab="居民";app.hud.visible=true;app.drawer.show()
		app.world_view._light_clock(w.data.clock)
		app.summary.text="午後接待・受控畫面測試 12:00"
		if mode=="followup":
			app._load_document(FileAccess.get_file_as_string("res://docs/CARE_FOLLOWUP_HARBOR_PROGRESS.rimtown"),"自然照護後三日")
			w=app.simulation;m=app.motion
			app.summary.text="%s %d 日 %02d:%02d · 自然進度"%[w.data.clock.season,int(w.data.clock.day),int(w.data.clock.hour),int(w.data.clock.minute)]
			for id in w.data.agents:
				if w.data.agents[id].get("_careResults",[]).any(func(row):return row.get("followup",{}).get("state","")=="finished"):
					pair.provider=id;app.show_agenda(id);break
		elif mode=="hours":app.show_care_availability(pair.recipient)
		else:
			SimResidentCare.tick(w);SimResidentCare.apply(w,w.data.agents[pair.recipient],w.runtime[pair.recipient])
			if mode=="serving":
				for frame in 1500:m.update(w.data.agents)
				w.data.tickCount+=1;SimResidentCare.tick(w)
			app.show_agent(pair.provider)
		Fixture.render(app)
		await get_tree().process_frame;await get_tree().process_frame;await RenderingServer.frame_post_draw
		var file: String="care-followup-"+mode+".png"
		viewport.get_texture().get_image().save_png("res://docs/"+file)
		cases.append({"mode":mode,"file":file,"width":viewport.size.x,"height":viewport.size.y,"provider_text":SimAgenda.current(w,m,pair.provider).text})
		viewport.queue_free();await get_tree().process_frame
	FileAccess.open("res://docs/CARE_FOLLOWUP_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"native desktop/mobile rendering; controlled reception cases plus imported unforced three-day followup"},"  "))
	print("CARE_FOLLOWUP_CAPTURE_COMPLETE");get_tree().quit()
