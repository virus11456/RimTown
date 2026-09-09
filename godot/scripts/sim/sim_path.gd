class_name SimPath
extends RefCounted
var cache: Dictionary={}
var grid: Array=[]:
	set(value):
		grid=value
		cache.clear()
func walkable(x: int,y: int) -> bool:
	return y>=0 and y<grid.size() and x>=0 and x<grid[y].size() and int(grid[y][x]) not in [5,6,41,15,16,17,18]
func find_path(start: Vector2,finish: Vector2) -> Array:
	var key:="%d,%d,%d,%d"%[floori(start.x/16),floori(start.y/16),floori(finish.x/16),floori(finish.y/16)]
	if cache.has(key): return cache[key].duplicate(true)
	var result:=_find_path(start,finish)
	if cache.size()>=512: cache.clear()
	cache[key]=result.duplicate(true)
	return result
func _find_path(start: Vector2,finish: Vector2) -> Array:
	if grid.is_empty(): return []
	var cols: int=grid[0].size()
	var rows:=grid.size()
	var sx:=clampi(floori(start.x/16),0,cols-1)
	var sy:=clampi(floori(start.y/16),0,rows-1)
	var ex:=floori(finish.x/16); var ey:=floori(finish.y/16)
	var exc:=clampi(ex,0,cols-1); var eyc:=clampi(ey,0,rows-1)
	if sx==exc and sy==eyc: return []
	if not walkable(exc,eyc):
		var found:=false
		for r in range(1,9):
			for dy in range(-r,r+1):
				for dx in range(-r,r+1):
					if absi(dx)!=r and absi(dy)!=r: continue
					if walkable(exc+dx,eyc+dy): ex=exc+dx; ey=eyc+dy; found=true; break
				if found: break
			if found: break
		if not found: return []
	var first:=sx+sy*cols
	var open: Array=[{"x":sx,"y":sy,"f":absi(sx-ex)+absi(sy-ey)}]
	var scores: Dictionary={first:0.0}
	var parents: Dictionary={}
	var closed: Dictionary={}
	var directions := [[0,-1,1.0],[0,1,1.0],[-1,0,1.0],[1,0,1.0],[-1,-1,1.41],[1,-1,1.41],[-1,1,1.41],[1,1,1.41]]
	var iterations:=0
	while not open.is_empty() and iterations<2000:
		iterations+=1
		var best:=0
		for i in range(1,open.size()):
			if open[i].f<open[best].f: best=i
		var current: Dictionary=open.pop_at(best)
		var key: int=current.x+current.y*cols
		if closed.has(key): continue
		closed[key]=true
		if current.x==ex and current.y==ey:
			var path: Array=[]
			while true:
				var y:=floori(float(key)/cols)
				path.push_front({"x":(key-y*cols+.5)*16,"y":(y+.5)*16})
				if not parents.has(key): break
				key=parents[key]
			return simplify(path)
		for direction in directions:
			var nx: int=current.x+direction[0]; var ny: int=current.y+direction[1]
			var next:=nx+ny*cols
			if closed.has(next) or not walkable(nx,ny): continue
			if direction[0]!=0 and direction[1]!=0:
				if not walkable(current.x+direction[0],current.y) or not walkable(current.x,current.y+direction[1]): continue
			var score: float=scores[key]+direction[2]
			if not scores.has(next) or score<scores[next]:
				scores[next]=score; parents[next]=key
				open.append({"x":nx,"y":ny,"f":score+absi(nx-ex)+absi(ny-ey)})
	return []
static func simplify(path: Array) -> Array:
	if path.size()<=2: return path
	var result: Array=[path[0]]
	for i in range(1,path.size()-1):
		var previous: Dictionary=result.back()
		var current: Dictionary=path[i]
		var next: Dictionary=path[i+1]
		if sign(current.x-previous.x)!=sign(next.x-current.x) or sign(current.y-previous.y)!=sign(next.y-current.y): result.append(current)
	result.append(path.back())
	return result
