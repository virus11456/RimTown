class_name TownView
extends Node3D
var layout := TownLayout.new()
var content: Node3D
var shared_material: StandardMaterial3D
var meshes: Dictionary = {}
var dimensions: Dictionary = {}
var actors: Dictionary = {}
var current_save: Dictionary = {}
var sun: DirectionalLight3D
var environment: WorldEnvironment
var show_labels := true

func _ready() -> void:
	shared_material = StandardMaterial3D.new()
	shared_material.albedo_texture = load("res://assets/palette/palette.png")
	shared_material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	shared_material.roughness = 1.0
	shared_material.metallic = 0.0
	var verified: Array = JSON.parse_string(FileAccess.get_file_as_string("res://docs/ASSET_VERIFICATION.json"))
	for item in verified: dimensions[item.name] = item.size
	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 100
	add_child(sun)
	environment = WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("9bb5b0")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("d2e4df")
	environment.environment.ambient_light_energy = 0.55
	add_child(environment)

func _mesh(name: String) -> Mesh:
	if meshes.has(name): return meshes[name]
	var packed: PackedScene = load("res://assets/models/%s.glb" % name)
	var scene := packed.instantiate()
	var stack: Array[Node] = [scene]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		if node is MeshInstance3D:
			meshes[name] = node.mesh
			break
		for child in node.get_children(): stack.append(child)
	scene.free()
	return meshes.get(name)

func _instance(name: String,position_value: Vector3,scale_value := Vector3.ONE,parent: Node = null) -> MeshInstance3D:
	var model := MeshInstance3D.new()
	model.mesh = _mesh(name)
	model.material_override = shared_material
	model.position = position_value
	model.scale = scale_value
	(parent if parent != null else content).add_child(model)
	return model

func _building(name: String,zone: Dictionary,height_scale := 1.2) -> void:
	var size: Array = dimensions[name]
	var w: float = zone.w
	var depth: float = zone.h
	_instance(name,Vector3(zone.x+w/2,0.12,zone.y+depth/2),Vector3(w/float(size[0]),height_scale,depth/float(size[2])))

func display_save(save: Dictionary) -> void:
	current_save = save.duplicate(true)
	layout.rebuild(save)
	actors.clear()
	if content != null:
		remove_child(content)
		content.queue_free()
	content = Node3D.new()
	content.name = "Town"
	add_child(content)
	var winter: bool = save.get("clock",{}).get("season","") == "冬季"
	var harbor: bool = save.get("townTheme", "frontier") == "harbor"
	_build_terrain(winter)
	_build_locations(harbor)
	_build_overlays(save)
	_build_villagers(save)
	_light_clock(save.get("clock",{}))
	_weather(save)

func _build_terrain(winter: bool) -> void:
	var library := MeshLibrary.new()
	var names := ["ter_grass","ter_grass_light","ter_forest","ter_dirt","ter_stone","ter_water","ter_sand","ter_soil"]
	for i in names.size():
		library.create_item(i)
		var mesh := _mesh(names[i]).duplicate()
		if winter and i in [0,1,2]: mesh = _recolor(mesh,28, true)
		for surface in mesh.get_surface_count(): mesh.surface_set_material(surface,shared_material)
		library.set_item_mesh(i,mesh)
	var terrain := GridMap.new()
	terrain.name = "Terrain"
	terrain.cell_size = Vector3.ONE
	terrain.cell_center_y = false
	terrain.mesh_library = library
	content.add_child(terrain)
	var batches: Dictionary = {}
	for y in 60:
		for x in 80:
			var tile: int = layout.grid[y][x]
			var terrain_id := 0
			match tile:
				1: terrain_id=0
				2: terrain_id=0
				3: terrain_id=3
				4,5,6,7,8,9,15,16,28,29,30,31,32,33,34,35,36,40,41,42,43,44: terrain_id=4
				10,11: terrain_id=5
				37: terrain_id=6
				19,20,21: terrain_id=7
			terrain.set_cell_item(Vector3i(x,0,y),terrain_id)
			var prop := ""
			match tile:
				12,13,14: prop=["prop_tree_pine","prop_tree_oak","prop_tree_birch"][(x+y)%3]
				17,18: prop="prop_fence"
				19,20,21: prop="prop_crop_%d" % (tile-18)
				22,23: prop="prop_flower"
				24: prop="prop_bush"
				25: prop="prop_rock"
				38: prop="prop_bridge"
			if not prop.is_empty():
				if not batches.has(prop): batches[prop]=[]
				var scale_factor := 0.65 if tile in [12,13,14] else 1.0
				batches[prop].append(Transform3D(Basis.IDENTITY.scaled(Vector3.ONE*scale_factor),Vector3(x+.5,.12,y+.5)))
	for name in batches: _batch(name,batches[name])
	# Thin soil skirt gives the diorama a grounded silhouette.
	_instance("ter_soil",Vector3(40,-1.25,30),Vector3(80,11,60))

func _batch(name: String,transforms: Array) -> void:
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = _mesh(name)
	multimesh.instance_count = transforms.size()
	for i in transforms.size(): multimesh.set_instance_transform(i,transforms[i])
	var node := MultiMeshInstance3D.new()
	node.multimesh = multimesh
	node.material_override = shared_material
	content.add_child(node)

func _build_locations(harbor: bool) -> void:
	var mapping := {"town_hall":"bld_town_hall","tavern":"bld_tavern","chapel":"bld_chapel","farm":"bld_farmhouse","quarry":"bld_saltworks" if harbor else "bld_mine","workshop":"bld_workshop","general_store":"bld_market","clinic":"bld_clinic","library":"bld_lighthouse" if harbor else "bld_library","guardpost":"bld_guardpost"}
	for id in layout.buildings:
		var zone: Dictionary = layout.buildings[id]
		if layout.houses.has(id):
			_building(["bld_house_a","bld_house_b","bld_house_c"][posmod(str(id).hash(),3)],zone,1.5)
		elif mapping.has(id):
			var footprint := zone.duplicate()
			if id == "farm": footprint.w=6; footprint.h=5
			_building(mapping[id],footprint)
		elif id == "well": _instance("prop_well",Vector3(zone.x+2,.12,zone.y+2),Vector3.ONE*1.5)
		elif id == "town_square":
			_instance("prop_well",Vector3(zone.x+5,.12,zone.y+4),Vector3.ONE*1.8)
			for dx in [2,7]:
				for dy in [2,5]: _instance("prop_bench",Vector3(zone.x+dx+.5,.12,zone.y+dy+.5))
	_building("bld_coach_station",layout.coach,1.0)
	if harbor and layout.nature.has("river"):
		var river: Dictionary=layout.nature.river
		_instance("bld_dock",Vector3(river.x+4,.16,river.y+2),Vector3(1.8,1,1))
	for id in layout.labels:
		var info: Dictionary=layout.labels[id]
		var label := Label3D.new()
		label.text = str(info.name)
		label.font = load("res://assets/fonts/NotoSansTC.ttf")
		label.font_size = 40
		label.pixel_size = 0.019
		label.outline_size = 10
		label.modulate = Color("fff6db")
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.no_depth_test = true
		label.position = Vector3(float(info.x)/16,4.7,float(info.y)/16)
		label.visible = show_labels
		content.add_child(label)

func _build_overlays(save: Dictionary) -> void:
	var factories: Dictionary=save.get("processing",{}).get("builtFactories",{})
	var factory_keys := factories.keys()
	for i in layout.factory_plots.size():
		var plot: Dictionary=layout.factory_plots[i]
		_instance("ter_stone",Vector3(plot.x+2,.13,plot.y+1.5),Vector3(4,1,3))
		if i<factory_keys.size(): _building("bld_factory",plot,0.8)
		else: _instance("prop_crate",Vector3(plot.x+2,.3,plot.y+1.5),Vector3.ONE*.7)
	var placement := {"watchtower":["guardpost",-2,-2],"granary":["farm",8,-1],"marketplace":["town_square",9,-1],"well_upgrade":["well",0,-1],"training_ground":["guardpost",7,0],"brewery":["tavern",-3,-1],"garden":["clinic",-3,-1],"school":["library",-3,0],"farm_irrigation":["farm",-2,5],"forge_bellows":["workshop",-3,-1],"clinic_upgrade":["clinic",6,-1],"town_walls":["town_square",-5,-3]}
	for building in save.get("buildings",{}).get("completed",[]):
		var pos: Vector2
		var key: String=building.get("buildingKey",building.get("key",""))
		if building.has("siteX") and building.siteX!=null: pos=Vector2(building.siteX,building.siteY)
		elif placement.has(key):
			var rule: Array=placement[key]
			var zone: Dictionary=layout.buildings.get(rule[0],layout.nature.get(rule[0],{}))
			if zone.is_empty(): continue
			pos=Vector2(zone.x+rule[1],zone.y+rule[2])
		else: continue
		var model: String={"watchtower":"bld_guardpost","marketplace":"bld_market","well_upgrade":"prop_well","garden":"prop_bush","farm_irrigation":"prop_well","town_walls":"prop_fence"}.get(key,"bld_house_b")
		_building(model,{"x":pos.x,"y":pos.y,"w":2,"h":2},0.75)
	for project in layout.projects:
		_instance("ter_soil",Vector3(project.siteX+1,.15,project.siteY+1),Vector3(2,1,2))
		_instance("prop_crate",Vector3(project.siteX+.5,.3,project.siteY+.5))
	for decoration in layout.decorations:
		var name: String={"tree":"prop_tree_oak","pine":"prop_tree_pine","flower":"prop_flower","flowers":"prop_flower","bench":"prop_bench","lamp":"prop_lamp","lantern":"prop_lantern","campfire":"prop_campfire","fence":"prop_fence","well":"prop_well","statue":"prop_grave","fountain":"prop_well"}.get(str(decoration.get("type","")),"prop_flower")
		_instance(name,Vector3(decoration.x+.5,.14,decoration.y+.5))

func _recolor(source: Mesh,color_index: int,all_faces := false) -> ArrayMesh:
	var result := ArrayMesh.new()
	for surface in source.get_surface_count():
		var arrays := source.surface_get_arrays(surface)
		var uv: PackedVector2Array=arrays[Mesh.ARRAY_TEX_UV]
		for i in uv.size():
			# GLTF V coordinates are flipped relative to Blender's palette UVs.
			var index := floori(uv[i].x*16) + (15-floori(uv[i].y*16))*16
			if all_faces or index in [20,21]: uv[i]=Vector2((color_index%16+.5)/16,1.0-(floori(color_index/16.0)+.5)/16)
		arrays[Mesh.ARRAY_TEX_UV]=uv
		result.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	return result

func _build_villagers(save: Dictionary) -> void:
	var hats := {"farmer":"acc_hat_farmer","miner":"acc_hat_miner","cook":"acc_hat_cook","guard":"acc_hat_guard","priest":"acc_hat_priest"}
	var jobs := {"mayor":22,"doctor":28,"blacksmith":20,"cook":25,"farmer":23,"trader":21,"guard":24,"researcher":20,"miner":18,"priest":31,"carpenter":12,"tailor":21,"fisherman":20,"saltworker":14}
	for id in save.agents:
		var agent: Dictionary=save.agents[id]
		var age: float=agent.get("age",25)
		var body_name := "chr_body_child" if age<16 else "chr_body_elder" if age>=60 else "chr_body_f" if agent.get("gender")=="female" else "chr_body_m"
		var pos: Dictionary=layout.agent_positions[id]
		var actor := Node3D.new()
		actor.name=str(id)
		actor.position=Vector3(pos.x/16,.16,pos.y/16)
		content.add_child(actor)
		actors[id]=actor
		var body := _instance(body_name,Vector3.ZERO,Vector3.ONE,actor)
		var job: String=str(agent.get("jobKey","default"))
		body.mesh=_recolor(body.mesh,int(jobs.get(job,20)))
		var head_y:=1.37 if age>=16 else 1.03
		var traits: Array=agent.get("personality",{}).get("traits",[])
		var variant := 1+posmod(str(id).hash()+traits.size(),6)
		_instance("chr_hair_%02d"%variant,Vector3(0,head_y,0),Vector3.ONE*.95,actor)
		if hats.has(job): _instance(hats[job],Vector3(0,head_y+.1,0),Vector3.ONE,actor)
		if "shy" in traits: actor.rotation_degrees.y=-18
		elif "charismatic" in traits: actor.rotation_degrees.y=18
		if job in ["miner","blacksmith","farmer","researcher"]:
			var tool: String={"miner":"acc_tool_pickaxe","blacksmith":"acc_tool_hammer","farmer":"acc_tool_hoe","researcher":"acc_tool_book"}[job]
			_instance(tool,Vector3(.4,.35,0),Vector3.ONE*.7,actor)

func agent_position(id: String) -> Variant:
	return actors[id].position if actors.has(id) else null

func _light_clock(clock_data: Dictionary) -> void:
	var hour: float=float(clock_data.get("hour",12))+float(clock_data.get("minute",0))/60
	var daylight := clampf(sin((hour-6)/12*PI),0,1)
	sun.rotation_degrees=Vector3(-15-daylight*45,-40+(hour-6)*8,0)
	sun.light_energy=0.25+daylight*.7
	sun.light_color=Color("ffd9ac").lerp(Color("fff8e7"),daylight)
	environment.environment.ambient_light_energy=.28+daylight*.35
	environment.environment.background_color=Color("172e40").lerp(Color("9bb5b0"),daylight)

func _weather(save: Dictionary) -> void:
	var weather: String=str(save.get("weather",{}).get("current","clear"))
	var season: String=str(save.get("clock",{}).get("season","春季"))
	var hour: float=save.get("clock",{}).get("hour",12)
	var kind := ""
	if weather in ["rain","storm"]: kind="rain"
	elif weather in ["snow","blizzard"]: kind="snow"
	elif season=="秋季": kind="leaves"
	elif season=="夏季" and (hour>=19 or hour<5): kind="fireflies"
	for old_kind in ["rain","snow","leaves","fireflies"]:
		var old:=content.get_node_or_null(old_kind)
		if old!=null:
			if old_kind==kind: return
			content.remove_child(old)
			old.queue_free()
	if kind.is_empty(): return
	var particles:=GPUParticles3D.new()
	particles.name=kind
	particles.amount=120 if kind!="fireflies" else 50
	particles.lifetime=8
	particles.preprocess=8
	particles.visibility_aabb=AABB(Vector3(-45,-10,-35),Vector3(90,40,70))
	particles.position=Vector3(40,12,30)
	var process:=ParticleProcessMaterial.new()
	process.emission_shape=ParticleProcessMaterial.EMISSION_SHAPE_BOX
	process.emission_box_extents=Vector3(40,1,30)
	process.direction=Vector3.DOWN
	process.spread=8
	process.initial_velocity_min=3 if kind=="rain" else .5
	process.initial_velocity_max=5 if kind=="rain" else 1
	process.gravity=Vector3(0,-2 if kind=="rain" else -.2,0)
	if kind=="fireflies":
		particles.position.y=1
		process.gravity=Vector3.ZERO
		process.initial_velocity_min=.03
		process.initial_velocity_max=.1
	particles.process_material=process
	var quad:=QuadMesh.new()
	quad.size=Vector2(.035,.5) if kind=="rain" else Vector2(.12,.12)
	var color_index: int={"rain":15,"snow":28,"leaves":29,"fireflies":26}[kind]
	var arrays:=quad.get_mesh_arrays()
	var uvs: PackedVector2Array=arrays[Mesh.ARRAY_TEX_UV]
	for i in uvs.size(): uvs[i]=Vector2((color_index%16+.5)/16,1.0-(floori(color_index/16.0)+.5)/16)
	arrays[Mesh.ARRAY_TEX_UV]=uvs
	var mesh:=ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	mesh.surface_set_material(0,shared_material)
	particles.draw_pass_1=mesh
	content.add_child(particles)

func animate_agents(positions: Dictionary) -> void:
	for id in positions:
		if not actors.has(id): continue
		var p: Dictionary=positions[id]
		var actor: Node3D=actors[id]
		var previous:=actor.position
		var walking: bool=p.get("walking",false)
		var bob:=sin(float(p.get("walkStep",0))*.18)*.045 if walking else 0.0
		actor.position=Vector3(float(p.x)/16,.16+bob,float(p.y)/16)
		var direction:=actor.position-previous
		if walking and Vector2(direction.x,direction.z).length()>.0001:
			actor.rotation.y=atan2(direction.x,direction.z)
		actor.rotation.z=PI/2 if p.get("activity")=="sleeping" and not walking else 0.0
