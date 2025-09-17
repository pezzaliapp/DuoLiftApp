/* DuoLiftApp — Game logic
   Copyright (c) 2025
   MIT License
*/
(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const video = document.getElementById('videoBg');
  const bar = document.getElementById('piecesBar');
  const placedEl = document.getElementById('placed');
  const totalEl = document.getElementById('total');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const btnReset = document.getElementById('btnReset');
  const btnCamera = document.getElementById('btnCamera');
  const btnInstall = document.getElementById('btnInstall');
  const intro = document.getElementById('intro');
  const startBtn = document.getElementById('startBtn');

  // Resize canvas to fit container
  function fit() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(fit).observe(canvas.parentElement);
  window.addEventListener('orientationchange', () => setTimeout(fit, 300));
  fit();

  // Game model
  const state = {
    started:false,
    t0:0,
    elapsed:0,
    score:0,
    pieces:[],
    targets:[],
    dragging:null,
    hoverTarget:null,
    theme:'blue',
    difficulty:'easy'
  };

  // Blueprint geometry constants (relative)
  function buildBlueprint() {
    // Work area padding
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const pad = 24;
    const area = {x: pad, y: pad, w: W - pad*2, h: H - 140}; // leave space for HUD margins
    // Base plate
    const base = {id:'base', x: area.x + area.w*0.1, y: area.y + area.h*0.8, w: area.w*0.8, h: 18, rot:0};
    // Columns symmetric
    const colW = 36, colH = area.h*0.62;
    const colL = {id:'colL', x: area.x + area.w*0.22, y: base.y - colH, w: colW, h: colH, rot:0};
    const colR = {id:'colR', x: area.x + area.w*0.78 - colW, y: base.y - colH, w: colW, h: colH, rot:0};
    // Motor/Power unit on right column lower side
    const motor = {id:'motor', x: colR.x + colW + 10, y: colR.y + colH*0.55, w: 28, h: 48, rot:0};
    const control = {id:'control', x: colR.x + colW + 10, y: motor.y - 56, w: 24, h: 38, rot:0};

    // Arms: 2 sides, each with 3 telescoping segments
    const armY = base.y - 28;
    const armLen = Math.min(140, area.w*0.28);
    const armH = 12;
    const arms = [
      {id:'armL_1', x: colL.x + colW, y: armY, w: armLen*0.5, h: armH, rot:0},
      {id:'armL_2', x: colL.x + colW + armLen*0.5, y: armY, w: armLen*0.32, h: armH, rot:0},
      {id:'armL_3', x: colL.x + colW + armLen*0.82, y: armY, w: armLen*0.22, h: armH, rot:0},
      {id:'armR_1', x: colR.x - armLen*0.5, y: armY, w: armLen*0.5, h: armH, rot:0},
      {id:'armR_2', x: colR.x - armLen*0.82, y: armY, w: armLen*0.32, h: armH, rot:0},
      {id:'armR_3', x: colR.x - armLen*1.04, y: armY, w: armLen*0.22, h: armH, rot:0},
    ];

    const targets = [base, colL, colR, motor, control, ...arms].map(t => ({...t, placed:false}));
    state.targets = targets;
  }

  // Pieces to place (shuffle positions)
  function buildPieces() {
    const names = state.targets.map(t => t.id);
    const W = canvas.clientWidth; const H = canvas.clientHeight;
    const bag = [];
    for (const id of names) {
      const tgt = state.targets.find(t => t.id === id);
      const piece = {
        id,
        x: 20 + Math.random()*(W-40),
        y: H - 120 + Math.random()*40,
        w: tgt.w, h: tgt.h,
        rot:0,
        held:false,
        placed:false,
        color: pickColorFor(id)
      };
      bag.push(piece);
    }
    // Small tweak: motor/control pieces start in bar (we also render clones in bar UI list)
    state.pieces = bag;
    totalEl.textContent = String(bag.length);
  }

  function pickColorFor(id){
    const theme = state.theme;
    if (id.startsWith('arm')) return theme === 'blue' ? '#9dd1ff' : theme === 'yellow' ? '#ffe08a' : '#ffb3b3';
    if (id.startsWith('col')) return theme === 'blue' ? '#70b2ff' : theme === 'yellow' ? '#ffd666' : '#ff8f8f';
    if (id==='base') return '#a6adc8';
    if (id==='motor') return '#7fe3a6';
    if (id==='control') return '#e3e37f';
    return '#c9d1ff';
  }

  // Draw loop
  function draw() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0,0,W,H);

    // Blueprint guides
    drawBlueprint();

    // Draw pieces (unplaced below, placed above)
    const unplaced = state.pieces.filter(p=>!p.placed);
    const placed = state.pieces.filter(p=>p.placed);
    for (const p of unplaced) drawPiece(p, .9);
    for (const p of placed) drawPiece(p, 1.0, true);

    // Hover highlight
    if (state.hoverTarget) {
      const t = state.hoverTarget;
      ctx.save();
      ctx.strokeStyle = 'rgba(21,179,116,.8)';
      ctx.setLineDash([6,6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(t.x, t.y, t.w, t.h);
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }

  function drawBlueprint(){
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.setLineDash([8,8]);
    ctx.lineWidth = 1.5;
    for (const t of state.targets) {
      ctx.strokeRect(t.x, t.y, t.w, t.h);
    }
    // Ground line
    ctx.setLineDash([]);
    ctx.globalAlpha = .25;
    ctx.beginPath();
    ctx.moveTo(16, H-42); ctx.lineTo(W-16, H-42); ctx.stroke();
    ctx.restore();
  }

  function drawPiece(p, alpha=1, placed=false){
    ctx.save();
    ctx.globalAlpha = alpha;
    roundedRect(p.x, p.y, p.w, p.h, 4);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = placed ? 1.2 : 1;
    ctx.strokeStyle = placed ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.1)';
    ctx.stroke();
    // label
    ctx.fillStyle = '#0b1220';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha*0.9;
    const label = labelFor(p.id);
    ctx.fillText(label, p.x + 6, p.y + p.h/2);
    ctx.restore();
  }

  function roundedRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function labelFor(id){
    if (id==='base') return 'Base';
    if (id==='colL') return 'Colonna SX';
    if (id==='colR') return 'Colonna DX';
    if (id==='motor') return 'Motore';
    if (id==='control') return 'Centralina';
    if (id.startsWith('armL')) return 'Braccio SX';
    if (id.startsWith('armR')) return 'Braccio DX';
    return id;
  }

  // Drag interactions (mouse + touch)
  let pointerId = null;
  canvas.addEventListener('pointerdown', (e)=>{
    pointerId = e.pointerId;
    const pos = getPos(e);
    const p = hitPiece(pos.x, pos.y);
    if (p){
      state.dragging = p;
      p.held = true;
      p._dx = pos.x - p.x;
      p._dy = pos.y - p.y;
      canvas.setPointerCapture(pointerId);
    }
  });
  canvas.addEventListener('pointermove', (e)=>{
    if (pointerId !== e.pointerId) return;
    const pos = getPos(e);
    if (state.dragging){
      const p = state.dragging;
      p.x = pos.x - p._dx;
      p.y = pos.y - p._dy;
      // snap detection
      state.hoverTarget = matchTarget(p);
    }
  });
  canvas.addEventListener('pointerup', (e)=>{
    if (pointerId !== e.pointerId) return;
    if (state.dragging){
      const p = state.dragging;
      const t = matchTarget(p);
      if (t && !t.placed && t.id === p.id){
        // Snap
        p.x = t.x; p.y = t.y; p.placed = true; t.placed = true;
        state.score += 100;
        updatePlaced();
        pulseHud('#15b374');
        checkWin();
      } else {
        // small penalty
        state.score = Math.max(0, state.score - 10);
        pulseHud('#ff4d4f');
      }
      p.held = false;
      state.dragging = null;
      state.hoverTarget = null;
    }
    pointerId = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch{}
  });

  function getPos(e){
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitPiece(x,y){
    // iterate top to bottom: pick last unplaced first to simulate z-order
    for (let i = state.pieces.length-1; i>=0; i--){
      const p = state.pieces[i];
      if (p.placed) continue;
      if (x>=p.x && x<=p.x+p.w && y>=p.y && y<=p.y+p.h) return p;
    }
    return null;
  }

  function matchTarget(p){
    const tol = state.difficulty === 'easy' ? 22 : 10;
    for (const t of state.targets){
      if (t.placed || t.id !== p.id) continue;
      if (Math.abs(p.x - t.x) < tol && Math.abs(p.y - t.y) < tol) return t;
    }
    return null;
  }

  function updatePlaced(){
    const placedCount = state.pieces.filter(p=>p.placed).length;
    placedEl.textContent = String(placedCount);
    scoreEl.textContent = String(state.score);
  }

  function checkWin(){
    if (state.pieces.every(p=>p.placed)){
      // Symmetry check for columns & arms length ordering
      const ok = validateSymmetry();
      if (ok){
        state.score += 250;
        scoreEl.textContent = String(state.score);
        toast('✅ Ponte completato! Simmetria OK.','ok');
      } else {
        toast('⚠️ Ponte completato ma la simmetria/ordine bracci non è perfetto.','err');
      }
    }
  }

  function validateSymmetry(){
    const colL = state.targets.find(t=>t.id==='colL');
    const colR = state.targets.find(t=>t.id==='colR');
    let sym = Math.abs((colL.x+colL.w/2) - (colR.x+colR.w/2)) > 20 ? false : true;
    // Arms order by length (decreasing from base): 1 > 2 > 3 on both sides
    const aL1 = state.targets.find(t=>t.id==='armL_1').w;
    const aL2 = state.targets.find(t=>t.id==='armL_2').w;
    const aL3 = state.targets.find(t=>t.id==='armL_3').w;
    const aR1 = state.targets.find(t=>t.id==='armR_1').w;
    const aR2 = state.targets.find(t=>t.id==='armR_2').w;
    const aR3 = state.targets.find(t=>t.id==='armR_3').w;
    const order = (aL1>aL2 && aL2>aL3) && (aR1>aR2 && aR2>aR3);
    return sym && order;
  }

  function pulseHud(color){
    const hud = document.getElementById('hud');
    const prev = hud.style.boxShadow;
    hud.style.boxShadow = `0 0 0 2px ${color}`;
    setTimeout(()=> hud.style.boxShadow = prev, 200);
  }

  function toast(msg, type='ok'){
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.position='fixed';
    el.style.left='50%'; el.style.top='18px'; el.style.transform='translateX(-50%)';
    el.style.background = type==='ok' ? '#0f5132' : '#5f1212';
    el.style.color = '#fff';
    el.style.padding='10px 14px'; el.style.borderRadius='10px';
    el.style.boxShadow='0 8px 30px rgba(0,0,0,.35)';
    el.style.zIndex='20';
    document.body.appendChild(el);
    setTimeout(()=> el.remove(), 1600);
  }

  // Camera background
  let camOn = false;
  btnCamera.addEventListener('click', async ()=>{
    if (!camOn){
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
        video.srcObject = stream;
        video.style.display = 'block';
        camOn = true;
        btnCamera.setAttribute('aria-pressed','true');
      } catch (e){
        toast('Permesso camera negato', 'err');
      }
    } else {
      const s = video.srcObject;
      if (s) s.getTracks().forEach(t=>t.stop());
      video.srcObject = null;
      video.style.display = 'none';
      camOn = false;
      btnCamera.setAttribute('aria-pressed','false');
    }
  });

  // Install prompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstall.hidden = false;
  });
  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btnInstall.hidden = true;
  });

  // Start / Reset
  function start(){
    state.started = true;
    state.t0 = performance.now();
    state.elapsed = 0;
    state.score = 0;
    buildBlueprint();
    buildPieces();
    updatePlaced();
    intro.style.display='none';
  }
  function reset(){
    start();
  }

  startBtn.addEventListener('click', start);
  btnReset.addEventListener('click', reset);

  // Timer
  function tick(t){
    if (state.started){
      state.elapsed = t - state.t0;
      const sec = Math.floor(state.elapsed/1000);
      const mm = String(Math.floor(sec/60)).padStart(2,'0');
      const ss = String(sec%60).padStart(2,'0');
      timeEl.textContent = `${mm}:${ss}`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Render loop
  draw();

  // Sidebar controls (theme/difficulty)
  document.querySelectorAll('[data-theme]').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.theme = b.dataset.theme;
      state.pieces.forEach(p=> p.color = pickColorFor(p.id));
    });
  });
  document.querySelectorAll('[data-diff]').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.difficulty = b.dataset.diff;
    });
  });

  // Service worker
  if ('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    });
  }
})();