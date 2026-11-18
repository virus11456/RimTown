# 用法：python3 addline.py <changelog.js> <version> <zh> <en> [front]   把一條加進既有版本的更新紀錄
import sys, json
p, ver, zh, en = sys.argv[1:5]; front = len(sys.argv) > 5
s = open(p, encoding='utf8').read(); k = 'window.RIMTOWN_CHANGELOG = '; i = s.index(k) + len(k)
body = s[i:].strip().rstrip(';').strip(); lines = body.split('\n')
out = []; done = False
for ln in lines:
    t = ln.strip().rstrip(',')
    if t.startswith('{') and json.loads(t).get('version') == ver:
        e = json.loads(t)
        if zh in e['changes']: sys.exit('already there')
        (e['changes'].insert(0, zh), e['changes_en'].insert(0, en)) if front else (e['changes'].append(zh), e['changes_en'].append(en))
        ln = ln[:len(ln) - len(ln.lstrip())] + json.dumps(e, ensure_ascii=False, separators=(',', ':')) + (',' if ln.rstrip().endswith(',') else ''); done = True
    out.append(ln)
assert done, 'version not found'
open(p, 'w', encoding='utf8').write(s[:i] + '\n'.join(out) + ';\n')
