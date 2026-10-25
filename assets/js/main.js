(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const en = document.documentElement.lang === 'en';

  // Idioma: recuerda la elección y redirige a la versión equivalente
  const pref = (() => { try { return localStorage.getItem('lang'); } catch (e) { return null; } })();
  const other = document.querySelector('.lang-switch a:not([aria-current])');
  if (other && pref && pref !== document.documentElement.lang) { location.replace(other.href + location.hash); return; }
  document.querySelectorAll('.lang-switch a').forEach(a => a.addEventListener('click', () => { try { localStorage.setItem('lang', a.lang); } catch (e) {} }));

  // Nav
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 10);
  addEventListener('scroll', onScroll, {passive:true}); onScroll();
  const btn = document.getElementById('menuBtn'), menu = document.getElementById('menu');
  const setMenu = o => { menu.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); btn.setAttribute('aria-label', o ? (en ? 'Close menu' : 'Cerrar menú') : (en ? 'Open menu' : 'Abrir menú')); };
  btn.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  document.getElementById('year').textContent = new Date().getFullYear();

  // Typed keywords
  const words = en
    ? ['machine learning','genomics','spatial transcriptomics','biostatistics','predictive models','high dimensionality · p ≫ n','immune repertoires','compositional data']
    : ['machine learning','genómica','transcriptómica espacial','bioestadística','modelos predictivos','alta dimensionalidad · p ≫ n','repertorios inmunológicos','datos composicionales'];
  const el = document.getElementById('typed');
  if (el && !reduce) {
    let w = 0, i = words[0].length, del = true;
    const tick = () => {
      const word = words[w];
      i += del ? -1 : 1;
      el.textContent = word.slice(0, i);
      let t = del ? 35 : 70;
      if (!del && i === word.length) { del = true; t = 1800; }
      else if (del && i === 0) { del = false; w = (w + 1) % words.length; t = 300; }
      setTimeout(tick, t);
    };
    setTimeout(tick, 2000);
  }

  // Reveal on scroll
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {threshold:.12});
  document.querySelectorAll('.reveal').forEach(n => io.observe(n));

  // Publication filters
  const fbtns = document.querySelectorAll('.filters button');
  fbtns.forEach(b => b.addEventListener('click', () => {
    fbtns.forEach(x => x.setAttribute('aria-pressed', x === b));
    const f = b.dataset.filter;
    document.querySelectorAll('.pub').forEach(p => p.classList.toggle('hidden', f !== 'all' && p.dataset.type !== f));
  }));

  // Normal(0,1) por Box-Muller
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };

  // Heatmap (clustered expression-like pattern)
  const hm = document.getElementById('heatmap');
  if (hm) {
    const rows = 10, cols = 48;
    const color = z => {
      const t = Math.max(-1, Math.min(1, z / 2));
      // azul del logo -> blanco -> rojo del logo
      const a = [246,248,251], lo = [58,134,201], hi = [192,72,74];
      const tgt = t < 0 ? lo : hi, k = Math.abs(t);
      return `rgb(${a.map((v,j) => Math.round(v + (tgt[j]-v)*k)).join(',')})`;
    };
    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const group = c < 16 ? 0 : c < 32 ? 1 : 2;
      const sig = [[1.6,-1.2,0],[-1.4,1.5,0.2],[0,0.3,1.7],[1.2,0,-1.3],[-0.8,-0.6,1.5]][r % 5][group] * (r < 5 ? 1 : -0.8);
      const i = document.createElement('i'); i.style.background = color(sig + gauss()*0.6); frag.appendChild(i);
    }
  hm.appendChild(frag);
  }

  // Fondo tipo UMAP: clusters de puntos que se reorganizan (portada y cabeceras de página)
  const palette = ['#3a86c9','#d8a92e','#c0484a','#833a8e','#6fb0e6'];
  const ease = t => t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
  const initEmbed = (cv, {n, xMin, xMax, axes, avoid}) => {
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, cur = 0, phase = 0, visible = true, running = false;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({c: i % palette.length, r: 1.6 + Math.random()*2});
    // rectángulo (en fracciones del canvas) que los clusters deben esquivar, p. ej. el logo
    const avoidBox = () => {
      if (!avoid || !avoid.offsetWidth) return null;
      const a = avoid.getBoundingClientRect(), c = cv.getBoundingClientRect();
      const m = 30;
      return {x0:(a.left-c.left-m)/c.width, x1:(a.right-c.left+m)/c.width, y0:(a.top-c.top-m)/c.height, y1:(a.bottom-c.top+m)/c.height};
    };
    const makeLayout = () => {
      const box = avoidBox(), centers = [];
      for (let j = 0; j < palette.length; j++) {
        let c, tries = 0;
        do { c = {x: xMin + Math.random()*(xMax-xMin), y: .14 + Math.random()*.72, s: .025 + Math.random()*.04}; }
        while (box && ++tries < 40 && c.x > box.x0 && c.x < box.x1 && c.y > box.y0 && c.y < box.y1);
        centers.push(c);
      }
      return pts.map(p => { const c = centers[p.c]; return {x: c.x + gauss()*c.s, y: c.y + gauss()*c.s*1.3}; });
    };
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W*dpr; cv.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize(); addEventListener('resize', resize);
    const layouts = [makeLayout(), makeLayout()];
    let last = performance.now();
    const draw = now => {
      const dt = Math.min(50, now - last); last = now;
      phase += dt / 7000;
      if (phase >= 1) { phase = 0; cur = 1 - cur; layouts[1 - cur] = makeLayout(); }
      const hold = .45, t = phase < hold ? 0 : ease((phase - hold) / (1 - hold));
      const A = layouts[cur], B = layouts[1 - cur];
      ctx.clearRect(0,0,W,H);
      const xs = new Float32Array(n), ys = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        xs[i] = (A[i].x + (B[i].x - A[i].x)*t + Math.sin(now/1300 + i)*0.0015) * W;
        ys[i] = (A[i].y + (B[i].y - A[i].y)*t + Math.cos(now/1500 + i)*0.0015) * H;
      }
      // aristas tipo kNN dentro de cada cluster
      ctx.lineWidth = .8;
      const maxD = Math.min(W,H) * .07;
      for (let a = 0; a < n; a += 2) for (let b = a + 1; b < n; b += 3) {
        if (pts[a].c !== pts[b].c) continue;
        const dx = xs[a]-xs[b], dy = ys[a]-ys[b];
        if (dx*dx+dy*dy < maxD*maxD) { ctx.strokeStyle = palette[pts[a].c] + '55'; ctx.beginPath(); ctx.moveTo(xs[a],ys[a]); ctx.lineTo(xs[b],ys[b]); ctx.stroke(); }
      }
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = palette[pts[i].c] + 'dd';
        ctx.beginPath(); ctx.arc(xs[i], ys[i], pts[i].r, 0, 6.283); ctx.fill();
      }
      if (axes) {
        const x0 = W*xMin - 20;
        ctx.strokeStyle = '#b4c2d6'; ctx.fillStyle = '#748298'; ctx.font = '11px "JetBrains Mono", monospace';
        ctx.beginPath(); ctx.moveTo(x0, H-40); ctx.lineTo(W-30, H-40); ctx.moveTo(x0, H-40); ctx.lineTo(x0, 90); ctx.stroke();
        ctx.fillText('UMAP_1', W-80, H-24); ctx.save(); ctx.translate(x0-10, 150); ctx.rotate(-Math.PI/2); ctx.fillText('UMAP_2', 0, 0); ctx.restore();
      }
      if (!reduce && visible) requestAnimationFrame(draw); else running = false;
    };
    const start = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(draw); } };
    // pausa la animación cuando no está en pantalla
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(cv);
    start();
  };

  const small = innerWidth < 600;
  const hero = document.getElementById('embed');
  if (hero) initEmbed(hero, {n: small ? 180 : 420, xMin: small ? .05 : .3, xMax: .97, axes: !small, avoid: document.querySelector('.hero-logo')});
  document.querySelectorAll('canvas.embed-bg').forEach(cv => initEmbed(cv, {n: small ? 90 : 200, xMin: small ? .3 : .5, xMax: .97, axes: false}));
})();
