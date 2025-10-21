let gameState = 'loading'; // initially loading
let assetsLoaded = false;

const images = {
  g17: new Image(),
  tree: new Image(),
  building: new Image()
};

// Load assets
function loadAssets(){
  let loadedCount = 0;
  const totalAssets = Object.keys(images).length;

  images.g17.src = 'sprites/g17.png';
  images.tree.src = 'sprites/tree.png';
  images.building.src = 'sprites/building.png';

  for(let key in images){
    images[key].onload = ()=>{
      loadedCount++;
      if(loadedCount === totalAssets){
        assetsLoaded = true;
        gameState = 'menu'; // move to menu after assets loaded
      }
    }
    images[key].onerror = ()=>{
      console.error('Failed to load asset:', key);
      loadedCount++;
      if(loadedCount === totalAssets){
        assetsLoaded = true;
        gameState = 'menu';
      }
    }
  }
}

loadAssets();

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(gameState==='loading'){
    ctx.fillStyle='black';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='white';
    ctx.font='24px sans-serif';
    ctx.fillText('Loading...', 300, 200);
  } else if(gameState==='menu'){
    ctx.fillStyle='skyblue';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='black';
    ctx.font='28px sans-serif';
    ctx.fillText('Badlands', 260, 100);
    ctx.fillStyle='orange';
    ctx.fillRect(260,160,220,40);
    ctx.fillStyle='black';
    ctx.fillText('Buy Key', 320, 188);
  }
  // You can continue with the rest of draw() from before
}

function loop(){
  requestAnimationFrame(loop);
  draw();
}

loop();
