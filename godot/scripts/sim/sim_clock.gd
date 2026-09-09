class_name SimClock
extends RefCounted
const SEASONS = ["春季","夏季","秋季","冬季"]
static func tick(clock: Dictionary) -> Array[String]:
	var events: Array[String] = []
	clock.minute += 15
	if clock.minute >= 60:
		clock.minute = 0; clock.hour += 1; events.append("new_hour")
	if clock.hour >= 24:
		clock.hour = 0; clock.day += 1; events.append("new_day")
	if clock.day > 15:
		clock.day = 1
		var index := SEASONS.find(clock.season)
		if index == 3:
			clock.season = SEASONS[0]; clock.year += 1; events.append("new_year")
		else: clock.season = SEASONS[index+1]
		events.append("new_season")
	return events
static func total_days(clock: Dictionary) -> int:
	return (int(clock.year)-1)*60 + maxi(0,SEASONS.find(clock.season))*15+int(clock.day)-1
