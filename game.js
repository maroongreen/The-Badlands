/* The Badlands — game.js (v0.5 major upgrade)
   - Buy Game Keys button bottom-right -> opens shop
   - Improved scenery (parallax: sky gradient, clouds, mountains, foreground)
   - Stylized human player model + Glock-17-like pistol drawing
   - Smarter soldier AI: patrol, chase, jump between reachable platforms
   - Two levels + Level Menu
   - Skins Menu (change player colors)
   - Ammo crates, E interact, reload (4s), health, game over
   - Client-side key unlock kept
   - All drawing uses canvas vector primitives; no external assets
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
const SHOOT_RATE = 28; // frames
const SHOP_URL = 'https://maroongreen.github.io/Badlands-Key-Shop/';

/* ---------------- state ---------------- */
let gameState = 'menu'; // menu, playing, levelSelect, skins, credits, controls, updates, gameover
let unlocked = localStorage.getItem('badlands_unlocked') === '1';
let currentLevelIndex = 0; // 0 = level1, 1 = level2
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

/* ---------------- key unlock (same algorithm) ---------------- */
function checksum(s){
  let sum = 0;
  for(let i=0;i<s.length;i++) sum += s.charCodeAt(i);
  return (sum % 1000).toString(36).toUpperCase();
}
function validateKey(key){
  if(!key || typeof key !== 'string') return false;
  const k = key.trim().toUpperCase();
  const parts = k.split('-');
  if(parts.length < 2) return false;
  return checksum(parts[0]) === parts[1];
}
function tryKeySubmit(key){
  if(validateKey(key)){ unlocked = true; localStorage.setItem('badlands_unlocked','1'); return true; }
  return false;
}

/* ---------------- player & skins ---------------- */
const skins = [
  {name:'Default', body:'#e74c3c', head:'#f1c40f', clothes:'#2d3436'},
  {name:'Desert', body:'#c18b53', head:'#f3e8c7', clothes:'#6b5130'},
  {name:'Blue', body:'#3b82f6', head:'#a5d8ff', clothes:'#0b2545'},
];
let currentSkin = Number(localStorage.getItem('badlands_skin')) || 0;

const player = {
  x: 120, y: 360, width: 28, height: 54,
  vy:0, onGround:false,
  facing:1,
  ammo:15, mags:7,
  isReloading:false, reloadTimer:0,
  hp:10, maxHp:10,
  shootCooldown:0
};

/* ---------------- levels ---------------- */
// we'll define two levels, each with own platforms, crates, enemy spawns, sky tint
const levels = [
  { // level 0 - Badlands Outskirts
    name: 'Badlands Outskirts',
    width: 4000,
    skyTop: '#87ceeb', skyBot: '#bcdfff',
    mountainColor:'#6b6b6b', mountain2:'#545454',
    platforms: [
      {x:0,y:480,w:4000,h:20},
      {x:150,y:360,w:140,h:16},
      {x:350,y:280,w:160,h:16},
      {x:600,y:360,w:200,h:16},
      {x:900,y:320,w:140,h:16},
      {x:1200,y:420,w:180,h:16},
      {x:1600,y:300,w:200,h:16},
      {x:1900,y:380,w:160,h:16},
      {x:2300,y:320,w:220,h:16},
      {x:2700,y:360,w:200,h:16},
      {x:3100,y:300,w:250,h:16},
      {x:3500,y:360,w:400,h:16}
    ],
    cratePositions: [500, 1700, 2800, 3600],
    enemySpawns: [800, 1400, 1800, 2200, 2600, 3000, 3400],
    foregroundColor: '#c9a77b'
  },
  { // level 1 - Industrial Ruins
    name: 'Industrial Ruins',
    width: 4500,
    skyTop: '#a1c4ff', skyBot: '#cfd9ff',
    mountainColor:'#505050', mountain2:'#3b3b3b',
    platforms: [
      {x:0,y:500,w:4500,h:20},
      {x:200,y:380,w:200,h:16},
      {x:500,y:320,w:140,h:16},
      {x:800,y:260,w:160,h:16},
      {x:1100,y:360,w:220,h:16},
      {x:1500,y:300,w:180,h:16},
      {x:1850,y:380,w:200,h:16},
      {x:2300,y:320,w:220,h:16},
      {x:2800,y:300,w:320,h:16},
      {x:3300,y:340,w:240,h:16},
      {x:3800,y:280,w:260,h:16}
    ],
    cratePositions: [700, 1250, 2500, 3400],
    enemySpawns: [600, 1000, 1700, 2100, 2600, 3100, 3600],
    foregroundColor: '#9aa0a6'
  }
];

let currentLevel = null;

/* ---------------- scenery objects ---------------- */
let clouds = [];
let particles = [];

/* ---------------- enemies & crates ---------------- */
let enemies = [];
let crates = [];
let bullets = [];
let cameraX = 0;

/* ---------------- utility: initialize level ---------------- */
function loadLevel(index){
  if(index < 0 || index >= levels.length) index = 0;
  currentLevelIndex = index;
  currentLevel = JSON.parse(JSON.stringify(levels[index])); // clone
  cameraX = 0;

  // reset player
  player.x = 120;
  player.y = 360;
  player.vy = 0;
  player.hp = player.maxHp;
  player.ammo = 15;
  player.mags = 7;
  player.isReloading = false;
  player.reloadTimer = 0;
  player.shootCooldown = 0;
  player.facing = 1;

  // build platforms from level
  currentLevel.platforms = currentLevel.platforms.map(p => ({x:p.x,y:p.y,width:p.w || p.width || p.w, height:p.h || p.height || p.h}));

  // crates
  crates = currentLevel.cratePositions.map(cx => ({x:cx, y: getGroundYForX(cx) - 28, w:28, h:28, taken:false}));

  // enemies
  enemies = [];
  currentLevel.enemySpawns.forEach(pos => spawnEnemy(pos));

  // clouds
  clouds = [];
  for(let i=0;i<8;i++) clouds.push({x:Math.random() * currentLevel.width, y:30 + Math.random()*90, size:40 + Math.random()*60, speed:0.15 + Math.random()*0.6});

  // particles clear
  particles = [];
}

/* find ground Y at given x by scanning platforms */
function getGroundYForX(x){
  // choose top-most platform under a certain y
  let candidates = currentLevel.platforms.filter(p => x >= p.x && x <= p.x + p.width);
  if(candidates.length) return candidates[0].y;
  // fallback ground level
  return 480;
}

/* ---------------- spawn enemy ---------------- */
function spawnEnemy(x){
  enemies.push({
    x: x,
    y: getGroundYForX(x) - 42,
    width: 26, height: 42,
    vx: 0, vy:0,
    hp:3, speed:1.35,
    state: 'idle', // idle, patrol, chase, attack, jump
    patrolRange: 120 + Math.random()*160,
    patrolBaseX: x,
    attackCooldown: 0,
    jumpTimer: 0,
    lastStateChange: now()
  });
}

/* ---------------- menu buttons layout ---------------- */
const menuButtons = [
  {text: 'Play', x: 260, y: 160, w: 220, h: 48, action: () => { if(unlocked) loadLevel(0), gameState='playing'; else { const ok = confirm('Game locked. Enter key?'); if(ok){ const k = prompt('Paste key:'); if(k && tryKeySubmit(k)) alert('Unlocked!'); else alert('Invalid.'); } } }},
  {text: 'Level Select', x: 260, y: 220, w: 220, h: 44, action: () => { gameState = 'levelSelect'; }},
  {text: 'Skins', x: 260, y: 276, w: 220, h: 44, action: () => { gameState = 'skins'; }},
  {text: 'Enter Key', x: 260, y: 332, w: 220, h: 40, action: () => { const k = prompt('Paste key:'); if(k && tryKeySubmit(k)) alert('Unlocked'); else if(k) alert('Invalid'); }},
  {text: 'Credits', x: 260, y: 384, w: 220, h: 36, action: () => { gameState = 'credits'; }},
];

/* ---------------- click handler ---------------- */
function onClick(e){
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // In menu states, handle buttons by hit test
  if(gameState === 'menu'){
    menuButtons.forEach(b => {
      if(mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h){ b.action(); }
    });
    return;
  }
  if(gameState === 'levelSelect'){
    // level tiles listing area
    for(let i=0;i<levels.length;i++){
      const lx = 120 + i*260, ly = 160, lw = 220, lh = 120;
      if(mx >= lx && mx <= lx+lw && my >= ly && my <= ly+lh){
        loadLevel(i); gameState = 'playing'; return;
      }
    }
    // click outside returns to menu
    gameState = 'menu';
    return;
  }
  if(gameState === 'skins'){
    // skin tiles
    for(let i=0;i<skins.length;i++){
      const sx = 120 + i*200, sy = 180, sw = 160, sh = 120;
      if(mx >= sx && mx <= sx+sw && my >= sy && my <= sy+sh){
        currentSkin = i; localStorage.setItem('badlands_skin', String(currentSkin)); return;
      }
    }
    gameState = 'menu';
    return;
  }
  if(gameState === 'credits' || gameState === 'controls' || gameState === 'updates'){
    gameState = 'menu'; return;
  }

  if(gameState === 'playing'){
    // HUD buy button bottom-right
    const bx = canvas.width - 120, by = canvas.height - 56, bw = 100, bh = 40;
    if(mx >= bx && mx <= bx + bw && my >= by && my <= by + bh){
      window.open(SHOP_URL, '_blank', 'noopener');
      return;
    }
    // If in gameover & retry shown, clicking handled elsewhere
  }

  if(gameState === 'gameover' && showRetry){
    const rx = canvas.width/2 - 80, ry = canvas.height/2 + 50, rw = 160, rh = 40;
    if(mx >= rx && mx <= rx+rw && my >= ry && my <= ry+rh) { loadLevel(currentLevelIndex); gameState = 'playing'; return; }
  }
}

/* ---------------- physics helpers ---------------- */
/* find platform index under a given x and y (player feet) */
function findPlatformUnder(x, y){
  for(let i=0;i<currentLevel.platforms.length;i++){
    const p = currentLevel.platforms[i];
    if(x + 2 >= p.x && x <= p.x + p.width - 2 && Math.abs(y - p.y) < 80) return i;
  }
  return -1;
}

/* can enemy jump from platform A to platform B? */
function canJumpBetweenPlatforms(fromIdx, toIdx){
  if(fromIdx < 0 || toIdx < 0) return false;
  const from = currentLevel.platforms[fromIdx];
  const to = currentLevel.platforms[toIdx];
  const dx = (to.x + to.width/2) - (from.x + from.width/2);
  const dy = to.y - from.y;
  // allow jumps where horizontal < 260 and vertical not too high
  return Math.abs(dx) < 260 && dy > -170;
}

/* ---------------- update loop ---------------- */
function update(){
  // general input edge flags for E
  if(gameState === 'playing'){
    // horizontal movement
    if(keys['ArrowLeft']) { player.x -= PLAYER_SPEED; player.facing = -1; }
    if(keys['ArrowRight']) { player.x += PLAYER_SPEED; player.facing = 1; }
    // jump
    if(keys['ArrowUp'] && player.onGround){ player.vy = PLAYER_JUMP; player.onGround = false; }

    // gravity
    player.vy += GRAVITY; player.y += player.vy;

    // platform collision (player)
    player.onGround = false;
    for(const p of currentLevel.platforms){
      if(player.x + player.width > p.x && player.x < p.x + p.width &&
         player.y + player.height > p.y && player.y + player.height < p.y + p.height + 24 && player.vy >= 0){
        player.y = p.y - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }
    // clamp inside level
    player.x = clamp(player.x, 0, currentLevel.width - player.width);

    // shooting
    if(player.shootCooldown > 0) player.shootCooldown--;
    if(keys[' '] && player.ammo > 0 && player.shootCooldown === 0 && !player.isReloading){
      const bx = player.x + player.width/2 + (player.facing===1?18:-22);
      bullets.push({x: bx, y: player.y + 22, vx: BULLET_SPEED * player.facing});
      player.ammo--; player.shootCooldown = SHOOT_RATE;
      // particle muzzle
      particles.push({x:bx, y: player.y + 18, vx: (Math.random()-0.5)*1.5, life:12, size:6});
    }

    // reload
    if(keys['r'] && !player.isReloading && player.mags > 0 && player.ammo < 15){
      player.isReloading = true; player.reloadTimer = RELOAD_FRAMES;
    }
    if(player.isReloading){
      player.reloadTimer--;
      if(player.reloadTimer <= 0){ player.isReloading = false; if(player.mags > 0){ player.mags--; player.ammo = 15; } }
    }

    // interact E (once per press)
    if(keys['e']){
      if(!keys._ePrev){
        for(const c of crates){
          if(!c.taken && Math.abs((c.x + c.w/2) - (player.x + player.width/2)) < 44 && Math.abs(c.y - player.y) < 56){
            c.taken = true; player.mags = clamp(player.mags + 1, 0, 99);
            // effect
            particles.push({x:c.x + 14, y:c.y + 6, vx:0, life:40, size:8, color:'#ffd27f'});
            break;
          }
        }
      }
      keys._ePrev = true;
    } else keys._ePrev = false;

    // bullets update + collisions with enemies
    for(let i=bullets.length-1;i>=0;i--){
      bullets[i].x += bullets[i].vx;
      // collide with enemies
      for(const en of enemies){
        if(!en.alive) continue;
        if(rectsOverlap({x:bullets[i].x,y:bullets[i].y,width:8,height:4},{x:en.x,y:en.y,width:en.width,height:en.height})){
          en.hp--; bullets.splice(i,1);
          en.lastHit = now();
          if(en.hp <= 0) { en.alive = false; // spawn pickup particle
            particles.push({x:en.x + en.width/2, y:en.y + 10, vx:0, life:50, size:10, color:'#ff6b6b'});
          }
          break;
        }
      }
      // offscreen
      if(i < bullets.length && (bullets[i].x < cameraX - 100 || bullets[i].x > cameraX + canvas.width + 100)) bullets.splice(i,1);
    }

    // particles update
    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.x += (p.vx || 0);
      p.life--; p.size *= 0.98;
      if(p.life <= 0) particles.splice(i,1);
    }

    // enemy AI
    for(const en of enemies){
      if(!en.alive) continue;

      // simple state machine
      const dx = (player.x - en.x);
      const dist = Math.abs(dx);
      const enPlatform = findPlatformUnder(en.x, en.y + en.height);
      const plPlatform = findPlatformUnder(player.x, player.y + player.height);

      // reduce attack cooldown
      if(en.attackCooldown > 0) en.attackCooldown--;

      // choose behavior
      const timeSinceChange = now() - (en.lastStateChange || 0);
      if(en.state === 'idle'){
        // small random patrol after idle
        if(Math.random() < 0.002 || Math.abs(en.x - en.patrolBaseX) > en.patrolRange) { en.state = 'patrol'; en.lastStateChange = now(); }
        if(dist < 220) { en.state = 'chase'; en.lastStateChange = now(); }
      } else if(en.state === 'patrol'){
        // move within patrol range
        const dir = Math.sign(en.patrolBaseX - en.x + Math.sin(now()/1000 + en.patrolBaseX) * en.patrolRange * 0.5);
        en.vx = dir * en.speed * 0.6;
        en.x += en.vx;
        if(dist < 220) { en.state = 'chase'; en.lastStateChange = now(); }
        if(Math.random() < 0.002) { en.state = 'idle'; en.lastStateChange = now(); }
      } else if(en.state === 'chase'){
        // attempt to chase: if player on different platform, attempt parkour jump if possible
        if(plPlatform !== -1 && enPlatform !== -1 && plPlatform !== enPlatform && canJumpBetweenPlatforms(enPlatform, plPlatform)){
          // move toward edge to jump
          en.vx = Math.sign(dx) * en.speed * 1.1;
          en.x += en.vx;
          // if close horizontally, perform jump action simulated by forward dash
          if(Math.abs(player.x - en.x) < 40 && en.jumpTimer <= 0){
            en.jumpTimer = 22;
            en.state = 'jump';
            en.lastStateChange = now();
          }
        } else {
          // normal chase on same plane
          if(dist > en.attackRange + 6){
            en.vx = Math.sign(dx) * en.speed;
            en.x += en.vx;
          } else {
            en.vx = 0;
          }
        }
        if(dist > 700) { en.state = 'idle'; en.lastStateChange = now(); }
      } else if(en.state === 'jump'){
        // simulate jump forward/dash to reach platform
        if(en.jumpTimer > 0){
          en.jumpTimer--;
          en.x += Math.sign(dx) * (en.speed * 1.8);
        } else {
          en.state = 'chase';
        }
      }

      // attack if close AND roughly same vertical level (prevents hitting through platforms)
      const verticalDelta = Math.abs(en.y - player.y);
      if(dist <= en.attackRange + 8 && verticalDelta < 40){
        if(en.attackCooldown <= 0){
          player.hp -= 1;
          en.attackCooldown = 55; // ~0.9s
        }
        en.state = 'attack';
      }

      en.x = clamp(en.x, 0, currentLevel.width - en.width);
    }

    // death check
    if(player.hp <= 0){
      player.hp = 0; gameState = 'gameover'; fadeAlpha = 0; showRetry = false;
    }

    // camera follow
    cameraX = player.x - canvas.width/2 + 120;
    cameraX = clamp(cameraX, 0, currentLevel.width - canvas.width);

    return;
  }
}

/* ---------------- drawing helpers ---------------- */
/* draw stylized human at player.x, player.y */
function drawPlayer(px, py, facing=1){
  const skin = skins[currentSkin];
  const bodyC = skin.body, headC = skin.head, clothC = skin.clothes;
  const cx = px, cy = py;
  // legs
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(cx + 6, cy + 28, 6, 18); // left leg
  ctx.fillRect(cx + 16, cy + 28, 6, 18); // right leg
  // torso
  ctx.fillStyle = clothC;
  ctx.fillRect(cx, cy + 8, 28, 22);
  // arms
  ctx.fillStyle = bodyC;
  ctx.fillRect(cx - (facing===1?2:8), cy + 8, 8, 6); // left arm (simplified)
  ctx.fillRect(cx + 22 + (facing===1?0:2), cy + 8, 8, 6); // right arm
  // head
  ctx.fillStyle = headC;
  ctx.beginPath();
  ctx.ellipse(cx + 14, cy + 4, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // eyes simple
  ctx.fillStyle = '#111';
  ctx.fillRect(cx + (facing===1?18:8), cy + 2, 3, 2);
}

/* draw a Glock-17 like pistol at given coords; facing right if facing===1 */
function drawG17(px, py, facing=1){
  ctx.save();
  ctx.translate(px, py);
  if(facing === -1) { ctx.scale(-1,1); ctx.translate(-36,0); } // mirror
  // barrel
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(6, 8, 22, 6);
  // slide detail
  ctx.fillStyle = '#2f2f2f';
  ctx.fillRect(6, 6, 22, 4);
  // ejection port area
  ctx.fillStyle = '#111';
  ctx.fillRect(18, 7, 6, 2);
  // frame (handle)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(20, 14, 8, 14);
  // magazine lower
  ctx.fillStyle = '#111';
  ctx.fillRect(22, 26, 6, 6);
  ctx.restore();
}

/* draw ammo UI bottom-right and buy shop button */
function drawHUD(){
  // ammo / mags
  const uiW = 220, uiH = 44;
  const uiX = canvas.width - uiW - 12, uiY = canvas.height - uiH - 12;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(uiX, uiY, uiW, uiH);
  ctx.fillStyle = 'white';
  ctx.font = '16px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`Ammo: ${player.ammo}   |   Mags: ${player.mags}`, uiX + uiW - 12, uiY + 28);
  ctx.textAlign = 'left';

  // buy game keys button (bottom-right small)
  const bx = canvas.width - 120, by = canvas.height - 56, bw = 100, bh = 40;
  ctx.fillStyle = '#0b4a6f';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#aeefff';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Buy Keys', bx + bw/2, by + 25);
  ctx.textAlign = 'left';

  // reload indicator
  if(player.isReloading){
    const pct = 1 - player.reloadTimer / RELOAD_FRAMES;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(uiX, uiY, uiW * pct, uiH);
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText('Reloading...', uiX + 8, uiY + 28);
  }
}

/* draw enemies */
function drawEnemy(en){
  const ex = en.x - cameraX, ey = en.y;
  // body box
  ctx.fillStyle = '#2d3436';
  ctx.fillRect(ex, ey, en.width, en.height);
  // helmet
  ctx.fillStyle = '#b2bec3';
  ctx.fillRect(ex + 4, ey - 10, en.width - 8, 8);
  // gun
  ctx.fillStyle = '#1b1b1b';
  if(en.x < player.x) ctx.fillRect(ex + en.width, ey + 18, 14, 4);
  else ctx.fillRect(ex - 14, ey + 18, 14, 4);
  // hp bar
  const hpW = (en.hp / 3) * en.width;
  ctx.fillStyle = 'red'; ctx.fillRect(ex, ey - 8, hpW, 4);
  ctx.strokeStyle = 'black'; ctx.strokeRect(ex, ey - 8, en.width, 4);
}

/* draw background scenery */
function drawScenery(){
  // sky gradient
  const grad = ctx.createLinearGradient(0,0,0,canvas.height);
  grad.addColorStop(0, currentLevel.skyTop);
  grad.addColorStop(1, currentLevel.skyBot);
  ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width,canvas.height);

  // mountains parallax
  [currentLevel.mountainColor, currentLevel.mountain2].forEach((color, i) => {
    ctx.fillStyle = color;
    const step = 300;
    for(let sx = -cameraX * (0.15 + i*0.1); sx < canvas.width + 400; sx += step){
      ctx.beginPath();
      ctx.moveTo(sx - 150, canvas.height - (100 + i*40) - 40);
      ctx.lineTo(sx, canvas.height - (100 + i*40) - 140);
      ctx.lineTo(sx + 150, canvas.height - (100 + i*40) - 40);
      ctx.closePath();
      ctx.fill();
    }
  });

  // clouds
  clouds.forEach(c => {
    const cx = c.x - cameraX * 0.25;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(cx, c.y, c.size * 0.9, c.size * 0.5, 0, 0, Math.PI*2);
    ctx.fill();
    c.x += c.speed;
    if(c.x - cameraX > currentLevel.width + 200) c.x = -200 + Math.random()*100;
  });

  // subtle foreground tint
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
}

/* ---------------- draw main scene ---------------- */
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(gameState === 'menu'){
    // background
    ctx.fillStyle = '#0f0f10'; ctx.fillRect(0,0,canvas.width,canvas.height);
    // title
    ctx.fillStyle = '#00bfff'; ctx.font = '64px Impact'; ctx.textAlign = 'center';
    ctx.fillText('THE BADLANDS', canvas.width/2, 90);
    ctx.font = '16px Arial'; ctx.fillStyle = '#cfefff';
    ctx.fillText('v0.5 — Demo', canvas.width/2, 120);

    // menu buttons
    ctx.textAlign = 'left';
    menuButtons.forEach(b => {
      ctx.fillStyle = '#24292e';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#e8f9ff';
      ctx.font = '20px Arial';
      ctx.fillText(b.text, b.x + 18, b.y + 32);
    });

    // bottom small buy button link (also present in-game)
    ctx.fillStyle = '#0b4a6f';
    ctx.fillRect(canvas.width - 140, canvas.height - 60, 120, 36);
    ctx.fillStyle = '#aeefff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Buy Game Keys', canvas.width - 80, canvas.height - 36);

    // footer credits
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9aa4ad';
    ctx.font = '13px Arial';
    ctx.fillText('Made by: Maroonstykl (General_brock14153 / mrmythrl)', canvas.width/2, canvas.height - 16);
    ctx.textAlign = 'left';
    return;
  }

  if(gameState === 'levelSelect'){
    ctx.fillStyle = '#0e0e12'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#00bfff'; ctx.font = '44px Impact'; ctx.textAlign = 'center';
    ctx.fillText('Select Level', canvas.width/2, 80);
    // draw level cards
    for(let i=0;i<levels.length;i++){
      const lx = 120 + i*260, ly = 160, lw = 220, lh = 120;
      ctx.fillStyle = '#1a1c20'; ctx.fillRect(lx, ly, lw, lh);
      ctx.fillStyle = '#cfefff'; ctx.font = '18px Arial'; ctx.textAlign = 'left';
      ctx.fillText(levels[i].name, lx + 14, ly + 34);
      ctx.fillStyle = '#95a5a6'; ctx.font = '13px Arial';
      ctx.fillText('Click to Play', lx + 14, ly + 64);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9aa4ad'; ctx.font = '13px Arial';
    ctx.fillText('Click anywhere to return', canvas.width/2, canvas.height - 60);
    return;
  }

  if(gameState === 'skins'){
    ctx.fillStyle = '#0f1012'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#00bfff'; ctx.font = '44px Impact'; ctx.textAlign = 'center';
    ctx.fillText('Skins', canvas.width/2, 80);
    // show skin cards
    for(let i=0;i<skins.length;i++){
      const sx = 120 + i*200, sy = 180, sw = 160, sh = 120;
      ctx.fillStyle = '#101214'; ctx.fillRect(sx, sy, sw, sh);
      // draw small player preview
      drawPlayer(sx + 36, sy + 14, 1);
      // color swatch
      ctx.fillStyle = skins[i].body; ctx.fillRect(sx + 6, sy + 80, 36, 24);
      ctx.fillStyle = skins[i].clothes; ctx.fillRect(sx + 48, sy + 80, 36, 24);
      ctx.fillStyle = '#cfefff'; ctx.font = '14px Arial';
      ctx.fillText(skins[i].name, sx + 6, sy + 118);
      // highlight selected
      if(i === currentSkin){ ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, sw, sh); }
    }
    ctx.fillStyle = '#9aa4ad'; ctx.font = '13px Arial'; ctx.fillText('Click a skin to select; click outside to return', canvas.width/2, canvas.height - 60);
    ctx.textAlign = 'left';
    return;
  }

  if(gameState === 'credits' || gameState === 'controls' || gameState === 'updates'){
    ctx.fillStyle = '#101316'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'white'; ctx.font = '48px Impact'; ctx.textAlign = 'center';
    ctx.fillText(gameState === 'credits' ? 'CREDITS' : gameState === 'controls' ? 'CONTROLS' : 'UPDATE LOG', canvas.width/2, 100);
    ctx.font = '20px Arial';
    if(gameState === 'credits'){
      ctx.fillText('Made by: Maroonstykl (General_brock14153 / mrmythrl)', canvas.width/2, 240);
    } else if(gameState === 'controls'){
      ctx.fillText('← → Move', canvas.width/2, 200);
      ctx.fillText('↑ Jump', canvas.width/2, 240);
      ctx.fillText('Space Shoot', canvas.width/2, 280);
      ctx.fillText('R Reload (4s)', canvas.width/2, 320);
      ctx.fillText('E Interact', canvas.width/2, 360);
    } else {
      ctx.fillText('v0.5 - Levels, skins, smarter AI', canvas.width/2, 200);
    }
    ctx.fillText('Click anywhere to return', canvas.width/2, canvas.height - 60);
    ctx.textAlign = 'left';
    return;
  }

  // gameplay background & scenery
  drawScenery();

  // draw platforms
  ctx.fillStyle = '#654321';
  currentLevel.platforms.forEach(p => ctx.fillRect(p.x - cameraX, p.y, p.width, p.height));

  // crates
  crates.forEach(c => {
    if(c.taken) return;
    const cx = c.x - cameraX;
    ctx.fillStyle = '#9aa0a6'; ctx.fillRect(cx, c.y, c.w, c.h);
    ctx.strokeStyle = '#6b6f73'; ctx.strokeRect(cx, c.y, c.w, c.h);
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(cx + 10, c.y + 6, 8, 2); ctx.fillRect(cx + 13, c.y + 3, 2, 8);
    const dist = Math.abs((c.x + c.w/2) - (player.x + player.width/2));
    if(dist < 60 && Math.abs(c.y - player.y) < 60){
      ctx.fillStyle = 'white'; ctx.font = '12px Arial'; ctx.fillText('Press E to pick mag', cx - 6, c.y - 8);
    }
  });

  // bullets
  ctx.fillStyle = 'yellow'; bullets.forEach(b => ctx.fillRect(b.x - cameraX, b.y, 8, 4));

  // enemies
  enemies.forEach(en => { if(en.alive) drawEnemy(en); });

  // player
  drawPlayer(player.x - cameraX, player.y, player.facing);
  drawG17(player.x - cameraX + (player.facing===1?10: -14), player.y + 6, player.facing);

  // particles
  particles.forEach(p => {
    ctx.fillStyle = p.color || '#ffd27f';
    ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, Math.max(1, p.size || 3), 0, Math.PI*2); ctx.fill();
  });

  // HUD
  drawHUD();

  // health top-left
  const hpX = 18, hpY = 18, hpW = 160;
  ctx.fillStyle = '#222'; ctx.fillRect(hpX - 2, hpY - 2, hpW + 4, 22);
  ctx.fillStyle = 'red'; ctx.fillRect(hpX, hpY, (player.hp / player.maxHp) * hpW, 18);
  ctx.strokeStyle = '#111'; ctx.strokeRect(hpX - 2, hpY - 2, hpW + 4, 22);
  ctx.fillStyle = 'white'; ctx.font = '14px Arial'; ctx.fillText(`HP: ${player.hp} / ${player.maxHp}`, hpX + hpW + 10, hpY + 14);

  // hint bottom-left
  ctx.fillStyle = '#ffffffcc'; ctx.font = '12px Arial'; ctx.fillText('Press E to interact with crates. Press R to reload.', 20, canvas.height - 10);
}

/* ---------------- gameover overlay ---------------- */
function drawGameOver(){
  fadeAlpha += 0.01; if(fadeAlpha > 1) fadeAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#ee4b2b'; ctx.font = '64px Impact'; ctx.textAlign = 'center';
  ctx.fillText('YOU DIED', canvas.width/2, canvas.height/2 - 20);
  ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.fillText('The Badlands claim another soul...', canvas.width/2, canvas.height/2 + 10);
  if(fadeAlpha >= 1){
    showRetry = true;
    const rx = canvas.width/2 - 80, ry = canvas.height/2 + 50;
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(rx, ry, 160, 40);
    ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.fillText('Retry', canvas.width/2, ry + 26);
  }
}

/* ---------------- main loop ---------------- */
function loop(){
  update();
  if(gameState === 'gameover'){ draw(); drawGameOver(); }
  else draw();
  requestAnimationFrame(loop);
}

/* ---------------- initialize & start ---------------- */
function init(){
  // set canvas size to window and watch resize
  function resize(){
    canvas.width = Math.max(800, Math.min(window.innerWidth - 20, 1200));
    canvas.height = Math.max(480, Math.min(window.innerHeight - 40, 760));
  }
  resize();
  window.addEventListener('resize', resize);

  loadLevel(currentLevelIndex);
  loop();
}
init();

/* ---------------- Notes & tweak points ----------------
- Enemy AI is simplified but improved: they attempt patrol, chase, and jump actions if platform jumps are possible.
- Player & gun are stylized vector drawings; you can replace with sprite images if you want.
- Skins menu writes selected skin to localStorage ("badlands_skin").
- Level select lets you choose level; clicking outside returns to menu.
- Buy Game Keys button is in bottom-right HUD and opens SHOP_URL.
- This is a big, game-style single-file engine — if you want sounds, sprite sheets, or networked multiplayer next, I can add them.
*/
