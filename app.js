// DuoLiftApp CSS 3D — zero dipendenze
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const floor = $('#floor');
const bin = $('#tray .bin');
const timeEl = $('#time'), placedEl = $('#placed'), totalEl = $('#total'), scoreEl = $('#score');

// Definizione pezzi e target (coordinate in px sul piano isometrico)
const pieces = [
  { id:'base',     w:420, h:24,  d:80,  color:'#a6adc8', pos:[-210, 0], rot:0, snap:[-210, 0] },
  { id:'colL',     w:24,  h:250, d:32,  color:'#70b2ff', pos:[-140,-40], rot:0, snap:[-140,-40] },
  { id:'colR',     w:24,  h:250, d:32,  color:'#70b2ff', pos:[ 140,-40], rot:0, snap:[ 140,-40] },
  { id:'motor',    w:26,  h:90,  d:38,  color:'#7fe3a6', pos:[ 180, 10], rot:0, snap:[ 180, 10] },
  { id:'control',  w:22,  h:72,  d:22,  color:'#e3e37f', pos:[ 180, 70], rot:0, snap:[ 180, 70] },
  // bracci sinistra (lunghi -> corti)
  { id:'armL_1',   w:180, h:16,  d:16,  color:'#9dd1ff', pos:[-40, 120], rot:0, snap:[-40,  40] },
  { id:'armL_2',   w:110, h:14,  d:14,  color:'#9dd1ff', pos:[-40, 170], rot:0, snap:[ 20,  40] },
  { id:'armL_3',   w: 70, h:12,  d:12,  color:'#9dd1ff', pos:[-40, 210], rot:0, snap:[ 60,  40] },
  // bracci destra
  { id:'armR_1',   w:180, h:16,  d:16,  color:'#9dd1ff', pos:[ 40, 120], rot:180, snap:[ 40, -40] },
  { id:'armR_2',   w:110, h:14,  d:14,  color:'#9dd1ff', pos:[ 40, 170], rot:180, snap:[-20, -40] },
  { id:'armR_3',   w: 70, h:12,  d:12,  color:'#9dd1ff', pos:[ 40, 210], rot:180, snap:[-60, -40] },
];

let placed = 0, score = 0, t0 = performance.now();

function pad(n){return String(n).padStart(2,'0')}
function tick(){
  const s = Math.floor((performance.now()-t0)/1000);
  timeEl.textContent = pad(Math.floor(s/60))+':'+pad(s%60);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Utilità: crea un cubo CSS
function makeCube({w,h,d,color,label}){
  const c = document.createElement('div');
  c.className = 'cube';
  c.style.width = w+'px';
  c.style.height = d+'px'; // l'altezza visuale del piano superiore
  c.dataset.w = w; c.dataset.h = h; c.dataset.d = d;
  // Facce
  const faces = {};
  function face(cls, css){
    const f = document.createElement('div');
    f.className = 'face '+cls;
    Object.assign(f.style, css);
    c.appendChild(f);
    faces[cls] = f;
  }
  // top
  face('top',    {width:w+'px', height:d+'px', transform:`translateZ(${h}px)`, background:`linear-gradient(180deg,${lighten(color,10)},${color})`});
  // front/back
  face('front',  {width:w+'px', height:h+'px', transform:`rotateX(-90deg) translateZ(${d}px)`, background:color});
  face('back',   {width:w+'px', height:h+'px', transform:`rotateX(-90deg)`, background:color});
  // left/right
  face('left',   {width:d+'px', height:h+'px', transform:`rotateY(90deg) rotateX(-90deg)`, background:shade(color,10)});
  face('right',  {width:d+'px', height:h+'px', transform:`rotateY(-90deg) rotateX(-90deg) translateZ(${w}px)`, background:shade(color,10)});
  // badge opzionale
  if (label){
    const b = document.createElement('div'); b.className='badge'; b.textContent = label; c.appendChild(b);
  }
  return c;
}
function lighten(hex, amt){ const c = toRGB(hex); return `rgb(${clamp(c[0]+amt*2.5)},${clamp(c[1]+amt*2.5)},${clamp(c[2]+amt*2.5)})`; }
function shade(hex, amt){ const c = toRGB(hex); return `rgb(${clamp(c[0]-amt*2.5)},${clamp(c[1]-amt*2.5)},${clamp(c[2]-amt*2.5)})`; }
function toRGB(hex){ hex=hex.replace('#',''); const n=parseInt(hex,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function clamp(n){ return Math.max(0,Math.min(255,Math.floor(n))); }

// Targets (ghost)
function ghostRect({w,h,d, pos:[x,z], rot=0}){
  const g = document.createElement('div');
  g.className='ghost';
  g.style.width=w+'px'; g.style.height=d+'px';
  g.style.transform = `translate3d(${x}px, ${z}px, 0) rotateZ(${rot}deg)`;
  g.dataset.x=x; g.dataset.z=z; g.dataset.rot=rot;
  g.dataset.w=w; g.dataset.d=d;
  floor.appendChild(g);
  return g;
}

// Setup scena
function setup(){
  // targets
  pieces.forEach(p=> ghostRect({w:p.w,h:p.h,d:p.d,pos:p.snap,rot:p.rot}));
  // palette pezzi
  pieces.forEach(p=>{
    const cube = makeCube({w:p.w,h:p.h,d:p.d,color:p.color,label:p.id});
    cube.style.transform = `translate3d(0,0,0)`;
    cube.dataset.id = p.id;
    cube.dataset.rot = p.rot;
    cube.style.setProperty('--rot', p.rot+'deg');
    // Posizione iniziale nella tray (stack)
    const wrap = document.createElement('div');
    wrap.style.position='relative'; wrap.style.height=(p.d+28)+'px';
    wrap.appendChild(cube);
    bin.appendChild(wrap);
    // Sposta nel floor con posizione iniziale
    floor.appendChild(cube);
    moveTo(cube, p.pos[0], p.pos[1], p.rot);
    enableDrag(cube);
  });
  totalEl.textContent = pieces.length;
}
setup();

function moveTo(el, x,z, rot){
  el.style.transform = `translate3d(${x}px, ${z}px, 0) rotateZ(${rot}deg)`;
  el.dataset.x = x; el.dataset.z = z; el.dataset.rot = rot;
}

function enableDrag(el){
  let startX=0,startY=0,baseX=0,baseZ=0, dragging=false;
  el.addEventListener('pointerdown', (e)=>{
    dragging=true; el.classList.add('dragging'); el.setPointerCapture(e.pointerId);
    startX=e.clientX; startY=e.clientY; baseX=parseFloat(el.dataset.x||0); baseZ=parseFloat(el.dataset.z||0);
  });
  el.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const dx = e.clientX-startX, dz = e.clientY-startY;
    moveTo(el, baseX+dx, baseZ+dz, parseFloat(el.dataset.rot||0));
  });
  el.addEventListener('pointerup', (e)=>{
    if(!dragging) return; dragging=false; el.classList.remove('dragging'); el.releasePointerCapture(e.pointerId);
    trySnap(el);
  });
  // rotazione con doppio click
  el.addEventListener('dblclick', ()=>{
    const r = (parseFloat(el.dataset.rot||0)+15)%360;
    moveTo(el, parseFloat(el.dataset.x||0), parseFloat(el.dataset.z||0), r);
  });
}

function trySnap(el){
  const id = el.dataset.id;
  const g = [...$$('.ghost')].find(t=> t.matches(`[data-id="${id}"]`) ) || // (se avessimo id specifici)
            bestGhostFor(el);
  if(!g) return;
  const dx = (parseFloat(el.dataset.x)-parseFloat(g.dataset.x));
  const dz = (parseFloat(el.dataset.z)-parseFloat(g.dataset.z));
  const dr = angleDelta(parseFloat(el.dataset.rot), parseFloat(g.dataset.rot));
  const within = (Math.hypot(dx,dz) < 20) && (Math.abs(dr) < 10);
  if(within){
    moveTo(el, parseFloat(g.dataset.x), parseFloat(g.dataset.z), parseFloat(g.dataset.rot));
    if(!el.dataset.locked){ el.dataset.locked='1'; placed++; score+=100; }
    placedEl.textContent = placed; scoreEl.textContent = score;
    checkWin();
  }
}

// Sceglie il ghost con area simile e vicino
function bestGhostFor(el){
  const w = parseFloat(el.dataset.w), d = parseFloat(el.dataset.d);
  let best=null, bestDist=1e9;
  $$('.ghost').forEach(g=>{
    const gw=parseFloat(g.dataset.w), gd=parseFloat(g.dataset.d);
    const areaOk = Math.abs(gw-w) < 40 && Math.abs(gd-d) < 40;
    if(!areaOk) return;
    const dx = (parseFloat(el.dataset.x)-parseFloat(g.dataset.x));
    const dz = (parseFloat(el.dataset.z)-parseFloat(g.dataset.z));
    const dist = Math.hypot(dx,dz);
    if(dist < bestDist){ best=g; bestDist=dist; }
  });
  return best;
}

function angleDelta(a,b){
  let d = (a-b)%360; if(d>180) d-=360; if(d<-180) d+=360; return d;
}

function checkWin(){
  if(placed >= pieces.length){
    score += 250;
    scoreEl.textContent = score;
    const done = document.createElement('div');
    done.textContent = '✅ Ponte completato!';
    Object.assign(done.style, {position:'absolute', left:'50%', top:'12px', transform:'translateX(-50%)',
      background:'#0f5132', color:'#fff', padding:'10px 14px', borderRadius:'10px'});
    $('#stageWrap').appendChild(done);
    setTimeout(()=>done.remove(),1500);
  }
}

// Pulsanti
$('#reset').addEventListener('click', ()=>{
  placed=0; score=0; placedEl.textContent='0'; scoreEl.textContent='0';
  $$('.cube').forEach((el,i)=>{ const p = pieces[i]; el.dataset.locked=''; moveTo(el, p.pos[0], p.pos[1], p.rot); });
});
$('#help').addEventListener('click', ()=> $('#guide').showModal());
