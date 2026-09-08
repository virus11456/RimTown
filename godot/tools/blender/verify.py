"""Validate generated GLBs by importing them; run inside Blender."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
def verify(root):
 spec=json.loads((root/'tools/asset_manifest.json').read_text());results=[]
 for a in spec['assets']:
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
  bpy.ops.import_scene.gltf(filepath=str(root/'assets/models'/(a['name']+'.glb')))
  objs=[o for o in bpy.context.scene.objects if o.type=='MESH'];tris=0;verts=[];uvs=[]
  for o in objs:
   me=o.data;me.calc_loop_triangles();tris+=len(me.loop_triangles)
   if hasattr(me,'calc_normals_split'): me.calc_normals_split()
   for p in me.polygons:
    for li in p.loop_indices: assert me.loops[li].normal.dot(p.normal) > .9999,a['name']+' non-flat normal'
   for tri in me.loop_triangles:assert tri.area>1e-9,a['name']+' degenerate'
   for v in me.vertices:
    co=o.matrix_world@v.co;assert all(math.isfinite(x) for x in co);verts.append(tuple(co))
   assert len(me.materials)==1,a['name']+' material'
   for uv in me.uv_layers.active.data:
    u,v=uv.uv;assert abs((u*16-.5)-round(u*16-.5))<1e-4 and abs((v*16-.5)-round(v*16-.5))<1e-4,a['name']+' UV'
    uvs.append(tuple(uv.uv))
  lo=[min(v[i] for v in verts) for i in range(3)];hi=[max(v[i] for v in verts) for i in range(3)]
  # Blender imported Y-up GLB returns to Z-up.
  size=[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]]
  assert tris<=a['triangles'],(a['name'],tris,a['triangles'])
  assert all(s<=cap+.001 for s,cap in zip(size,a['size'])),(a['name'],size,a['size'])
  assert abs(lo[2])<1e-4 and abs(lo[0]+hi[0])<1e-4 and abs(lo[1]+hi[1])<1e-4,a['name']+' origin'
  digest=hashlib.sha256(json.dumps([sorted(verts),uvs],sort_keys=True).encode()).hexdigest()
  results.append(dict(name=a['name'],triangles=tris,size=size,geometry_sha256=digest))
 (root/'docs/ASSET_VERIFICATION.json').write_text(json.dumps(results,indent=2)+'\n');print('PASS assets:',len(results))
if __name__=='__main__':verify(Path(__file__).resolve().parents[2])
