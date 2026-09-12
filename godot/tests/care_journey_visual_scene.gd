extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/resident_care_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_journey")
func capture_journey() -> void:
	var cases: Array=[]
	for town in ["frontier","harbor"]:
		for job in ["doctor","priest"]:
			var pair: Dictionary=Fixture.prepare(self,town,job)
			var w: SimWorld=simulation;var m: SimMotion=motion;w.social_enabled=true;w.social.observe_positions(m)
			var a: Dictionary=w.data.agents[pair.recipient];var b: Dictionary=w.data.agents[pair.provider]
			a.needs.rest=40;a.needs.hunger=100;b.needs.rest=100;b.needs.hunger=100
			for id in w.data.agents:
				if id!=pair.recipient: w.data.agents[id]._careVisitDay=SimClock.total_days(w.data.clock)
			var q: Dictionary=m.positions[pair.provider];var goal:=Vector2.INF
			for offset in [Vector2(24,0),Vector2(-24,0),Vector2(0,24),Vector2(0,-24),Vector2(12,0),Vector2(-12,0),Vector2(0,12),Vector2(0,-12)]:
				var candidate: Vector2=Vector2(q.x,q.y)+offset
				if m.layout._walkable(candidate) and m.location_at(candidate)==b.currentLocation: goal=candidate;break
			var found:=false
			for place in w.data.townMap.locations:
				var point:=m.layout._nearest(m.layout._center(place));m.positions[pair.recipient].x=point.x;m.positions[pair.recipient].y=point.y
				if SimResidentCare.travel_ticks(m,pair.recipient,b.currentLocation,goal)>=6 and SimResidentCare.feasibility(w,a,b,goal).is_empty(): found=true;break
			assert(found);SimResidentCare.tick(w);SimResidentCare.apply(w,a,w.runtime[pair.recipient]);m.update(w.data.agents)
			for phase in ["travel","visiting"]:
				if phase=="visiting":
					for frame in 4000:
						m.update(w.data.agents)
						if not m.positions[pair.recipient].walking and m.positions[pair.recipient].get("doorPhase")==null: break
					w.data.tickCount+=1;SimResidentCare.tick(w);SimResidentCare.apply(w,a,w.runtime[pair.recipient])
				assert(a._careVisit.state==phase)
				Fixture.render(self);world_view.show_labels=false
				rig.width=45;rig.angle=135;rig.follow_player=false;rig.position=world_view.actors[pair.recipient].position+Vector3(0,.7,0);rig._sync();world_view._light_clock(w.data.clock)
				summary.text="%s %d日 %02d:%02d · %d人"%[w.data.clock.season,w.data.clock.day,w.data.clock.hour,w.data.clock.minute,w.data.agents.size()]
				hud.visible=true;drawer.show();show_agenda(pair.recipient)
				await get_tree().process_frame;await get_tree().process_frame;await RenderingServer.frame_post_draw
				get_viewport().get_texture().get_image().save_png("res://docs/journey-"+town+"-"+job+"-"+phase+".png")
				cases.append({"town":town,"job":job,"state":phase,"visit":a._careVisit.duplicate(true)})
	FileAccess.open("res://docs/CARE_JOURNEY_CAPTURE.json",FileAccess.WRITE).store_string(JSON.stringify({"cases":cases,"scope":"controlled needs and long-route start; actual departure, collision movement and arrival, native agenda phase/time text; no natural-play claim"},"  "))
	print("CARE_JOURNEY_CAPTURE_COMPLETE");get_tree().quit()
