
export async function boot(){
  const [{default:THREE}, {OrbitControls}] = await Promise.all([
    import('https://unpkg.com/three@0.160.0/build/three.module.js'),
    import('https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js')
  ]);
  const canvas = document.getElementById('webgl');
  const placedEl = document.getElementById('placed');
  const totalEl = document.getElementById('total');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const intro = document.getElementById('intro');
  const btnReset = document.getElementById('btnReset');

  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  function setSize(){ renderer.setSize(window.innerWidth, window.innerHeight-56); camera.aspect = window.innerWidth/(window.innerHeight-56); camera.updateProjectionMatrix(); }
  const scene = new THREE.Scene(); scene.background = null;
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100); camera.position.set(3.8,2.2,5.2);
  setSize(); window.addEventListener('resize', setSize);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.08; controls.target.set(0,0.8,0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, .9)); const dir = new THREE.DirectionalLight(0xffffff,.8); dir.position.set(3,6,5); scene.add(dir);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10,10), new THREE.MeshStandardMaterial({color:0x0b1324, roughness:.95}));
  ground.rotation.x = -Math.PI/2; ground.position.y=0; scene.add(ground);
  const grid = new THREE.GridHelper(10, 20, 0x2a3350, 0x1a2038); grid.position.y = 0.001; scene.add(grid);

  const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(); const dragPlane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
  let dragging=null, dragOffset=new THREE.Vector3();

  const state = { started:false, t0:0, score:0, pieces:[], targets:[] };

  const M = {
    base:  new THREE.MeshStandardMaterial({color:0xa6adc8, metalness:.2, roughness:.6}),
    col:   new THREE.MeshStandardMaterial({color:0x70b2ff, metalness:.2, roughness:.5}),
    arm:   new THREE.MeshStandardMaterial({color:0x9dd1ff, metalness:.2, roughness:.5}),
    acc:   new THREE.MeshStandardMaterial({color:0x7fe3a6, metalness:.2, roughness:.4}),
    ctrl:  new THREE.MeshStandardMaterial({color:0xe3e37f, metalness:.2, roughness:.4}),
    ghost: new THREE.MeshStandardMaterial({color:0xffffff, opacity:.15, transparent:true})
  };
  const box = (w,h,d,mat)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.userData.size=[w,h,d]; return m; };
  const setPos = (o,[x,y,z])=>{ o.position.set(x,y,z); return o; };

  function buildTargets(){
    const t=[
      {id:'base',pos:[0,0.09,0],rotY:0,size:[3.2,0.18,0.6],mat:M.base},
      {id:'colL',pos:[-1.0,1.2,0],rotY:0,size:[0.18,2.4,0.24],mat:M.col},
      {id:'colR',pos:[ 1.0,1.2,0],rotY:0,size:[0.18,2.4,0.24],mat:M.col},
      {id:'motor',pos:[ 1.25,0.9,0.3],rotY:0,size:[0.18,0.5,0.2],mat:M.acc},
      {id:'control',pos:[ 1.25,1.5,0.3],rotY:0,size:[0.14,0.36,0.12],mat:M.ctrl},
      {id:'armL_1',pos:[-0.82,0.5,0],rotY:0,size:[0.8,0.12,0.12],mat:M.arm},
      {id:'armL_2',pos:[-0.22,0.5,0],rotY:0,size:[0.5,0.10,0.10],mat:M.arm},
      {id:'armL_3',pos:[ 0.20,0.5,0],rotY:0,size:[0.3,0.08,0.08],mat:M.arm},
      {id:'armR_1',pos:[ 0.82,0.5,0],rotY:Math.PI,size:[0.8,0.12,0.12],mat:M.arm},
      {id:'armR_2',pos:[ 0.22,0.5,0],rotY:Math.PI,size:[0.5,0.10,0.10],mat:M.arm},
      {id:'armR_3',pos:[-0.20,0.5,0],rotY:Math.PI,size:[0.3,0.08,0.08],mat:M.arm},
    ];
    for(const g of t){ const ghost=box(...g.size,M.ghost); setPos(ghost,g.pos); ghost.rotation.y=g.rotY; ghost.name='ghost:'+g.id; scene.add(ghost); }
    state.targets=t;
  }

  function buildPieces(){
    const startZ=2.6; const rnd=(a,b)=>a+Math.random()*(b-a);
    for(const g of state.targets){
      const mesh=box(...g.size,g.mat); mesh.name=g.id;
      mesh.position.set(rnd(-2.5,2.5), rnd(0.2,1.2), startZ + rnd(-1.2,1.2));
      mesh.rotation.y=0; mesh.userData={id:g.id, placed:false, target:g};
      scene.add(mesh); state.pieces.push(mesh);
    }
    totalEl.textContent=String(state.pieces.length);
  }

  function reset(){
    for(const m of state.pieces){ scene.remove(m); }
    state.pieces=[]; state.score=0; scoreEl.textContent='0'; placedEl.textContent='0';
    buildPieces();
  }

  function start(){ if(state.started) return; state.started=true; state.t0=performance.now(); intro.style.display='none'; reset(); }

  function setMouse(e){
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
    mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
  }
  const mouse = new THREE.Vector2(), raycaster = new THREE.Raycaster(); const dragPlane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
  let dragging=null, dragOffset=new THREE.Vector3();

  renderer.domElement.addEventListener('pointerdown', (e)=>{
    setMouse(e); raycaster.setFromCamera(mouse,camera);
    const hits = raycaster.intersectObjects(state.pieces.filter(p=>!p.userData.placed));
    if(hits.length){ dragging=hits[0].object;
      dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0), new THREE.Vector3(0, dragging.position.y, 0));
      const hitPoint=new THREE.Vector3(); raycaster.ray.intersectPlane(dragPlane, hitPoint);
      dragOffset.copy(hitPoint).sub(dragging.position); controls.enabled=false; }
  });
  renderer.domElement.addEventListener('pointermove', (e)=>{
    if(!dragging) return; setMouse(e); raycaster.setFromCamera(mouse,camera);
    const hitPoint=new THREE.Vector3(); if(raycaster.ray.intersectPlane(dragPlane, hitPoint)){ dragging.position.copy(hitPoint.sub(dragOffset)); }
  });
  renderer.domElement.addEventListener('pointerup', ()=>{
    if(dragging){ trySnap(dragging); } dragging=null; controls.enabled=true;
  });
  window.addEventListener('keydown',(e)=>{ if(!dragging) return; if(e.key.toLowerCase()==='q') dragging.rotation.y-=Math.PI/12; if(e.key.toLowerCase()==='e') dragging.rotation.y+=Math.PI/12; });

  function trySnap(mesh){
    const t=mesh.userData.target;
    const posOk = mesh.position.distanceTo(new THREE.Vector3(...t.pos)) < 0.18;
    const angOk = Math.abs(((mesh.rotation.y - t.rotY + Math.PI)%(2*Math.PI))-Math.PI) < (Math.PI/18);
    if(posOk && angOk){ mesh.position.set(...t.pos); mesh.rotation.y=t.rotY; mesh.userData.placed=true;
      state.score+=100; scoreEl.textContent=String(state.score);
      placedEl.textContent=String(state.pieces.filter(p=>p.userData.placed).length);
      checkWin();
    }
  }
  function checkWin(){
    if(state.pieces.every(p=>p.userData.placed)){ toast('✅ Ponte completato!'); state.score+=250; scoreEl.textContent=String(state.score); }
  }
  function toast(msg){
    const el=document.createElement('div'); el.textContent=msg; el.style.position='fixed'; el.style.left='50%'; el.style.top='16px';
    el.style.transform='translateX(-50%)'; el.style.background='#0f5132'; el.style.color='#fff'; el.style.padding='10px 14px'; el.style.borderRadius='10px';
    el.style.boxShadow='0 8px 30px rgba(0,0,0,.35)'; el.style.zIndex='20'; document.body.appendChild(el); setTimeout(()=>el.remove(),1600);
  }
  function animate(){ controls.update(); renderer.render(scene,camera); requestAnimationFrame(animate); }
  buildTargets(); animate();
  document.getElementById('startBtn').addEventListener('click', start);
  btnReset.addEventListener('click', reset);

  // Expose for external buttons (optional)
  window.__duolift_reset = reset;
}
