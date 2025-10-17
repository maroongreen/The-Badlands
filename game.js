const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game state
let gameState = "menu"; // menu, playing, credits, controls, updates

// Controls
const keys = {};
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);
canvas.addEventListener("click", handleClick);

// Buttons
const buttons = [
  {text: "Play", x: 300, y: 150, width: 200, height: 50, action: () => gameState = "playing"},
  {text: "Credits", x: 300, y: 220, width: 200, height: 50, action: () => gameState = "credits"},
  {text: "Controls", x: 300, y: 290, width: 200, height: 50, action: () => gameState = "controls"},
  {text: "Update Log", x: 300, y: 360, width: 200, height: 50, action: () => gameState = "updates"}
];

// Player
const player = {
  x: 50,
  y: 400,
  width: 30,
  height: 50,
  colorBody: '#e74c3c',
  colorHead: '#f1c40f',
  vy: 0,
  onGround: false,
  ammo: 15,
  mags: 7,
  facing: 1
};

const gravity = 0.8;
const bullets = [];
const bulletSpeed = 12;
let shootCooldown = 0;
const shootRate = 20;

// Level and scrolling
let cameraX = 0;
const levelWidth = 2000;
const platforms = [
  {x:0, y:480, width:2000, height:20},
  {x:150, y:380, width:100, height:15},
  {x:350, y:300, width:120, height:15},
  {x:600, y:400, width:150, height:15},
  {x:900, y:350, width:100, height:15},
  {x:1200, y:450, width:150, height:15}
];

// Mouse click for menu navigation
function handleClick(e){
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if(gameState === "menu"){
    buttons.forEach(btn => {
      if(mx >= btn.x && mx <= btn.x + btn.width &&
         my >= btn.y && my <= btn.y + btn.height){
        btn.action();
      }
    });
  } else if(gameState !== "playing"){
    gameState = "menu"; // return to menu from other screens
  }
}

// Update loop
function update() {
  if(gameState !== "playing") return;

  if(keys['ArrowLeft']) { player.x -= 5; player.facing = -1; }
  if(keys['ArrowRight']) { player.x += 5; player.facing = 1; }
  if(keys['ArrowUp'] && player.onGround){ player.vy = -15; player.onGround = false; }

  player.vy += gravity;
  player.y += player.vy;

  // Platform collision
  player.onGround = false;
  for(let p of platforms){
    if(player.x + player.width > p.x &&
       player.x < p.x + p.width &&
       player.y + player.height > p.y &&
       player.y + player.height < p.y + p.height + 20 &&
       player.vy >= 0){
      player.y = p.y - player.height;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // Shooting
  if(shootCooldown > 0) shootCooldown--;
  if(keys[' '] && player.ammo > 0 && shootCooldown === 0){
    bullets.push({x: player.x + player.width/2, y: player.y + 25, vx: bulletSpeed * player.facing});
    player.ammo--;
    shootCooldown = shootRate;
  }

  // Reload
  if(keys['r'] && player.mags > 0 && player.ammo < 15){
    const needed = 15 - player.ammo;
    player.ammo += needed;
    player.mags--;
    keys['r'] = false;
  }

  // Update bullets
  for(let i=bullets.length-1;i>=0;i--){
    bullets[i].x += bullets[i].vx;
    if(bullets[i].x < cameraX || bullets[i].x > cameraX + canvas.width) bullets.splice(i,1);
  }

  // Camera
  cameraX = player.x - 200;
  if(cameraX < 0) cameraX = 0;
  if(cameraX + canvas.width > levelWidth) cameraX = levelWidth - canvas.width;
}

// Draw loop
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // --- MAIN MENU ---
  if(gameState === "menu"){
    ctx.fillStyle = "#1abc9c";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "48px Arial";
    ctx.fillText("Platform Shooter", 180, 100);

    buttons.forEach(btn => {
      ctx.fillStyle = "#34495e";
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.fillStyle = "white";
      ctx.font = "24px Arial";
      ctx.fillText(btn.text, btn.x + 40, btn.y + 32);
    });
    return; // stop here, don’t draw game
  }

  // --- CREDITS / CONTROLS / UPDATES ---
  if(gameState === "credits" || gameState === "controls" || gameState === "updates"){
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "28px Arial";

    if(gameState === "credits") ctx.fillText("Credits", 350, 100);
    else if(gameState === "controls") ctx.fillText("Controls", 350, 100);
    else ctx.fillText("Update Log", 330, 100);

    ctx.font = "20px Arial";
    if(gameState === "credits"){
      ctx.fillText("Made by: Maroonstykl (General_brock14153 / mrmythrl)", 300, 200);
    } else if(gameState === "controls"){
      ctx.fillText("Arrow Left/Right: Move", 280, 200);
      ctx.fillText("Arrow Up: Jump", 280, 240);
      ctx.fillText("Space: Shoot", 280, 280);
      ctx.fillText("R: Reload", 280, 320);
    } else if(gameState === "updates"){
      ctx.fillText("v0.1 - Basic player, gun, platforms", 220, 200);
      ctx.fillText("v0.2 - Ammo UI, smoother shooting", 220, 240);
      ctx.fillText("v0.3 - Better visuals", 220, 280);
    }
    ctx.fillText("Click anywhere to return", 270, 400);
    return;
  }

  // --- GAMEPLAY ---
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Platforms
  ctx.fillStyle = '#654321';
  platforms.forEach(p => ctx.fillRect(p.x - cameraX, p.y, p.width, p.height));

  // Player body & head
  ctx.fillStyle = player.colorBody;
  ctx.fillRect(player.x - cameraX, player.y + 10, player.width, player.height - 10);
  ctx.fillStyle = player.colorHead;
  ctx.fillRect(player.x - cameraX + 5, player.y, player.width - 10, 10);

  // Gun
  ctx.fillStyle = 'black';
  if(player.facing === 1){
    ctx.fillRect(player.x - cameraX + player.width, player.y + 20, 20, 5);
    ctx.fillRect(player.x - cameraX + player.width + 10, player.y + 23, 5, 10);
  } else {
    ctx.fillRect(player.x - cameraX - 20, player.y + 20, 20, 5);
    ctx.fillRect(player.x - cameraX - 15, player.y + 23, 5, 10);
  }

  // Bullets
  ctx.fillStyle = 'yellow';
  bullets.forEach(b => ctx.fillRect(b.x - cameraX, b.y, 10, 4));

  // --- Ammo/Mags UI ---
  const uiX = canvas.width - 160;
  const uiY = canvas.height - 40;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(uiX, uiY, 150, 30);

  ctx.fillStyle = 'yellow';
  ctx.font = '16px Arial';
  let ammoSymbols = 'Ammo'.repeat(player.ammo);
  let magsSymbols = 'Mags'.repeat(player.mags);
  ctx.fillText(`Ammo: ${ammoSymbols} / Mags: ${magsSymbols}`, uiX + 5, uiY + 20);
}

// Game loop
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
