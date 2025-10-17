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
  colorBody: '#e74c3c',
  colorHead: '#f1c40f',
  vy: 0,
  onGround: false,
  ammo: 15,
  mags: 7,
  facing: 1 // 1 = right, -1 = left
};

const gravity = 0.8;
const bullets = [];
const bulletSpeed = 12;

// Shooting rate
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

// Update loop
function update() {
  // Move player
  if(keys['ArrowLeft']){
    player.x -= 5;
    player.facing = -1;
  }
  if(keys['ArrowRight']){
    player.x += 5;
    player.facing = 1;
  }

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

  // Player body
  ctx.fillStyle = player.colorBody;
  ctx.fillRect(player.x - cameraX, player.y + 10, player.width, player.height - 10);

  // Player head
  ctx.fillStyle = player.colorHead;
  ctx.fillRect(player.x - cameraX + 5, player.y, player.width - 10, 10);

  // Gun
  ctx.fillStyle = 'black';
  if(player.facing === 1){
    // Barrel
    ctx.fillRect(player.x - cameraX + player.width, player.y + 20, 20, 5);
    // Handle
    ctx.fillRect(player.x - cameraX + player.width + 10, player.y + 23, 5, 10);
  } else {
    ctx.fillRect(player.x - cameraX - 20, player.y + 20, 20, 5);
    ctx.fillRect(player.x - cameraX - 15, player.y + 23, 5, 10);
  }

  // Bullets
  ctx.fillStyle = 'yellow';
  bullets.forEach(b => ctx.fillRect(b.x - cameraX, b.y, 10, 4));

  // Ammo UI bottom-right
  const uiX = canvas.width - 160;
  const uiY = canvas.height - 40;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(uiX, uiY, 150, 30);

  // Bullets dots
  ctx.fillStyle = 'yellow';
  for(let i=0;i<player.ammo;i++){
    ctx.fillRect(uiX + 5 + i*9, uiY + 7, 7, 16);
  }

  // Mags
  ctx.fillStyle = 'white';
  ctx.font = '16px Arial';
  ctx.fillText(`Mags: ${player.mags}`, uiX + 100, uiY + 20);
}

// Game loop
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
