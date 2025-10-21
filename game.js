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
let gameState = 'menu'; 
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
function checksum(s){
  let sum = 0; for(let i=0;i<s.length;i++) sum += s.charCodeAt(i);
  return (sum % 1000).toString(36).toUpperCase();
}
function validateKey(key){
  if(!key || typeof key !== 'string') return false;
  const k = key.trim().toUpperCase(); const parts = k.split('-');
  return parts.length >= 2 && checksum(parts[0]) === parts[1];
}
function tryKeySubmit(key){
  if(validateKey(key)){ unlocked = true; localStorage.setItem('badlands_unlocked','1'); return true; }
  return false;
}

/* ---------------- skins ---------------- */
const skins = [
  {name:'Default', body:'#e74c3c', head:'#f1c40f', clothes:'#2d3436'},
  {name:'Desert', body:'#c18b53', head:'#f3e8c7', clothes:'#6b5130'},
  {name:'Blue', body:'#3b82f6', head:'#a5d8ff', clothes:'#0b2545'},
];
let currentSkin = Number(localStorage.getItem('badlands_skin')) || 0;

/* ---------------- player ---------------- */
const player = {
  x:120,y:360,width:28,height:54,
  vy:0,onGround:false,
  facing:1,ammo:15,mags:7,
  isReloading:false,reloadTimer:0,
  hp:10,maxHp:10,
  shootCooldown:0
};

/* ---------------- levels ---------------- */
const levels = [
  { // Level 0 - Badlands Outskirts
    name:'Badlands Outskirts',width:4000,
    skyTop:'#87ceeb',skyBot:'#bcdfff',
    mountainColor:'#6b6b6b',mountain2:'#545454',
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
  { // Level 1 - Industrial Ruins
    name:'Industrial Ruins',width:4500,
    skyTop:'#a1c4ff',skyBot:'#cfd9ff',
    mountainColor:
