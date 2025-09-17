/* DuoLiftApp — Game logic (Enhanced)
   - Theatre intro like KubeApp
   - Brand palette toggle (Cormach)
   - Sounds via WebAudio (no external assets)
   - Pro mode: rotation for arms, extra pieces (tamponi, piastre, fermo)
   MIT License
*/
(() => {
  const $ = sel => document.querySelector(sel);
  const canvas = $('#c');
  const ctx = canvas.getContext('2d');
  const video = $('#videoBg');
  const bar = $('#piecesBar');
  const placedEl = $('#placed');
  const totalEl = $('#total');
  const scoreEl = $('#score');
  const timeEl = $('#time');
  const btnReset = $('#btnReset');
  const btnCamera = $('#btnCamera');
  const btnInstall = $('#btnInstall');
  const intro = $('#intro');
  const startBtn = $('#startBtn');
  const theatre = $('#theatre');
  const btnBrand = $('#btnBrand');
  const btnSound = $('#btnSound');

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

  // WebAudio simple beeps
  let audioOn = true;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  function beep(freq=660, dur=0.08, type='sine', vol=0.05){
    if (!audioOn) return;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.frequency.value = freq; o.type = type;
    g.gain.value = vol;
    o.connect(g); g.connect(ac.destination);
    o.start();
    setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur); o.stop(ac.currentTime + dur+0.02); }, 0);
  }
  function sndSnap(){ beep(880, .09, 'square', .06); }
  function sndError(){ beep(220, .12, 'sawtooth', .07); }
  function sndWin(){ [0,1,2].forEach(i=> setTimeout(()=>beep(640 + i*160, .09, 'triangle', .08), i*110)); }

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
    difficulty:'easy', // easy or pro
    brand: 'default'
  };

  // Blueprint geometry
  function buildBlueprint() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const pad = 24;
    const area = {x: pad, y: pad, w: W - pad*2, h: H - 140};
    const base = {id:'base', x: area.x + area.w*0.1, y: area.y + area.h*0.8, w: area.w*0.8, h: 18, rot:0};
    const colW = 36, colH = area.h*0.62;
    const colL = {id:'colL', x: area.x + area.w*0.22, y: base.y - colH, w: colW, h: colH, rot:0};
    const colR = {id:'colR', x: area.x + area.w*0.78 - colW, y: base.y - colH, w: colW, h: colH, rot:0};
    const motor = {id:'motor', x: colR.x + colW + 10, y: colR.y + colH*0.55, w: 28, h: 48, rot:0};
    const control = {id:'control', x: colR.x + colW + 10, y: motor.y - 56, w: 24, h: 38, rot:0};

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

    // Pro-only pieces
    const padsY = armY - 10;
    const padSize = 12;
    const proPieces = [
      {id:'padL', x: colL.x + colW + 6, y: padsY, w: padSize, h: padSize, rot:0},
      {id:'padR', x: colR.x - 6 - padSize, y: padsY, w: padSize, h: padSize, rot:0},
      {id:'plateL', x: colL.x + colW + 14, y: padsY - 18, w: 18, h: 6, rot:0},
      {id:'plateR', x: colR.x - 14 - 18, y: padsY - 18, w: 18, h: 6, rot:0},
      {id:'lock', x: base.x + base.w/2 - 10, y: base.y - 40, w: 20, h: 10, rot:0},
    ];

    const targets = [base, colL, colR, motor, control, ...arms];
    if (state.difficulty === 'pro') targets.push(...proPieces);
    state.targets = targets.map(t => ({...t, placed:false}));
  }

  // Pieces bag
  function buildPieces() {
    const W = canvas.clientWidth; const H = canvas.clientHeight;
    const bag = [];
    for (const tgt of state.targets) {
      const piece = {
        id: tgt.id,
        x: 20 + Math.random()*(W-40),
        y: H - 120 + Math.random()*40,
        w: tgt.w, h: tgt.h,
        rot: tgt.rot || 0,
        held:false,
        placed:false,
        color: pickColorFor(tgt.id)
      };
      bag.push(piece);
    }
    state.pieces = bag;
    totalEl.textContent = String(bag.length);
  }

  function pickColorFor(id){
    const theme = state.theme;
    const brand = state.brand;
    const cBlue = {arm:'#9dd1ff', col:'#70b2ff'};
    const cYel  = {arm:'#ffe08a', col:'#ffd666'};
    const cRed  = {arm:'#ffb3b3', col:'#ff8f8f'};
    const pal = theme==='blue'?cBlue: theme==='yellow'?cYel:cRed;
    const col = pal.col, arm = pal.arm;
    const accent = brand==='cormach' ? '#ff6a00' : '#7fe3a6';
    if (id.startsWith('arm')) return arm;
    if (id.startsWith('col')) return col;
    if (id==='base') return brand==='cormach' ? '#ffc7a1' : '#a6adc8';
    if (id==='motor') return accent;
    if (id==='control') return brand==='cormach' ? '#ffe2cc' : '#e3e37f';
    if (id==='padL' || id==='padR') return '#ffd24d';
    if (id.startsWith('plate')) return '#d0d7e2';
    if (id==='lock') return '#98f5d0';
    return '#c9d1ff';
  }

  // Draw loop
  function draw() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0,0,W,H);
    drawBlueprint();
    // pieces: unplaced then placed
    const unplaced = state.pieces.filter(p=>!p.placed);
    const placed = state.pieces.filter(p=>p.placed);
    for (const p of unplaced) drawPiece(p, .9);
    for (const p of placed) drawPiece(p, 1.0, true);
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
      // draw as axis-aligned guides regardless of rotation
      ctx.strokeRect(t.x, t.y, t.w, t.h);
    }
    // centerline between columns
    const colL = state.targets.find(t=>t.id==='colL');
    const colR = state.targets.find(t=>t.id==='colR');
    if (colL && colR){
      ctx.setLineDash([3,6]);
      ctx.beginPath();
      const cx = (colL.x + colL.w/2 + colR.x + colR.w/2)/2;
      ctx.moveTo(cx, 12); ctx.lineTo(cx, H-12); ctx.stroke();
    }
    // ground line
    ctx.setLineDash([]); ctx.globalAlpha=.25;
    ctx.beginPath(); ctx.moveTo(16, H-42); ctx.lineTo(W-16, H-42); ctx.stroke();
    ctx.restore();
  }

  function drawPiece(p, alpha=1, placed=false){
    ctx.save();
    ctx.globalAlpha = alpha;
    // rotation support (for Pro)
    ctx.translate(p.x + p.w/2, p.y + p.h/2);
    ctx.rotate((p.rot||0) * Math.PI/180);
    const rx = -p.w/2, ry = -p.h/2;
    roundedRect(rx, ry, p.w, p.h, 4);
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
    ctx.fillText(label, rx + 6, ry + p.h/2);
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
    if (id==='padL') return 'Tampone SX';
    if (id==='padR') return 'Tampone DX';
    if (id==='plateL') return 'Piastra SX';
    if (id==='plateR') return 'Piastra DX';
    if (id==='lock') return 'Fermocolonna';
    return id;
  }

  // Drag + rotate (mouse/touch + wheel/R)
  let pointerId = null;
  canvas.addEventListener('pointerdown', (e)=>{
    pointerId = e.pointerId;
    const pos = getPos(e);
    const p = hitPiece(pos.x, pos.y);
    if (p){
      state.dragging = p;
      p.held = true;
      p._dx = pos.x - (p.x + p.w/2);
      p._dy = pos.y - (p.y + p.h/2);
      canvas.setPointerCapture(pointerId);
      beep(520,.05,'triangle',.03);
    }
  });
  canvas.addEventListener('pointermove', (e)=>{
    if (pointerId !== e.pointerId) return;
    const pos = getPos(e);
    if (state.dragging){
      const p = state.dragging;
      // position by center to keep rotation intuitive
      p.x = pos.x - p._dx - p.w/2;
      p.y = pos.y - p._dy - p.h/2;
      state.hoverTarget = matchTarget(p);
    }
  });
  canvas.addEventListener('pointerup', (e)=>{
    if (pointerId !== e.pointerId) return;
    if (state.dragging){
      const p = state.dragging;
      const t = matchTarget(p);
      if (t && !t.placed && t.id === p.id && angleClose(p.rot, t.rot||0)){
        // Snap center to center
        p.x = t.x; p.y = t.y; p.rot = t.rot||0; p.placed = true; t.placed = true;
        state.score += 100;
        sndSnap();
        updatePlaced();
        pulseHud('#15b374');
        checkWin();
      } else {
        state.score = Math.max(0, state.score - 10);
        sndError();
        pulseHud('#ff4d4f');
      }
      p.held = false;
      state.dragging = null;
      state.hoverTarget = null;
    }
    pointerId = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch{}
  });

  // Rotate with mouse wheel or key R (Pro only)
  canvas.addEventListener('wheel', (e)=>{
    if (state.difficulty !== 'pro') return;
    if (!state.dragging) return;
    e.preventDefault();
    const p = state.dragging;
    p.rot = (p.rot + Math.sign(e.deltaY) * 5) % 360;
  }, {passive:false});
  window.addEventListener('keydown', (e)=>{
    if (state.difficulty !== 'pro') return;
    if (e.key.toLowerCase()==='r' && state.dragging){
      state.dragging.rot = (state.dragging.rot + 15)%360;
    }
  });

  function angleClose(a,b){ return Math.abs(((a-b+540)%360)-180) < 8; }

  function getPos(e){
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitPiece(x,y){
    for (let i = state.pieces.length-1; i>=0; i--){
      const p = state.pieces[i];
      if (p.placed) continue;
      // transform point into piece local space considering rotation
      const cx = p.x + p.w/2, cy = p.y + p.h/2;
      const dx = x - cx, dy = y - cy;
      const ang = -(p.rot||0) * Math.PI/180;
      const lx =  dx*Math.cos(ang) - dy*Math.sin(ang);
      const ly =  dx*Math.sin(ang) + dy*Math.cos(ang);
      if (lx>=-p.w/2 && lx<=p.w/2 && ly>=-p.h/2 && ly<=p.h/2) return p;
    }
    return null;
  }

  function matchTarget(p){
    const tol = state.difficulty === 'easy' ? 22 : 10;
    for (const t of state.targets){
      if (t.placed || t.id !== p.id) continue;
      if (Math.abs(p.x - t.x) < tol && Math.abs(p.y - t.y) < tol){
        if (state.difficulty==='pro'){
          if (!angleClose(p.rot, t.rot||0)) continue;
        }
        return t;
      }
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
      const ok = validateSymmetry();
      if (ok){
        state.score += 250;
        scoreEl.textContent = String(state.score);
        sndWin();
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

  // Theatre open after Start
  function openTheatreThenStart(){
    theatre.classList.remove('open');
    theatre.style.display = 'flex';
    setTimeout(()=>{
      theatre.classList.add('open');
      setTimeout(()=>{
        theatre.style.display = 'none';
        start();
      }, 1300);
    }, 150);
  }

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

  startBtn.addEventListener('click', openTheatreThenStart);
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

  // Sidebar-like controls (in header)
  document.querySelectorAll('[data-theme]').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.theme = b.dataset.theme;
      state.pieces.forEach(p=> p.color = pickColorFor(p.id));
    });
  });
  document.querySelectorAll('[data-diff]').forEach(b=>{
    b.addEventListener('click', ()=>{
      state.difficulty = b.dataset.diff;
      reset();
    });
  });

  // Brand toggle
  btnBrand.addEventListener('click', ()=>{
    const root = document.documentElement;
    const on = root.getAttribute('data-brand') === 'cormach';
    if (on){
      root.removeAttribute('data-brand');
      btnBrand.setAttribute('aria-pressed','false');
      btnBrand.textContent = '🎨 Cormach';
      state.brand = 'default';
    } else {
      root.setAttribute('data-brand', 'cormach');
      btnBrand.setAttribute('aria-pressed','true');
      btnBrand.textContent = '🎨 Default';
      state.brand = 'cormach';
    }
    state.pieces.forEach(p=> p.color = pickColorFor(p.id));
  });

  // Sound toggle
  btnSound.addEventListener('click', ()=>{
    audioOn = !audioOn;
    btnSound.setAttribute('aria-pressed', audioOn?'true':'false');
    btnSound.textContent = audioOn? '🔊 Suoni' : '🔈 Muto';
    if (audioOn){ beep(740,.06,'triangle',.05); }
  });

  // Service worker
  if ('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    });
  }
})();