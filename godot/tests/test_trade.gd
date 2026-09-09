extends "res://tests/test_player_interaction.gd"
func _initialize() -> void:
	var cases: Array=JSON.parse_string(FileAccess.get_file_as_string("res://tests/trade/oracle.json"))
	for c in cases:
		var w:=SimWorld.new();w.load_snapshot(c.input);w.rng.state=int(c.seed)
		for day in 30:
			SimTrade.daily(w)
			if w.data.trade.merchant is Dictionary:
				SimTrade.execute(w,0,3);SimTrade.execute(w,w.data.trade.merchant.offers.size()-1,100)
		check(equal(w.data.trade,c.trade),"merchant and offers")
		check(equal(w.data.stockpile,c.stock),"stock and ledger")
		check(equal(w.data.messageLog,c.logs),"trade logs")
		check(w.rng.state==int(c.rng),"RNG")
	var report:={"checks":checks,"failures":failures,"scope":"nine 30-day source trade scenarios: seeded arrivals/departures/prices, reputation/building/news modifiers, buying/selling/exhaustion, exact ledger/logs/RNG"}
	FileAccess.open("res://docs/TRADE_TESTS.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print(JSON.stringify(report));quit(0 if failures.is_empty() else 1)
