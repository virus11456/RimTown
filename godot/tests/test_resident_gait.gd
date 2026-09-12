extends "res://tests/test_player_chat_ui.gd"
var contacts:=0
var variants: Array=[]
func run() -> void:
	var viewport:=SubViewport.new();viewport.size=Vector2i(900,700);viewport.own_world_3d=true;root.add_child(viewport)
	var app: Node=load("res://scenes/main.tscn").instantiate();viewport.add_child(app);await process_frame;app.set_process(false)
	for town in ["frontier","harbor"]:
		for variant in [[9,"male"],[28,"male"],[28,"female"],[70,"male"]]:
			app.load_demo(town)
			var id: String=app.simulation.data.agents.keys().filter(func(k):return k!="player")[0]
			app.simulation.data.agents[id].age=variant[0];app.simulation.data.agents[id].gender=variant[1]
			app.world_view.display_save(app.simulation.snapshot())
			var town_view: TownView=app.world_view
			check(town_view.resident_gaits.size()==app.simulation.data.agents.size()-1,"all residents get independent gait state")
			var actor: Node3D=town_view.actors[id];var body: Node3D=actor.get_node("Body")
			var h: float=body.get_meta("gait_height")
			check(is_equal_approx(h,.78 if variant[0]<16 else 1.0),"height matches model")
			var positions: Dictionary=app.motion.positions.duplicate(true)
			positions[id].x=640.0;positions[id].y=480.0;positions[id].walking=false;positions[id].activity="idle"
			town_view.animate_agents(positions);town_view.animate_resident_gaits(positions,1.0/60)
			var before: Dictionary=app.simulation.snapshot();var original_motion: Dictionary=app.motion.positions.duplicate(true)
			for frame in 120:
				positions[id].x+=.8;positions[id].walking=true;positions[id].activity="heading_home"
				town_view.animate_agents(positions);town_view.animate_resident_gaits(positions,1.0/60)
				var gait: TravelerGait=town_view.resident_gaits[id]
				for side in 2:
					var shoe: MeshInstance3D=body.get_node("GaitRight" if side==0 else "GaitLeft")
					var bottom:=INF
					for v in shoe.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]: bottom=minf(bottom,(shoe.global_transform*v).y)
					check(bottom>=.1199,"resident shoe never enters ground")
					if gait.feet[side].planted: contacts+=1;check(absf(bottom-.12)<.0001,"resident support remains grounded")
					var hip: Vector3=shoe.get_meta("hip");var knee: Vector3=shoe.get_meta("knee");var ankle: Vector3=shoe.get_meta("ankle")
					check(absf(hip.distance_to(knee)-.28*h)<.0001 and absf(knee.distance_to(ankle)-.28*h)<.0001,"age-specific bones keep length")
			check(equal(before,app.simulation.snapshot()) and equal(original_motion,app.motion.positions),"rendering cannot change routines or motion")
			for frame in 30:
				positions[id].walking=false;positions[id].activity="working";town_view.animate_agents(positions);town_view.animate_resident_gaits(positions,1.0/60)
			check(body.get_node("ServiceRight").rotation==Vector3.ZERO and town_view.resident_gaits[id].weight==0,"stationary work returns arms and feet to rest")
			positions[id].activity="sleeping";town_view.animate_agents(positions);town_view.animate_resident_gaits(positions,1.0/60)
			check(is_equal_approx(actor.rotation.z,PI/2) and town_view.resident_gaits[id].feet.is_empty(),"sleep restores local rest pose and releases support")
			positions[id].walking=true;positions[id].x+=.8
			town_view.animate_agents(positions);town_view.animate_resident_gaits(positions,1.0/60)
			check(actor.rotation.z==0 and town_view.resident_gaits[id].weight>0,"walking wins over stale sleeping label")
			# Pause through the real frame handler with matching motion positions.
			app.motion.positions=positions;app.motion.manual_player=true;app.running=false
			var phase: float=town_view.resident_gaits[id].phase;var foot: Transform3D=body.get_node("GaitRight").global_transform
			app._process(.1)
			check(town_view.resident_gaits[id].phase==phase and body.get_node("GaitRight").global_transform.is_equal_approx(foot),"paused simulation freezes resident gait")
			var saved: Dictionary=app.progress_snapshot();app._load_document(JSON.stringify(saved),"resident gait reload")
			check(app.world_view.resident_gaits[id].feet.is_empty(),"reload does not retain old world foot anchors")
			variants.append({"town":town,"age":variant[0],"gender":variant[1]})
	var report:={"checks":checks,"failures":failures,"contacts":contacts,"variants":variants,"scope":"controlled child/male/female/elder model variants in both towns, independent resident state, actual mesh floor and bone geometry, pure presentation, work stop, sleeping, stale sleep label, real pause and reload"}
	FileAccess.open("res://docs/RESIDENT_GAIT_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "));print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)
