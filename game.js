const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Input
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// Player
const player = {
  x: 50,
  y: 400,
  width: 40,
  height: 40,
  color: 'red',
  vy: 0,
  onGround: false,
  ammo: 15,      // bullets in current mag
  mags: 7        // extra mags
};

// Gravity
const gravity = 0.8;

// Bullets array
const bullets = [];

// Platforms
const platforms = [
  { x:0, y:480, width:800, height:20 },
  { x:100, y:350, width:150, height:15 },
  { x:300, y:250, width:200, height:15 },
  { x:600, y:400, width:150, height:15 }
];

// Update loop
function update() {
  // Player movement
  if(keys['ArrowLeft']) player.x -= 5;
  if(keys['ArrowRight']) player.x += 5;

  // Jump
  if(keys['ArrowUp'] && player.onGround) {
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
       player.vy >=0){
      player.y = p.y - player.height;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // Shooting
  if(keys[' '] && player.ammo > 0){ // Space to shoot
    if(bullets.length < 15) bullets.push({ x: player.x+player.width/2, y: player.y+player.height/2, vx: 10 });
    player.ammo--;
  }

  // Reload
  if(keys['r'] && player.mags > 0 && player.ammo < 15){
    let needed = 15 - player.ammo;
    player.mags--;
    player.ammo += needed;
  }

  // Update bullets
  for(let i=bullets.length-1;i>=0;i--){
    bullets[i].x += bullets[i].vx;
    if(bullets[i].x > canvas.width) bullets.splice(i,1);
  }
}

// Draw everything
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Background
  ctx.fillStyle = '#87ceeb'; // sky blue
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Platforms
  ctx.fillStyle = '#654321';
  platforms.forEach(p => ctx.fillRect(p.x,p.y,p.width,p.height));

  // Player
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Gun (simple rectangle)
  ctx.fillStyle = 'black';
  ctx.fillRect(player.x + player.width, player.y + 10, 20, 5);

  // Bullets
  ctx.fillStyle = 'yellow';
  bullets.forEach(b => ctx.fillRect(b.x, b.y, 10, 4));

  // Ammo info
  ctx.fillStyle = 'white';
  ctx.font = '16px Arial';
  ctx.fillText(`Ammo: ${player.ammo} | Mags: ${player.mags}`, 10, 20);
}

// Game loop
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
