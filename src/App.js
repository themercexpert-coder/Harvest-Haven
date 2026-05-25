import { useState, useEffect, useCallback, useRef } from 'react';
import { db, ref, set, get, child, onValue, auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase';
import { useState, useEffect, useCallback, useRef } from 'react';
// In VS Code replace this line with:
// import { db, ref, set, get, child, onValue, auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase';
const db=null,auth=null;
const ref=()=>{},set=async()=>{},get=async()=>({exists:()=>false,val:()=>({})}),child=()=>{},onValue=()=>()=>{};
const createUserWithEmailAndPassword=async()=>({user:{uid:'preview_'+Math.random().toString(36).substr(2,6)}}),signInWithEmailAndPassword=async()=>({user:{uid:'preview'}}),signOut=async()=>{},onAuthStateChanged=(a,cb)=>{cb({uid:'preview_user',email:'preview@farm.com'});return()=>{}};

// ─── Storage Polyfill ─────────────────────────────────────────
if(typeof window!=='undefined'&&!window.storage){
  window.storage={
    get:async(key)=>{try{const v=localStorage.getItem(key);return v?{value:v}:null;}catch{return null;}},
    set:async(key,value)=>{try{localStorage.setItem(key,String(value));return{key,value};}catch{return null;}},
    list:async(prefix)=>{try{return{keys:Object.keys(localStorage).filter(k=>k.startsWith(prefix))};}catch{return{keys:[]};}}
  };
}

// ─── Themes ───────────────────────────────────────────────────
export const THEMES=[
  {id:'forest',name:'🌿 Forest',bg:'linear-gradient(170deg,#a8d8ea,#b8e4c9 55%,#d4f1b8)',primary:'#1a6b2a',accent:'#27ae60',light:'#eef7ee'},
  {id:'ocean',name:'🌊 Ocean',bg:'linear-gradient(170deg,#c8e6ff,#b3d9f5 55%,#d4eaf8)',primary:'#1a4f76',accent:'#2980b9',light:'#eaf4fb'},
  {id:'rose',name:'🌹 Rose',bg:'linear-gradient(170deg,#fce4ec,#f8bbd0 55%,#f3e5f5)',primary:'#880e4f',accent:'#c2185b',light:'#fce8f0'},
  {id:'autumn',name:'🍂 Autumn',bg:'linear-gradient(170deg,#fff3e0,#ffe0b2 55%,#ffcc80)',primary:'#bf360c',accent:'#e64a19',light:'#fef3e8'},
  {id:'lavender',name:'🪻 Lavender',bg:'linear-gradient(170deg,#ede7f6,#d1c4e9 55%,#c3a8e1)',primary:'#6c3483',accent:'#8e44ad',light:'#f3eafa'},
  {id:'teal',name:'🩵 Teal',bg:'linear-gradient(170deg,#e0f7fa,#b2ebf2 55%,#80deea)',primary:'#00695c',accent:'#00897b',light:'#e0f2f1'},
  {id:'sunset',name:'🌅 Sunset',bg:'linear-gradient(170deg,#fff8e1,#ffe0b2 55%,#ffb74d)',primary:'#e65100',accent:'#f57c00',light:'#fff3e0'},
  {id:'night',name:'🌙 Night',bg:'linear-gradient(170deg,#1a1a2e,#16213e 55%,#0d2346)',primary:'#7986cb',accent:'#5c6bc0',light:'#252540'},
];

// ─── Seasons ──────────────────────────────────────────────────
export const SEASONS=[
  {name:'Spring',emoji:'🌸',col:'#c2185b',boost:{wheat:1.1,tomato:1.2,strawberry:1.3,blueberry:1.2,lavender:1.4,sunflower:1.2,pepper:1.1}},
  {name:'Summer',emoji:'☀️',col:'#f57c00',boost:{corn:1.2,pumpkin:1.1,blueberry:1.3,golden:1.1,watermelon:1.5,grape:1.3,chili:1.4,cotton:1.2}},
  {name:'Autumn',emoji:'🍂',col:'#5d4037',boost:{pumpkin:1.4,wheat:1.2,carrot:1.3,corn:1.1,mushroom:1.5,potato:1.3,onion:1.2,eggplant:1.2}},
  {name:'Winter',emoji:'❄️',col:'#1565c0',boost:{golden:1.5,carrot:1.2,diamond_flower:1.8,cotton:1.3,mushroom:1.2}},
];

// ─── Crops ────────────────────────────────────────────────────
export const CROPS=[
  {id:'wheat',name:'Wheat',emoji:'🌾',cost:10,base:25,xp:5,grow:30},
  {id:'corn',name:'Corn',emoji:'🌽',cost:15,base:38,xp:8,grow:45},
  {id:'tomato',name:'Tomato',emoji:'🍅',cost:20,base:52,xp:10,grow:60},
  {id:'strawberry',name:'Strawberry',emoji:'🍓',cost:25,base:68,xp:13,grow:90},
  {id:'carrot',name:'Carrot',emoji:'🥕',cost:18,base:46,xp:9,grow:45},
  {id:'pumpkin',name:'Pumpkin',emoji:'🎃',cost:30,base:80,xp:15,grow:120},
  {id:'blueberry',name:'Blueberry',emoji:'🫐',cost:35,base:95,xp:18,grow:180},
  {id:'golden',name:'Golden Grain',emoji:'✨',cost:100,base:300,xp:50,grow:300},
  {id:'potato',name:'Potato',emoji:'🥔',cost:12,base:32,xp:6,grow:40},
  {id:'onion',name:'Onion',emoji:'🧅',cost:14,base:36,xp:7,grow:50},
  {id:'pepper',name:'Pepper',emoji:'🫑',cost:22,base:58,xp:11,grow:65},
  {id:'eggplant',name:'Eggplant',emoji:'🍆',cost:24,base:63,xp:12,grow:70},
  {id:'watermelon',name:'Watermelon',emoji:'🍉',cost:40,base:105,xp:20,grow:200},
  {id:'grape',name:'Grapes',emoji:'🍇',cost:45,base:118,xp:22,grow:220},
  {id:'sunflower',name:'Sunflower',emoji:'🌻',cost:28,base:74,xp:14,grow:100},
  {id:'lavender',name:'Lavender',emoji:'💜',cost:32,base:85,xp:16,grow:130},
  {id:'chili',name:'Chili',emoji:'🌶️',cost:38,base:98,xp:19,grow:160},
  {id:'mushroom',name:'Mushroom',emoji:'🍄',cost:50,base:130,xp:24,grow:240},
  {id:'cotton',name:'Cotton',emoji:'🌿',cost:55,base:145,xp:26,grow:260},
  {id:'diamond_flower',name:'Diamond Flower',emoji:'💎',cost:200,base:600,xp:80,grow:300},
];

// ─── Animals ──────────────────────────────────────────────────
export const ANIMALS=[
  {id:'cow',emoji:'🐄',name:'Cow',product:'Milk',pe:'🥛',value:40,ml:1,meat:'Beef',me:'🥩',ms:80,mv:120,buyCost:300},
  {id:'chicken',emoji:'🐔',name:'Chicken',product:'Eggs',pe:'🥚',value:25,ml:1,meat:'Chicken',me:'🍗',ms:40,mv:60,buyCost:150},
  {id:'sheep',emoji:'🐑',name:'Sheep',product:'Wool',pe:'🧶',value:55,ml:5,meat:'Lamb',me:'🍖',ms:60,mv:90,buyCost:350},
  {id:'goat',emoji:'🐐',name:'Goat',product:'Goat Milk',pe:'🥛',value:35,ml:8,meat:'Goat Meat',me:'🍖',ms:55,mv:80,buyCost:280},
  {id:'horse',emoji:'🐎',name:'Horse',product:'Stamina',pe:'⚡',value:0,ml:10,meat:null,me:null,ms:0,mv:0,buyCost:800},
  {id:'duck',emoji:'🦆',name:'Duck',product:'Feathers',pe:'🪶',value:30,ml:12,meat:'Duck Meat',me:'🍗',ms:45,mv:70,buyCost:220},
  {id:'rabbit',emoji:'🐇',name:'Rabbit',product:'Lucky Drops',pe:'🍀',value:45,ml:15,meat:'Rabbit Meat',me:'🍖',ms:35,mv:55,buyCost:200},
];

// ─── Minerals ─────────────────────────────────────────────────
export const MINERALS=[
  {id:'coal',name:'Coal',emoji:'⚫',r:.35,v:30,xp:5},
  {id:'iron',name:'Iron',emoji:'🪨',r:.28,v:55,xp:8},
  {id:'copper',name:'Copper',emoji:'🔵',r:.18,v:80,xp:12},
  {id:'silver',name:'Silver',emoji:'🪙',r:.10,v:150,xp:18},
  {id:'goldore',name:'Gold Ore',emoji:'🟡',r:.06,v:300,xp:25},
  {id:'diamond',name:'Diamond',emoji:'💎',r:.02,v:800,xp:50},
  {id:'emerald',name:'Emerald',emoji:'🟢',r:.01,v:1200,xp:80},
  {id:'ruby',name:'Ruby',emoji:'🔴',r:.008,v:1800,xp:100},
  {id:'sapphire',name:'Sapphire',emoji:'🔷',r:.006,v:2200,xp:120},
  {id:'titanium',name:'Titanium',emoji:'⚙️',r:.005,v:2800,xp:140},
  {id:'crystal',name:'Crystal',emoji:'🔮',r:.003,v:3500,xp:160},
  {id:'mythril',name:'Mythril',emoji:'🌀',r:.002,v:5000,xp:200},
];

// ─── Recipes ──────────────────────────────────────────────────
export const RECIPES=[
  {id:'bread',name:'Bread',emoji:'🍞',ing:{wheat:3},sell:70,xp:15,desc:'3 Wheat'},
  {id:'vegSoup',name:'Veg Soup',emoji:'🍲',ing:{carrot:2,tomato:2},sell:130,xp:22,desc:'2 Carrot + 2 Tomato'},
  {id:'berryJam',name:'Berry Jam',emoji:'🍯',ing:{strawberry:3,blueberry:2},sell:200,xp:28,desc:'3 Strawberry + 2 Blueberry'},
  {id:'pumpkinPie',name:'Pumpkin Pie',emoji:'🥧',ing:{pumpkin:1,wheat:2},sell:160,xp:25,desc:'1 Pumpkin + 2 Wheat'},
  {id:'ironTool',name:'Iron Tool',emoji:'🔨',ing:{iron:2,coal:1},sell:210,xp:35,desc:'2 Iron + 1 Coal'},
  {id:'copperWire',name:'Copper Wire',emoji:'🔌',ing:{copper:3},sell:290,xp:40,desc:'3 Copper'},
  {id:'goldBar',name:'Gold Bar',emoji:'🏅',ing:{goldore:2},sell:720,xp:60,desc:'2 Gold Ore'},
  {id:'diamondGem',name:'Cut Diamond',emoji:'💍',ing:{diamond:1},sell:1900,xp:100,desc:'1 Diamond'},
  {id:'rubyRing',name:'Ruby Ring',emoji:'💍',ing:{ruby:1,goldore:1},sell:2500,xp:130,desc:'1 Ruby + 1 Gold Ore'},
  {id:'sapphireNeck',name:'Sapphire Necklace',emoji:'📿',ing:{sapphire:1,silver:2},sell:3200,xp:150,desc:'1 Sapphire + 2 Silver'},
  {id:'titaniumPlate',name:'Titanium Plate',emoji:'🛡️',ing:{titanium:2,coal:2},sell:4000,xp:170,desc:'2 Titanium + 2 Coal'},
  {id:'crystalOrb',name:'Crystal Orb',emoji:'🔮',ing:{crystal:1,silver:2},sell:5000,xp:200,desc:'1 Crystal + 2 Silver'},
  {id:'mythrilSword',name:'Mythril Sword',emoji:'⚔️',ing:{mythril:1,titanium:1},sell:8000,xp:300,desc:'1 Mythril + 1 Titanium'},
  {id:'spiceSauce',name:'Spice Sauce',emoji:'🌶️',ing:{chili:3,tomato:2},sell:180,xp:26,desc:'3 Chili + 2 Tomato'},
  {id:'lavenderOil',name:'Lavender Oil',emoji:'🧴',ing:{lavender:4},sell:220,xp:30,desc:'4 Lavender'},
  {id:'cottonFabric',name:'Cotton Fabric',emoji:'🧵',ing:{cotton:3},sell:260,xp:32,desc:'3 Cotton'},
  {id:'mushroomSoup',name:'Mushroom Soup',emoji:'🍵',ing:{mushroom:2,carrot:1},sell:190,xp:28,desc:'2 Mushroom + 1 Carrot'},
  {id:'grapejuice',name:'Grape Juice',emoji:'🍷',ing:{grape:4},sell:240,xp:30,desc:'4 Grapes'},
  {id:'pet_bone',name:'Dog Bone',emoji:'🦴',ing:{wheat:2,iron:1},sell:30,xp:8,desc:'Pet food for Farm Dog'},
  {id:'pet_fish',name:'Pet Fish',emoji:'🐟',ing:{wheat:1,copper:1},sell:25,xp:7,desc:'Pet food for Barn Cat'},
  {id:'pet_seeds',name:'Seeds Mix',emoji:'🌱',ing:{wheat:3},sell:20,xp:6,desc:'Pet food for Parrot'},
  {id:'pet_carrot',name:'Pet Carrot',emoji:'🥕',ing:{carrot:2},sell:22,xp:6,desc:'Pet food for Lucky Bunny'},
  {id:'pet_meat',name:'Raw Meat',emoji:'🥩',ing:{corn:1,iron:1},sell:35,xp:9,desc:'Pet food for Farm Fox'},
  {id:'pet_honey',name:'Wild Honey',emoji:'🍯',ing:{sunflower:2,corn:1},sell:50,xp:12,desc:'Pet food for Honey Bear'},
  {id:'pet_gemstone',name:'Gemstone',emoji:'💎',ing:{diamond:1},sell:500,xp:50,desc:'Pet food for Dragon'},
];

// ─── Pets ─────────────────────────────────────────────────────
export const PET_TYPES=[
  {id:'dog',name:'Farm Dog',emoji:'🐕',bonus:'Finds bonus seeds',cost:200,food:'pet_bone'},
  {id:'cat',name:'Barn Cat',emoji:'🐈',bonus:'Animal product boost',cost:250,food:'pet_fish'},
  {id:'parrot',name:'Parrot',emoji:'🦜',bonus:'Market price alerts',cost:300,food:'pet_seeds'},
  {id:'bunny',name:'Lucky Bunny',emoji:'🐰',bonus:'Lucky crop drops',cost:350,food:'pet_carrot'},
  {id:'fox',name:'Farm Fox',emoji:'🦊',bonus:'Mining bonus',cost:400,food:'pet_meat'},
  {id:'owl',name:'Wise Owl',emoji:'🦉',bonus:'+15% XP from all actions',cost:450,food:'pet_seeds'},
  {id:'bear',name:'Honey Bear',emoji:'🐻',bonus:'Doubles fruit yields',cost:500,food:'pet_honey'},
  {id:'dragon',name:'Farm Dragon',emoji:'🐲',bonus:'Auto clears empty tiles',cost:1000,food:'pet_gemstone'},
  {id:'unicorn',name:'Unicorn',emoji:'🦄',bonus:'Chance to double any harvest',cost:1500,food:'pet_gemstone'},
];

// ─── NPCs & Tasks ─────────────────────────────────────────────
export const NPCS={
  joe:{name:'Farmer Joe',emoji:'👨‍🌾',col:'#27ae60',lines:['Hello neighbour!','Great work today!','Fields look wonderful!','Really appreciate you!','Best farmer I know!']},
  mary:{name:'Market Mary',emoji:'👩‍💼',col:'#2980b9',lines:['Perfect quality!','My stall thanks you!','Fair deal always!','Premium goods!','My best supplier!']},
  tom:{name:'Miner Tom',emoji:'⛏️',col:'#546e7a',lines:['Good ore today!','Mine yields well!','Solid work!','Sharp pick!','Best miner!']},
  lily:{name:'Florist Lily',emoji:'🌸',col:'#c2185b',lines:['Beautiful harvest!','Blooms lovely!','Nature smiles!','Wonderful!','Garden thanks you!']},
  chef:{name:'Chef Carlos',emoji:'👨‍🍳',col:'#e67e22',lines:['Delicious!','Soup perfect!','Customers love it!','Finest produce!','You feed the town!']},
};

export const TASK_POOL=[
  {npcId:'joe',itemId:'wheat',qty:3,inv:'silo',coins:75,xp:15,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  {npcId:'chef',itemId:'tomato',qty:3,inv:'silo',coins:110,xp:18,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  {npcId:'lily',itemId:'corn',qty:4,inv:'silo',coins:95,xp:16,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  {npcId:'mary',itemId:'carrot',qty:5,inv:'silo',coins:140,xp:20,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  {npcId:'joe',itemId:'pumpkin',qty:2,inv:'silo',coins:130,xp:19,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  {npcId:'mary',itemId:'strawberry',qty:6,inv:'silo',coins:320,xp:45,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'chef',itemId:'blueberry',qty:5,inv:'silo',coins:380,xp:50,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'tom',itemId:'iron',qty:2,inv:'mineral',coins:200,xp:38,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'tom',itemId:'copper',qty:2,inv:'mineral',coins:260,xp:42,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'joe',itemId:'wheat',qty:10,inv:'silo',coins:350,xp:48,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'joe',itemId:'golden',qty:2,inv:'silo',coins:900,xp:120,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'tom',itemId:'diamond',qty:1,inv:'mineral',coins:1600,xp:160,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'mary',itemId:'emerald',qty:1,inv:'mineral',coins:2000,xp:180,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'chef',itemId:'strawberry',qty:15,inv:'silo',coins:1000,xp:130,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'tom',itemId:'ruby',qty:1,inv:'mineral',coins:2500,xp:200,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'mary',itemId:'mushroom',qty:5,inv:'silo',coins:400,xp:55,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'chef',itemId:'chili',qty:4,inv:'silo',coins:360,xp:48,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'lily',itemId:'lavender',qty:5,inv:'silo',coins:380,xp:50,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
];

export const genTasks=lvl=>[...TASK_POOL]
  .filter(t=>!(t.diff==='hard'&&lvl<10)&&!(t.diff==='medium'&&lvl<4))
  .sort(()=>Math.random()-.5).slice(0,8)
  .map((t,i)=>({...t,id:`t${Date.now()}${i}`,accepted:false,expiresAt:Date.now()+t.hrs*3600000}));

// ─── Daily Rewards ────────────────────────────────────────────
export const DR=[
  {coins:50,xp:10},
  {coins:100,xp:20},
  {coins:150,xp:30,petFood:1},
  {coins:200,xp:40},
  {coins:300,xp:50,petFood:2},
  {coins:400,xp:60,toys:1},
  {coins:600,xp:100,petFood:3,toys:1},
];

export const DQ=[
  {id:'dq1',text:'Harvest 5 crops',key:'dqH',target:5,reward:{coins:80,xp:15}},
  {id:'dq2',text:'Mine 2 minerals',key:'dqM',target:2,reward:{coins:100,xp:20}},
  {id:'dq3',text:'Complete 1 NPC task',key:'dqT',target:1,reward:{coins:150,xp:25,petFood:1}},
];

// ─── Upgrades ─────────────────────────────────────────────────
export const UPGRADES=[
  {id:'autoPlow',name:'Auto-Plower',emoji:'🚜',desc:'One-tap plow all empty fields instantly',cost:2000},
  {id:'mineBoost',name:'Mine Elevator',emoji:'⛏️',desc:'Double rare mineral drop rates permanently',cost:5000},
  {id:'premiumBank',name:'Premium Banking',emoji:'🏦',desc:'Profit share increases from 5% to 8%',cost:2500},
  {id:'petHouse',name:'Pet Luxury House',emoji:'🏠',desc:'Pets decay 60% slower',cost:1500},
  {id:'goldVault',name:'Gold Vault',emoji:'🥇',desc:'Unlocks Gold Growth Account in Bank',cost:3000},
  {id:'siloBoost',name:'Super Silo',emoji:'🏗️',desc:'All crop sell prices +10% permanently',cost:1800},
  {id:'waterTank',name:'Water Tank',emoji:'💧',desc:'Auto waters all planted crops every 2 minutes',cost:2200},
  {id:'greenhouse',name:'Greenhouse',emoji:'🌿',desc:'All crops grow 40% faster permanently',cost:4000},
  {id:'richSoil',name:'Rich Soil',emoji:'🌱',desc:'All crops yield +1 extra on harvest',cost:3500},
  {id:'mineralScanner',name:'Mineral Scanner',emoji:'📡',desc:'Shows mineral before mining',cost:4500},
  {id:'autoFeeder',name:'Auto Pet Feeder',emoji:'🐾',desc:'Pets hunger stays above 50%',cost:3000},
  {id:'marketStall',name:'Premium Stall',emoji:'🏪',desc:'Your stall gets priority placement',cost:2800},
];

// ─── Long Goals ───────────────────────────────────────────────
export const LONG_GOALS=[
  {id:'town',name:'Restore the Town',emoji:'🏘️',desc:'Complete 10 hard tasks',key:'hardTasks',target:10,reward:2000},
  {id:'greenhouse',name:'Unlock Greenhouse',emoji:'🌿',desc:'Reach Level 15',key:'level',target:15,reward:3000},
  {id:'fishing',name:'Fishing Pond',emoji:'🎣',desc:'Earn 50,000 total coins',key:'totalEarned',target:50000,reward:5000},
  {id:'mountain',name:'Mountain Mine',emoji:'⛰️',desc:'Mine 50 minerals',key:'minedTotal',target:50,reward:4000},
  {id:'rareCrops',name:'Rare Crop Field',emoji:'✨',desc:'Harvest 20 Golden Grain',key:'goldenHarv',target:20,reward:8000},
  {id:'megaBarn',name:'Mega Barn',emoji:'🐄',desc:'Collect from all 7 animals',key:'animalTypes',target:7,reward:6000},
  {id:'mineralKing',name:'Mineral King',emoji:'👑',desc:'Mine 200 total minerals',key:'minedTotal',target:200,reward:15000},
  {id:'cropMaster',name:'Crop Master',emoji:'🌾',desc:'Harvest 500 total crops',key:'totalCrops',target:500,reward:12000},
  {id:'millionaire',name:'Farm Millionaire',emoji:'💰',desc:'Earn 1,000,000 total coins',key:'totalEarned',target:1000000,reward:50000},
  {id:'petMaster',name:'Pet Master',emoji:'🐾',desc:'Own all 9 pets',key:'petCount',target:9,reward:20000},
  {id:'craftMaster',name:'Master Crafter',emoji:'🔨',desc:'Craft 100 items total',key:'totalCrafted',target:100,reward:10000},
  {id:'diamondMiner',name:'Diamond Miner',emoji:'💎',desc:'Mine 10 diamonds',key:'diamondMined',target:10,reward:25000},
];

// ─── Other constants ──────────────────────────────────────────
export const STALL_THEMES=[
  {id:'green',label:'Forest Fresh',color:'#1a6b2a'},
  {id:'gold',label:'Golden Harvest',color:'#b7800a'},
  {id:'rose',label:'Rose Garden',color:'#b5174f'},
  {id:'blue',label:'Cool Morning',color:'#1a5276'},
  {id:'purple',label:'Lavender Dream',color:'#6c3483'},
  {id:'dark',label:'Midnight Farm',color:'#212f3c'},
];
export const LAND_PRICES=[300,800,1800,3500,7000,14000,28000];
export const CHAT_CH=['General','Help','Missions','Trading'];
export const CH_COL={General:'#27ae60',Help:'#2980b9',Missions:'#8e44ad',Trading:'#e67e22'};
export const MARKET_ITEMS=[
  {emoji:'🌾',name:'Wheat',price:45,trend:'+5%',up:true},
  {emoji:'🍅',name:'Tomato',price:80,trend:'-3%',up:false},
  {emoji:'🥛',name:'Milk',price:60,trend:'+8%',up:true},
  {emoji:'🥚',name:'Eggs',price:50,trend:'+2%',up:true},
  {emoji:'🪨',name:'Iron',price:120,trend:'+12%',up:true},
  {emoji:'🟡',name:'Gold Ore',price:350,trend:'+1%',up:true},
  {emoji:'🌹',name:'Roses',price:90,trend:'-1%',up:false},
  {emoji:'🧶',name:'Wool',price:75,trend:'+6%',up:true},
];
export const BOOKS=[
  {id:'b1',title:"Beginner's Guide",emoji:'📗',ml:1,pages:[
    {t:'Welcome',c:"Plow fields, plant crops, harvest into Silo, sell for coins."},
    {t:'First Harvest',c:"1. Tap brown tile to plow\n2. Choose crop\n3. Tap plowed tile to plant\n4. Wait for timer\n5. Tap glowing tile to harvest\n6. Go to Silo to sell!"},
  ]},
  {id:'b2',title:'Farming Tips',emoji:'🌾',ml:1,pages:[
    {t:'Crop Timers',c:"Crops take real time to grow. Tap Water All to cut grow time by 30%."},
    {t:'Seasons',c:"Prices change each season. Pumpkins earn 40% more in Autumn. Plan your planting!"},
  ]},
  {id:'b3',title:'Missions',emoji:'📋',ml:1,pages:[
    {t:'Task Board',c:"NPCs post requests. Complete tasks for coins, XP and pet supplies. Tasks refresh hourly."},
    {t:'NPC Friendship',c:"Each task builds friendship. Best Friend gives 20% coin bonus on that NPC rewards."},
  ]},
  {id:'b4',title:'Pets',emoji:'🐾',ml:1,pages:[
    {t:'Adopting',c:"Adopt up to 3 pets from My Pets. Each pet needs specific food crafted from ingredients."},
    {t:'Care',c:"Each pet type needs its own food — craft it in the Crafting screen. Feed and play daily."},
  ]},
  {id:'b5',title:'Finance',emoji:'💰',ml:3,pages:[
    {t:'Bank',c:"Emergency Loan capped at 500 coins. 10% auto-debits until repaid. Fixed fee loans available."},
    {t:'Gold',c:"Buy gold at live prices. Deposit in Gold Growth Account for automatic returns."},
  ]},
  {id:'b6',title:'Friends',emoji:'🤝',ml:1,pages:[
    {t:'Friend Bonuses',c:"Add friends by Player ID. Send daily help to each other."},
    {t:'Mutual Streak',c:"When both send help same day, streak grows. Each day adds 5% earnings bonus up to 50%."},
  ]},
];

export const MACH_DEF={
  plow:{id:'plow',name:'Plow Tractor',emoji:'🚜',desc:'Auto plows empty tiles',cost:800,tiers:[{t:1,s:30,f:2,l:'Mk1'},{t:2,s:24,f:2.5,l:'Mk2'},{t:4,s:18,f:3,l:'Mk3'},{t:8,s:12,f:3.5,l:'Mk4'},{t:16,s:7,f:4,l:'Mk5'}],upg:[0,600,1400,3000,6000]},
  seeder:{id:'seeder',name:'Seeder Tractor',emoji:'🌱',desc:'Plants queued crops automatically',cost:1000,tiers:[{t:1,s:35,f:2,l:'Mk1'},{t:2,s:28,f:2.5,l:'Mk2'},{t:3,s:22,f:3,l:'Mk3'},{t:4,s:16,f:3.5,l:'Mk4'},{t:6,s:10,f:4,l:'Mk5'}],upg:[0,800,2000,4000,8000]},
  fertiliser:{id:'fertiliser',name:'Fertiliser Spreader',emoji:'🌿',desc:'Boosts growth speed and yield',cost:900,tiers:[{sb:.15,s:50,f:1.5,l:'Mk1'},{sb:.2,s:42,f:2,l:'Mk2'},{sb:.25,s:35,f:2.5,l:'Mk3'},{sb:.3,s:28,f:3,l:'Mk4'},{sb:.4,s:18,f:3.5,l:'Mk5'}],upg:[0,700,1600,3500,7000]},
  irrigation:{id:'irrigation',name:'Water Tank',emoji:'💧',desc:'Waters crops, cuts grow time 35%',cost:700,tiers:[{cv:4,s:60,f:1,l:'Mk1'},{cv:8,s:50,f:1.5,l:'Mk2'},{cv:16,s:40,f:2,l:'Mk3'},{cv:32,s:30,f:2.5,l:'Mk4'},{cv:999,s:20,f:3,l:'Mk5'}],upg:[0,500,1200,2500,5000]},
  harvester:{id:'harvester',name:'Combine Harvester',emoji:'🌾',desc:'Auto-harvests ready crops',cost:2000,tiers:[{t:2,s:20,f:3,bc:.05,l:'Mk1'},{t:4,s:15,f:3.5,bc:.1,l:'Mk2'},{t:6,s:11,f:4,bc:.15,l:'Mk3'},{t:8,s:8,f:4.5,bc:.2,l:'Mk4'},{t:16,s:5,f:5,bc:.3,l:'Mk5'}],upg:[0,1200,2800,5500,10000]},
};
export const FUEL_SHOP=[
  {name:'Small Can',emoji:'⛽',amt:25,cost:120},
  {name:'Large Can',emoji:'🪣',amt:75,cost:320},
  {name:'Full Tank',emoji:'🚛',amt:200,cost:750},
];

export const MENU_DEF=[
  {title:'YOUR FARM',items:[
    {id:'daily',emoji:'🎁',label:'Daily Rewards',desc:'Claim daily bonus and streak',ac:'#f39c12',ml:1},
    {id:'farm',emoji:'🌾',label:'Farming Fields',desc:'Plow, plant and harvest',ac:'#27ae60',ml:1},
    {id:'silo',emoji:'🏗️',label:'Silo',desc:'View and sell stored crops',ac:'#8B6914',ml:1},
    {id:'crafting',emoji:'🔨',label:'Crafting',desc:'Craft items for higher value',ac:'#795548',ml:3},
    {id:'taskboard',emoji:'📋',label:'Task Board',desc:'Accept NPC missions for rewards',ac:'#8e44ad',ml:1},
    {id:'pets',emoji:'🐾',label:'My Pets',desc:'Feed and care for your pets',ac:'#e67e22',ml:1},
    {id:'animals',emoji:'🐄',label:'Animals',desc:'Buy animals and collect products',ac:'#795548',ml:1},
    {id:'butchery',emoji:'🔪',label:'Butchery',desc:'Process meat for stamina or sell',ac:'#c0392b',ml:1},
    {id:'mine',emoji:'⛏️',label:'Mine',desc:'Extract rare minerals',ac:'#4a4a4a',ml:5},
    {id:'collections',emoji:'📖',label:'Collections',desc:'Track your discoveries',ac:'#16a085',ml:1},
  ]},
  {title:'COMMERCE',items:[
    {id:'market',emoji:'🏪',label:'Player Market',desc:'List and buy from other players',ac:'#2980b9',ml:1},
    {id:'gmb',emoji:'🏛️',label:'Gov. Marketing Board',desc:'Last resort buyer and seller',ac:'#7f8c8d',ml:1},
    {id:'stall',emoji:'🛖',label:'My Farm Stall',desc:'Customise your personal stall',ac:'#e67e22',ml:1},
    {id:'visitstalls',emoji:'🏘️',label:'Visit Stalls',desc:'Browse and buy from other players',ac:'#16a085',ml:1},
  ]},
  {title:'FINANCE',items:[
    {id:'bank',emoji:'🏦',label:'Bank',desc:'Savings, loans and profit share',ac:'#1a5276',ml:1},
    {id:'gold',emoji:'🥇',label:'Gold Store',desc:'Buy and sell gold at live rates',ac:'#b7800a',ml:1},
    {id:'finance',emoji:'💰',label:'Financial Dashboard',desc:'Income, expenses and net worth',ac:'#1a6b2a',ml:1},
  ]},
  {title:'COMMUNITY',items:[
    {id:'chat',emoji:'💬',label:'Farm Chat',desc:'Global chat with all players',ac:'#16a085',ml:1},
    {id:'goals',emoji:'🏆',label:'Long-Term Goals',desc:'Big milestones and rewards',ac:'#f39c12',ml:1},
  ]},
  {title:'MANAGEMENT',items:[
    {id:'farmhouse',emoji:'🏡',label:'Farmhouse',desc:'Guide, friends, settings and multiplayer',ac:'#795548',ml:1},
    {id:'garage',emoji:'🔧',label:'Garage & Upgrades',desc:'Machines and permanent upgrades',ac:'#546e7a',ml:1},
    {id:'workers',emoji:'👔',label:'Farm Workers',desc:'Hire workers and a manager',ac:'#2c3e50',ml:8},
  ]},
];

export const ACTIVE=['farm','silo','animals','butchery','mine','market','gmb','stall','bank','gold','finance','farmhouse','taskboard','pets','chat','daily','crafting','collections','goals','garage','visitstalls'];
export const xpFor=l=>l*100;
export const todayStr=()=>new Date().toISOString().split('T')[0];
export const getMood=a=>a>=80?{mood:'Thriving',emoji:'😄',col:'#27ae60'}:a>=60?{mood:'Happy',emoji:'😊',col:'#2ecc71'}:a>=40?{mood:'Content',emoji:'😐',col:'#f39c12'}:a>=20?{mood:'Sad',emoji:'😟',col:'#e67e22'}:{mood:'Hungry',emoji:'😢',col:'#e74c3c'};
export const getFP=p=>p>=200?{label:'Best Friend',col:'#8e44ad'}:p>=100?{label:'Good Friend',col:'#2980b9'}:p>=50?{label:'Friend',col:'#27ae60'}:p>=20?{label:'Acquaintance',col:'#f39c12'}:{label:'Stranger',col:'#aaa'};

// ─── Shared UI ─────────────────────────────────────────────────
export const Card=({children,style={}})=><div style={{background:'#fff',borderRadius:16,padding:14,boxShadow:'0 1px 8px rgba(0,0,0,.07)',border:'1px solid #ececec',marginBottom:10,...style}}>{children}</div>;
export const Btn=({onClick,color='#27ae60',disabled,children,style={}})=><button onClick={onClick} disabled={disabled} style={{background:disabled?'#bbb':color,color:'#fff',border:'none',borderRadius:12,padding:'9px 16px',fontSize:13,fontWeight:700,cursor:disabled?'default':'pointer',...style}}>{children}</button>;
export const Bar=({v,c})=><div style={{height:8,background:'#eee',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.max(0,Math.min(100,v))}%`,background:c,borderRadius:4,transition:'width .5s'}}/></div>;
export const DiffBadge=({d})=>{const c=d==='easy'?'#27ae60':d==='medium'?'#e67e22':'#e74c3c';return<span style={{background:c,color:'#fff',borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:800}}>{d.toUpperCase()}</span>;};
export const SecHead=({label,color='#777'})=><div style={{fontSize:11,fontWeight:800,color,letterSpacing:1.1,marginBottom:8,paddingLeft:2}}>{label}</div>;
export const TabRow=({tabs,active,onSelect,ac='#1a6b2a'})=><div style={{display:'flex',gap:6,marginBottom:14}}>{tabs.map(([id,lb])=><button key={id} onClick={()=>onSelect(id)} style={{flex:1,background:active===id?ac:'#fff',color:active===id?'#fff':'#555',border:`1.5px solid ${active===id?ac:'#ddd'}`,borderRadius:12,padding:'8px 4px',fontSize:11,fontWeight:700,cursor:'pointer'}}>{lb}</button>)}</div>;

// ─── Main App ──────────────────────────────────────────────────
function HarvestHaven({user,onSignOut}){
  const [screen,setScreen]=useState('home');
  const [tiles,setTiles]=useState(Array(12).fill(null).map((_,i)=>({id:i,state:'empty',crop:null,growsAt:0,watered:false})));
  const [landPlots,setLP]=useState(3);
  const [selCrop,setSelCrop]=useState(CROPS[0]);
  const [coins,setCoins]=useState(500);
  const [stamina,setStamina]=useState(100);
  const [xp,setXp]=useState(0);
  const [level,setLevel]=useState(1);
  const [silo,setSilo]=useState({});
  const [totalHarv,setTH]=useState({});
  const [bankBal,setBankBal]=useState(0);
  const [totalEarned,setTE]=useState(0);
  const [todayEarned,setTDE]=useState(0);
  const [todaySpent,setTDS]=useState(0);
  const [animalCd,setAnimalCd]=useState({});
  const [animalTypes,setAT]=useState(new Set());
  const [ownedAnimals,setOwnedAnimals]=useState({});
  const [meatInv,setMeatInv]=useState({});
  const [minerals,setMin]=useState({});
  const [minedTotal,setMTotal]=useState(0);
  const [mineCd,setMineCd]=useState(false);
  const [goldHeld,setGold]=useState(0);
  const [goldPrice,setGP]=useState(92.5);
  const [goldBuy,setGoldBuy]=useState('');
  const [goldSell,setGoldSell]=useState('');
  const [stallCfg,setStall]=useState({name:'My Farm Stall',welcome:'Welcome! Freshest goods in the valley',goodbye:'Thanks for visiting! Come back soon',theme:'green'});
  const [notifs,setNotifs]=useState([]);
  const [farmName,setFarmName]=useState('Sunny Acres Farm');
  const [themeId,setThemeId]=useState('forest');
  const [worldCode,setWC]=useState('');
  const [playerId]=useState(()=>`P${Math.random().toString(36).substr(2,6).toUpperCase()}`);
  const [tasks,setTasks]=useState([]);
  const [pets,setPets]=useState([]);
  const [petInv,setPetInv]=useState({petFood:5,toys:3,treats:2});
  const [chatMsgs,setChat]=useState(()=>Object.fromEntries(CHAT_CH.map(c=>[c,[]])));
  const [blocked,setBlocked]=useState([]);
  const [seasonIdx,setSeasonIdx]=useState(0);
  const [streak,setStreak]=useState(0);
  const [lastLogin,setLastLogin]=useState('');
  const [dailyClaimed,setDC]=useState(false);
  const [craftInv,setCraftInv]=useState({});
  const [collected,setCollected]=useState([]);
  const [friendship,setFP]=useState({joe:0,mary:0,tom:0,lily:0,chef:0});
  const [hardTasks,setHT]=useState(0);
  const [goldenHarv,setGH]=useState(0);
  const [listings,setListings]=useState([]);
  const [loanDebt,setLoanDebt]=useState(0);
  const loanRef=useRef(0);
  const [dqP,setDQP]=useState({dqH:0,dqM:0,dqT:0});
  const [dqDone,setDQDone]=useState([]);
  const [friendsList,setFriendsList]=useState([]);
  const [friendStreak,setFS]=useState(0);
  const [lastFriendHelp,setLFH]=useState('');
  const [upgrades,setUpgrades]=useState({});
  const [goldGrowth,setGG]=useState(0);
  const [goldGrowthBal,setGGB]=useState(0);
  const [jointBal,setJB]=useState(0);
  const [mach,setMach]=useState({
    plow:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
    seeder:{owned:false,tier:0,active:false,dur:100,lastCycle:0,queue:[],qCrop:'wheat'},
    fertiliser:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
    irrigation:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
    harvester:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
  });
  const [fuel,setFuel]=useState(50);
  const [offRep,setOffRep]=useState(null);
  const [allStalls,setAllStalls]=useState([]);
  const [visitingStall,setVisitingStall]=useState(null);

  const machR=useRef(null);const tilesR=useRef(null);const siloR=useRef(null);
  const fuelR=useRef(null);const coinsRf=useRef(500);const upgradesR=useRef({});

  const T=THEMES.find(t=>t.id===themeId)||THEMES[0];
  const season=SEASONS[seasonIdx];
  const xpNeeded=xpFor(level),xpCur=xp%xpNeeded;
  const siloTotal=Object.values(silo).reduce((a,b)=>a+b,0);
  const siloMult=upgrades.siloBoost?1.1:1;
  const siloValue=CROPS.reduce((s,c)=>s+(silo[c.id]||0)*Math.round(c.base*(season.boost[c.id]||1)*siloMult),0);
  const minCount=Object.values(minerals).reduce((a,b)=>a+b,0);
  const activeTasks=tasks.filter(t=>t.accepted&&t.expiresAt>Date.now());
  const availTasks=tasks.filter(t=>!t.accepted&&t.expiresAt>Date.now());
  const cropPrice=crop=>Math.round(crop.base*(season.boost[crop.id]||1)*siloMult);
  const friendBonus=Math.min(friendStreak*.05,.5);

  useEffect(()=>{loanRef.current=loanDebt;},[loanDebt]);
  useEffect(()=>{machR.current=mach;},[mach]);
  useEffect(()=>{tilesR.current=tiles;},[tiles]);
  useEffect(()=>{siloR.current=silo;},[silo]);
  useEffect(()=>{fuelR.current=fuel;},[fuel]);
  useEffect(()=>{coinsRf.current=coins;},[coins]);
  useEffect(()=>{upgradesR.current=upgrades;},[upgrades]);

  // ── Load ──────────────────────────────────────────────────
  useEffect(()=>{
    (async()=>{
      try{
        let saveData=null;
        if(db&&user?.uid){
          try{const sn=await get(child(ref(db),`saves/${user.uid}`));if(sn.exists())saveData=JSON.parse(sn.val());}catch{}
        }
        if(!saveData){const raw=localStorage.getItem('hh7');if(raw)saveData=JSON.parse(raw);}
        if(saveData){
          const s=saveData;
          const k={coins:setCoins,xp:setXp,level:setLevel,silo:setSilo,minerals:setMin,bankBal:setBankBal,goldHeld:setGold,friendship:setFP,streak:setStreak,lastLogin:setLastLogin,petInv:setPetInv,pets:setPets,collected:setCollected,craftInv:setCraftInv,hardTasks:setHT,goldenHarv:setGH,minedTotal:setMTotal,totalEarned:setTE,seasonIdx:setSeasonIdx,totalHarv:setTH,loanDebt:setLoanDebt,dqP:setDQP,dqDone:setDQDone,friendsList:setFriendsList,friendStreak:setFS,lastFriendHelp:setLFH,upgrades:setUpgrades,goldGrowth:setGG,goldGrowthBal:setGGB,jointBal:setJB,listings:setListings,ownedAnimals:setOwnedAnimals};
          Object.entries(k).forEach(([key,fn])=>{if(s[key]!==undefined)fn(s[key]);});
          if(s.tiles)setTiles(s.tiles.map(t=>({...t,crop:t.crop?CROPS.find(c=>c.id===t.crop.id)||null:null})));
          if(s.mach)setMach(s.mach);
          if(s.fuel!==undefined)setFuel(s.fuel);
          if(s.lastLogin&&s.lastLogin===todayStr())setDC(true);
        }
      }catch(e){console.log('Load error',e);}
      try{const r=await window.storage.get('farm_name');if(r)setFarmName(r.value);}catch{}
      try{if(user?.uid&&db){const sn=await get(child(ref(db),`users/${user.uid}/profile`));if(sn.exists()){const p=sn.val();if(p.farmName)setFarmName(p.farmName);}}}catch{}
      try{const r=await window.storage.get('theme_id');if(r)setThemeId(r.value);}catch{}
      try{
        const r=await window.storage.get('world_code');
        if(r)setWC(r.value);
        else{const c=`HVN${Math.random().toString(36).substr(2,3).toUpperCase()}`;await window.storage.set('world_code',c);setWC(c);}
      }catch{setWC(`HVN${Math.random().toString(36).substr(2,3).toUpperCase()}`);}
      setTasks(genTasks(1));
    })();
  },[]);

  // ── Save ──────────────────────────────────────────────────
  const saveGame=useCallback(async()=>{
    try{
      const s={coins,xp,level,silo,minerals,bankBal,goldHeld,friendship,streak,lastLogin,petInv,pets,collected,craftInv,hardTasks,goldenHarv,minedTotal,totalEarned,seasonIdx,totalHarv,loanDebt,dqP,dqDone,friendsList,friendStreak,lastFriendHelp,upgrades,goldGrowth,goldGrowthBal,jointBal,listings,ownedAnimals,mach,fuel,tiles:tiles.map(t=>({...t,crop:t.crop?{id:t.crop.id}:null}))};
      localStorage.setItem('hh7',JSON.stringify(s));
      if(db&&user?.uid){
        try{await set(ref(db,`saves/${user.uid}`),JSON.stringify(s));}catch(e){console.log('Firebase save error',e);}
      }
    }catch(e){console.log('Save error',e);}
  },[coins,xp,level,silo,minerals,bankBal,goldHeld,friendship,streak,lastLogin,petInv,pets,collected,craftInv,hardTasks,goldenHarv,minedTotal,totalEarned,seasonIdx,totalHarv,loanDebt,dqP,dqDone,friendsList,friendStreak,lastFriendHelp,upgrades,goldGrowth,goldGrowthBal,jointBal,listings,ownedAnimals,mach,fuel,tiles]);

  useEffect(()=>{const t=setInterval(saveGame,15000);return()=>clearInterval(t);},[saveGame]);
  useEffect(()=>{
    const handler=()=>saveGame();
    document.addEventListener('visibilitychange',handler);
    window.addEventListener('beforeunload',handler);
    return()=>{document.removeEventListener('visibilitychange',handler);window.removeEventListener('beforeunload',handler);};
  },[saveGame]);

  // ── Intervals ─────────────────────────────────────────────
  useEffect(()=>{const t=setInterval(()=>setStamina(s=>Math.min(100,s+2)),4000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const t=setInterval(()=>setGP(p=>Math.max(82,Math.min(115,+(p+(Math.random()-.48)*.4).toFixed(2)))),20000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    if(xp>0&&xp>=xpFor(level)){
      const nl=level+1;setLevel(nl);
      const cr=nl*100;earn(cr);
      if(nl>=5)setPetInv(p=>({...p,petFood:p.petFood+2}));
      notify(`🎉 Level ${nl}! +🪙${cr}`,'gold');
    }
  },[xp]);
  useEffect(()=>{const t=setInterval(()=>{setTiles(ts=>{const now=Date.now();let ch=false;const nx=ts.map(ti=>{if(ti.state==='planted'&&ti.growsAt>0&&now>=ti.growsAt){ch=true;return{...ti,state:'ready'};}return ti;});return ch?nx:ts;});},2000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    const decay=upgrades.petHouse?0.4:1;
    const t=setInterval(()=>{setPets(ps=>ps.map(p=>({...p,hunger:Math.max(0,p.hunger-decay),happiness:Math.max(0,p.happiness-decay*.5)})));},45000);
    return()=>clearInterval(t);
  },[upgrades.petHouse]);
  useEffect(()=>{const t=setInterval(()=>setSeasonIdx(i=>(i+1)%4),240000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    if(lastLogin&&lastLogin!==todayStr())setDC(false);
  },[lastLogin]);
  useEffect(()=>{
    const t=setInterval(()=>{
      setTasks(prev=>{
        const exp=prev.filter(t=>t.expiresAt<=Date.now()&&!t.accepted);
        if(exp.length>0||prev.filter(t=>!t.accepted).length<4){
          notify('New tasks available! 📋','blue');
          return[...prev.filter(t=>t.accepted),...genTasks(level)];
        }
        return prev;
      });
    },3600000);
    return()=>clearInterval(t);
  },[level]);
  useEffect(()=>{const t=setInterval(()=>{if(goldGrowthBal>0){const ret=+(goldGrowthBal*.02).toFixed(2);setGG(g=>+(g+ret).toFixed(2));notify(`Gold Growth +${ret}g!`,'gold');}},120000);return()=>clearInterval(t);},[goldGrowthBal]);
  useEffect(()=>{const t=setInterval(()=>{if(jointBal>0){const ret=Math.floor(jointBal*.02);setJB(b=>b+ret);notify(`Joint Fund +🪙${ret}!`,'gold');}},90000);return()=>clearInterval(t);},[jointBal]);

  // ── Stall sync ────────────────────────────────────────────
  useEffect(()=>{
    if(!db||!playerId)return;
    const stall={...stallCfg,playerId,farmName,listings:listings.filter(l=>l.sellerId===playerId&&l.expiresAt>Date.now()),lastSeen:Date.now()};
    set(ref(db,`stalls/${playerId}`),stall).catch(()=>{});
  },[stallCfg,listings,farmName,playerId]);

  useEffect(()=>{
    if(!db)return;
    const unsub=onValue(ref(db,'stalls'),sn=>{
      if(sn.exists()){
        const data=sn.val();
        const stalls=Object.values(data).filter(s=>s.playerId!==playerId&&Date.now()-s.lastSeen<3600000);
        setAllStalls(stalls);
      }else setAllStalls([]);
    });
    return()=>unsub();
  },[playerId]);

  // ── Market sync ───────────────────────────────────────────
  useEffect(()=>{
    if(!db)return;
    const unsub=onValue(ref(db,'market'),sn=>{
      if(sn.exists()){
        const data=sn.val();
        if(data&&typeof data==='object'){
          const now=Date.now();
          setListings(Object.values(data).filter(l=>l&&l.expiresAt>now).sort((a,b)=>b.expiresAt-a.expiresAt));
        }
      }else setListings([]);
    });
    return()=>unsub();
  },[]);

  // ── Automation ────────────────────────────────────────────
  const runAuto=useCallback(()=>{
    const now=Date.now(),ms=machR.current,ts=tilesR.current,sl=siloR.current,fl=fuelR.current;
    if(!ms||!ts||!sl)return;
    let nT=[...ts],nS={...sl},nF=fl,cE=0,cD=0,xpG=0,durUpd={},anyChg=false;
    const smult=upgradesR.current?.siloBoost?1.1:1;
    Object.entries(ms).forEach(([mId,m])=>{
      if(!m.owned||!m.active||m.dur<=0)return;
      const def=MACH_DEF[mId],tier=def.tiers[m.tier];
      if(now-m.lastCycle<tier.s*1000)return;
      if(nF<tier.f){setMach(p=>({...p,[mId]:{...p[mId],active:false}}));notify(`${def.name} stopped — out of fuel!`,'orange');return;}
      nF-=tier.f;durUpd[mId]=Math.max(0,m.dur-0.4);anyChg=true;
      if(mId==='plow'){let c=tier.t;nT=nT.map(t=>t.state==='empty'&&c-->0?{...t,state:'plowed'}:t);}
      else if(mId==='seeder'){
        const q=[...machR.current.seeder.queue];let c=tier.t,qi=0;
        nT=nT.map(t=>{if(t.state==='plowed'&&c>0&&qi<q.length){const cr=CROPS.find(x=>x.id===q[qi]);if(cr&&coinsRf.current-cD>=cr.cost){cD+=cr.cost;qi++;c--;return{...t,state:'planted',crop:cr,growsAt:now+cr.grow*1000,watered:false};}return t;}return t;});
        if(qi>0)setMach(p=>({...p,seeder:{...p.seeder,queue:p.seeder.queue.slice(qi)}}));
      }
      else if(mId==='fertiliser'){let c=8;nT=nT.map(t=>t.state==='planted'&&!t.fertilised&&c-->0?{...t,fertilised:true,growsAt:now+Math.max(0,t.growsAt-now)*(1-tier.sb)}:t);}
      else if(mId==='irrigation'){let c=tier.cv;nT=nT.map(t=>t.state==='planted'&&!t.watered&&c-->0?{...t,watered:true,growsAt:now+Math.max(0,t.growsAt-now)*.65}:t);}
      else if(mId==='harvester'){let c=tier.t;nT=nT.map(t=>{if(t.state==='ready'&&c-->0){const cr=t.crop,qty=Math.random()<tier.bc?2:1;nS[cr.id]=(nS[cr.id]||0)+qty;cE+=cr.base*smult*qty;xpG+=cr.xp;return{...t,state:'empty',crop:null,growsAt:0,watered:false,fertilised:false};}return t;});}
    });
    if(anyChg){
      setTiles(nT);setSilo(nS);setFuel(nF);
      if(Object.keys(durUpd).length)setMach(p=>{const n={...p};Object.entries(durUpd).forEach(([id,d])=>{n[id]={...n[id],dur:d,lastCycle:now};});return n;});
      if(cE>0){setCoins(c=>c+Math.round(cE));setTE(t=>t+Math.round(cE));}
      if(cD>0)setCoins(c=>Math.max(0,c-cD));
      if(xpG>0)setXp(x=>x+xpG);
    }
  },[notify]);
  useEffect(()=>{const t=setInterval(runAuto,2500);return()=>clearInterval(t);},[runAuto]);

  // ── Helpers ───────────────────────────────────────────────
  const notify=(msg,type='green')=>{const id=Date.now()+Math.random();setNotifs(n=>[...n,{id,msg,type}]);setTimeout(()=>setNotifs(n=>n.filter(x=>x.id!==id)),2800);};
  const earn=amt=>{
    const debt=loanRef.current;const bonus=Math.round(amt*friendBonus);const total=amt+bonus;
    if(debt>0){const debit=Math.min(debt,Math.round(total*.1));setLoanDebt(d=>{const nd=Math.max(0,d-debit);if(nd===0&&d>0)notify('Loan fully repaid!','green');return nd;});setCoins(c=>c+total-debit);}
    else setCoins(c=>c+total);
    setTE(t=>t+total);setTDE(e=>e+total);
  };
  const spend=amt=>{setCoins(c=>c-amt);setTDS(s=>s+amt);};
  const addCollected=id=>setCollected(c=>{if(c.includes(id))return c;return[...c,id];});
  const updateFN=async n=>{setFarmName(n);try{await window.storage.set('farm_name',n);}catch{}};
  const updateTheme=async id=>{setThemeId(id);try{await window.storage.set('theme_id',id);}catch{}};

  // ── Farm ──────────────────────────────────────────────────
  const buyLand=()=>{
    const idx=landPlots-3;if(idx>=LAND_PRICES.length){notify('Maximum land!','orange');return;}
    const p=LAND_PRICES[idx];if(coins<p){notify(`Need 🪙${p.toLocaleString()}!`,'orange');return;}
    spend(p);setLP(l=>l+1);
    setTiles(ts=>[...ts,...Array(4).fill(null).map((_,i)=>({id:ts.length+i,state:'empty',crop:null,growsAt:0,watered:false}))]);
    notify('+4 new fields!','green');
  };
  const tapTile=tile=>{
    if(tile.state==='empty'){setTiles(ts=>ts.map(ti=>ti.id===tile.id?{...ti,state:'plowed'}:ti));setStamina(s=>Math.max(0,s-1));notify('Plowed!');}
    else if(tile.state==='plowed'){
      if(coins<selCrop.cost){notify('Not enough coins!','orange');return;}
      spend(selCrop.cost);
      const growMult=upgrades.greenhouse?.6:1;
      const at=Date.now()+selCrop.grow*1000*growMult;
      setTiles(ts=>ts.map(ti=>ti.id===tile.id?{...ti,state:'planted',crop:selCrop,growsAt:at,watered:false}:ti));
      setStamina(s=>Math.max(0,s-.5));notify(`${selCrop.emoji} Planted!`);
    }
    else if(tile.state==='ready'){
      const crop=tile.crop,sp=cropPrice(crop);
      const qty=upgrades.richSoil?2:1;
      setSilo(s=>({...s,[crop.id]:(s[crop.id]||0)+qty}));
      setTH(h=>({...h,[crop.id]:(h[crop.id]||0)+qty}));
      setXp(x=>x+crop.xp);
      if(crop.id==='golden')setGH(h=>h+qty);
      setTiles(ts=>ts.map(ti=>ti.id===tile.id?{...ti,state:'empty',crop:null,growsAt:0,watered:false}:ti));
      addCollected(crop.id);
      setDQP(p=>({...p,dqH:p.dqH+1}));
      notify(`${crop.emoji} Harvested!`,'green');
    }
  };
  const plantAll=()=>{
    const plowed=tiles.filter(t=>t.state==='plowed');
    if(!plowed.length){notify('No plowed fields!','orange');return;}
    const cost=plowed.length*selCrop.cost;
    if(coins<cost){notify(`Need 🪙${cost.toLocaleString()} for ${plowed.length} fields!`,'orange');return;}
    spend(cost);
    const growMult=upgrades.greenhouse?.6:1;
    const at=Date.now()+selCrop.grow*1000*growMult;
    setTiles(ts=>ts.map(t=>t.state==='plowed'?{...t,state:'planted',crop:selCrop,growsAt:at,watered:false}:t));
    notify(`Planted ${plowed.length}x ${selCrop.emoji}!`,'green');
  };
  const harvestAll=()=>{
    const ready=tiles.filter(t=>t.state==='ready');
    if(!ready.length){notify('Nothing ready!','orange');return;}
    const ns={...silo},nh={...totalHarv};let txp=0,ng=0;
    const qty=upgrades.richSoil?2:1;
    ready.forEach(t=>{const c=t.crop;ns[c.id]=(ns[c.id]||0)+qty;nh[c.id]=(nh[c.id]||0)+qty;txp+=c.xp;if(c.id==='golden')ng+=qty;addCollected(c.id);});
    setSilo(ns);setTH(nh);setXp(x=>x+txp);if(ng)setGH(h=>h+ng);
    setTiles(ts=>ts.map(t=>t.state==='ready'?{...t,state:'empty',crop:null,growsAt:0,watered:false}:t));
    setDQP(p=>({...p,dqH:p.dqH+ready.length}));
    notify(`Harvested ${ready.length} crops! +${txp}XP`,'gold');
  };
  const waterAll=()=>{
    let cnt=0;
    setTiles(ts=>ts.map(t=>{if(t.state!=='planted'||t.watered)return t;cnt++;const rem=Math.max(0,t.growsAt-Date.now());return{...t,watered:true,growsAt:Date.now()+rem*.7};}));
    if(cnt>0)notify(`Watered ${cnt} crops! -30% grow time`,'blue');else notify('No growing crops!','orange');
  };
  const autoPlow=()=>{
    let cnt=0;
    setTiles(ts=>{const n=ts.map(t=>{if(t.state==='empty'&&cnt<(mach.plow.owned?MACH_DEF.plow.tiers[mach.plow.tier].t:4)){cnt++;return{...t,state:'plowed'};}return t;});return n;});
    setTimeout(()=>{if(cnt>0)notify(`Auto-plowed ${cnt} fields!`,'green');else notify('No empty fields!','orange');},50);
  };
  const td=tile=>{
    if(tile.state==='empty')return{bg:'#b5835a',emoji:'',sub:'Plow'};
    if(tile.state==='plowed')return{bg:'#7a5230',emoji:'🌱',sub:'Plant'};
    if(tile.state==='planted'){const pct=Math.max(0,Math.min(100,((tile.growsAt-Date.now())/(tile.crop?.grow*1000||1))*100));return{bg:'#2d7a27',emoji:tile.watered?'💧':'🌱',sub:`${Math.round(100-pct)}%`};}
    if(tile.state==='ready')return{bg:'#27ae60',emoji:tile.crop?.emoji,sub:'Harvest!',glow:true};
    return{bg:'#b5835a',emoji:'',sub:''};
  };

  // ── Silo ──────────────────────────────────────────────────
  const sellFrom=(crop,qty)=>{if(!qty)return;const sp=cropPrice(crop);earn(qty*sp);setSilo(s=>({...s,[crop.id]:0}));notify(`Sold ${qty}x ${crop.emoji} 🪙${(qty*sp).toLocaleString()}`,'gold');};
  const sellOne=crop=>{if(!silo[crop.id])return;earn(cropPrice(crop));setSilo(s=>({...s,[crop.id]:s[crop.id]-1}));notify(`Sold 1x ${crop.emoji}`,'gold');};
  const sellAll=()=>{if(!siloTotal){notify('Silo empty!','orange');return;}earn(siloValue);setSilo({});notify(`Sold all 🪙${siloValue.toLocaleString()}`,'gold');};

  // ── Animals ───────────────────────────────────────────────
  const buyAnimal=a=>{
    if(ownedAnimals[a.id]){notify('Already owned!','orange');return;}
    if(coins<a.buyCost){notify(`Need 🪙${a.buyCost.toLocaleString()}!`,'orange');return;}
    spend(a.buyCost);setOwnedAnimals(o=>({...o,[a.id]:true}));
    notify(`${a.emoji} ${a.name} purchased!`,'green');
  };
  const collectAnimal=a=>{
    if(!ownedAnimals[a.id]){notify(`Buy a ${a.name} first!`,'orange');return;}
    if(animalCd[a.id]){notify('Resting...','orange');return;}
    if(a.value===0){setStamina(s=>Math.min(100,s+15));notify('+15 Stamina! 🐎','green');return;}
    earn(a.value);setXp(x=>x+5);notify(`+🪙${a.value} ${a.pe}`,'gold');
    setAT(at=>{const n=new Set(at);n.add(a.id);return n;});
    setAnimalCd(c=>({...c,[a.id]:true}));
    setTimeout(()=>setAnimalCd(c=>{const n={...c};delete n[a.id];return n;}),12000);
  };
  const slaughter=a=>{
    if(!ownedAnimals[a.id]){notify(`Buy a ${a.name} first!`,'orange');return;}
    if(!a.meat)return;
    setMeatInv(p=>({...p,[a.id]:(p[a.id]||0)+1}));
    setOwnedAnimals(o=>({...o,[a.id]:false}));
    notify(`${a.me} ${a.meat} added! Animal removed.`,'green');
  };
  const eatMeat=a=>{if(!meatInv[a.id]){notify('No meat!','orange');return;}setMeatInv(p=>({...p,[a.id]:p[a.id]-1}));setStamina(s=>Math.min(100,s+a.ms));notify(`+${a.ms} Stamina!`,'green');};
  const sellMeat=a=>{const q=meatInv[a.id]||0;if(!q){notify('No meat!','orange');return;}earn(q*a.mv);setMeatInv(p=>({...p,[a.id]:0}));notify(`Sold ${q}x ${a.me} 🪙${(q*a.mv).toLocaleString()}`,'gold');};

  // ── Mine ──────────────────────────────────────────────────
  const mine=()=>{
    if(level<5){notify('Mine unlocks at Level 5!','orange');return;}if(mineCd){notify('Mining...','orange');return;}
    setMineCd(true);notify('Mining...');
    setTimeout(()=>{
      const roll=Math.random();let cum=0,found=MINERALS[0];
      for(const m of MINERALS){
        const rate=m.r*(upgrades.mineBoost&&m.r<.1?2:1);
        cum+=rate;if(roll<Math.min(cum,1)){found=m;break;}
      }
      setMin(p=>({...p,[found.id]:(p[found.id]||0)+1}));setXp(x=>x+found.xp);
      setMTotal(t=>t+1);addCollected(found.id);setDQP(p=>({...p,dqM:p.dqM+1}));
      notify(`Found ${found.emoji} ${found.name}!`,'gold');setMineCd(false);
    },1600);
  };
  const sellMin=m=>{const q=minerals[m.id]||0;if(!q)return;earn(q*m.v);setMin(p=>({...p,[m.id]:0}));notify(`Sold ${q}x ${m.emoji} 🪙${(q*m.v).toLocaleString()}`,'gold');};

  // ── Gold ──────────────────────────────────────────────────
  const buyGoldF=()=>{const g=parseFloat(goldBuy);if(!g||g<=0)return;const c=Math.ceil(g*goldPrice);if(coins<c){notify('Not enough!','orange');return;}spend(c);setGold(h=>+(h+g).toFixed(2));setGoldBuy('');notify(`Bought ${g}g!`,'gold');};
  const sellGoldF=()=>{const g=parseFloat(goldSell);if(!g||g<=0||g>goldHeld){notify('Invalid!','orange');return;}earn(Math.floor(g*goldPrice));setGold(h=>+(h-g).toFixed(2));setGoldSell('');notify(`Sold ${g}g 🪙${Math.floor(g*goldPrice).toLocaleString()}`,'gold');};

  // ── Tasks ─────────────────────────────────────────────────
  const acceptTask=id=>setTasks(ts=>ts.map(t=>t.id===id?{...t,accepted:true}:t));
  const abandonTask=id=>setTasks(ts=>ts.map(t=>t.id===id?{...t,accepted:false}:t));
  const canComplete=task=>(task.inv==='silo'?(silo[task.itemId]||0):(minerals[task.itemId]||0))>=task.qty;
  const completeTask=task=>{
    if(!canComplete(task)){notify('Not enough items!','orange');return;}
    if(task.inv==='silo')setSilo(s=>({...s,[task.itemId]:(s[task.itemId]||0)-task.qty}));
    else setMin(m=>({...m,[task.itemId]:(m[task.itemId]||0)-task.qty}));
    const isBF=getFP(friendship[task.npcId]||0).label==='Best Friend';
    const payout=isBF?Math.round(task.coins*1.2):task.coins;
    earn(payout);setXp(x=>x+task.xp);
    if(task.rfood)setPetInv(p=>({...p,petFood:p.petFood+task.rfood}));
    if(task.rtoy)setPetInv(p=>({...p,toys:p.toys+task.rtoy}));
    if(task.diff==='hard')setHT(h=>h+1);
    setFP(f=>({...f,[task.npcId]:Math.min(300,(f[task.npcId]||0)+task.fp)}));
    setTasks(ts=>ts.filter(t=>t.id!==task.id));
    setDQP(p=>({...p,dqT:p.dqT+1}));
    notify(`Done! +🪙${payout}${isBF?' (Best Friend bonus!)':''}`,'gold');
  };

  // ── Daily ─────────────────────────────────────────────────
  const claimDaily=()=>{
    const today=todayStr();
    if(dailyClaimed||lastLogin===today){notify('Already claimed today!','orange');setDC(true);return;}
    const dayIdx=Math.min(streak%7,6);const r=DR[dayIdx];
    earn(r.coins);setXp(x=>x+r.xp);
    if(r.petFood)setPetInv(p=>({...p,petFood:p.petFood+r.petFood}));
    if(r.toys)setPetInv(p=>({...p,toys:p.toys+r.toys}));
    setStreak(s=>s+1);setLastLogin(today);setDC(true);
    notify(`Day ${dayIdx+1} reward! +🪙${r.coins}`,'gold');
  };
  const claimDQ=dq=>{
    if(dqDone.includes(dq.id)){notify('Already claimed!','orange');return;}
    if((dqP[dq.key]||0)<dq.target){notify(`Not complete yet! ${dqP[dq.key]||0}/${dq.target}`,'orange');return;}
    earn(dq.reward.coins);setXp(x=>x+dq.reward.xp);
    if(dq.reward.petFood)setPetInv(p=>({...p,petFood:p.petFood+dq.reward.petFood}));
    setDQDone(d=>[...d,dq.id]);
    notify(`Quest done! +🪙${dq.reward.coins}`,'gold');
  };

  // ── Pets ──────────────────────────────────────────────────
  const adoptPet=pt=>{if(coins<pt.cost){notify(`Need 🪙${pt.cost}!`,'orange');return;}if(pets.length>=3){notify('Max 3 pets!','orange');return;}spend(pt.cost);setPets(p=>[...p,{id:`pet_${Date.now()}`,typeId:pt.id,name:pt.name,hunger:100,happiness:100,petXp:0,petLevel:1}]);notify(`${pt.emoji} ${pt.name} adopted!`,'green');};
  const feedPet=id=>{
    if(petInv.petFood<=0){notify('No Pet Food! Craft some first.','orange');return;}
    setPetInv(p=>({...p,petFood:p.petFood-1}));
    setPets(ps=>ps.map(p=>{if(p.id!==id)return p;const nx=p.petXp+5,nl=nx>=p.petLevel*50?p.petLevel+1:p.petLevel;return{...p,hunger:Math.min(100,p.hunger+35),petXp:nx,petLevel:nl};}));
    setXp(x=>x+5);notify('Pet fed! +5 XP','green');
  };
  const playPet=id=>{
    const ht=petInv.toys>0;if(ht)setPetInv(p=>({...p,toys:p.toys-1}));
    setPets(ps=>ps.map(p=>{if(p.id!==id)return p;const nx=p.petXp+5,nl=nx>=p.petLevel*50?p.petLevel+1:p.petLevel;return{...p,happiness:Math.min(100,p.happiness+(ht?30:15)),petXp:nx,petLevel:nl};}));
    setXp(x=>x+5);notify(ht?'Played with toy! +5 XP':'Played! +5 XP','green');
  };

  // ── Crafting ──────────────────────────────────────────────
  const canCraft=r=>Object.entries(r.ing).every(([id,qty])=>{const inS=CROPS.find(c=>c.id===id);return inS?(silo[id]||0)>=qty:(minerals[id]||0)>=qty;});
  const craft=r=>{
    if(!canCraft(r)){notify('Not enough ingredients!','orange');return;}
    const ns={...silo},nm={...minerals};
    Object.entries(r.ing).forEach(([id,qty])=>{const inS=CROPS.find(c=>c.id===id);if(inS)ns[id]=(ns[id]||0)-qty;else nm[id]=(nm[id]||0)-qty;});
    setSilo(ns);setMin(nm);
    setCraftInv(c=>({...c,[r.id]:(c[r.id]||0)+1}));
    setXp(x=>x+r.xp);addCollected(r.id);
    notify(`Crafted ${r.emoji} ${r.name}!`,'gold');
  };
  const sellCrafted=r=>{const q=craftInv[r.id]||0;if(!q)return;earn(q*r.sell);setCraftInv(c=>({...c,[r.id]:0}));notify(`Sold ${q}x ${r.emoji} 🪙${(q*r.sell).toLocaleString()}`,'gold');};

  // ── Market ────────────────────────────────────────────────
  const addListing=async(itemId,qty,price,type,emoji,name)=>{
    if(type==='silo'&&(silo[itemId]||0)<qty){notify('Not enough in Silo!','orange');return;}
    if(type==='mineral'&&(minerals[itemId]||0)<qty){notify('Not enough minerals!','orange');return;}
    if(type==='silo')setSilo(s=>({...s,[itemId]:(s[itemId]||0)-qty}));
    else setMin(m=>({...m,[itemId]:(m[itemId]||0)-qty}));
    const listing={id:`${Date.now()}_${playerId}`,itemId,qty,price,type,emoji,name,seller:farmName,sellerId:playerId,expiresAt:Date.now()+24*3600000};
    if(db){try{await set(ref(db,`market/${listing.id}`),listing);}catch(e){console.log('Listing error:',e);}}
    notify(`Listed ${qty}x ${name}!`,'green');
  };
  const buyListing=async l=>{
    if(l.sellerId===playerId){notify('Cannot buy own listing!','orange');return;}
    const total=l.price*l.qty;if(coins<total){notify('Not enough coins!','orange');return;}
    spend(total);
    if(l.type==='silo')setSilo(s=>({...s,[l.itemId]:(s[l.itemId]||0)+l.qty}));
    else setMin(m=>({...m,[l.itemId]:(m[l.itemId]||0)+l.qty}));
    if(db){try{await set(ref(db,`market/${l.id}`),null);}catch(e){console.log('Buy error:',e);}}
    notify(`Bought ${l.qty}x ${l.name}!`,'gold');
  };

  // ── Chat ──────────────────────────────────────────────────
  const sendChat=useCallback(async(ch,text)=>{
    if(['spam','scam','hack'].some(w=>text.toLowerCase().includes(w))){notify('Blocked.','orange');return false;}
    const msg={id:`${Date.now()}_${playerId}`,author:playerId,farm:farmName,text:String(text),time:Date.now()};
    setChat(m=>({...m,[ch]:[...m[ch].slice(-49),msg]}));
    if(db){try{await set(ref(db,`globalchat/${ch}/${msg.id}`),msg);}catch(e){console.log('Chat error:',e);}}
    return true;
  },[playerId,farmName]);

  // ── Loans ─────────────────────────────────────────────────
  const takeEmergencyLoan=amt=>{
    const MAX=500;if(loanDebt>0){notify('Repay current loan first!','orange');return;}
    if(amt>MAX||amt<=0){notify(`Emergency loan max is 🪙${MAX}.`,'orange');return;}
    setCoins(c=>c+amt);setTE(t=>t+amt);setTDE(e=>e+amt);setLoanDebt(amt);
    notify(`🪙${amt} loan approved. 10% of earnings auto-debits.`,'blue');
  };

  // ── Friends ───────────────────────────────────────────────
  const sendFriendHelp=async fid=>{
    if(!fid||!worldCode)return;
    const today=todayStr();
    try{
      await set(ref(db,`fhelp/${worldCode}/${playerId}/${fid}/${today}`),'1');
      const r=await get(child(ref(db),`fhelp/${worldCode}/${fid}/${playerId}/${today}`));
      if(r.exists()){
        const ns=lastFriendHelp===today?friendStreak:friendStreak+1;
        setFS(ns);setLFH(today);
        const bonus=Math.min(ns*50,250);earn(bonus);
        notify(`Mutual help! Streak ${ns} days. +🪙${bonus}!`,'gold');
      }else{setLFH(today);notify('Help sent! Both get bonus when friend helps back.','green');}
    }catch{setLFH(today);notify('Help sent!','green');}
  };

  // ── Upgrades ──────────────────────────────────────────────
  const buyUpgrade=up=>{if(upgrades[up.id]){notify('Already owned!','orange');return;}if(coins<up.cost){notify(`Need 🪙${up.cost.toLocaleString()}!`,'orange');return;}spend(up.cost);setUpgrades(u=>({...u,[up.id]:true}));notify(`${up.emoji} ${up.name} activated!`,'gold');};

  // ── Machines ──────────────────────────────────────────────
  const buyMach=mId=>{const def=MACH_DEF[mId];if(coins<def.cost){notify(`Need 🪙${def.cost.toLocaleString()}!`,'orange');return;}spend(def.cost);setMach(p=>({...p,[mId]:{...p[mId],owned:true}}));notify(`${def.name} purchased!`,'green');};
  const upgMach=mId=>{const m=mach[mId],def=MACH_DEF[mId];if(m.tier>=4){notify('Already max tier!','orange');return;}const cost=def.upg[m.tier+1];if(coins<cost){notify(`Need 🪙${cost.toLocaleString()}!`,'orange');return;}spend(cost);setMach(p=>({...p,[mId]:{...p[mId],tier:p[mId].tier+1}}));notify(`${def.name} upgraded!`,'gold');};
  const toggleMach=mId=>{const m=mach[mId];if(!m.owned)return;if(m.dur<=0){notify('Repair first!','orange');return;}if(fuel<=0&&!m.active){notify('Buy fuel first!','orange');return;}const was=m.active;setMach(p=>({...p,[mId]:{...p[mId],active:!p[mId].active,lastCycle:Date.now()}}));notify(!was?'Machine started! 🟢':'Machine stopped.','green');};
  const repairMach=mId=>{if(coins<200){notify('Need 🪙200!','orange');return;}spend(200);setMach(p=>({...p,[mId]:{...p[mId],dur:100}}));notify('Repaired! ✅','green');};
  const buyFuelF=item=>{if(coins<item.cost){notify(`Need 🪙${item.cost}!`,'orange');return;}spend(item.cost);setFuel(f=>Math.min(200,f+item.amt));notify(`+${item.amt} fuel!`,'green');};
  const addToQueue=(cropId,qty=5)=>{setMach(p=>({...p,seeder:{...p.seeder,queue:[...p.seeder.queue,...Array(qty).fill(cropId)]}}));const cr=CROPS.find(c=>c.id===cropId);notify(`Added ${qty}x ${cr?.emoji} to queue!`,'green');};
  const clearQueue=()=>{setMach(p=>({...p,seeder:{...p.seeder,queue:[]}}));notify('Queue cleared.','orange');};

  const nc={green:'#27ae60',gold:'#b7800a',orange:'#e67e22',blue:'#2980b9'};
  const isHome=screen==='home';
  const screenLabel=MENU_DEF.flatMap(s=>s.items).find(i=>i.id===screen);

  const G={coins,earn,spend,notify,level,xp,setXp,totalEarned,todayEarned,todaySpent,bankBal,setBankBal,goldHeld,goldPrice,goldBuy,setGoldBuy,goldSell,setGoldSell,buyGoldF,sellGoldF,animalCd,collectAnimal,buyAnimal,ownedAnimals,minerals,mine,mineCd,sellMin,stallCfg,setStall,stamina,setStamina,meatInv,slaughter,eatMeat,sellMeat,silo,setSilo,siloTotal,siloValue,sellFrom,sellOne,sellAll,totalHarv,setScreen,farmName,updateFN,themeId,updateTheme,worldCode,setWC,playerId,T,season,seasonIdx,setSeasonIdx,cropPrice,tasks,activeTasks,availTasks,acceptTask,abandonTask,canComplete,completeTask,setTasks,pets,petInv,adoptPet,feedPet,playPet,chatMsgs,sendChat,setChat,blocked,setBlocked,streak,lastLogin,dailyClaimed,setDC,claimDaily,craftInv,craft,canCraft,sellCrafted,collected,friendship,hardTasks,minedTotal,goldenHarv,animalTypes,listings,addListing,buyListing,setMin,loanDebt,takeEmergencyLoan,setLoanDebt,dqP,dqDone,claimDQ,friendsList,setFriendsList,friendStreak,lastFriendHelp,sendFriendHelp,upgrades,buyUpgrade,goldGrowthBal,setGGB,goldGrowth,setGG,goldHeld,jointBal,setJB,friendBonus,plantAll,harvestAll,waterAll,autoPlow,mach,fuel,offRep,setOffRep,buyMach,upgMach,toggleMach,repairMach,buyFuelF,addToQueue,clearQueue,MACH_DEF,FUEL_SHOP,allStalls,visitingStall,setVisitingStall,saveGame};

  // Import screens dynamically - in VS Code this comes from Screens.js
  // For preview we inline a minimal version
  const {HomeScreen,FarmScreen,SiloScreen,DailyScreen,CraftingScreen,TaskBoardScreen,PetsScreen,CollectionsScreen,GoalsScreen,AnimalsScreen,ButcheryScreen,MineScreen,MarketScreen,GmbScreen,StallScreen,BankScreen,GoldScreen,FinanceScreen,ChatScreen,GarageScreen,FarmhouseScreen,VisitStallScreen,VisitStallsListScreen}=window.__HHScreens||{};

  const renderScreen=()=>{
    const props={G,tiles,tapTile,td,selCrop,setSelCrop,landPlots,buyLand};
    if(!HomeScreen)return<div style={{padding:20,textAlign:'center',color:'#1a6b2a',fontSize:14}}>Loading screens... Make sure Screens.js is imported.</div>;
    switch(screen){
      case 'home': return<HomeScreen G={G} siloTotal={siloTotal} siloValue={silo