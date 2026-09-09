class_name DisputeBubbles
extends CanvasLayer
## Short visual responses to new simulation events; not dialogue or saved state.
var town: Node3D
var bubbles: Dictionary={}
func clear() -> void:
	for entry in bubbles.values(): entry.panel.queue_free();entry.tail.queue_free()
	bubbles.clear()
func show_dispute(a: String,b: String) -> void:
	_show(a,"你這樣說太過分了！",0)
	_show(b,"我也受夠了！",1)
func _show(id: String,text: String,side: int) -> void:
	if not town.actors.has(id): return
	if bubbles.has(id): bubbles[id].panel.queue_free();bubbles[id].tail.queue_free()
	var panel:=PanelContainer.new();panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var style:=StyleBoxFlat.new();style.bg_color=Color("fff0df");style.border_color=Color("b85242")
	style.set_border_width_all(2);style.set_corner_radius_all(10)
	style.content_margin_left=10;style.content_margin_right=10;style.content_margin_top=7;style.content_margin_bottom=7
	panel.add_theme_stylebox_override("panel",style)
	var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font",load("res://assets/fonts/NotoSansTC.ttf"));label.add_theme_font_size_override("font_size",14);label.add_theme_color_override("font_color",Color("662d27"))
	label.text=str(town.current_save.agents.get(id,{}).get("name",id))+"\n"+text
	panel.add_child(label)
	var tail:=Polygon2D.new();tail.color=Color("b85242");add_child(tail);add_child(panel)
	bubbles[id]={"panel":panel,"tail":tail,"remaining":6.0,"side":side}
	_update_positions()
func _process(delta: float) -> void:
	for id in bubbles.keys():
		bubbles[id].remaining-=delta
		if bubbles[id].remaining<=0 or not town.actors.has(id):
			bubbles[id].panel.queue_free();bubbles[id].tail.queue_free();bubbles.erase(id)
	_update_positions()
func _update_positions() -> void:
	var camera:=get_viewport().get_camera_3d()
	if camera==null: return
	var bounds:=get_viewport().get_visible_rect()
	var occupied: Array[Rect2]=[]
	for id in bubbles:
		var entry: Dictionary=bubbles[id]
		var position: Vector3=town.actors[id].global_position+Vector3(0,2.0,0)
		var anchor:=camera.unproject_position(position)
		var visible_now:=not camera.is_position_behind(position) and bounds.has_point(anchor)
		entry.panel.visible=visible_now;entry.tail.visible=visible_now
		if not visible_now: continue
		var size: Vector2=entry.panel.get_combined_minimum_size()
		entry.panel.size=size
		var point:=anchor-Vector2(size.x*.5,size.y+12)
		point.x=clampf(point.x,8,maxf(8,bounds.size.x-size.x-8));point.y=clampf(point.y,212,maxf(212,bounds.size.y-size.y-88))
		var candidates: Array[Vector2]=[point]
		for rect in occupied:
			candidates.append(Vector2(rect.end.x+8,point.y))
			candidates.append(Vector2(rect.position.x-size.x-8,point.y))
			candidates.append(Vector2(point.x,rect.position.y-size.y-8))
			candidates.append(Vector2(point.x,rect.end.y+8))
		var found:=false
		for candidate in candidates:
			var rect:=Rect2(candidate,size)
			if candidate.x<8 or candidate.y<212 or rect.end.x>bounds.size.x-8 or rect.end.y>bounds.size.y-88: continue
			if occupied.any(func(other): return rect.intersects(other.grow(4))): continue
			point=candidate;found=true;break
		if not found: entry.panel.hide();entry.tail.hide();continue
		entry.panel.position=point
		occupied.append(Rect2(point,size))
		var foot:=Vector2(clampf(anchor.x,point.x+12,point.x+size.x-12),point.y+size.y)
		entry.tail.polygon=PackedVector2Array([foot+Vector2(-5,0),foot+Vector2(5,0),anchor])
