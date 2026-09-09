class_name SimRandom
extends RefCounted
var state: int = 11456
func next_float() -> float:
	state = (state * 16807) % 2147483647
	return float(state - 1) / 2147483646.0
func next_int(low: int, high: int) -> int:
	return floori(next_float() * (high-low+1)) + low
func pick(values: Array) -> Variant:
	return values[next_int(0,values.size()-1)]
func weighted(values: Array, weights: Array) -> Variant:
	var total := 0.0
	for weight in weights: total += weight
	var value := next_float()*total
	for i in values.size():
		value -= weights[i]
		if value <= 0: return values[i]
	return values.back()
