const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Controls
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// Player
const player = {
  x: 50,
  y: 400,
  width: 30,
  height: 50,
  color: '#e74c3c',
  vy: 0,
  onGround: false,
  ammo: 15,
  mags: 7
};

const gravity = 0.8;
const bullets = [];
const bulletSpeed = 12;

// Shooting rate
let shootCooldown = 0; // frames until next bullet can be fired
const shootRate = 10;  // lower = faster fire rate

// Level and scrolling
let cameraX = 0;
const levelWidth = 2000; // Level length
const platforms = [
  {x:0, y:480, width:2000, height:20}, // ground
  {x:150, y:380, width:100, height:15},
  {x:350, y:300, width:120, height:15},
  {x:600, y:400, width:150, height:15},
  {x:900, y:350, width:100, height:15},
  {x:1200, y:450, width:150, height:15}
];

// Update loop
function update() {
  // Move player
  if(keys['ArrowLeft']) player.x -= 5;
  if(keys['ArrowRight']) player.x += 5;

  // Jump
  if(keys['ArrowUp'] && player.onGround){
    player.vy = -15;
    player.onGround = false;
  }

  // Gravity
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
    bullets.push({x: player.x + player.width, y: player.y + 20, vx: bulletSpeed});
    player.ammo--;
    shootCooldown = shootRate;
  }

  // Reload
  if(keys['r'] && player.mags > 0 && player.ammo < 15){
    const needed = 15 - player.ammo;
    player.ammo += needed;
    player.mags--;
    keys['r'] = false; // prevent repeated reload
  }

  // Update bullets
  for(let i=bullets.length-1;i>=0;i--){
    bullets[i].x += bullets[i].vx;
    if(bullets[i].x > cameraX + canvas.width) bullets.splice(i,1);
  }

  // Camera follows player
  cameraX = player.x - 200;
  if(cameraX < 0) cameraX = 0;
  if(cameraX + canvas.width > levelWidth) cameraX = levelWidth - canvas.width;
}

// Draw loop
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Background
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Platforms
  ctx.fillStyle = '#654321';
  platforms.forEach(p => ctx.fillRect(p.x - cameraX, p.y, p.width, p.height));

  // Player
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x - cameraX, player.y, player.width, player.height);

  // Gun (simple rectangle)
  ctx.fillStyle = 'black';
  ctx.fillRect(player.x - cameraX + player.width, player.y + 20, 20, 5);

  // Bullets
  ctx.fillStyle = 'yellow';
  bullets.forEach(b => ctx.fillRect(b.x - cameraX, b.y, 10, 4));

  // Ammo UI
  ctx.fillStyle = 'white';
  ctx.font = '18px Arial';
  ctx.fillText(`Ammo: ${player.ammo} | Mags: ${player.mags}`, 10, 30);
}

// Game loop
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
