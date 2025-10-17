const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

const player = { x: 50, y: 400, width: 40, height: 40, color: 'red', vy:0, onGround:false };
const gravity = 0.8;
const bullets = [];

function update() {
  // Player movement
  if(keys['ArrowLeft']) player.x -= 5;
  if(keys['ArrowRight']) player.x += 5;
  
  // Jump
  if(keys['ArrowUp'] && player.onGround) { player.vy = -15; player.onGround=false; }

  // Gravity
  player.vy += gravity;
  player.y += player.vy;
  
  // Ground collision
  if(player.y + player.height > canvas.height) {
    player.y = canvas.height - player.height;
    player.vy = 0;
    player.onGround = true;
  }

  // Shooting
  if(keys[' ']) { // Space bar
    if(bullets.length < 5) bullets.push({ x: player.x+player.width/2, y: player.y+player.height/2, vx: 10 });
  }

  // Update bullets
  for(let i=bullets.length-1; i>=0; i--) {
    bullets[i].x += bullets[i].vx;
    if(bullets[i].x > canvas.width) bullets.splice(i,1); // remove offscreen
  }
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  // Draw player
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Draw bullets
  ctx.fillStyle = 'yellow';
  bullets.forEach(b => ctx.fillRect(b.x, b.y, 10, 4));
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
