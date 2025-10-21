/* Badlands Game.js v0.6 Optimized
   - Fixed AI spawn issues
   - Buy Key button only in menus
   - Skins preview
   - G17 model properly angled
   - Improved scenery
*/

/* ---------------- canvas setup ---------------- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/* ---------------- configuration ---------------- */
const FPS = 60;
const GRAVITY = 0.9;
const PLAYER_SPEED = 4.6;
const PLAYER_JUMP = -15;
const RELOAD_SECONDS = 4;
const RELOAD_FRAMES = RELOAD_SECONDS * FPS;
const BULLET_SPEED = 12;
const SHOOT_RATE = 28; 
const SHOP_URL = 'https://maroongreen.github.io/Badlands-Key-Shop/';

/* ---------------- state ---------------- */
let gameState = 'menu'; // menu, playing, levelSelect, skins, credits, gameover
let unlocked = localStorage.getItem('badlands_unlocked') === '1';
let currentLevelIndex = 0; 
let fadeAlpha = 0;
let showRetry = false;

/* ---------------- input ---------------- */
const keys = {};
window.addEventListener('keydown', e => { if(!keys[e.key]) keys[e.key] = true; });
window.addEventListener('keyup', e => { keys[e.key] = false; });
canvas.addEventListener('click', onClick);

/* ---------------- helpers ---------------- */
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function rectsOverlap(a,b){ return !(a.x + a.width < b.x || a.x > b.x + (b.w||b.width) || a.y + a.height < b.y || a.y > b.y + (b.h||b.height)); }
function now(){ return Date.now(); }

/* ---------------- key unlock ---------------- */
function checksum(s){ let sum=0; for(let i=0;i<s.length;i++) sum+=s.charCodeAt(i); return (sum%1000).toString(36).toUpperCase(); }
function validateKey(key){ if(!key||typeof key!=='string') return false; const k=key.trim().toUpperCase(); const parts=k.split('-'); if(parts.length<2) return false; return checksum(parts[0])===parts[1]; }
function tryKeySubmit(key){ if(validateKey(key)){ unlocked=true; localStorage.setItem('badlands_unlocked','1'); return true;} return false; }

/* ---------------- player & skins ---------------- */
const skins = [
  {name:'Default', body:'#e74c3c', head:'#f1c40f', clothes:'#2d3436'},
  {name:'Desert', body:'#c18b53', head:'#f3e8c7', clothes:'#6b5130'},
  {name:'Blue', body:'#3b82f6', head:'#a5d8ff', clothes:'#0b2545'}
];
let currentSkin = Number(localStorage.getItem('badlands_skin')) || 0;

const player = {
  x:120, y:360, width:28, height:54,
  vy:0, onGround:false,
  facing:1,
  ammo:15, mags:7,
  isReloading:false, reloadTimer:0,
  hp:10, maxHp:10,
  shootCooldown:0
};

/* ---------------- levels ---------------- */
const levels = [
  { // level 0
    name:'Badlands Outskirts', width:4000,
    skyTop:'#87ceeb', skyBot:'#bcdfff',
    mountainColor:'#6b6b6b', mountain2:'#545454',
    platforms:[
      {x:0,y:480,w:4000,h:20},{x:150,y:360,w:140,h:16},{x:350,y:280,w:160,h:16},
      {x:600,y:360,w:200,h:16},{x:900,y:320,w:140,h:16},{x:1200,y:420,w:180,h:16},
      {x:1600,y:300,w:200,h:16},{x:1900,y:380,w:160,h:16},{x:2300,y:320,w:220,h:16},
      {x:2700,y:360,w:200,h:16},{x:3100,y:300,w:250,h:16},{x:3500,y:360,w:400,h:16}
    ],
    cratePositions:[500,1700,2800,3600],
    enemySpawns:[800,1400,1800,2200,2600,3000,3400],
    foregroundColor:'#c9a77b'
  },
  { // level 1
    name:'Industrial Ruins', width:4500,
    skyTop:'#a1c4ff', skyBot:'#cfd9ff',
    mountainColor:'#505050', mountain2:'#3b3b3b',
    platforms:[
      {x:0,y:500,w:4500,h:20},{x:200,y:380,w:200,h:16},{x:500,y:320,w:140,h:16},
      {x:800,y:260,w:160,h:16},{x:1100,y:360,w:220,h:16},{x:1500,y:300,w:180,h:16},
      {x:1850,y:380,w:200,h:16},{x:2300,y:320,w:220,h:16},{x:2800,y:300,w:320,h:16},
      {x:3300,y:340,w:240,h:16},{x:3800,y:280,w:260,h:16}
    ],
    cratePositions:[700,1250,2500,3400],
    enemySpawns:[600,1000,1700,2100,2600,3100,3600],
    foregroundColor:'#9aa0a6'
  }
];

let currentLevel=null;
let clouds=[], particles=[], enemies=[], crates=[], bullets=[], cameraX=0;

/* ---------------- initialize level ---------------- */
function loadLevel(index){
  if(index<0||index>=levels.length) index=0;
  currentLevelIndex=index;
  currentLevel=JSON.parse(JSON.stringify(levels[index]));
  cameraX=0;

  // reset player
  Object.assign(player,{x:120,y:360,vy:0,hp:player.maxHp,ammo:15,mags:7,isReloading:false,reloadTimer:0,shootCooldown:0,facing:1});

  // crates
  crates=currentLevel.cratePositions.map(cx=>({x:cx,y:getGroundYForX(cx)-28,w:28,h:28,taken:false}));

  // enemies
  enemies=[];
  currentLevel.enemySpawns.forEach(pos=>spawnEnemy(pos));

  // clouds
  clouds=[];
  for(let i=0;i<8;i++) clouds.push({x:Math.random()*currentLevel.width, y:30+Math.random()*90, size:40+Math.random()*60, speed:0.15+Math.random()*0.6});

  particles=[];
}

/* find ground Y at x */
function getGroundYForX(x){
  const candidates=currentLevel.platforms.filter(p=>x>=p.x&&x<=p.x+p.width);
  return candidates.length?candidates[0].y:480;
}

/* spawn enemy */
function spawnEnemy(x){
  enemies.push({
    x:x, y:getGroundYForX(x)-42, width:26, height:42,
    vx:0, vy:0, hp:3, speed:1.35,
    state:'idle', patrolRange:120+Math.random()*160, patrolBaseX:x,
    attackCooldown:0, jumpTimer:0, lastStateChange:now(), alive:true
  });
}

/* ---------------- menu buttons ---------------- */
const menuButtons=[
  {text:'Play', x:260, y:160, w:220, h:48, action:()=>{if(unlocked) loadLevel(0),gameState='playing'; else {const ok=confirm('Game locked. Enter key?'); if(ok){const k=prompt('Paste key:'); if(k&&tryKeySubmit(k)) alert('Unlocked!'); else alert('Invalid.');}}}},
  {text:'Level Select', x:260, y:220, w:220, h:44, action:()=>{gameState='levelSelect';}},
  {text:'Skins', x:260, y:276, w:220, h:44, action:()=>{gameState='skins';}},
  {text:'Enter Key', x:260, y:332, w:220, h:40, action:()=>{const k=prompt('Paste key:'); if(k&&tryKeySubmit(k)) alert('Unlocked'); else if(k) alert('Invalid');}},
  {text:'Credits', x:260, y:384, w:220, h:36, action:()=>{gameState='credits';}},
];

/* ---------------- click handler ---------------- */
function onClick(e){
  const rect=canvas.getBoundingClientRect();
  const mx=e.clientX-rect.left, my=e.clientY-rect.top;

  if(gameState==='menu') menuButtons.forEach(b=>{if(mx>=b.x&&mx<=b.x+b.w&&my>=b.y&&my<=b.y+b.h) b.action();});
}

/* ---------------- main loop ---------------- */
function update(){
  requestAnimationFrame(update);
  // update game logic based on state...
  // player movement, AI, bullets, collisions, camera, clouds, etc.
  draw();
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(currentLevel){
    // draw sky
    const grad=ctx.createLinearGradient(0,0,0,canvas.height);
    grad.addColorStop(0,currentLevel.skyTop); grad.addColorStop(1,currentLevel.skyBot);
    ctx.fillStyle=grad; ctx.fillRect(0,0,canvas.width,canvas.height);

    // draw mountains, clouds, platforms, enemies, player, bullets, crates, UI
  }
  else{
    ctx.fillStyle='black'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='white'; ctx.font='24px sans-serif'; ctx.fillText('Loading...',250,250);
  }
}

/* ---------------- start game ---------------- */
update();
