"""Run: blender -b -P tools/blender/build_all.py. No external art dependencies."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).parent))
SPEC=json.loads((ROOT/'tools/asset_manifest.json').read_text())
OUT=ROOT/'assets/models';OUT.mkdir(parents=True,exist_ok=True)
image=bpy.data.images.new('RimTown Palette',width=16,height=16,alpha=True)
pixels=[]
for i in range(256):
 c=SPEC['palette'][i%32];pixels += [int(c[j:j+2],16)/255 for j in (0,2,4)]+[1]
image.pixels=pixels;image.filepath_raw=str(ROOT/'assets/palette/palette.png');image.file_format='PNG';image.save()
mat=bpy.data.materials.new('RimTown Palette');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=1;bsdf.inputs['Metallic'].default_value=0
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Closest';mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
def paint(o,c):
 o.data.materials.clear();o.data.materials.append(mat)
 uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
 for face in o.data.polygons:
  face.use_smooth=False
  for li in face.loop_indices:uv.data[li].uv=((c%16+.5)/16,(c//16+.5)/16)
 return o
def box(pos,scale,c,rot=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.scale=scale;o.rotation_euler.z=rot
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return paint(o,c)
def cone(pos,radius,depth,c,vertices=5,top=0):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=top,depth=depth,location=pos);return paint(bpy.context.object,c)
def roof(w,d,z,c):
 verts=[(-w/2,-d/2,z),(w/2,-d/2,z),(-w/2,d/2,z),(w/2,d/2,z),(0,-d/2,z+.65),(0,d/2,z+.65)]
 faces=[(0,2,3,1),(0,1,4),(2,5,3),(0,4,5,2),(1,3,5,4)]
 me=bpy.data.meshes.new('gable');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Roof',me);bpy.context.collection.objects.link(o);return paint(o,c)
def house(name):
 c=8 if name.endswith('a') else 9 if name.endswith('b') else 14
 box((0,0,.68),(1.75,1.6,1.36),c);roof(2,1.9,1.36,10 if name!='bld_house_c' else 11)
 box((.25,-.81,.4),(.38,.04,.8),12)
 for x in [-.54,.59]:box((x,-.82,.91),(.28,.035,.32),15)
 box((0,-.91,.08),(.72,.18,.16),4);box((-.57,.25,1.7),(.24,.27,.7),13)
def building(name):
 if name=='bld_lighthouse':
  cone((0,0,1.85),.73,3.7,14,8,.46);cone((0,0,3.7),.77,.15,13,8,.77)
  cone((0,0,4.06),.47,.62,26,8,.47);cone((0,0,4.52),.83,.32,10,8);box((0,-.71,.38),(.3,.04,.76),13);return
 if name=='bld_dock':
  for i in range(9):box((-1.76+i*.44,0,.26),(.42,2.8,.14),12 if i%2 else 9)
  for x in [-1.65,1.65]:
   for y in [-1.15,1.15]:box((x,y,.25),(.14,.14,.5),13)
  box((1,.55,.63),(.55,.55,.6),25);return
 if name=='bld_saltworks':
  box((0,0,.08),(3.8,2.7,.16),6)
  for x in [-.9,.9]:
   for y in [-.64,.64]:box((x,y,.18),(1.65,1.04,.06),28)
  box((0,0,.22),(.12,2.6,.14),12);box((0,0,.22),(3.6,.12,.14),12);return
 if name=='bld_mine':
  cone((0,.2,.9),1.35,1.8,4,6,.75);box((0,-1.02,.68),(.95,.08,1.3),13)
  for x in [-.61,.61]:box((x,-1.12,.72),(.2,.2,1.44),12)
  box((0,-1.12,1.44),(1.42,.2,.2),12);return
 if name=='bld_market':
  for x in [-1.2,1.2]:box((x,0,.9),(.14,1.9,1.8),12)
  box((0,-.4,.56),(2.7,.9,1),9);roof(3.4,2.5,1.75,14)
  for x in [-.9,0,.9]:cone((x,-.45,1.13),.25,.3,23 if x==0 else 25,5,.13)
  return
 if name=='bld_coach_station':
  box((0,0,.08),(3.8,2.8,.16),4)
  for x in [-1.5,1.5]:box((x,.7,1.1),(.15,.15,2.2),12)
  roof(3.8,2,2.12,11);box((-.65,.4,.55),(1.6,.6,.16),12)
  box((1,-.6,.86),(.12,.12,1.72),12);box((1,-.6,1.55),(.75,.12,.4),14);return
 w,d=3.25,2.45; wall=14 if name in ['bld_chapel','bld_clinic','bld_library'] else 8
 box((0,0,.86),(w,d,1.72),wall);roof(3.6,2.8,1.72,10 if name not in ['bld_library','bld_workshop'] else 11)
 box((0,-d/2-.02,.56),(.58,.04,1.12),12)
 for x in [-1.05,1.05]:box((x,-d/2-.025,1.03),(.48,.04,.54),15)
 box((0,-1.4,.12),(1.1,.2,.24),4)
 if name in ['bld_factory','bld_workshop']:
  for x in [-1.05,1.05]:box((x,.65,1.85),(.35,.35,2.1),13)
 if name in ['bld_town_hall','bld_chapel','bld_guardpost']:
  box((0,.25,2.2),(1,1,1.5),wall);cone((0,.25,3.18),.8,.65,10,4)
  if name=='bld_chapel':box((0,.25,3.6),(.1,.1,.6),14);box((0,.25,3.7),(.4,.1,.1),14)
 if name=='bld_clinic':box((0,-1.25,1.46),(.12,.04,.35),10);box((0,-1.26,1.46),(.35,.04,.12),10)
 if name=='bld_farmhouse':box((1.4,-1,.4),(.55,.5,.8),25)
def tree(name):
 cone((0,0,.55),.12,1.1,12,5,.1)
 if name.endswith('pine'):
  cone((0,0,1.35),.65,1.35,2,5);cone((0,0,2),.48,1.25,23,5)
 else:
  cone((0,0,1.55),.78,1.5,23 if name.endswith('birch') else 2,5,.3)
  cone((0,0,2.4),.3,.2,1,5)
def body(name):
 child=name.endswith('child');elder=name.endswith('elder');female=name.endswith('f');h=.78 if child else 1
 for x in [-.14,.14]:
  box((x,0,.1*h),(.2,.29,.2*h),19);box((x,0,.36*h),(.15,.17,.42*h),18)
 torso=box((0,0,.79*h),(.48,.27,.48*h),21 if female else 20)
 if elder:torso.rotation_euler.x=.14
 for x in [-.32,.32]:box((x,0,.76*h),(.14,.19,.45*h),16)
 box((0,-.035 if elder else 0,1.24*h),(.52,.44,.5*h),16)
 for x in [-.11,.11]:box((x,-.229,1.26*h),(.045,.012,.045),19)
def accessory(name):
 if name.startswith('chr_hair'):
  idx=int(name[-2:]);c=18 if idx%2 else 19;box((0,0,.12),(.56,.49,.24),c)
  if idx in [2,4,6]:box((0,.19,.19),(.53,.15,.38),c)
  if idx in [3,5]:cone((.17,.1,.27),.14,.22,c,5)
 elif 'hat' in name:
  if 'farmer' in name:cone((0,0,.07),.4,.1,22,8,.4);cone((0,0,.21),.24,.22,22,6,.18)
  elif 'cook' in name:cone((0,0,.25),.28,.5,28,8,.3)
  elif 'priest' in name:cone((0,0,.32),.24,.64,22,4)
  else:cone((0,0,.18),.31,.36,24,8,.19)
 elif 'book' in name:box((0,0,.18),(.4,.14,.36),21);box((0,-.075,.18),(.34,.02,.29),14)
 else:
  box((0,0,.4),(.065,.065,.8),12)
  if 'fishing' in name:box((.14,0,.76),(.28,.025,.025),24)
  else:box((0,0,.7),(.56,.12,.16 if 'hammer' in name else .07),24)
def prop(name):
 n=name.removeprefix('prop_')
 if n.startswith('crop'):
  stage=int(n[-1]);cone((0,0,.15*stage),.06,.3*stage,23,4)
  for x in [-.15,.15]:cone((x,0,.17*stage),.1,.25*stage,31 if stage==3 else 1,4)
 elif n in ['rock','bush','flower']:
  cone((0,0,.22),.35,.44,4 if n=='rock' else 2 if n=='bush' else 29,5,.16)
 elif n=='campfire':
  box((0,0,.07),(.8,.13,.14),12,.5);box((0,0,.14),(.8,.13,.14),12,-.5);cone((0,0,.43),.24,.65,26,5)
 elif n=='well':
  cone((0,0,.33),.55,.66,4,6,.55);cone((0,0,.68),.4,.015,5,6,.4)
  for x in [-.55,.55]:box((x,0,.83),(.12,.12,1.66),12)
  roof(1.45,.95,1.3,10)
 elif n in ['lamp','lantern','flag']:
  box((0,0,.86),(.1,.1,1.72),12);box((.14,0,1.65),(.5,.3,.38),26 if n!='flag' else 21)
 elif n=='fence':
  for x in [-.45,.45]:box((x,0,.45),(.12,.12,.9),12)
  for z in [.3,.65]:box((0,0,z),(.98,.075,.08),9)
 elif n in ['table','bench','chair','bed','altar','counter','stall']:
  width=.65 if n=='chair' else 1.35
  for x in [-width/2+.1,width/2-.1]:
   for y in [-.25,.25]:box((x,y,.27),(.1,.1,.54),12)
  box((0,0,.54),(width,.72,.12),14 if n in ['bed','altar'] else 9)
  if n in ['chair','bench']:box((0,.3,.84),(width,.1,.52),12)
  if n=='bed':box((-.43,0,.69),(.38,.6,.18),28)
 elif n in ['barrel','cauldron']:cone((0,0,.36),.35,.72,12 if n=='barrel' else 24,8,.3)
 elif n in ['bridge','rug']:box((0,0,.05),(1.8,1,.1),12 if n=='bridge' else 21)
 elif n in ['bookshelf','weapon_rack']:
  for x in [-.55,.55]:box((x,0,.7),(.1,.3,1.4),12)
  for z in [.1,.55,1.1]:box((0,0,z),(1.2,.35,.1),12)
 elif n=='snowman':cone((0,0,.5),.4,1,28,6,.18);cone((0,0,1.14),.23,.35,28,6,.17)
 else:
  box((0,0,.35),(.65,.6,.7),24 if n in ['anvil','furnace'] else 12)
  if n=='grave':box((0,0,.82),(.6,.18,.24),4)
for asset in SPEC['assets']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 n,k=asset['name'],asset['kind']
 if k in ['terrain','road']:
  c=next((i for i,x in enumerate(['grass','grass_light','forest','dirt','stone','water','sand','soil']) if n=='ter_'+x),3)
  box((0,0,.06),(1,1,.12),c)
  if k=='road':
   # Four different topology markings, total <=24 triangles.
   arms={'road_straight':[0,2],'road_corner':[0,1],'road_t':[0,1,3],'road_cross':[0,1,2,3]}[n]
   for arm in arms:
    coords=[(-.12,0,.121),(.12,0,.121),(.12,.5,.121),(-.12,.5,.121)]
    angle=arm*math.pi/2
    vv=[(x*math.cos(angle)-y*math.sin(angle),x*math.sin(angle)+y*math.cos(angle),z) for x,y,z in coords]
    me=bpy.data.meshes.new('road');me.from_pydata(vv,[],[(0,1,2,3)]);o=bpy.data.objects.new('road',me);bpy.context.collection.objects.link(o);paint(o,4)
 elif k=='house':house(n)
 elif k in ['building','large']:building(n)
 elif k=='tree':tree(n)
 elif k=='body':body(n)
 elif k in ['hair','accessory']:accessory(n)
 else:prop(n)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();o=bpy.context.object;o.name=n
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 # Bake all coordinates, normalize base origin; no silent size clamping.
 verts=[o.matrix_world@v.co for v in o.data.vertices];lo=Vector([min(v[i] for v in verts) for i in range(3)]);hi=Vector([max(v[i] for v in verts) for i in range(3)])
 center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 for v,co in zip(o.data.vertices,verts):v.co=co-center
 o.location=(0,0,0);o.rotation_euler=(0,0,0);o.scale=(1,1,1)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(n+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
print('Generated',len(SPEC['assets']),'assets')
from verify import verify
verify(ROOT)
