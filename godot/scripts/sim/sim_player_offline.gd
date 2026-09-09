class_name SimPlayerOffline
extends RefCounted
## Local authored dialogue, ported from ConversationEngine._fallbackPlayerReply.
static func has(message: String,pattern: String) -> bool:
	var regex:=RegEx.new();regex.compile(pattern);return regex.search(message)!=null
static func reply(w: SimWorld,id: String,message: String) -> Dictionary:
	var npc: Dictionary=w.data.agents[id];var player: Dictionary=w.data.agents.player
	var rel:=SimSocial.relationship(npc,player)
	var tr: Array=npc.personality.traits
	var aff: float=rel.affinity
	var couple: bool=rel.get("status") in ["dating","married"]
	var msg:=message.to_lower()
	var job: Dictionary=SimPlayerChat.job(w,npc)
	var title: String=job.get("title","居民");var job_key: String=job.get("key","")
	var loc: String=npc.currentLocation.replace("_"," ")
	var season: String=w.data.clock.season
	var night: bool=int(w.data.clock.hour)>=17 or int(w.data.clock.hour)<5
	var shy: bool="shy" in tr;var kind: bool="kind" in tr;var abrasive: bool="abrasive" in tr
	var charismatic: bool="charismatic" in tr;var gossip: bool="gossip" in tr;var romantic: bool="romantic" in tr
	var pessimist: bool="pessimist" in tr;var optimist: bool="optimist" in tr;var lazy: bool="lazy" in tr
	var rng:=w.rng;var text:="";var affinity:=0;var romance:=0;var summary:=""
	if has(msg,"笨|蠢|醜|差|爛|廢|討厭|滾"):
		if abrasive: text=rng.pick(["你說什麼！？你自己才是吧！","哼，你也好不到哪去。","你這嘴巴欠教訓。"])
		elif shy: text=rng.pick(["...你、你怎麼能這樣說...","......","我做錯什麼了嗎..."])
		elif kind: text=rng.pick(["這樣說話很傷人的...","你是不是心情不好？不然怎麼會這樣。","我...不知道你為什麼要這樣。"])
		else: text=rng.pick(["你這話說得太過分了。","......我沒必要跟你計較。","你認真的嗎？"])
		affinity=rng.next_int(-6,-3);summary=player.name+"言語冒犯了"+npc.name+"。"
	elif has(msg,"好看|漂亮|帥|可愛|迷人|約會|陪我"):
		if couple:
			text=rng.pick(["你啊...每次都這樣，不過我就是吃這套。","哈哈，老夫老妻了還這麼會講。","你真的很會撩人，我都不好意思了。"])
			affinity=rng.next_int(2,4);romance=rng.next_int(1,3)
		elif romantic and aff>10:
			text=rng.pick(["你、你在說什麼啦...（臉紅）","別、別突然這樣講...","...謝謝...（小聲）"] if shy else ["哈哈，你還挺會說話的嘛。","嗯？你是在跟我告白嗎？","你這話讓人心跳加速呢。"])
			affinity=rng.next_int(1,4);romance=rng.next_int(2,5)
		elif aff< -10:
			text=rng.pick(["...你在開什麼玩笑。","拜託，省省吧。","你是不是搞錯了什麼？"]);affinity=rng.next_int(-2,0)
		else:
			text="...什麼？（不知所措）" if shy else rng.pick(["哈？你認真的嗎？","嗯...謝謝？","你還挺有趣的。"])
			affinity=rng.next_int(0,2);romance=rng.next_int(0,2)
		summary=player.name+"對"+npc.name+"說了甜言蜜語。"
	elif has(msg,"你好|嗨|哈囉|hello|hi|早安|晚安|嘿"):
		if couple: text=rng.pick(["嗨親愛的，我一直在等你呢。","你來了！好想你。","嘿~今天怎麼這麼晚來找我？"])
		elif aff>50: text=player.name+"！太好了你來了！" if charismatic else ("啊..."+player.name+"...你好。（微笑）" if shy else "嘿！好久不見，最近好嗎？")
		elif aff>10: text=rng.pick(["你好啊！有什麼事嗎？","嗨！今天"+loc+"挺熱鬧的。","哈囉，正好遇到你了。"])
		elif aff> -10: text="嗯？怎麼了。" if abrasive else rng.pick(["嗯，你好。","哦，是你啊。","哈囉。"])
		else: text=rng.pick(["...有事嗎？","你又來了。","嗯。"])
		affinity=rng.next_int(0,2) if aff> -10 else rng.next_int(-1,0);summary=player.name+"和"+npc.name+"打了招呼。"
	elif has(msg,"名字|你叫|你是誰|認識"):
		text=rng.pick(["我叫"+npc.name+"，"+str(int(npc.age))+"歲，在鎮上當"+title+"。",npc.name+"啊，怎麼？你忘了我嗎？","我...我叫"+npc.name+"..." if shy else "我是"+npc.name+"，認識一下！"])
		affinity=rng.next_int(0,2);summary=npc.name+"自我介紹了。"
	elif has(msg,"工作|職業|做什麼|你在幹|忙什麼"):
		# Object literal in the original eagerly consumes four random choices, regardless of job.
		var jobs:={
			"farmer":["我是農夫啊，每天日出就到田裡去了。"+season+"是"+str(rng.pick(["播種","收穫","準備","整地"]))+"的季節。","種田很辛苦，但看到作物長大就很有成就感。"],
			"miner":["挖礦啊，每天鑽到山裡去。最近挖到了一些不錯的"+str(rng.pick(["鐵礦","石頭","稀有礦石"]))+"。","礦坑裡又暗又悶，但能找到好東西的時候特別開心。"],
			"cook":["我在酒館煮飯！最近在研究新"+str(rng.pick(["菜色","食譜","料理"]))+"。","煮飯給大家吃是我的樂趣，你要不要嚐嚐？"],
			"blacksmith":["我是鐵匠，每天跟鐵和火打交道。"+("...比跟人打交道容易多了。" if shy else "最近在打造一把新的工具。"),"敲打金屬的感覺很療癒，每一件作品都是獨一無二的。"],
			"doctor":["我是醫生，"+("...雖然有時候很懶得看診。" if lazy else "負責照顧鎮上所有人的健康。")+"有什麼不舒服嗎？","行醫是一份責任很重的工作，但能治好人的時候很開心。"],
			"researcher":["我在圖書館做研究，最近在研究"+str(rng.pick(["古代遺跡","草藥學","天文現象","歷史文獻"]))+"。","學問的世界無窮無盡，每天都有新發現。"],
			"trader":["我做買賣的，跟外面的商隊有聯繫。"+("要買什麼跟我說，我給你打折！" if charismatic else "最近市場不太穩定。"),"當商人最重要的是眼光和人脈。"],
			"guard":["我是守衛，負責鎮上的安全。"+("這年頭什麼事都可能發生。" if pessimist else "還好最近挺太平的。"),"守衛的工作就是讓大家能安心過日子。"],
			"carpenter":["我是木匠，蓋房子修東西。"+("...雖然有時候偷懶。" if lazy else "最近在趕工，忙得很。"),"木工的手藝越老越精，每塊木頭都有它的個性。"],
			"tailor":["我是裁縫，做衣服的。"+("...你要訂做什麼嗎？" if shy else "最近在設計新款式呢！"),"一針一線都是心血，我對品質很要求的。"],
			"priest":["我在禮拜堂服務，照顧大家的心靈。"+("如果有煩惱，可以來找我聊聊。" if kind else "也會幫忙主持各種儀式。"),"能為鎮民帶來平靜和希望，就是我最大的滿足。"],
			"mayor":["我是鎮長，管理鎮上大小事務。"+("我對這個鎮的未來很有信心！" if optimist else "責任很重，但這是我的使命。"),"治理一個鎮子不容易，但看到大家過得好就值了。"]}
		text=rng.pick(jobs.get(job_key,["我在鎮上當"+title+"，還過得去吧。",title+"的工作有好有壞，但至少有事做。"]));affinity=rng.next_int(0,2);summary=npc.name+"聊了自己的工作。"
	elif has(msg,"心情|怎麼了|還好嗎|你好嗎|開心|難過|不好"):
		if npc.mood>60: text=rng.pick(["我很好啊！"+("今天特別開心！" if optimist else "最近一切都挺順利的。"),"心情不錯！有什麼好事就是會開心嘛。","挺好的，謝謝你關心。"])
		elif npc.mood>30: text=rng.pick(["還行吧，普普通通。","馬馬虎虎，"+("不過總覺得少了什麼。" if pessimist else "就是平常的日子。"),"沒什麼特別的，過一天算一天。"])
		else: text=rng.pick(["唉...說實話不太好。"+("不過沒關係，撐得住。" if kind else "別問了。"),"最近有點"+str(rng.pick(["煩","累","低落","壓力大"]))+"..."+("..." if shy else "你真的想聽嗎？"),"一如既往地糟。" if pessimist else "有點不順，但會過去的。"])
		affinity=rng.next_int(1,3);summary=npc.name+"分享了自己的心情。"
	elif has(msg,"喜歡|愛|暗戀|對象|交往|結婚|單身|感情"):
		if couple:
			text=rng.pick(["我跟"+player.name+"在一起啊，你忘了嗎？","哈哈，感情的事...有你就夠了。","你是在試探我嗎？我只有你啊。"]);romance=rng.next_int(1,3)
		elif rel.romanticInterest>50:
			text="感、感情的事...我不太想說...（臉紅）" if shy else rng.pick(["嗯...其實有一個在意的人啦...不告訴你是誰。","你為什麼突然問這個？難道你...？","哈，秘密。"]);romance=rng.next_int(0,2)
		else: text=rng.pick(["還沒遇到對的人呢...不過我相信緣分。","我是很期待愛情的，只是...唉。"] if romantic else ["這種事順其自然吧。","目前沒什麼想法，工作比較重要。","關你什麼事。" if abrasive else "哈哈，你怎麼突然問這個？"])
		affinity=rng.next_int(0,2);summary=player.name+"問了"+npc.name+"感情的事。"
	elif has(msg,"故事|過去|以前|經歷|怎麼來|家鄉"):
		var background: String=npc.personality.background
		text=rng.pick(["我的故事啊..."+background,"以前的事嗎？"+("...有點不好意思說。" if shy else "坐下來，我慢慢跟你講。")+" "+background,"你想知道我的過去？好吧..."+utf16_left(background,50)])
		affinity=rng.next_int(1,4);summary=npc.name+"分享了自己的故事。"
	elif has(msg,"鎮上|小鎮|這裡|消息|八卦|新聞|最近"):
		var topics: Array=w.data.get("events",{}).get("conversationTopics",[])
		var items: Array=w.data.get("gossip",[])
		if gossip and not items.is_empty(): text="你想知道最近的八卦？"+str(rng.pick(items).content)+" 這可是獨家消息喔！"
		elif not topics.is_empty(): text="最近鎮上在聊"+str(rng.pick(topics))+"的事，你聽說了嗎？"
		else: text=rng.pick(["鎮上最近"+("挺太平的，大家都過得不錯。" if optimist else "也沒什麼特別的事。"),season+"嘛，"+str(rng.pick(["農忙的季節","大家都挺忙的","日子就這樣過"]))+"。","最近總覺得要出什麼事..." if pessimist else "邊境鎮就是這樣，每天都有小故事。"])
		affinity=rng.next_int(0,3);summary=npc.name+"跟"+player.name+"聊了鎮上的近況。"
	elif has(msg,"吃|餓|食物|餐|飯|料理|好吃"):
		if job_key=="cook": text=rng.pick(["你來對人了！我最近做了"+str(rng.pick(["燉肉","烤魚","蔬菜湯","肉包子"]))+"，要不要嚐嚐？","吃的是我的專業！等著，我去給你弄點好吃的。"])
		elif npc.needs.hunger<30: text="別說了，我自己都快餓死了...一起去酒館吧？"
		else: text=rng.pick(["酒館的飯菜不錯，推薦你去試試。","王麗煮的菜最好吃了，你應該去嚐嚐。","肚子餓了嗎？吃飽了心情才會好。"])
		affinity=rng.next_int(0,2);summary=player.name+"和"+npc.name+"聊了吃的。"
	elif has(msg,"天氣|天空|冷|熱|下雨|季節|星星"):
		var weather:={"春季":"春天暖洋洋的","夏季":"夏天好熱","秋季":"秋天涼爽","冬季":"冬天好冷"}
		if night: text=rng.pick(["今晚的"+str(rng.pick(["星空","月色","夜風"]))+"真不錯。","夜裡出來"+str(rng.pick(["看星星","散步","吹風"]))+"？我也覺得很舒服。","夜晚最棒了，安安靜靜的。" if "night_owl" in tr else "這麼晚了，小心著涼。"])
		else: text=rng.pick([str(weather.get(season,"天氣還好"))+"，"+("不過我很享受！" if optimist else "希望別變天。"),season+"到了，"+str(rng.pick(["時間過得真快","又是新的季節","風景挺美的"]))+"。"])
		affinity=rng.next_int(0,2);summary=player.name+"和"+npc.name+"聊了天氣。"
	elif has(msg,"厲害|佩服|好棒|真強|了不起|手藝|技術"):
		if shy: text=rng.pick(["啊...謝、謝謝你...（臉紅）","不、不會啦...你過獎了。","...真的嗎？（開心但不好意思）"])
		elif abrasive: text=rng.pick(["哼，不用奉承我。","...你有什麼目的？","嗯，我知道。"])
		else: text=rng.pick(["哈哈，謝謝！你這麼說我很開心。","你真會說話！","被你這樣誇，有點不好意思呢。"])
		affinity=rng.next_int(2,5)
		if romantic: romance=rng.next_int(0,2)
		summary=player.name+"讚美了"+npc.name+"。"
	elif has(msg,"幫忙|幫我|拜託|求你|需要"):
		if kind: text=rng.pick(["需要幫忙嗎？儘管說！","我能做的一定幫！你說吧。","別客氣，鄰居互相幫忙是應該的。"])
		elif lazy: text=rng.pick(["嗯...看是什麼事吧。我今天有點懶...","幫忙可以，但別太累的。"])
		elif abrasive: text=rng.pick(["看什麼事吧。","我不是慈善機構。","你自己不能解決嗎？"])
		else: text=rng.pick(["什麼事？看我能不能幫上忙。","好吧，你說說看。","我盡量吧。"])
		affinity=rng.next_int(1,3) if kind else rng.next_int(-1,2);summary=player.name+"向"+npc.name+"求助。"
	elif has(msg,"再見|掰|拜|走了|先走|告辭"):
		if couple: text=rng.pick(["這麼快就走？路上小心。想你。","嗯...早點回來。","下次再來找我。"])
		elif aff>30: text=rng.pick(["再見！下次再聊！","掰掰，保重啊！","好的，有空再來找我！"])
		else: text=rng.pick(["嗯，再見。","好的。","終於要走了。" if abrasive else "拜拜。"])
		affinity=rng.next_int(0,1);summary=player.name+"和"+npc.name+"道別了。"
	else:
		var question:=has(msg,"[？?]") or has(msg.strip_edges(),"嗎$|呢$|吧$") or has(msg,"^(誰|什麼|哪|為什麼|怎麼|有沒有|是不是|知不知|你知道|你覺得|你認為|你有|可以|能不能|會不會|要不要)")
		if question and has(msg,"誰|某人|有人|大家|他們|別人|其他人"):
			var items: Array=w.data.get("gossip",[])
			if gossip and not items.is_empty():
				var content: String=rng.pick(items).content
				text=rng.pick(["嗯...我聽說"+content,"你問這個啊？我倒是有聽到一些..."+content,("呃...我不太確定，但..." if shy else "我跟你說喔，")+content])
			else: text=rng.pick([("嗯...我不太清楚..." if shy else "這個嘛...")+"我平常不太注意別人的事。",("我怎麼會知道這種事。" if abrasive else "我沒聽說過耶。")+"你要不要去問問別人？","欸我有聽到一點風聲，但不確定是不是真的..." if gossip else "這個我真的不知道。",("哈哈，你還挺八卦的嘛！" if charismatic else "嗯...")+"我對這些不太了解欸。"])
			affinity=rng.next_int(0,2);summary=player.name+"問了"+npc.name+"關於其他人的事。"
		elif question and has(msg,"覺得|認為|看法|意見|怎麼看|怎麼想"):
			text=rng.pick([("呃...我的想法嗎..." if shy else "嗯，讓我想想。")+"我覺得"+str(rng.pick(["每個人有每個人的想法吧","很難說，要看情況","這種事沒有標準答案"]))+"。",("你問我？" if abrasive else "好問題。")+("反正不管怎樣結果都差不多。" if pessimist else ("我覺得往好的方面想就對了！" if optimist else "這要看怎麼看吧。")),("哦？你想聽我的看法？" if charismatic else "嗯...")+str(rng.pick(["我個人是覺得還好啦。","說真的，我也沒什麼特別的想法。","這個嘛...要我說的話...算了，我也不太確定。"]))])
			affinity=rng.next_int(0,3);summary=player.name+"詢問了"+npc.name+"的看法。"
		elif question and has(msg,"知道|聽說|有沒有|是不是|真的|假的"):
			text=rng.pick([("呃..." if shy else "嗯，")+str(rng.pick(["我不太確定耶...","這個我沒聽過。","好像有聽說過，但記不太清了。"])),"欸你這麼一說我好像有印象...不過我也不確定是不是真的。" if gossip else "這個嘛...我真的不知道欸。",("你覺得我什麼都知道嗎？" if abrasive else "哈，")+"你可以去問問鎮上其他人，搞不好他們知道。",("有趣的問題！" if charismatic else "嗯...")+str(rng.pick(["讓我想想...不，我真的不知道。","我也想知道呢。","你去圖書館查查看？"]))])
			affinity=rng.next_int(0,2);summary=player.name+"問了"+npc.name+"一些事。"
		elif question:
			text=rng.pick([("嗯...這個嘛..." if shy else "")+str(rng.pick(["我想想喔...","好問題...","你突然這樣問我..."]))+str(rng.pick(["我也不太確定。","可能吧？","要看情況。","我沒想過這個問題欸。"])),("這種事你自己不知道嗎？" if abrasive else ("哈哈，你真的很好奇欸！" if charismatic else "嗯..."))+str(rng.pick(["說實話我不太清楚。","我回去想想再告訴你。","你為什麼會想問這個？"])),"嗯，我覺得答案應該是正面的！" if optimist else ("我不確定，但大概不會太好吧..." if pessimist else "我沒有什麼特別的想法欸。")])
			affinity=rng.next_int(0,2);summary=player.name+"問了"+npc.name+"一個問題。"
		else:
			if couple: text=rng.pick(["嗯嗯，我在聽。你繼續說。","你說的我都聽進去了。","是嗎？跟我說更多。"])
			elif aff>50: text=rng.pick(["嗯嗯！然後呢？","哈哈，你說的我懂。","是嗎？有意思！跟我說更多。","我也有同感！"])
			elif aff>20: text=rng.pick(["嗯，你說的有道理。","原來如此，我沒想過這件事。","哈，你還挺有想法的嘛。","是喔？有趣。"])
			elif aff> -10: text=rng.pick(["嗯...是嗎。","哦，我知道了。","你這人還挺愛聊的。","嗯嗯..." if shy else ("所以呢？" if abrasive else "好吧。")])
			else: text=rng.pick(["...隨便你怎麼說吧。","嗯哼。","我不太感興趣。","你說完了嗎？"])
			affinity=rng.next_int(0,2) if aff>0 else rng.next_int(-1,1)
		if summary.is_empty(): summary=player.name+"和"+npc.name+"聊了天。"
	if npc.needs.hunger<20 and rng.next_float()<.3: text+=str(rng.pick([" ...（肚子咕嚕叫）啊，不好意思。"," 話說酒館現在有什麼吃的嗎？我都沒吃午飯。"," 哎，跟你聊著聊著都忘了吃飯了。"] ))
	if npc.needs.rest<20 and rng.next_float()<.3: text+=str(rng.pick([" （打了個哈欠）抱歉...昨晚沒睡好。"," 唉，今天腰都快斷了，幹了一整天活。"," 不好意思，我眼皮有點撐不住了..."]))
	if night and "night_owl" not in tr and rng.next_float()<.2: text+=str(rng.pick([" 好了，夜深了，明天再聊吧。"," 啊，都這個時間了？我得回去了。"] ))
	if npc.activity=="stargazing" and rng.next_float()<.3: text+=str(rng.pick([" 欸你看！那邊那顆星特別亮！"," 今晚的星空真美，你不覺得嗎？"]))
	return {"text":text,"affinity":affinity,"romantic":romance,"summary":summary}
static func utf16_left(value: String,count: int) -> String:
	# Keep complete Unicode characters when the JS slice boundary splits a surrogate pair.
	var units:=0;var end:=0
	for character in value:
		units+=2 if character.unicode_at(0)>65535 else 1
		if units>count: break
		end+=1
	return value.left(end)
static func apply(w: SimWorld,id: String,message: String) -> Dictionary:
	var result:=reply(w,id,message)
	var npc: Dictionary=w.data.agents[id];var player: Dictionary=w.data.agents.player
	var affinity: int=result.affinity;var romantic: int=result.romantic;var summary: String=result.summary
	var npc_rel:=SimSocial.relationship(npc,player);var player_rel:=SimSocial.relationship(player,npc)
	SimRelationships.modify(npc_rel,"affinity",affinity);SimRelationships.modify(npc_rel,"romanticInterest",romantic);SimRelationships.record_interaction(npc_rel,int(w.data.tickCount),summary)
	SimRelationships.modify(player_rel,"affinity",maxi(-3,affinity-1));SimRelationships.record_interaction(player_rel,int(w.data.tickCount),summary)
	SimFeuds._memory(npc,w,"conversation",player.name+"說：「"+utf16_left(message,30)+"」— "+summary,4+absi(affinity),[player.name])
	SimFeuds._memory(player,w,"conversation","與"+npc.name+"："+summary,3+absi(affinity),[npc.name])
	var history: Array=player.get("chatHistory",[])
	if not history.slice(maxi(0,history.size()-6)).any(func(m): return m.speaker==player.name and m.target==npc.name and m.text==message): history.append({"speaker":player.name,"target":npc.name,"text":message,"time":SimSocial.time_string(w.data.clock)})
	history.append({"speaker":npc.name,"target":player.name,"text":result.text,"time":SimSocial.time_string(w.data.clock)})
	player.chatHistory=history.slice(maxi(0,history.size()-10000));player._recentChatTick=w.data.tickCount
	SimSocial.log_message(w.data,"player_chat",summary,player.name,npc.name)
	return result
