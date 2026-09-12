class_name InteriorCutaway
extends RefCounted
# Display-only room opening. Collision and saved motion remain authoritative.
var shells: Dictionary={}
var originals: Dictionary={}
var labels: Dictionary={}
var opened := ""
var material: ShaderMaterial
func _init(palette: Texture2D=null) -> void:
	var shader:=Shader.new()
	shader.code="""shader_type spatial;
uniform sampler2D palette : source_color, filter_nearest;
uniform float wall_top = 0.55;
varying float world_height;
void vertex() { world_height = (MODEL_MATRIX * vec4(VERTEX, 1.0)).y; }
void fragment() {
	if (world_height > wall_top) { discard; }
	ALBEDO = texture(palette, UV).rgb;
	ROUGHNESS = 1.0;
}
"""
	material=ShaderMaterial.new();material.shader=shader;material.set_shader_parameter("palette",palette)
func register_shell(key: String,node: MeshInstance3D) -> void:
	shells[key]=node
	originals[key]={"material":node.material_override,"shadow":node.cast_shadow}
func occupied(layout: TownLayout,positions: Dictionary) -> String:
	if not positions.has("player"): return ""
	var p: Dictionary=positions.player
	if p.get("doorPhase")!=null: return ""
	var point:=Vector2(float(p.x),float(p.y))
	if not layout._walkable(point): return ""
	var tile_x:=floori(point.x/16);var tile_y:=floori(point.y/16)
	if tile_y<0 or tile_y>=layout.grid.size() or tile_x<0 or tile_x>=layout.grid[tile_y].size(): return ""
	if int(layout.grid[tile_y][tile_x])==9: return ""
	for key in shells:
		var z: Dictionary=layout.buildings.get(key,{})
		if not z.has("doorPixelX"): continue
		if point.x>=float(z.x)*16 and point.x<float(z.x+z.w)*16 and point.y>=float(z.y)*16 and point.y<float(z.y+z.h)*16: return key
	return ""
func update(layout: TownLayout,positions: Dictionary,show_labels: bool) -> void:
	var key:=occupied(layout,positions)
	if key!=opened:
		if shells.has(opened):
			shells[opened].material_override=originals[opened].material
			shells[opened].cast_shadow=originals[opened].shadow
		opened=key
		if shells.has(opened):
			shells[opened].material_override=material
			shells[opened].cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for id in labels:
		labels[id].visible=show_labels and id!=opened
