// DuoLiftApp 3D – build minimale funzionante (no moduli, no PWA)
(function(){
  // ==== guardia: librerie caricate? ====
  if (!window.THREE || !THREE.OrbitControls) {
    alert("Errore: non riesco a caricare Three.js dal CDN.");
    return;
  }

  // ==== UI ====
  const canvas  = document.getElementById('webgl');
  const placedEl= document.getElementById('placed');
  const totalEl = document.getElementById('total');
  const scoreEl = document.getElementById('score');
  const timeEl  = document.getElementById('time');
  const intro   = document.getElementById('intro');
  const startBtn= document.getElementById('startBtn');
  const btnReset= document.getElementById('btnReset');

  // ==== renderer/scene/camera ====
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  const scene = new THREE.Scene(); scene.background = null;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(3.8, 2.2, 5.2);

  function resize(){
    const h = window.innerHeight - 56;
    renderer.setSize(window.innerWidth, h);
    camera.aspect = window.innerWidth / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.target.set(0,0.8,0);

  // ==== luci & pavimento ====
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(3,6,5); scene.add(dir);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10,10), new THREE.MeshStandardMaterial({color:0x0b1324, roughness:0.95}));
  ground.rotation.x = -Math.PI/2; ground.position.y = 0; scene.add(ground);
  const grid = new THREE.GridHelper(10, 20, 0x2a3350, 0x1a2038); grid.position.y = 0.001; scene.add(grid);

  // ==== materiali ====
  const M = {
    base:  new THREE.MeshStandardMaterial({color:0xa6adc8, metalness:0.2, roughness:0.6}),
    col:   new THREE.MeshStandardMaterial({color:0x70b2ff, metalness:0.2, roughness:0.5}),
    arm:   new THREE.MeshStandardMaterial({color:0x9dd1ff, metalness:0.2, roughness:0.5}),
    acc:   new THREE.MeshStandardMaterial({color:0x7fe3a6, metalness:0.2, roughness:0.4}),
    ctrl:  new THREE.MeshStandardMaterial({color:0xe3e37f, metalness:0.2, roughness:0.4}),
    ghost: new THREE.MeshStandardMaterial({color:0xffffff, opacity:0.13, transparent:true})
  };
  const box = (w,h,d,mat)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); m.userData.size=[w,h,d]; return m; };
  const setPos = (o,[x,y,z])=>o.position.set(x,y,z);

  // ==== stato gioco ====
  const state = { started:false, t0:0, score:0, pieces:[], targets:[] };
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  let dragging=null, dragOffset=new THREE.Vector3();

  // ==== layout target (ghost) ====
  function buildTargets(){
    const t = [
      {id:'base',    pos:[0,0.09,0],     rotY:0,   size:[3.2,0.18,0.6], mat:M.base},
      {id:'colL',    pos:[-1.0,1.2,0],   rotY:0,   size:[0.18,2.4,0.24], mat:M.col},
      {id:'colR',    pos:[ 1.0,1.2,0],   rotY:0,   size:[0.18,2.4,0.24], mat:M.col},
      {id:'motor',   pos:[ 1.25,0.9,0.3],rotY:0,   size:[0.18,0.5,0.2],  mat:M.acc},
      {id:'control', pos:[ 1.25,1.5,0.3],rotY:0,   size:[0.14,0.36,0.12],mat:M.ctrl},
      // bracci SX
      {id:'armL_1',  pos:[-0.82,0.5,0],  rotY:0,   size:[0.8,0.12,0.12], mat:M.arm},
      {id:'armL_2',  pos:[-0.22,0.5,0],  rotY:0,   size:[0.5,0.10,0.10], mat:M.arm},
      {id:'armL_3',  pos:[ 0.20,0.5,0],  rotY:0,   size:[0.3,0.08,0.08], mat:M.arm},
      // bracci DX
      {id:'armR_1',  pos:[ 0.82,0.5,0],  rotY:Math.PI, size:[0.8,0.12,0.12], mat:M.arm},
      {id:'armR_2',  pos:[ 0.22,0.5,0],  rotY:Math.PI, size:[0.5,0.10,0.10], mat:M.arm},
      {id:'armR_3',  pos:[-0.20,0.5,0],  rotY:Math.PI, size:[0.3,0.08,0.08], mat:M.arm}
    ];
    // ghost
    for (const g of t){
      const ghost = box(...g.size, M.ghost);
      setPos(ghost, g.pos); ghost.rotation.y = g.rotY; ghost.name = 'ghost:'+g.id;
      scene.add(ghost);
    }
    state.targets = t;
  }

  function buildPieces(){
    const startZ = 2.6; const rnd=(a,b)=>a + Math.random()*(b-a);
    for (const g of state.targets){
      const m = box(...g.size, g.mat); m.name=g.id;
      m.position.set(rnd(-2.5,2.5), rnd(0.2,1.2), startZ + rnd(-1.2,1.2));
      m.rotation.y = 0;
      m.userData = { placed:false, target:g };
      scene.add(m); state.pieces.push(m);
    }
    totalEl.textContent = String(state.pieces.length);
  }

  function reset(){
    for (const p of state.pieces){ scene.remove(p); }
    state.pieces=[]; state.score=0; placedEl.textContent='0'; scoreEl.textContent='0';
    buildPieces();
  }

  function start(){
    if (state.started) return;
    state.started = true; state.t0 = performance.now(); intro.style.display='none';
    reset();
  }

  // ==== drag & snap ====
  function setMouse(e){
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX-r.left)/r.width)*2-1;
    mouse.y = -((e.clientY-r.top)/r.height)*2+1;
  }
  renderer.domElement.addEventListener('pointerdown', (e)=>{
    setMouse(e); raycaster.setFromCamera(mouse,camera);
    const hits = raycaster.intersectObjects(state.pieces.filter(p=>!p.userData.placed));
    if (hits.length){
      dragging = hits[0].object;
      dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0), new THREE.Vector3(0, dragging.position.y, 0));
      const hitPoint=new THREE.Vector3(); raycaster.ray.intersectPlane(dragPlane, hitPoint);
      dragOffset.copy(hitPoint).sub(dragging.position);
      controls.enabled=false;
    }
  });
  renderer.domElement.addEventListener('pointermove', (e)=>{
    if (!dragging) return;
    setMouse(e); raycaster.setFromCamera(mouse,camera);
    const hitPoint=new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) dragging.position.copy(hitPoint.sub(dragOffset));
  });
  renderer.domElement.addEventListener('pointerup', ()=>{
    if (dragging) trySnap(dragging);
    dragging=null; controls.enabled=true;
  });
  window.addEventListener('keydown', (e)=>{
    if (!dragging) return;
    if (e.key.toLowerCase()==='q') dragging.rotation.y -= Math.PI/12;
    if (e.key.toLowerCase()==='e') dragging.rotation.y += Math.PI/12;
  });

  function trySnap(m){
    const t = m.userData.target;
    const posOk = m.position.distanceTo(new THREE.Vector3(...t.pos)) < 0.18;
    const angOk = Math.abs(((m.rotation.y - t.rotY + Math.PI)%(2*Math.PI))-Math.PI) < (Math.PI/18);
    if (posOk && angOk){
      m.position.set(...t.pos); m.rotation.y=t.rotY; m.userData.placed=true;
      const placed = state.pieces.filter(p=>p.userData.placed).length;
      placedEl.textContent = String(placed);
      state.score += 100; scoreEl.textContent = String(state.score);
      if (placed === state.pieces.length) win();
    }
  }

  function win(){
    state.score += 250; scoreEl.textContent = String(state.score);
    const ok = document.createElement('div');
    ok.textContent='✅ Ponte completato!';
    Object.assign(ok.style,{position:'fixed',left:'50%',top:'14px',transform:'translateX(-50%)',background:'#0f5132',color:'#fff',padding:'10px 14px',borderRadius:'10px',zIndex:20});
    document.body.appendChild(ok); setTimeout(()=>ok.remove(),1600);
  }

  // ==== timer & loop ====
  function loop(t){
    if (state.started){
      const s=Math.floor((t-state.t0)/1000);
      timeEl.textContent = (''+Math.floor(s/60)).padStart(2,'0')+':'+(''+(s%60)).padStart(2,'0');
    }
    controls.update(); renderer.render(scene,camera);
    requestAnimationFrame(loop);
  }
  buildTargets(); requestAnimationFrame(loop);

  // ==== bind UI ====
  startBtn.addEventListener('click', start);
  btnReset.addEventListener('click', reset);
})();
