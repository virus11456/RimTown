class_name InteriorFurnishings
extends RefCounted
# Furnish existing solid wall cells only; never create an invisible path obstacle.
var rooms: Dictionary = {}
const WOOD := Color("755239")
const TOP := Color("b99060")
const PAPER := Color("ded4b4")
func build(layout: TownLayout, parent: Node3D, shells: Dictionary) -> void:
	rooms.clear()
	for key in shells:
		var zone: Dictionary = layout.buildings[key]
		var room := Node3D.new();room.name="Furnishings_"+key;parent.add_child(room)
		room.visible=false;rooms[key]=room
		# Back-wall units keep the door side and every navigable cell untouched.
		var count := 0
		var limit := 2 if key=="library" else 3
		for cell in SimWorkstation.slots(layout,zone,limit):
			var x:=cell.x;var y:=cell.y
			var unit := Node3D.new();unit.position=Vector3(x+.5,.12,y+.5);room.add_child(unit)
			unit.set_meta("cell",Vector2i(x,y))
			var job: String=""
			if key=="workshop": job="carpenter" if count==0 else ("tailor" if count==1 else "")
			elif count==0: job={"tavern":"cook","library":"researcher"}.get(key,"")
			var station:=SimWorkstation.resolve(layout,job)
			if not station.is_empty():
				unit.position=Vector3(station.bench.x,.12,station.bench.y);unit.set_meta("cell",station.cell)
				unit.set_meta("station_job",job)
				var mesh:=TorusMesh.new();mesh.inner_radius=.17;mesh.outer_radius=.21
				CareerProps.part(room,mesh,Vector3(station.stand.x/16,.135,station.stand.y/16),Color("ebc477"))
			make_unit(unit,str(key),count);count+=1
func make_unit(unit: Node3D,key: String,index: int) -> void:
	CareerProps.box(unit,Vector3(.78,.62,.66),Vector3(0,.31,0),WOOD)
	CareerProps.box(unit,Vector3(.94,.08,.96) if unit.has_meta("station_job") else Vector3(.84,.08,.72),Vector3(0,.66,0),TOP)
	if unit.get_meta("station_job","") in ["cook","tailor","researcher"]:
		# Keep the operating surface clear for the held bowl, cloth or book.
		return
	if key=="library" or key=="town_hall":
		for i in 4:
			CareerProps.box(unit,Vector3(.11,.25+.04*(i%2),.30),Vector3(-.24+i*.16,.84,0),[Color("765773"),Color("687b66"),Color("a87b54"),PAPER][i])
	elif key=="tavern":
		CareerProps.tube(unit,.20,.12,Vector3(0,.77,0),Color("718b91"))
		CareerProps.tube(unit,.17,.014,Vector3(0,.84,0),Color("caa261"))
	elif key=="workshop":
		CareerProps.box(unit,Vector3(.78,.10,.94) if index==0 else Vector3(.45,.10,.34),Vector3(0,.75,0),Color("718b91"))
		if index>0: CareerProps.box(unit,Vector3(.35,.055,.065),Vector3(0,.84,0),TOP)
	elif key=="clinic" or key=="chapel":
		CareerProps.box(unit,Vector3(.45,.08,.35),Vector3(0,.74,0),PAPER)
		CareerProps.tube(unit,.07,.19,Vector3(.20,.80,0),Color("7da4a1"))
	else:
		CareerProps.box(unit,Vector3(.44,.12,.35),Vector3(0,.76,0),Color("a77d78") if index%2==0 else Color("789087"))
		CareerProps.box(unit,Vector3(.12,.04,.03),Vector3(0,.36,.345),TOP)
func update(opened: String) -> void:
	for key in rooms: rooms[key].visible=key==opened
