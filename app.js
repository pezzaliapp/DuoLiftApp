console.log("✅ DuoLiftApp JS caricato");
// Minimal demo to confirm canvas works
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
function fit(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight*0.8;
}
window.addEventListener('resize', fit); fit();
ctx.fillStyle = '#0b5fff';
ctx.fillRect(50,50,200,200);
ctx.fillStyle = '#fff';
ctx.font = '20px sans-serif';
ctx.fillText('DuoLiftApp v3', 60,150);
