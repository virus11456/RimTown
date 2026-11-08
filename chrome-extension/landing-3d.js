// RimTown - landing-3d.js：首頁主視覺的 3D 方塊村民(v6.98.0)
// - 頁面先畫好,閒置時才載 three.js 與 villager3d.js(跟遊戲同一套長相),不拖慢首屏
// - 一座小草島、一棟小屋、一棵樹、七位村民:會呼吸、眨眼、揮手、兩兩聊天,頭上冒出 HTML 對話泡泡
// - 捲出畫面或切到別的分頁就停;偏好減少動態的人只畫一格;沒有 WebGL 就改放一張實際畫面
'use strict';
const LANDING3D = (() => {
    let state = null;
    const zh = () => !(typeof I18N !== 'undefined' && I18N.getLang && I18N.getLang() === 'en');
    const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    // 村民:名字(決定長相)、職業、性別、年齡段、階層;站位(角度、半徑)
    const CAST = [
        { name: '林美玲', job: 'farmer', g: 'female', b: 'a', cls: 1, a: -1.0, r: 2.6 },
        { name: '王大偉', job: 'blacksmith', g: 'male', b: 'a', cls: 1, a: -0.55, r: 2.9 },
        { name: '小豆子', job: 'farmer', g: 'male', b: 'c', cls: 1, a: -0.18, r: 1.7 },
        { name: '陳婉君', job: 'trader', g: 'female', b: 'a', cls: 4, a: 0.15, r: 2.9 },
        { name: '張老伯', job: 'priest', g: 'male', b: 'o', cls: 2, a: 0.5, r: 2.3 },
        { name: '黃淑芬', job: 'cook', g: 'female', b: 'a', cls: 1, a: 0.85, r: 2.8 },
        { name: '劉阿福', job: 'tailor', g: 'male', b: 'a', cls: 0, a: 1.2, r: 2.4 },
    ];
    // 對話泡泡:誰跟誰聊、說什麼(都是遊戲裡真的會發生的事)
    const TALK = [
        [0, 1, ['聽說鐵匠暗戀麵包師？', 'I heard the smith likes the baker?'], ['噓！別傳出去……', 'Shh! Keep it quiet...']],
        [3, 4, ['我捐點錢給鎮長，應該沒關係吧？', 'A small gift to the mayor can\'t hurt, right?'], ['報社會寫出來的。', 'The paper will print it.']],
        [5, 6, ['工會今晚開會，你來嗎？', 'Union meeting tonight. Coming?'], ['老闆說來的人就開除……', 'The boss says he\'ll fire anyone who goes...']],
        [1, 2, ['明天投票，你要投穀倉嗎？', 'Vote tomorrow. Granary or not?'], ['我還小，不能投啦！', 'I\'m too young to vote!']],
        [6, 0, ['房租又漲了，這個月付不出來。', 'Rent went up again. I can\'t pay this month.'], ['先來我家吃飯吧。', 'Come eat at my place for now.']],
        [4, 5, ['冬天柴火好貴。', 'Firewood is so pricey in winter.'], ['我多買了一點，分你。', 'I bought extra. Have some.']],
    ];
    function mount(host) {
        if (!host || state?.host === host) return;
        unmount();
        state = { host, alive: true };
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const go = () => {
            if (!state || state.host !== host) return;
            const need = [];
            if (typeof THREE === 'undefined') need.push('vendor/three.min.js');
            const chain = need.reduce((p, s) => p.then(() => load(s)), Promise.resolve())
                .then(() => (typeof VILLAGER3D === 'undefined' ? load('villager3d.js') : null));
            chain.then(() => { if (state && state.host === host) start(host, reduce); }).catch(() => fallback(host));
        };
        if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 300);
    }
    function fallback(host) {
        if (!host) return; host.classList.add('lp-stage-fallback');
        const L = zh() ? 'zh' : 'en';
        host.innerHTML = `<img src="img/landing/proposals-${L}.jpg" width="1280" height="760" alt="${zh() ? '遊戲畫面' : 'Game screenshot'}" loading="lazy">`;
    }
    function start(host, reduce) {
        let renderer;
        const canvas = document.createElement('canvas'); canvas.className = 'lp-stage-canvas'; canvas.setAttribute('aria-hidden', 'true');
        try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { fallback(host); return; }
        const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
        if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = !mobile; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        host.querySelector('.lp-stage-ph')?.remove();
        host.prepend(canvas);
        const bubbles = document.createElement('div'); bubbles.className = 'lp-bubbles'; host.appendChild(bubbles);
        const scene = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
        scene.add(new THREE.HemisphereLight(0xfff4e0, 0x4a6a4a, 1.05));
        const sun = new THREE.DirectionalLight(0xffffff, 1.25); sun.position.set(4, 9, 6); sun.castShadow = !mobile;
        sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 }); scene.add(sun);
        const rim = new THREE.DirectionalLight(0xffc89a, 0.45); rim.position.set(-6, 4, -5); scene.add(rim);
        const mat = (hex) => new THREE.MeshLambertMaterial({ color: new THREE.Color(hex) });
        const add = (geo, hex, x, y, z, opts = {}) => { const m = new THREE.Mesh(geo, mat(hex)); m.position.set(x, y, z); m.castShadow = opts.cast !== false; m.receiveShadow = !!opts.recv; if (opts.ry) m.rotation.y = opts.ry; scene.add(m); return m; };
        // 草島:上面草皮、下面泥土(八角柱,低多邊形)
        add(new THREE.CylinderGeometry(4.1, 4.1, 0.35, 10), '#7CC45A', 0, -0.175, 0, { recv: true, cast: false });
        add(new THREE.CylinderGeometry(4.1, 3.2, 0.9, 10), '#9C7650', 0, -0.8, 0, { cast: false });
        add(new THREE.CylinderGeometry(3.2, 1.6, 0.8, 10), '#7E5E40', 0, -1.6, 0, { cast: false });
        const path = add(new THREE.BoxGeometry(1.1, 0.04, 3.2), '#CBA470', 0.2, 0.02, 1.3, { recv: true, cast: false }); path.rotation.y = 0.15;
        // 小屋
        add(new THREE.BoxGeometry(1.5, 1.05, 1.25), '#F3E2C3', -2.1, 0.52, -2.45, { recv: true, ry: 0.35 });
        const roof = add(new THREE.ConeGeometry(1.28, 0.8, 4), '#C9533D', -2.1, 1.44, -2.45, { ry: 0.35 + Math.PI / 4 }); roof.scale.set(1, 1, 0.85);
        add(new THREE.BoxGeometry(0.32, 0.55, 0.06), '#8C5A3C', -1.9, 0.28, -1.86, { ry: 0.35 });
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.06), new THREE.MeshLambertMaterial({ color: '#9CC8E8', emissive: new THREE.Color('#FFD27A'), emissiveIntensity: 0.35 }));
        win.position.set(-2.5, 0.62, -1.95); win.rotation.y = 0.35; scene.add(win);
        // 樹與花
        add(new THREE.CylinderGeometry(0.13, 0.17, 0.8, 6), '#8C5A3C', 2.5, 0.4, -2.1);
        add(new THREE.IcosahedronGeometry(0.8, 0), '#5FA05A', 2.5, 1.35, -2.1);
        add(new THREE.IcosahedronGeometry(0.55, 0), '#6FB565', 2.75, 1.9, -1.95);
        const flowers = [['#F4A3C4', -2.8, 1.2], ['#F6D365', -2.4, 1.9], ['#FFFFFF', 2.9, 0.8], ['#F4A3C4', 2.6, 1.6], ['#9EC9F2', -0.6, -2.9], ['#F6D365', 1.2, -2.8]];
        for (const [c, x, z] of flowers) { add(new THREE.BoxGeometry(0.04, 0.18, 0.04), '#4E8A3A', x, 0.09, z, { cast: false }); add(new THREE.BoxGeometry(0.12, 0.1, 0.12), c, x, 0.2, z, { cast: false }); }
        // 村民
        const folks = CAST.map((s, i) => {
            const m = VILLAGER3D.build({ aid: 'lp' + i, agent: { name: s.name, appear: { b: s.b, cls: s.cls, king: false, hl: false } }, pos: { job: s.job, gender: s.g } });
            const x = Math.sin(s.a) * s.r, z = Math.cos(s.a) * s.r - 0.4;
            m.position.set(x, 0, z); m.rotation.y = Math.atan2(-x * 0.35, 6 - z) ; m.scale.multiplyScalar(0.92);
            m.traverse(o => { if (o.isMesh) { o.castShadow = !mobile; } });
            scene.add(m);
            const arm = m.children.find(c => c.name === 'armR'), armL = m.children.find(c => c.name === 'armL');
            return { m, s, x, z, base: m.rotation.y, arm, armL, ph: i * 1.7, blink: 40 + i * 37, face: null };
        });
        // 對話泡泡(HTML,字比較清楚,也不用在 3D 裡畫字)
        const bubbleEl = (txt) => { const d = document.createElement('div'); d.className = 'lp-bubble'; d.textContent = txt; bubbles.appendChild(d); return d; };
        let talkIdx = 0, talk = null;
        const nextTalk = (now) => {
            if (talk) { talk.els.forEach(e => e.remove()); talk.pair.forEach(f => { f.face = null; }); }
            const [ai, bi, la, lb] = TALK[talkIdx++ % TALK.length]; const A = folks[ai], Bf = folks[bi];
            A.face = Bf; Bf.face = A;
            const ix = zh() ? 0 : 1;
            talk = { pair: [A, Bf], t0: now, els: [bubbleEl(la[ix]), bubbleEl(lb[ix])] };
            talk.els[1].classList.add('lp-bubble-late');
        };
        const v = new THREE.Vector3();
        const place = () => {
            if (!talk) return; const w = canvas.clientWidth, h = canvas.clientHeight;
            const pts = talk.pair.map(f => { v.set(f.m.position.x, f.m.position.y + 1.85 * (f.s.b === 'c' ? 0.7 : 1), f.m.position.z).project(cam); return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h]; });
            // 兩個泡泡往外推開(左邊的人泡泡往左、右邊的往右),第二句再高一點,不會疊在一起
            talk.pair.forEach((f, k) => { const el = talk.els[k]; const [x, y] = pts[k]; const left = pts[k][0] <= pts[1 - k][0];
                el.classList.toggle('lp-bl', left); el.classList.toggle('lp-br', !left);
                el.style.transform = `translate(${x}px, ${y - (k ? 34 : 0)}px) translate(${left ? -88 : -12}%, -100%)`; });
        };
        const resize = () => {
            const w = host.clientWidth || 600, h = host.clientHeight || 420; renderer.setSize(w, h, false); cam.aspect = w / h;
            const narrow = w / h < 1.1; cam.fov = narrow ? 41 : 33; cam.updateProjectionMatrix();
        };
        resize();
        let raf = 0, frame = 0, visible = true, last = 0;
        const t0 = performance.now();
        const tick = (now) => {
            raf = 0; if (!state || !state.alive) return;
            if (now - last < (mobile ? 30 : 15)) { schedule(); return; } last = now; // 手機約 30fps
            const t = (now - t0) / 1000; frame++;
            const sway = reduce ? 0 : Math.sin(t * 0.25) * 0.22;
            cam.position.set(Math.sin(sway) * 13, 5.6, Math.cos(sway) * 13); cam.lookAt(0, 0.35, 0);
            if (!reduce && (!talk || now - talk.t0 > 5200)) nextTalk(now);
            for (const f of folks) {
                const breathe = reduce ? 0 : Math.sin(t * 2.2 + f.ph);
                f.m.position.y = Math.max(0, breathe) * 0.025;
                let target = f.base; if (f.face) target = Math.atan2(f.face.m.position.x - f.m.position.x, f.face.m.position.z - f.m.position.z);
                f.m.rotation.y += (((target - f.m.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.08;
                const talking = talk && talk.pair[0] === f && !reduce;
                if (f.arm) f.arm.rotation.x = talking ? -0.7 + Math.sin(t * 6) * 0.25 : (f === folks[2] && !reduce ? -2.6 + Math.sin(t * 7) * 0.35 : breathe * 0.05); // 小孩一直揮手
                if (f.armL) f.armL.rotation.x = -breathe * 0.05;
                const ud = f.m.userData; if (ud.eyes) { const shut = !reduce && ((frame + f.blink) % 190) < 6; ud.eyes.visible = !shut; ud.lids.visible = shut; }
            }
            if (talk) { const late = talk.els[1]; if (now - talk.t0 > 1800) late.classList.add('on'); talk.els[0].classList.add('on'); }
            renderer.render(scene, cam); place();
            if (!reduce) schedule();
        };
        const schedule = () => { if (!raf && visible && !document.hidden && state?.alive) raf = requestAnimationFrame(tick); };
        let io = null;
        try { io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); schedule(); }); io.observe(host); } catch (e) {}
        const onVis = () => schedule();
        document.addEventListener('visibilitychange', onVis);
        let rt = 0; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (reduce) requestAnimationFrame(tick); else schedule(); }, 120); };
        window.addEventListener('resize', onResize);
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); unmount(); fallback(host); });
        Object.assign(state, { renderer, scene, io, onVis, onResize, cancel: () => { if (raf) cancelAnimationFrame(raf); raf = 0; } });
        host.classList.add('lp-stage-live');
        requestAnimationFrame(tick);
    }
    function unmount() {
        if (!state) return; const s = state; state = null; s.alive = false;
        try { s.cancel?.(); s.io?.disconnect(); document.removeEventListener('visibilitychange', s.onVis); window.removeEventListener('resize', s.onResize); } catch (e) {}
        try { s.scene?.traverse(o => { if (o.isMesh) { o.geometry?.dispose?.(); } }); s.renderer?.dispose(); s.renderer?.forceContextLoss?.(); } catch (e) {}
    }
    return { mount, unmount, CAST, TALK };
})();
