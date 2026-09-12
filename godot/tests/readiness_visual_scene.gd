extends "res://scripts/view/main.gd"
const Fixture=preload("res://tests/work_pose_fixture.gd")
func _ready() -> void:
	super._ready();set_process(false);call_deferred("capture_readiness")
func capture_readiness() -> void:
	for state in ["reserve","materials","research"]:
		Fixture.prepare(self,"frontier","researcher" if state=="research" else "cook")
		if state=="reserve": simulation.data.stockpile.resources.meals=SimSupply.reserve(simulation,"meals")
		elif state=="materials": simulation.data.stockpile.resources.food=0
		else: simulation.data.stockpile.resources.research_points=100
		show_careers()
		await get_tree().process_frame
		(drawer_body.get_parent() as ScrollContainer).scroll_vertical=0 if state=="research" else 330
		await get_tree().process_frame;await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://docs/readiness-"+state+".png")
	print("READINESS_VISUAL_CAPTURE_COMPLETE")
