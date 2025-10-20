/* The Badlands — game.js (v0.4 + key unlock)
   - All gameplay features from v0.4 (scenery, enemies, crates, reload, gameover)
   - Adds a client-side key unlock system (localStorage)
   - Use "Enter Key" in the menu to paste a key and unlock.
   NOTE: This is only a cosmetic/local unlock (not secure).
*/

// -------------------- canvas setup --------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// -------------------- state --------------------
let gameState = "menu"; // menu, playing, credits, controls, updates, gameover
let fadeAlpha = 0; // for game over
let showRetry = false;

// -------------------- KEY UNLOCK (client-side demo) --------------------
// checksum: same algorithm used by the demo shop
function checksum(str){
  let sum = 0;
  for(let i=0;i<str.length;i++) sum += str.charCodeAt(i);
  return (sum % 1000).toString(36).toUpperCase();
}
function validateKey(key){
  if(!key || typeof key !== 'string') return false;
  key = key.trim().toUpperCase();
  const parts = key.split('-');
  if(parts.length !== 2) return false;
  return checksum(parts[0]) === parts[1];
}
function tryKeySubmit(key){
  if(validateKey(key)){
    localStorage.setItem('badlands_unlocked','1');
    unlocked = true;
    alert('Key valid — game unlocked!');
    return true;
  } else {
    alert('Key invalid.');
    return false;
  }
}
let unlocked = localStorage.getItem('badlands_unlocked') === '1';

// -------------------- input --------------------
const keys = {};
document.addEventListener("keydown", e => { if(!keys[e.key]) keys[e.key] = true; });
document.addEventListener("keyup", e => { keys[e.key] = false; });
canvas.addEventListener("click", handleClick);

// Prevent continuous triggers for single-press actions
const inputEdge = {
  wantReload: false,
  wantInteract: false,
  justDidInteract: false
};

// -------------------- player --------------------
const player = {
  x: 100,
  y: 380,
  width: 30,
  height: 50,
  colorBody: "#e74c3c",
  colorHead: "#f1c40f",
  vy: 0,
  onGround: false,
  ammo: 15,
  mags: 7,
  facing: 1,
  hp: 10,
  maxHp: 10,
  isReloading: false,
  reloadTimer: 0 // frames
};

// reload time: 4 seconds -> convert to frames (assuming 60fps)
const FPS = 60;
const reloadTimeFrames = 4 * FPS;

// -------------------- shooting --------------------
const bullets = [];
let shootCooldown = 0;
const shootRate = 30; // frames between shots (slower)
const bulletSpeed = 10;

// -------------------- level & camera --------------------
let cameraX = 0;
const levelWidth = 4000;
const platforms = [
  { x: 0, y: 480, width: 4000, height: 20 },
  { x: 150, y: 360, width: 140, height: 16 },
  { x: 350, y: 280, width: 160, height: 16 },
  { x: 600, y: 360, width: 200, height: 16 },
  { x: 900, y: 320, width: 140, height: 16 },
  { x: 1200, y: 420, width: 180, height: 16 },
  { x: 1600, y: 300, width: 200, height: 16 },
  { x: 1900, y: 380, width: 160, height: 16 },
  { x: 2300, y: 320, width: 220, height: 16 },
  { x: 2700, y: 360, width: 200, height: 16 },
  { x: 3100, y: 300, width: 250, height: 16 },
  { x: 3500, y: 360, width: 400, height: 16 }
];

// -------------------- scenery --------------------
const clouds = [];
for (let i = 0; i < 8; i++) {
  clouds.push({
    x: Math.random() * levelWidth,
    y: 30 + Math.random() * 80,
    size: 50 + Math.random() * 60,
    speed: 0.2 + Math.random() * 0.5
  });
}

// mountains (simple layered silhouette)
const mountains = [
  { x: 0, y: 220, w: levelWidth, color: "#6b6b6b", height: 200 },
  { x: 0, y: 260, w: levelWidth, color: "#545454", height: 160 }
];

// -------------------- enemies (soldier bots) --------------------
const enemies = [];
const enemySpawnPoints = [800, 1400, 1800, 2200, 2600, 3000, 3400]; // x positions
function spawnEnemyAt(x) {
  enemies.push({
    x,
    y: 420,
    width: 26,
    height: 42,
    vx: 0,
    hp: 3,
    speed: 1.2,
    attackRange: 30,
    attackCooldown: 0,
    alive: true
  });
}
enemySpawnPoints.forEach(spawnEnemyAt);

// -------------------- ammo crates --------------------
const crates = [
  { x: 500, y: 420, w: 28, h: 28, taken: false },
  { x: 1700, y: 260, w: 28, h: 28, taken: false },
  { x: 2800, y: 320, w: 28, h: 28, taken: false },
  { x: 3600, y: 320, w: 28, h: 28, taken: false }
];

// -------------------- UI / menu buttons --------------------
// menu buttons: Play (requires unlock), Enter Key, Credits, Controls, Update Log
const buttons = [
  { text: "Play", x: 300, y: 140, width: 200, height: 50, action: () => {
      if(unlocked) startNewGame();
      else {
        const doPrompt = confirm("Game is locked. Press OK to enter a key, or Cancel to return to menu.");
        if(doPrompt){
          const k = prompt("Enter your game key:");
          if(k) tryKeySubmit(k);
        }
      }
    }
  },
  { text: "Enter Key", x: 300, y: 210, width: 200, height: 44, action: () => {
      const k = prompt("Paste your game key:");
      if(k) tryKeySubmit(k);
    }
  },
  { text: "Credits", x: 300, y: 270, width: 200, height: 44, action: () => (gameState = "credits") },
  { text: "Controls", x: 300, y: 330, width: 200, height: 44, action: () => (gameState = "controls") },
  { text: "Update Log", x: 300, y: 390, width: 200, height: 44, action: () => (gameState = "updates") }
];

function startNewGame() {
  // reset player & world state for a new run
  player.x = 100;
  player.y = 380;
  player.hp = player.maxHp;
  player.ammo = 15;
  player.mags = 7;
  player.isReloading = false;
  player.reloadTimer = 0;
  bullets.length = 0;
  enemies.length = 0;
  enemySpawnPoints.forEach(spawnEnemyAt);
  crates.forEach(c => (c.taken = false));
  cameraX = 0;
  gameState = "playing";
  fadeAlpha = 0;
  showRetry = false;
}

// --------------- helpers -------------------
function rectsOverlap(a, b) {
  return !(a.x + a.width < b.x || a.x > b.x + (b.w || b.width) || a.y + a.height < b.y || a.y > b.y + (b.h || b.height));
}

// -------------------- input click handler --------------------
function handleClick(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (gameState === "menu") {
    buttons.forEach(btn => {
      if (mx >= btn.x && mx <= btn.x + btn.width && my >= btn.y && my <= btn.y + btn.height) {
        btn.action();
      }
    });
    return;
  }

  if (gameState === "gameover" && showRetry) {
    // retry button area (center)
    const rx = canvas.width / 2 - 80;
    const ry = canvas.height / 2 + 50;
    if (mx >= rx && mx <= rx + 160 && my >= ry && my <= ry + 40) {
      startNewGame();
    }
    return;
  }

  // clicking on credits/controls/updates returns to menu
  if (gameState === "credits" || gameState === "controls" || gameState === "updates") {
    gameState = "menu";
  }
}

// -------------------- game update --------------------
function update() {
  // edge triggers
  if (!inputEdge.wantReload && keys["r"]) inputEdge.wantReload = true;
  if (!inputEdge.wantInteract && keys["e"]) inputEdge.wantInteract = true;

  if (gameState === "playing") {
    // movement
    if (keys["ArrowLeft"]) {
      player.x -= 4.5;
      player.facing = -1;
    }
    if (keys["ArrowRight"]) {
      player.x += 4.5;
      player.facing = 1;
    }

    // jump
    if (keys["ArrowUp"] && player.onGround) {
      player.vy = -14.5;
      player.onGround = false;
    }

    // gravity
    player.vy += 0.8;
    player.y += player.vy;

    // collisions with platforms
    player.onGround = false;
    for (let p of platforms) {
      if (
        player.x + player.width > p.x &&
        player.x < p.x + p.width &&
        player.y + player.height > p.y &&
        player.y + player.height < p.y + p.height + 20 &&
        player.vy >= 0
      ) {
        player.y = p.y - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }

    // keep player inside level
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > levelWidth) player.x = levelWidth - player.width;

    // shooting cooldown
    if (shootCooldown > 0) shootCooldown--;
    if (keys[" "] && player.ammo > 0 && shootCooldown === 0 && !player.isReloading) {
      bullets.push({ x: player.x + player.width / 2, y: player.y + 26, vx: bulletSpeed * player.facing });
      player.ammo--;
      shootCooldown = shootRate;
    }

    // reload: start on key press (press R to begin)
    if (keys["r"] && !player.isReloading && player.mags > 0 && player.ammo < 15) {
      player.isReloading = true;
      player.reloadTimer = reloadTimeFrames;
    }

    if (player.isReloading) {
      player.reloadTimer--;
      if (player.reloadTimer <= 0) {
        player.isReloading = false;
        // complete reload: fill magazine (one mag)
        if (player.mags > 0) {
          player.mags--;
          player.ammo = 15;
        }
      }
    }

    // interact (press E)
    if (keys["e"]) {
      // only trigger once per press using guard
      if (!inputEdge.justDidInteract) {
        inputEdge.justDidInteract = true;
        // find nearby crate
        for (let c of crates) {
          if (!c.taken && Math.abs((c.x + c.w / 2) - (player.x + player.width / 2)) < 40 && Math.abs(c.y - player.y) < 50) {
            c.taken = true;
            player.mags = Math.min(player.mags + 1, 99); // cap mags
            break;
          }
        }
      }
    } else {
      inputEdge.justDidInteract = false;
    }

    // bullets update & collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].x += bullets[i].vx;
      // bullet collision with enemies
      for (let en of enemies) {
        if (!en.alive) continue;
        const bulletRect = { x: bullets[i].x, y: bullets[i].y, width: 10, height: 4 };
        const enemyRect = { x: en.x, y: en.y, width: en.width, height: en.height };
        if (rectsOverlap(bulletRect, enemyRect)) {
          en.hp--;
          bullets.splice(i, 1);
          // small stun on hit
          en.vx = 0;
          if (en.hp <= 0) {
            en.alive = false;
          }
          break;
        }
      }
      // remove offscreen (safety)
      if (i < bullets.length && (bullets[i].x < cameraX - 50 || bullets[i].x > cameraX + canvas.width + 50)) {
        bullets.splice(i, 1);
      }
    }

    // enemies AI
    for (let en of enemies) {
      if (!en.alive) continue;
      // simple ground position: ensure en is on ground (snap)
      en.y = 420; // ground y for soldiers (simple)
      const dx = player.x - en.x;
      const dist = Math.abs(dx);
      if (dist > en.attackRange) {
        en.vx = Math.sign(dx) * en.speed;
        en.x += en.vx;
      } else {
        en.vx = 0;
        if (en.attackCooldown <= 0) {
          player.hp -= 1;
          en.attackCooldown = 60; // 1s cooldown
        }
      }
      if (en.attackCooldown > 0) en.attackCooldown--;
    }

    // death condition
    if (player.hp <= 0) {
      player.hp = 0;
      gameState = "gameover";
      fadeAlpha = 0;
      showRetry = false;
    }

    // camera follow
    cameraX = player.x - 220;
    if (cameraX < 0) cameraX = 0;
    if (cameraX + canvas.width > levelWidth) cameraX = levelWidth - canvas.width;

    return;
  }

  // other states: nothing to update
}

// -------------------- draw --------------------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- MENU ---
  if (gameState === "menu") {
    ctx.fillStyle = "#0f0f10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = "#f39c12";
    ctx.font = "64px Impact";
    ctx.textAlign = "center";
    ctx.fillText("THE BADLANDS", canvas.width / 2, 100);

    // subtitle
    ctx.fillStyle = "#bdc3c7";
    ctx.font = "16px Arial";
    ctx.fillText("v0.4 — The Badlands (Demo)", canvas.width / 2, 130);

    // buttons
    buttons.forEach(btn => {
      ctx.fillStyle = "#2c3e50";
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.fillStyle = "white";
      ctx.font = "22px Arial";
      ctx.textAlign = "left";
      ctx.fillText(btn.text, btn.x + 60, btn.y + 33);
    });

    // unlocked status
    ctx.textAlign = "center";
    ctx.fillStyle = unlocked ? "#2ecc71" : "#e74c3c";
    ctx.font = "18px Arial";
    ctx.fillText(unlocked ? "UNLOCKED" : "LOCKED - Enter Key to Play", canvas.width / 2, 220);

    // footer credits
    ctx.fillStyle = "#95a5a6";
    ctx.font = "14px Arial";
    ctx.fillText("Made by: Maroonstykl (General_brock14153 / mrmythrl)", canvas.width / 2, canvas.height - 30);
    ctx.textAlign = "left";
    return;
  }

  // --- CREDITS / CONTROLS / UPDATES ---
  if (gameState === "credits" || gameState === "controls" || gameState === "updates") {
    ctx.fillStyle = "#13202a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "48px Impact";
    ctx.fillText(gameState === "credits" ? "CREDITS" : gameState === "controls" ? "CONTROLS" : "UPDATE LOG", canvas.width / 2, 100);
    ctx.font = "20px Arial";
    if (gameState === "credits") {
      ctx.fillText("Made by: Maroonstykl (General_brock14153 / mrmythrl)", canvas.width / 2, 240);
    } else if (gameState === "controls") {
      ctx.fillText("← →  Move", canvas.width / 2, 200);
      ctx.fillText("↑  Jump", canvas.width / 2, 240);
      ctx.fillText("Space  Shoot", canvas.width / 2, 280);
      ctx.fillText("R  Reload (4s)", canvas.width / 2, 320);
      ctx.fillText("E  Interact / Pickup", canvas.width / 2, 360);
    } else {
      ctx.fillText("v0.4 - Enemies, crates, scenery, gameover", canvas.width / 2, 200);
      ctx.fillText("v0.3 - Menus and visuals", canvas.width / 2, 240);
      ctx.fillText("v0.2 - Ammo and shooting", canvas.width / 2, 280);
    }
    ctx.fillText("Click anywhere to return", canvas.width / 2, canvas.height - 60);
    ctx.textAlign = "left";
    return;
  }

  // --- GAMEPLAY DRAW ---
  // sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#87ceeb");
  grad.addColorStop(1, "#bcdfff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // mountains (parallax)
  mountains.forEach((m, i) => {
    ctx.fillStyle = m.color;
    const step = 300;
    for (let sx = -cameraX * (0.2 + i * 0.1); sx < canvas.width + 400; sx += step) {
      ctx.beginPath();
      ctx.moveTo(sx - 150, canvas.height - m.height - 40);
      ctx.lineTo(sx + 0, canvas.height - m.height - 140);
      ctx.lineTo(sx + 150, canvas.height - m.height - 40);
      ctx.closePath();
      ctx.fill();
    }
  });

  // clouds
  clouds.forEach(c => {
    const cx = c.x - cameraX * 0.3;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(cx, c.y, c.size * 0.9, c.size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    c.x += c.speed;
    if (c.x - cameraX > levelWidth + 200) c.x = -200 + Math.random() * 100;
  });

  // platforms
  ctx.fillStyle = "#654321";
  platforms.forEach(p => ctx.fillRect(p.x - cameraX, p.y, p.width, p.height));

  // crates
  crates.forEach(c => {
    if (c.taken) return;
    const cx = c.x - cameraX;
    ctx.fillStyle = "#9aa0a6";
    ctx.fillRect(cx, c.y, c.w, c.h);
    ctx.strokeStyle = "#6b6f73";
    ctx.strokeRect(cx, c.y, c.w, c.h);
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(cx + 10, c.y + 6, 8, 2);
    ctx.fillRect(cx + 13, c.y + 3, 2, 8);
    const dist = Math.abs((c.x + c.w / 2) - (player.x + player.width / 2));
    if (!c.taken && dist < 60 && Math.abs(c.y - player.y) < 50) {
      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      ctx.fillText("Press E to pick mag", cx - 10, c.y - 8);
    }
  });

  // bullets
  ctx.fillStyle = "yellow";
  bullets.forEach(b => ctx.fillRect(b.x - cameraX, b.y, 10, 4));

  // enemies
  enemies.forEach(en => {
    if (!en.alive) return;
    const ex = en.x - cameraX;
    const ey = en.y;
    ctx.fillStyle = "#2d3436";
    ctx.fillRect(ex, ey, en.width, en.height);
    ctx.fillStyle = "#b2bec3";
    ctx.fillRect(ex + 4, ey - 10, en.width - 8, 8);
    ctx.fillStyle = "#2d3436";
    ctx.fillRect(ex + 6, ey - 8, en.width - 12, 4);
    ctx.fillStyle = "#1b1b1b";
    if (en.x < player.x) ctx.fillRect(ex + en.width, ey + 18, 14, 4);
    else ctx.fillRect(ex - 14, ey + 18, 14, 4);
    const hpW = (en.hp / 3) * en.width;
    ctx.fillStyle = "red";
    ctx.fillRect(ex, ey - 8, hpW, 4);
    ctx.strokeStyle = "black";
    ctx.strokeRect(ex, ey - 8, en.width, 4);
  });

  // player draw
  ctx.fillStyle = player.colorBody;
  ctx.fillRect(player.x - cameraX, player.y + 10, player.width, player.height - 10);
  ctx.fillStyle = player.colorHead;
  ctx.fillRect(player.x - cameraX + 5, player.y, player.width - 10, 10);

  // gun
  ctx.fillStyle = "#111";
  if (player.facing === 1) {
    ctx.fillRect(player.x - cameraX + player.width, player.y + 20, 22, 6);
    ctx.fillRect(player.x - cameraX + player.width + 12, player.y + 26, 6, 10);
  } else {
    ctx.fillRect(player.x - cameraX - 22, player.y + 20, 22, 6);
    ctx.fillRect(player.x - cameraX - 18, player.y + 26, 6, 10);
  }

  // muzzle flash
  if (shootCooldown > shootRate - 4 && bullets.length > 0) {
    ctx.fillStyle = "rgba(255,215,0,0.9)";
    if (player.facing === 1) ctx.fillRect(player.x - cameraX + player.width + 22, player.y + 16, 12, 12);
    else ctx.fillRect(player.x - cameraX - 34, player.y + 16, 12, 12);
  }

  // health bar
  const hpX = 20;
  const hpY = 20;
  const hpW = 160;
  ctx.fillStyle = "#222";
  ctx.fillRect(hpX - 2, hpY - 2, hpW + 4, 22);
  ctx.fillStyle = "red";
  ctx.fillRect(hpX, hpY, (player.hp / player.maxHp) * hpW, 18);
  ctx.strokeStyle = "#111";
  ctx.strokeRect(hpX - 2, hpY - 2, hpW + 4, 22);
  ctx.fillStyle = "white";
  ctx.font = "14px Arial";
  ctx.fillText(`HP: ${player.hp} / ${player.maxHp}`, hpX + hpW + 10, hpY + 14);

  // ammo UI numeric (bottom-right)
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(canvas.width - 200, canvas.height - 40, 180, 32);
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`Ammo: ${player.ammo}   |   Mags: ${player.mags}`, canvas.width - 20, canvas.height - 20);
  ctx.textAlign = "left";

  // reload indicator
  if (player.isReloading) {
    const pct = 1 - player.reloadTimer / reloadTimeFrames;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(canvas.width - 200, canvas.height - 40, 180 * pct, 32);
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText("Reloading...", canvas.width - 180, canvas.height - 22);
  }

  // hint
  ctx.fillStyle = "#ffffffcc";
  ctx.font = "12px Arial";
  ctx.fillText("Press E to interact with crates. Press R to reload.", 20, canvas.height - 10);
}

// -------------------- game over draw --------------------
function drawGameOver() {
  fadeAlpha += 0.01;
  if (fadeAlpha > 1) fadeAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ee4b2b";
  ctx.font = "64px Impact";
  ctx.textAlign = "center";
  ctx.fillText("YOU DIED", canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText("The Badlands claim another soul...", canvas.width / 2, canvas.height / 2 + 10);

  if (fadeAlpha >= 1) {
    showRetry = true;
    const rx = canvas.width / 2 - 80;
    const ry = canvas.height / 2 + 50;
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(rx, ry, 160, 40);
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("Retry", canvas.width / 2, ry + 26);
  }
}

// -------------------- main loop --------------------
function loop() {
  update();
  if (gameState === "gameover") {
    draw();
    drawGameOver();
  } else {
    draw();
  }
  requestAnimationFrame(loop);
}

// -------------------- start --------------------
loop();
