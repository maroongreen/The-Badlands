/* The Badlands — game.js (v0.4 enhanced)
   - Polished visuals + UI fixes
   - Enemies can parkour/jump to reachable platforms
   - Enemies only attack when vertically near or after successful parkour
   - Ammo crates, E interaction, reloading (4s), health, gameover
   - Client-side key unlock integrated
*/

// ---------- Canvas ----------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---------- Config ----------
const FPS = 60;
const RELOAD_SECONDS = 4;
const reloadFrames = RELOAD_SECONDS * FPS;
const GRAVITY = 0.8;
const PLAYER_SPEED = 4.5;
const PLAYER_JUMP = -14.5;

// ---------- State ----------
let gameState = 'menu'; // menu, playing, credits, controls, updates, gameover
let unlocked = localStorage.getItem('badlands_unlocked') === '1';
let fadeAlpha = 0;
let showRetry = false;

// ---------- Input ----------
const keys = {};
window.addEventListener('keydown', e => { if(!keys[e.key]) keys[e.key] = true; });
window.addEventListener('keyup', e => { keys[e.key] = false; });
canvas.addEventListener('click', onClick);

// ---------- Helpers ----------
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function rectsOverlap(a,b){ return !(a.x + a.width < b.x || a.x > (b.x + (b.w || b.width)) || a.y + a.height < b.y || a.y > (b.y + (b.h || b.height))); }

// ---------- Key unlock (same algorithm as shop) ----------
function checksum(str){
  let sum=0;
  for(let i=0;i<str.length;i++) sum+=str.charCodeAt(i);
  return (sum % 1000).toString(36).toUpperCase();
}
function validateKey(key){
  if(!key || typeof key !== 'string') return false;
  const k = key.trim().toUpperCase();
  const parts = k.split('-');
  if(parts.length !== 2) return false;
  return checksum(parts[0]) === parts[1];
}
function tryKeySubmit(key){
  if(validateKey(key)){
    unlocked = true;
    localStorage.setItem('badlands_unlocked','1');
    return true;
  }
  return false;
}

// ---------- Player ----------
const player = {
  x: 100, y: 380, width: 30, height: 50,
  colorBody:'#e74c3c', colorHead:'#f1c40f',
  vy:0, onGround:false,
  ammo:15, mags:7, facing:1,
  hp:10, maxHp:10,
  isReloading:false, reloadTimer:0
};

// ---------- Level ----------
let cameraX = 0;
const levelWidth = 4000;
const platforms = [
  {x:0,y:480,width:4000,height:20},
  {x:150,y:360,width:140,height:16},
  {x:350,y:280,width:160,height:16},
  {x:600,y:360,width:200,height:16},
  {x:900,y:320,width:140,height:16},
  {x:1200,y:420,width:180,height:16},
  {x:1600,y:300,width:200,height:16},
  {x:1900,y:380,width:160,height:16},
  {x:2300,y:320,width:220,height:16},
  {x:2700,y:360,width:200,height:16},
  {x:3100,y:300,width:250,height:16},
  {x:3500,y:360,width:400,height:16}
];

// ---------- Scenery ----------
const clouds = [];
for(let i=0;i<8;i++){
  clouds.push({x:Math.random()*levelWidth,y:30+Math.random()*80,size:50+Math.random()*60,speed:0.2+Math.random()*0.5});
}
const mountains = [{color:'#6b6b6b',height:200},{color:'#545454',height:160}];

// ---------- Enemies (soldier bots) ----------
const enemies = [];
const enemySpawnPoints = [800, 1400, 1800, 2200, 2600, 3000, 3400];
function spawnEnemyAt(x){
  enemies.push({
    x, y:420, width:26, height:42, vx:0, hp:3, speed:1.2,
    attackRange:30, attackCooldown:0, alive:true,
    targetPlatformIndex: null, jumpTimer:0
  });
}
function resetEnemies(){
  enemies.length = 0;
  enemySpawnPoints.forEach(spawnEnemyAt);
}
resetEnemies();

// ---------- Crates ----------
const crates = [
  {x:500,y:420,w:28,h:28,taken:false},
  {x:1700,y:260,w:28,h:28,taken:false},
  {x:2800,y:320,w:28,h:28,taken:false},
  {x:3600,y:320,w:28,h:28,taken:false}
];

// ---------- Bullets ----------
const bullets = [];
let shootCooldown = 0;
const shootRate = 30;
const bulletSpeed = 10;

// ---------- Menu Buttons (positions) ----------
const menuButtons = [
  {text:'Play', x:300,y:140,w:200,h:50, action: ()=> {
    if(unlocked) startNewGame();
    else {
      const ok = confirm('Game is locked. Enter key now?');
      if(ok){
        const k = prompt('Paste game key:');
        if(k && tryKeySubmit(k)){
          alert('Unlocked! Press Play again or start now.');
        } else alert('Invalid key.');
      }
    }
  }},
  {text:'Enter Key', x:300,y:210,w:200,h:44, action: ()=> {
    const k = prompt('Paste game key:');
    if(k && tryKeySubmit(k)) alert('Unlocked!');
    else if(k) alert('Invalid key.');
  }},
  {text:'Credits', x:300,y:270,w:200,h:44, action: ()=> gameState='credits'},
  {text:'Controls', x:300,y:330,w:200,h:44, action: ()=> gameState='controls'},
  {text:'Update Log', x:300,y:390,w:200,h:44, action: ()=> gameState='updates'}
];

function startNewGame(){
  player.x = 100; player.y = 380; player.vy=0; player.hp = player.maxHp;
  player.ammo = 15; player.mags = 7; player.isReloading=false; player.reloadTimer=0; player.facing=1;
  bullets.length = 0; crates.forEach(c=>c.taken=false); resetEnemies();
  cameraX = 0; gameState='playing'; fadeAlpha=0; showRetry=false;
}

// ---------- Click handling ----------
function onClick(e){
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if(gameState === 'menu'){
    menuButtons.forEach(b=>{
      if(mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) b.action();
    });
    return;
  }
  if(gameState === 'gameover' && showRetry){
    const rx = canvas.width/2 - 80, ry = canvas.height/2 + 50;
    if(mx>=rx && mx<=rx+160 && my>=ry && my<=ry+40) startNewGame();
    return;
  }
  if(gameState === 'credits' || gameState === 'controls' || gameState === 'updates'){
    gameState = 'menu';
  }
}

// ---------- Enemy parkour/jump helper ----------
function findPlatformUnder(x, y){
  for(let i=0;i<platforms.length;i++){
    const p=platforms[i];
    if(x >= p.x && x <= p.x+p.width && Math.abs(y - p.y) < 100) return i;
  }
  return -1;
}
// can enemy jump from px->target p? returns boolean
function canEnemyJumpFromTo(enemy, fromPlatformIdx, toPlatformIdx){
  if(fromPlatformIdx < 0 || toPlatformIdx < 0) return false;
  const from = platforms[fromPlatformIdx];
  const to = platforms[toPlatformIdx];
  // horizontal and vertical differences
  const dx = (to.x + to.width/2) - (from.x + from.width/2 || from.x + from.width/2);
  const dy = to.y - from.y;
  // enemy jump capability tuned: horizontal within 220, up to 140 vertical
  return Math.abs(dx) < 240 && dy > -150; // allow jumping up if dy > -150 (target not too high)
}

// ---------- Update ----------
function update(){
  // global input edge guards (not needed for everything now)
  if(gameState === 'playing'){
    // movement
    if(keys['ArrowLeft']) { player.x -= PLAYER_SPEED; player.facing = -1; }
    if(keys['ArrowRight']) { player.x += PLAYER_SPEED; player.facing = 1; }
    if(keys['ArrowUp'] && player.onGround) { player.vy = PLAYER_JUMP; player.onGround=false; }

    // gravity & apply
    player.vy += GRAVITY; player.y += player.vy;

    // platform collision for player
    player.onGround = false;
    for(const p of platforms){
      if(player.x + player.width > p.x && player.x < p.x + p.width &&
         player.y + player.height > p.y && player.y + player.height < p.y + p.height + 20 && player.vy >= 0){
        player.y = p.y - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }

    // clamp inside level
    player.x = clamp(player.x, 0, levelWidth - player.width);

    // shooting
    if(shootCooldown > 0) shootCooldown--;
    if(keys[' '] && player.ammo > 0 && shootCooldown === 0 && !player.isReloading){
      bullets.push({x: player.x + player.width/2, y: player.y + 26, vx: bulletSpeed * player.facing});
      player.ammo--; shootCooldown = shootRate;
    }

    // reload on press (start)
    if(keys['r'] && !player.isReloading && player.mags > 0 && player.ammo < 15){
      player.isReloading = true; player.reloadTimer = reloadFrames;
    }
    if(player.isReloading){
      player.reloadTimer--;
      if(player.reloadTimer <= 0){ player.isReloading=false; if(player.mags>0){ player.mags--; player.ammo=15; } }
    }

    // interact E - once per press
    if(keys['e']){
      if(!keys._ePrev){
        // attempt pickups
        for(const c of crates){
          if(!c.taken && Math.abs((c.x + c.w/2) - (player.x + player.width/2)) < 40 && Math.abs(c.y - player.y) < 50){
            c.taken = true; player.mags = clamp(player.mags + 1, 0, 99);
            break;
          }
        }
      }
      keys._ePrev = true;
    } else keys._ePrev = false;

    // bullets update & collisions
    for(let i=bullets.length-1;i>=0;i--){
      const b = bullets[i];
      b.x += b.vx;
      // collide with enemies
      for(const en of enemies){
        if(!en.alive) continue;
        const br = {x:b.x,y:b.y,width:10,height:4};
        const er = {x:en.x,y:en.y,width:en.width,height:en.height};
        if(rectsOverlap(br,er)){
          en.hp--; bullets.splice(i,1);
          en.vx = 0; // stun a bit
          if(en.hp <= 0) en.alive = false;
          break;
        }
      }
      // offscreen removal relative to camera bounds to be generous
      if(i < bullets.length && (b.x < cameraX - 100 || b.x > cameraX + canvas.width + 100)) bullets.splice(i,1);
    }

    // ENEMY AI with parkour/jumping
    for(const en of enemies){
      if(!en.alive) continue;

      // basic ground base y
      en.y = 420; // keep simple baseline

      // compute horizontal distance
      const dx = player.x - en.x;
      const dist = Math.abs(dx);

      // find nearest platform indices for enemy and player
      const enPlat = findPlatformUnder(en.x, en.y+en.height);
      const plPlat = findPlatformUnder(player.x, player.y+player.height);

      // If enemy can see player on same platform or ground and is near, move
      // If player is on higher platform and within limited horizontal range, attempt parkour: find path to platform
      en.targetPlatformIndex = null;

      // If player is above by a reasonable amount and within horizontal reach, try jump to their platform
      if(plPlat !== -1 && enPlat !== -1 && plPlat !== enPlat){
        if(canEnemyJumpFromTo(en, enPlat, plPlat)){
          // try to move toward edge to jump (very simple)
          const targetCenter = platforms[plPlat].x + platforms[plPlat].width/2;
          // move toward player's x to align, then attempt jump when close enough
          if(Math.abs(player.x - en.x) > en.attackRange){
            en.vx = Math.sign(dx) * en.speed;
            en.x += en.vx;
          } else {
            // attempt "jump": small upward impulse and forward move
            if(en.jumpTimer <= 0){
              en.jumpTimer = 30; // frames in jump state
              en.vy = -12; // enemy jump (not simulated vertical with collisions for simplicity)
            }
          }
        } else {
          // cannot jump to player's platform: walk toward player on ground
          if(dist > en.attackRange) { en.vx = Math.sign(dx) * en.speed; en.x += en.vx; }
          else { en.vx = 0; }
        }
      } else {
        // same platform or no platform info: simple approach
        if(dist > en.attackRange) { en.vx = Math.sign(dx) * en.speed; en.x += en.vx; }
        else { en.vx = 0; }
      }

      // attack if close AND vertically near (prevent hitting player on higher platform unless enemy reached)
      const verticalDelta = Math.abs(en.y - player.y);
      if(dist <= en.attackRange + 8 && verticalDelta < 40){
        if(en.attackCooldown <= 0){
          player.hp -= 1; en.attackCooldown = 60;
        }
      }

      if(en.attackCooldown > 0) en.attackCooldown--;
      if(en.jumpTimer > 0) {
        // simulate small forward movement when in jump mode
        en.jumpTimer--;
        en.x += Math.sign(dx) * (en.speed * 1.6);
      }

      // clamp enemy inside level
      en.x = clamp(en.x, 0, levelWidth - en.width);
    }

    // death check
    if(player.hp <= 0){
      player.hp = 0; gameState = 'gameover'; fadeAlpha = 0; showRetry=false;
    }

    // camera follow
    cameraX = player.x - 220;
    cameraX = clamp(cameraX, 0, levelWidth - canvas.width);
    return;
  }

  // no heavy updates for menus
}

// ---------- Draw ----------
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(gameState === 'menu'){
    // background
    ctx.fillStyle = '#0f0f10'; ctx.fillRect(0,0,canvas.width,canvas.height);
    // title
    ctx.fillStyle = '#f39c12'; ctx.font = '64px Impact'; ctx.textAlign='center';
    ctx.fillText('THE BADLANDS', canvas.width/2, 100);
    ctx.font = '14px Arial'; ctx.fillStyle='#bdc3c7';
    ctx.fillText('v0.4 — Demo', canvas.width/2, 132);

    // buttons
    ctx.textAlign='left';
    for(const b of menuButtons){
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.fillText(b.text, b.x + 36, b.y + 30);
    }

    // unlocked/locked indicator
    ctx.textAlign='center'; ctx.font='18px Arial';
    ctx.fillStyle = unlocked ? '#2ecc71' : '#e74c3c';
    ctx.fillText(unlocked ? 'UNLOCKED' : 'LOCKED - Enter Key to Play', canvas.width/2, 220);

    // footer credits centered
    ctx.fillStyle='#95a5a6'; ctx.font='12px Arial';
    ctx.fillText('Made by: Maroonstykl (General_brock14153 / mrmythrl)', canvas.width/2, canvas.height - 30);
    ctx.textAlign='left';
    return;
  }

  if(gameState === 'credits' || gameState === 'controls' || gameState === 'updates'){
    ctx.fillStyle = '#13202a'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'white'; ctx.textAlign='center';
    ctx.font = '48px Impact';
    ctx.fillText(gameState === 'credits' ? 'CREDITS' : gameState === 'controls' ? 'CONTROLS' : 'UPDATE LOG', canvas.width/2, 100);
    ctx.font='20px Arial';
    if(gameState === 'credits'){
      ctx.fillText('Made by: Maroonstykl (General_brock14153 / mrmythrl)', canvas.width/2, 240);
    } else if(gameState === 'controls'){
      ctx.fillText('← →  Move', canvas.width/2, 200); ctx.fillText('↑  Jump', canvas.width/2, 240);
      ctx.fillText('Space  Shoot', canvas.width/2, 280); ctx.fillText('R  Reload (4s)', canvas.width/2, 320);
      ctx.fillText('E  Interact / Pickup', canvas.width/2, 360);
    } else {
      ctx.fillText('v0.4 - Enemies, crates, scenery, gameover', canvas.width/2, 200);
      ctx.fillText('v0.3 - Menus and visuals', canvas.width/2, 240);
      ctx.fillText('v0.2 - Ammo and shooting', canvas.width/2, 280);
    }
    ctx.fillText('Click anywhere to return', canvas.width/2, canvas.height - 60);
    ctx.textAlign='left';
    return;
  }

  // ---------- Gameplay draw ----------
  // sky gradient
  const grad = ctx.createLinearGradient(0,0,0,canvas.height);
  grad.addColorStop(0,'#87ceeb'); grad.addColorStop(1,'#bcdfff');
  ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width,canvas.height);

  // mountains parallax
  mountains.forEach((m,i)=>{
    ctx.fillStyle = m.color;
    const step = 300;
    for(let sx = -cameraX*(0.2 + i*0.1); sx < canvas.width+400; sx += step){
      ctx.beginPath();
      ctx.moveTo(sx - 150, canvas.height - m.height - 40);
      ctx.lineTo(sx, canvas.height - m.height - 140);
      ctx.lineTo(sx + 150, canvas.height - m.height - 40);
      ctx.closePath(); ctx.fill();
    }
  });

  // clouds
  clouds.forEach(c=>{
    const cx = c.x - cameraX*0.3;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.ellipse(cx, c.y, c.size*0.9, c.size*0.55, 0,0,Math.PI*2); ctx.fill();
    c.x += c.speed; if(c.x - cameraX > levelWidth + 200) c.x = -200 + Math.random()*100;
  });

  // platforms
  ctx.fillStyle = '#654321';
  platforms.forEach(p => ctx.fillRect(p.x - cameraX, p.y, p.width, p.height));

  // crates
  for(const c of crates){
    if(c.taken) continue;
    const cx = c.x - cameraX;
    ctx.fillStyle = '#9aa0a6'; ctx.fillRect(cx, c.y, c.w, c.h);
    ctx.strokeStyle = '#6b6f73'; ctx.strokeRect(cx, c.y, c.w, c.h);
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(cx + 10, c.y + 6, 8, 2); ctx.fillRect(cx + 13, c.y + 3, 2, 8);
    const dist = Math.abs((c.x + c.w/2) - (player.x + player.width/2));
    if(dist < 60 && Math.abs(c.y - player.y) < 50){
      ctx.fillStyle = 'white'; ctx.font='12px Arial'; ctx.fillText('Press E to pick mag', cx - 10, c.y - 8);
    }
  }

  // bullets
  ctx.fillStyle = 'yellow'; for(const b of bullets) ctx.fillRect(b.x - cameraX, b.y, 10, 4);

  // enemies
  for(const en of enemies){
    if(!en.alive) continue;
    const ex = en.x - cameraX, ey = en.y;
    // body
    ctx.fillStyle = '#2d3436'; ctx.fillRect(ex, ey, en.width, en.height);
    // helmet/head
    ctx.fillStyle = '#b2bec3'; ctx.fillRect(ex + 4, ey - 10, en.width - 8, 8);
    ctx.fillStyle = '#2d3436'; ctx.fillRect(ex + 6, ey - 8, en.width - 12, 4);
    // gun
    ctx.fillStyle = '#1b1b1b';
    if(en.x < player.x) ctx.fillRect(ex + en.width, ey + 18, 14, 4);
    else ctx.fillRect(ex - 14, ey + 18, 14, 4);
    // hp bar
    const hpW = (en.hp / 3) * en.width;
    ctx.fillStyle = 'red'; ctx.fillRect(ex, ey - 8, hpW, 4);
    ctx.strokeStyle = 'black'; ctx.strokeRect(ex, ey - 8, en.width, 4);
  }

  // player
  ctx.fillStyle = player.colorBody; ctx.fillRect(player.x - cameraX, player.y + 10, player.width, player.height - 10);
  ctx.fillStyle = player.colorHead; ctx.fillRect(player.x - cameraX + 5, player.y, player.width - 10, 10);

  // gun
  ctx.fillStyle = '#111';
  if(player.facing === 1){
    ctx.fillRect(player.x - cameraX + player.width, player.y + 20, 22, 6);
    ctx.fillRect(player.x - cameraX + player.width + 12, player.y + 26, 6, 10);
  } else {
    ctx.fillRect(player.x - cameraX - 22, player.y + 20, 22, 6);
    ctx.fillRect(player.x - cameraX - 18, player.y + 26, 6, 10);
  }

  // muzzle flash
  if(shootCooldown > shootRate - 4 && bullets.length > 0){
    ctx.fillStyle = 'rgba(255,215,0,0.9)';
    if(player.facing === 1) ctx.fillRect(player.x - cameraX + player.width + 22, player.y + 16, 12, 12);
    else ctx.fillRect(player.x - cameraX - 34, player.y + 16, 12, 12);
  }

  // health bar top-left
  const hpX = 20, hpY = 20, hpW = 160;
  ctx.fillStyle = '#222'; ctx.fillRect(hpX - 2, hpY - 2, hpW + 4, 22);
  ctx.fillStyle = 'red'; ctx.fillRect(hpX, hpY, (player.hp / player.maxHp) * hpW, 18);
  ctx.strokeStyle = '#111'; ctx.strokeRect(hpX - 2, hpY - 2, hpW + 4, 22);
  ctx.fillStyle = 'white'; ctx.font='14px Arial'; ctx.fillText(`HP: ${player.hp} / ${player.maxHp}`, hpX + hpW + 10, hpY + 14);

  // ammo/mags bottom-right (tidy)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(canvas.width - 220, canvas.height - 44, 200, 36);
  ctx.fillStyle = 'white'; ctx.font = '16px Arial'; ctx.textAlign='right';
  ctx.fillText(`Ammo: ${player.ammo}   |   Mags: ${player.mags}`, canvas.width - 28, canvas.height - 18);
  ctx.textAlign='left';

  // reload indicator
  if(player.isReloading){
    const pct = 1 - player.reloadTimer / reloadFrames;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(canvas.width - 220, canvas.height - 44, 200 * pct, 36);
    ctx.fillStyle = 'white'; ctx.font='12px Arial'; ctx.fillText('Reloading...', canvas.width - 188, canvas.height - 22);
  }

  // bottom hint
  ctx.fillStyle = '#ffffffcc'; ctx.font='12px Arial'; ctx.fillText('Press E to interact with crates. Press R to reload.', 20, canvas.height - 10);
}

// ---------- GameOver overlay ----------
function drawGameOver(){
  fadeAlpha += 0.01; if(fadeAlpha > 1) fadeAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`; ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle = '#ee4b2b'; ctx.font='64px Impact'; ctx.textAlign='center';
  ctx.fillText('YOU DIED', canvas.width/2, canvas.height/2 - 20);
  ctx.fillStyle='white'; ctx.font='20px Arial'; ctx.fillText('The Badlands claim another soul...', canvas.width/2, canvas.height/2 + 10);

  if(fadeAlpha >= 1){
    showRetry = true;
    const rx = canvas.width/2 - 80, ry = canvas.height/2 + 50;
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(rx, ry, 160, 40);
    ctx.fillStyle = 'white'; ctx.font='20px Arial'; ctx.fillText('Retry', canvas.width/2, ry + 26);
  }
}

// ---------- main loop ----------
function loop(){
  update();
  if(gameState === 'gameover'){
    draw(); drawGameOver();
  } else draw();
  requestAnimationFrame(loop);
}

// ---------- Start ----------
loop();

/* 
  Notes / tuning:
  - Enemy parkour is simplified: they attempt to jump to player's platform if horizontal distance within ~240 px and vertical isn't extremely high.
  - Enemy won't "hit" player if player is safely high on an unreachable platform — they will try to get there if possible.
  - Tweak enemy.speed, player speeds, and canEnemyJumpFromTo logic to change difficulty.
*/
