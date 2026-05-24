import { useState, useEffect, useCallback, useRef } from 'react';
import { db, ref, set, get, child, onValue, auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase';

// ─── Storage Polyfill ─────────────────────────────────────────
// Works inside Claude AND in any real browser (localStorage fallback)
if(typeof window!=='undefined'&&!window.storage){
  const _db={};
  window.storage={
    get:async(key,shared=false)=>{
      try{
        const k=shared?`shared_${key}`:key;
        const v=localStorage.getItem(k);
        return v?{value:v}:null;
      }catch{return null;}
    },
    set:async(key,value,shared=false)=>{
      try{
        const k=shared?`shared_${key}`:key;
        localStorage.setItem(k,String(value));
        return{key,value};
      }catch{return null;}
    },
    list:async(prefix,shared=false)=>{
      try{
        const p=shared?`shared_${prefix}`:prefix;
        const keys=Object.keys(localStorage).filter(k=>k.startsWith(p));
        return{keys};
      }catch{return{keys:[]};}
    },
    delete:async(key,shared=false)=>{
      try{localStorage.removeItem(shared?`shared_${key}`:key);return{key};}catch{return null;}
    }
  };
}
const THEMES=[{id:'forest',name:'🌿 Forest',bg:'linear-gradient(170deg,#a8d8ea,#b8e4c9 55%,#d4f1b8)',primary:'#1a6b2a',accent:'#27ae60',light:'#eef7ee'},{id:'ocean',name:'🌊 Ocean',bg:'linear-gradient(170deg,#c8e6ff,#b3d9f5 55%,#d4eaf8)',primary:'#1a4f76',accent:'#2980b9',light:'#eaf4fb'},{id:'rose',name:'🌹 Rose',bg:'linear-gradient(170deg,#fce4ec,#f8bbd0 55%,#f3e5f5)',primary:'#880e4f',accent:'#c2185b',light:'#fce8f0'},{id:'autumn',name:'🍂 Autumn',bg:'linear-gradient(170deg,#fff3e0,#ffe0b2 55%,#ffcc80)',primary:'#bf360c',accent:'#e64a19',light:'#fef3e8'},{id:'lavender',name:'🪻 Lavender',bg:'linear-gradient(170deg,#ede7f6,#d1c4e9 55%,#c3a8e1)',primary:'#6c3483',accent:'#8e44ad',light:'#f3eafa'},{id:'teal',name:'🩵 Teal',bg:'linear-gradient(170deg,#e0f7fa,#b2ebf2 55%,#80deea)',primary:'#00695c',accent:'#00897b',light:'#e0f2f1'},{id:'sunset',name:'🌅 Sunset',bg:'linear-gradient(170deg,#fff8e1,#ffe0b2 55%,#ffb74d)',primary:'#e65100',accent:'#f57c00',light:'#fff3e0'},{id:'night',name:'🌙 Night',bg:'linear-gradient(170deg,#1a1a2e,#16213e 55%,#0d2346)',primary:'#7986cb',accent:'#5c6bc0',light:'#252540'}];
const SEASONS=[
  {name:'Spring',emoji:'🌸',col:'#c2185b',boost:{wheat:1.1,tomato:1.2,strawberry:1.3,blueberry:1.2,lavender:1.4,sunflower:1.2,pepper:1.1}},
  {name:'Summer',emoji:'☀️',col:'#f57c00',boost:{corn:1.2,pumpkin:1.1,blueberry:1.3,golden:1.1,watermelon:1.5,grape:1.3,chili:1.4,cotton:1.2}},
  {name:'Autumn',emoji:'🍂',col:'#5d4037',boost:{pumpkin:1.4,wheat:1.2,carrot:1.3,corn:1.1,mushroom:1.5,potato:1.3,onion:1.2,eggplant:1.2}},
  {name:'Winter',emoji:'❄️',col:'#1565c0',boost:{golden:1.5,carrot:1.2,diamond_flower:1.8,cotton:1.3,mushroom:1.2}},
];
// All crops max 5 minutes
const CROPS=[
  {id:'wheat',name:'Wheat',emoji:'🌾',cost:10,base:25,xp:5,grow:30},
  {id:'corn',name:'Corn',emoji:'🌽',cost:15,base:38,xp:8,grow:45},
  {id:'tomato',name:'Tomato',emoji:'🍅',cost:20,base:52,xp:10,grow:60},
  {id:'strawberry',name:'Strawberry',emoji:'🍓',cost:25,base:68,xp:13,grow:90},
  {id:'carrot',name:'Carrot',emoji:'🥕',cost:18,base:46,xp:9,grow:45},
  {id:'pumpkin',name:'Pumpkin',emoji:'🎃',cost:30,base:80,xp:15,grow:120},
  {id:'blueberry',name:'Blueberry',emoji:'🫐',cost:35,base:95,xp:18,grow:180},
  {id:'golden',name:'Golden Grain',emoji:'✨',cost:100,base:300,xp:50,grow:300},
  // New crops
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
];const ANIMALS=[{id:'cow',emoji:'🐄',name:'Cow',product:'Milk',pe:'🥛',value:40,ml:1,meat:'Beef',me:'🥩',ms:80,mv:120},{id:'chicken',emoji:'🐔',name:'Chicken',product:'Eggs',pe:'🥚',value:25,ml:1,meat:'Chicken',me:'🍗',ms:40,mv:60},{id:'sheep',emoji:'🐑',name:'Sheep',product:'Wool',pe:'🧶',value:55,ml:5,meat:'Lamb',me:'🍖',ms:60,mv:90},{id:'goat',emoji:'🐐',name:'Goat',product:'Goat Milk',pe:'🥛',value:35,ml:8,meat:'Goat Meat',me:'🍖',ms:55,mv:80},{id:'horse',emoji:'🐎',name:'Horse',product:'Stamina',pe:'⚡',value:0,ml:10,meat:null,me:null,ms:0,mv:0},{id:'duck',emoji:'🦆',name:'Duck',product:'Feathers',pe:'🪶',value:30,ml:12,meat:'Duck Meat',me:'🍗',ms:45,mv:70},{id:'rabbit',emoji:'🐇',name:'Rabbit',product:'Lucky Drops',pe:'🍀',value:45,ml:15,meat:'Rabbit Meat',me:'🍖',ms:35,mv:55}];
const MINERALS=[
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
  {id:'mythril',name:'Mythril',emoji:'🌀',r:.002,v:5000,xp:200},];
const RECIPES=[
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
  // Pet foods
  {id:'pet_bone',name:'Dog Bone',emoji:'🦴',ing:{wheat:2,iron:1},sell:30,xp:8,desc:'Pet food for Farm Dog'},
  {id:'pet_fish',name:'Pet Fish',emoji:'🐟',ing:{wheat:1,copper:1},sell:25,xp:7,desc:'Pet food for Barn Cat'},
  {id:'pet_seeds',name:'Seeds Mix',emoji:'🌱',ing:{wheat:3},sell:20,xp:6,desc:'Pet food for Parrot'},
  {id:'pet_carrot',name:'Pet Carrot',emoji:'🥕',ing:{carrot:2},sell:22,xp:6,desc:'Pet food for Lucky Bunny'},
  {id:'pet_meat',name:'Raw Meat',emoji:'🥩',ing:{corn:1,iron:1},sell:35,xp:9,desc:'Pet food for Farm Fox'},
  {id:'pet_honey',name:'Wild Honey',emoji:'🍯',ing:{sunflower:2,corn:1},sell:50,xp:12,desc:'Pet food for Honey Bear'},
  {id:'pet_gemstone',name:'Gemstone',emoji:'💎',ing:{diamond:1},sell:500,xp:50,desc:'Pet food for Dragon'},
];
  const NPCS={joe:{name:'Farmer Joe',emoji:'👨‍🌾',col:'#27ae60',lines:['Hello neighbour!','Great work today!','Fields look wonderful!','Really appreciate you!','Best farmer I know!']},mary:{name:'Market Mary',emoji:'👩‍💼',col:'#2980b9',lines:['Perfect quality!','My stall thanks you!','Fair deal always!','Premium goods!','My best supplier!']},tom:{name:'Miner Tom',emoji:'⛏️',col:'#546e7a',lines:['Good ore today!','Mine yields well!','Solid work!','Sharp pick!','Best miner!']},lily:{name:'Florist Lily',emoji:'🌸',col:'#c2185b',lines:['Beautiful harvest!','Blooms lovely!','Nature smiles!','Wonderful!','Garden thanks you!']},chef:{name:'Chef Carlos',emoji:'👨‍🍳',col:'#e67e22',lines:['Delicious!','Soup perfect!','Customers love it!','Finest produce!','You feed the town!']}};
const TASK_POOL=[{npcId:'joe',itemId:'wheat',qty:3,inv:'silo',coins:75,xp:15,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},{npcId:'chef',itemId:'tomato',qty:3,inv:'silo',coins:110,xp:18,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},{npcId:'lily',itemId:'corn',qty:4,inv:'silo',coins:95,xp:16,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},{npcId:'mary',itemId:'carrot',qty:5,inv:'silo',coins:140,xp:20,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},{npcId:'joe',itemId:'pumpkin',qty:2,inv:'silo',coins:130,xp:19,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},{npcId:'mary',itemId:'strawberry',qty:6,inv:'silo',coins:320,xp:45,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},{npcId:'chef',itemId:'blueberry',qty:5,inv:'silo',coins:380,xp:50,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},{npcId:'tom',itemId:'iron',qty:2,inv:'mineral',coins:200,xp:38,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},{npcId:'tom',itemId:'copper',qty:2,inv:'mineral',coins:260,xp:42,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},{npcId:'joe',itemId:'wheat',qty:10,inv:'silo',coins:350,xp:48,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},{npcId:'joe',itemId:'golden',qty:2,inv:'silo',coins:900,xp:120,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},{npcId:'tom',itemId:'diamond',qty:1,inv:'mineral',coins:1600,xp:160,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},{npcId:'mary',itemId:'emerald',qty:1,inv:'mineral',coins:2000,xp:180,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},{npcId:'chef',itemId:'strawberry',qty:15,inv:'silo',coins:1000,xp:130,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1}];
const DR=[{coins:50,xp:10},{coins:100,xp:20},{coins:150,xp:30,petFood:1},{coins:200,xp:40},{coins:300,xp:50,petFood:2},{coins:400,xp:60,toys:1},{coins:600,xp:100,petFood:3,toys:1}];
const DQ=[{id:'dq1',text:'Harvest 5 crops',key:'dqH',target:5,reward:{coins:80,xp:15}},{id:'dq2',text:'Mine 2 minerals',key:'dqM',target:2,reward:{coins:100,xp:20}},{id:'dq3',text:'Complete 1 NPC task',key:'dqT',target:1,reward:{coins:150,xp:25,petFood:1}}];
const PET_TYPES=[
  {id:'dog',name:'Farm Dog',emoji:'🐕',bonus:'Finds bonus seeds',cost:200,food:'bone'},
  {id:'cat',name:'Barn Cat',emoji:'🐈',bonus:'Animal product boost',cost:250,food:'fish'},
  {id:'parrot',name:'Parrot',emoji:'🦜',bonus:'Market price alerts',cost:300,food:'seeds'},
  {id:'bunny',name:'Lucky Bunny',emoji:'🐰',bonus:'Lucky crop drops',cost:350,food:'carrot'},
  {id:'fox',name:'Farm Fox',emoji:'🦊',bonus:'Mining bonus',cost:400,food:'meat'},
  {id:'owl',name:'Wise Owl',emoji:'🦉',bonus:'+15% XP from all actions',cost:450,food:'mouse'},
  {id:'bear',name:'Honey Bear',emoji:'🐻',bonus:'Doubles honey and fruit yields',cost:500,food:'honey'},
  {id:'dragon',name:'Farm Dragon',emoji:'🐲',bonus:'Burns weeds — auto clears empty tiles',cost:1000,food:'gemstone'},
  {id:'unicorn',name:'Unicorn',emoji:'🦄',bonus:'Rare chance to double any harvest',cost:1500,food:'rainbow'},
];
const BOOKS=[{id:'b1',title:"Beginner's Guide",emoji:'📗',ml:1,pages:[{t:'Welcome',c:"Plow fields, plant crops, wait for them to grow, harvest to Silo, sell for coins."},{t:'First Harvest',c:"1. Tap brown tile to plow\n2. Choose crop at top\n3. Tap plowed tile to plant\n4. Wait for the timer\n5. Tap glowing tile to harvest\n6. Go to Silo to sell!"}]},{id:'b2',title:'Farming Tips',emoji:'🌾',ml:1,pages:[{t:'Plant and Harvest All',c:"Use Plant All to plant your selected crop in every plowed tile at once. Use Harvest All to collect every ready crop in one tap."},{t:'Seasons',c:"Prices change each season. Pumpkins earn 40% more in Autumn. Golden Grain earns 50% more in Winter. Plan your planting!"}]},{id:'b3',title:'Missions',emoji:'📋',ml:1,pages:[{t:'Task Board',c:"NPCs post requests. Completing tasks earns coins, XP and pet supplies. Daily quests reset every day for extra bonuses."},{t:'NPC Friendship',c:"Each task builds friendship. Best Friend status gives a 20% coin bonus on that NPC's rewards. Check the NPC Friends tab."}]},{id:'b4',title:'Pets',emoji:'🐾',ml:1,pages:[{t:'Adopting',c:"Adopt up to 3 pets from My Pets. Each has a unique farm skill."},{t:'Care',c:"Feed pets with Pet Food earned from tasks. Play with Toys to boost happiness. Pets decay slowly and are forgiving."}]},{id:'b5',title:'Finance',emoji:'💰',ml:3,pages:[{t:'Bank Loans',c:"Emergency Loan is capped at 500 coins. 10% of every earning auto-debits until fully repaid. You can also repay manually at any time."},{t:'Gold Growth',c:"Deposit gold grams in the Gold Growth Account. Earn a simulated 2% return. Withdraw anytime with profits added."}]},{id:'b6',title:'Friends',emoji:'🤝',ml:1,pages:[{t:'Friend Bonuses',c:"Add friends by entering their Player ID in Farmhouse Friends tab. Send daily help to each other."},{t:'Mutual Streak',c:"When both you and a friend send help on the same day, your Mutual Help Streak grows. Each streak day adds a 5% earnings bonus up to 50%."}]}];
const CHAT_CH=['General','Help','Missions','Trading'];
const CH_COL={General:'#27ae60',Help:'#2980b9',Missions:'#8e44ad',Trading:'#e67e22'};
const SEED_CHAT={General:[{text:'Welcome to Harvest Haven!'},{text:'Anyone want to trade?'}],Help:[{text:'How do I unlock the mine?'},{text:'Best crop for level 3?'}],Missions:[{text:'Need diamonds!'},{text:'Just completed a hard task!'}],Trading:[{text:'Selling iron ore!'},{text:'Need golden grain'}]};
const MARKET_ITEMS=[{emoji:'🌾',name:'Wheat',price:45,trend:'+5%',up:true},{emoji:'🍅',name:'Tomato',price:80,trend:'-3%',up:false},{emoji:'🥛',name:'Milk',price:60,trend:'+8%',up:true},{emoji:'🥚',name:'Eggs',price:50,trend:'+2%',up:true},{emoji:'🪨',name:'Iron',price:120,trend:'+12%',up:true},{emoji:'🟡',name:'Gold Ore',price:350,trend:'+1%',up:true},{emoji:'🌹',name:'Roses',price:90,trend:'-1%',up:false},{emoji:'🧶',name:'Wool',price:75,trend:'+6%',up:true}];
const STALL_THEMES=[{id:'green',label:'Forest Fresh',color:'#1a6b2a'},{id:'gold',label:'Golden Harvest',color:'#b7800a'},{id:'rose',label:'Rose Garden',color:'#b5174f'},{id:'blue',label:'Cool Morning',color:'#1a5276'},{id:'purple',label:'Lavender Dream',color:'#6c3483'},{id:'dark',label:'Midnight Farm',color:'#212f3c'}];
const LAND_PRICES=[300,800,1800,3500,7000,14000,28000];
const LONG_GOALS=[
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
const MACH_DEF={
  plow:{id:'plow',name:'Plow Tractor',emoji:'🚜',desc:'Automatically plows empty tiles each cycle',cost:800,tiers:[{t:1,s:30,f:2,l:'Mk1'},{t:2,s:24,f:2.5,l:'Mk2'},{t:4,s:18,f:3,l:'Mk3'},{t:8,s:12,f:3.5,l:'Mk4'},{t:16,s:7,f:4,l:'Mk5'}],upg:[0,600,1400,3000,6000]},
  seeder:{id:'seeder',name:'Seeder Tractor',emoji:'🌱',desc:'Plants queued crops in plowed tiles automatically',cost:1000,tiers:[{t:1,s:35,f:2,l:'Mk1'},{t:2,s:28,f:2.5,l:'Mk2'},{t:3,s:22,f:3,l:'Mk3'},{t:4,s:16,f:3.5,l:'Mk4'},{t:6,s:10,f:4,l:'Mk5'}],upg:[0,800,2000,4000,8000]},
  fertiliser:{id:'fertiliser',name:'Fertiliser Spreader',emoji:'🌿',desc:'Boosts growth speed and harvest yield',cost:900,tiers:[{sb:.15,s:50,f:1.5,l:'Mk1'},{sb:.2,s:42,f:2,l:'Mk2'},{sb:.25,s:35,f:2.5,l:'Mk3'},{sb:.3,s:28,f:3,l:'Mk4'},{sb:.4,s:18,f:3.5,l:'Mk5'}],upg:[0,700,1600,3500,7000]},
  irrigation:{id:'irrigation',name:'Water Tank',emoji:'💧',desc:'Waters growing crops, cuts grow time 35%',cost:700,tiers:[{cv:4,s:60,f:1,l:'Mk1'},{cv:8,s:50,f:1.5,l:'Mk2'},{cv:16,s:40,f:2,l:'Mk3'},{cv:32,s:30,f:2.5,l:'Mk4'},{cv:999,s:20,f:3,l:'Mk5'}],upg:[0,500,1200,2500,5000]},
  harvester:{id:'harvester',name:'Combine Harvester',emoji:'🌾',desc:'Auto-harvests ready crops directly into silo',cost:2000,tiers:[{t:2,s:20,f:3,bc:.05,l:'Mk1'},{t:4,s:15,f:3.5,bc:.1,l:'Mk2'},{t:6,s:11,f:4,bc:.15,l:'Mk3'},{t:8,s:8,f:4.5,bc:.2,l:'Mk4'},{t:16,s:5,f:5,bc:.3,l:'Mk5'}],upg:[0,1200,2800,5500,10000]},
};
const FUEL_SHOP=[{name:'Small Can',emoji:'⛽',amt:25,cost:120},{name:'Large Can',emoji:'🪣',amt:75,cost:320},{name:'Full Tank',emoji:'🚛',amt:200,cost:750}];
const PET_FOODS={
  bone:{name:'Bone',emoji:'🦴',desc:'Farm Dog food',craft:{wheat:2,iron:1},sell:30},
  fish:{name:'Fish',emoji:'🐟',desc:'Barn Cat food',craft:{wheat:1,copper:1},sell:25},
  seeds:{name:'Seeds Mix',emoji:'🌱',desc:'Parrot food',craft:{wheat:3},sell:20},
  carrot:{name:'Fresh Carrot',emoji:'🥕',desc:'Lucky Bunny food',craft:{carrot:2},sell:22},
  meat:{name:'Raw Meat',emoji:'🥩',desc:'Farm Fox food',craft:{corn:1,iron:1},sell:35},
  mouse:{name:'Field Mouse',emoji:'🐭',desc:'Owl food',craft:{wheat:2,corn:1},sell:40},
  honey:{name:'Wild Honey',emoji:'🍯',desc:'Honey Bear food',craft:{sunflower:2,corn:1},sell:50},
  gemstone:{name:'Gemstone',emoji:'💎',desc:'Dragon food',craft:{diamond:1},sell:500},
  rainbow:{name:'Rainbow Crystal',emoji:'🌈',desc:'Unicorn food',craft:{crystal:1,ruby:1},sell:1000},
const UPGRADES=[
  {id:'autoPlow',name:'Auto-Plower',emoji:'🚜',desc:'One-tap plow all empty fields instantly',cost:2000},
  {id:'mineBoost',name:'Mine Elevator',emoji:'⛏️',desc:'Double rare mineral drop rates permanently',cost:5000},
  {id:'premiumBank',name:'Premium Banking',emoji:'🏦',desc:'Profit share increases from 5% to 8%',cost:2500},
  {id:'petHouse',name:'Pet Luxury House',emoji:'🏠',desc:'Pets decay 60% slower',cost:1500},
  {id:'goldVault',name:'Gold Vault',emoji:'🥇',desc:'Unlocks Gold Growth Account in Bank',cost:3000},
  {id:'siloBoost',name:'Super Silo',emoji:'🏗️',desc:'All crop sell prices +10% permanently',cost:1800},
  {id:'waterTank',name:'Water Tank',emoji:'💧',desc:'Automatically waters all planted crops every 2 minutes',cost:2200},
  {id:'greenhouse',name:'Greenhouse',emoji:'🌿',desc:'All crops grow 40% faster permanently',cost:4000},
  {id:'richSoil',name:'Rich Soil',emoji:'🌱',desc:'All crops yield +1 extra on harvest',cost:3500},
  {id:'mineralScanner',name:'Mineral Scanner',emoji:'📡',desc:'Shows what mineral you will find before mining',cost:4500},
  {id:'autoFeeder',name:'Auto Pet Feeder',emoji:'🐾',desc:'Pets never go hungry — hunger stays above 50%',cost:3000},
  {id:'marketStall',name:'Premium Stall',emoji:'🏪',desc:'Your stall listings get priority placement in market',cost:2800},
];
  const MENU_DEF=[
  {title:'YOUR FARM',items:[{id:'daily',emoji:'🎁',label:'Daily Rewards',desc:'Claim daily bonus and streak',ac:'#f39c12',ml:1},{id:'farm',emoji:'🌾',label:'Farming Fields',desc:'Plow, plant, water and harvest',ac:'#27ae60',ml:1},{id:'silo',emoji:'🏗️',label:'Silo',desc:'View and sell stored crops',ac:'#8B6914',ml:1},{id:'crafting',emoji:'🔨',label:'Crafting',desc:'Craft items for higher value',ac:'#795548',ml:3},{id:'taskboard',emoji:'📋',label:'Task Board',desc:'Accept NPC missions for rewards',ac:'#8e44ad',ml:1},{id:'pets',emoji:'🐾',label:'My Pets',desc:'Feed and care for your pets',ac:'#e67e22',ml:1},{id:'animals',emoji:'🐄',label:'Animals',desc:'Collect milk, eggs, wool',ac:'#795548',ml:1},{id:'butchery',emoji:'🔪',label:'Butchery',desc:'Process meat for stamina or sell',ac:'#c0392b',ml:1},{id:'mine',emoji:'⛏️',label:'Mine',desc:'Extract rare minerals',ac:'#4a4a4a',ml:5},{id:'collections',emoji:'📖',label:'Collections',desc:'Track discoveries',ac:'#16a085',ml:1}]},
  {title:'COMMERCE',items:[{id:'market',emoji:'🏪',label:'Player Market',desc:'List and buy from other players',ac:'#2980b9',ml:1},{id:'gmb',emoji:'🏛️',label:'Gov. Marketing Board',desc:'Last resort buyer and seller',ac:'#7f8c8d',ml:1},{id:'stall',emoji:'🛖',label:'My Farm Stall',desc:'Customise your personal stall',ac:'#e67e22',ml:1}]},
  {title:'FINANCE',items:[{id:'bank',emoji:'🏦',label:'Bank',desc:'Savings, loans and profit share',ac:'#1a5276',ml:1},{id:'gold',emoji:'🥇',label:'Gold Store',desc:'Buy and sell at live rates',ac:'#b7800a',ml:1},{id:'finance',emoji:'💰',label:'Financial Dashboard',desc:'Income, expenses and net worth',ac:'#1a6b2a',ml:1}]},
{title:'COMMUNITY',items:[
    {id:'chat',emoji:'💬',label:'Farm Chat',desc:'Talk, trade and get help',ac:'#16a085',ml:1},
    {id:'visitstalls',emoji:'🛖',label:'Visit Stalls',desc:'Browse and buy from other players stalls',ac:'#e67e22',ml:1},  {title:'MANAGEMENT',items:[{id:'farmhouse',emoji:'🏡',label:'Farmhouse',desc:'Guide, friends, settings and multiplayer',ac:'#795548',ml:1},{id:'garage',emoji:'🔧',label:'Garage & Upgrades',desc:'Buy permanent farm upgrades',ac:'#546e7a',ml:1},{id:'workers',emoji:'👔',label:'Farm Workers',desc:'Hire workers and a manager',ac:'#2c3e50',ml:8}]},
];
const ACTIVE=['farm','silo','animals','butchery','mine','market','gmb','stall','bank','gold','finance','farmhouse','taskboard','pets','chat','daily','crafting','collections','goals','garage','visitstalls'];const xpFor=l=>l*100;
const todayStr=()=>new Date().toISOString().split('T')[0];
const genTasks=lvl=>[...TASK_POOL].filter(t=>!(t.diff==='hard'&&lvl<10)&&!(t.diff==='medium'&&lvl<4)).sort(()=>Math.random()-.5).slice(0,8).map((t,i)=>({...t,id:`t${Date.now()}${i}`,accepted:false,expiresAt:Date.now()+t.hrs*3600000}));
const getMood=a=>a>=80?{mood:'Thriving',emoji:'😄',col:'#27ae60'}:a>=60?{mood:'Happy',emoji:'😊',col:'#2ecc71'}:a>=40?{mood:'Content',emoji:'😐',col:'#f39c12'}:a>=20?{mood:'Sad',emoji:'😟',col:'#e67e22'}:{mood:'Hungry',emoji:'😢',col:'#e74c3c'};
const getFP=p=>p>=200?{label:'Best Friend',col:'#8e44ad'}:p>=100?{label:'Good Friend',col:'#2980b9'}:p>=50?{label:'Friend',col:'#27ae60'}:p>=20?{label:'Acquaintance',col:'#f39c12'}:{label:'Stranger',col:'#aaa'};

const Card=({children,style={}})=><div style={{background:'#fff',borderRadius:16,padding:14,boxShadow:'0 1px 8px rgba(0,0,0,.07)',border:'1px solid #ececec',marginBottom:10,...style}}>{children}</div>;
const Btn=({onClick,color='#27ae60',disabled,children,style={}})=><button onClick={onClick} disabled={disabled} style={{background:disabled?'#bbb':color,color:'#fff',border:'none',borderRadius:12,padding:'9px 16px',fontSize:13,fontWeight:700,cursor:disabled?'default':'pointer',...style}}>{children}</button>;
const Bar=({v,c})=><div style={{height:8,background:'#eee',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.max(0,Math.min(100,v))}%`,background:c,borderRadius:4,transition:'width .5s'}}/></div>;
const DiffBadge=({d})=>{const c=d==='easy'?'#27ae60':d==='medium'?'#e67e22':'#e74c3c';return<span style={{background:c,color:'#fff',borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:800}}>{d.toUpperCase()}</span>;};
const SecHead=({label,color='#777'})=><div style={{fontSize:11,fontWeight:800,color,letterSpacing:1.1,marginBottom:8,paddingLeft:2}}>{label}</div>;
const TabRow=({tabs,active,onSelect,ac='#1a6b2a'})=><div style={{display:'flex',gap:6,marginBottom:14}}>{tabs.map(([id,lb])=><button key={id} onClick={()=>onSelect(id)} style={{flex:1,background:active===id?ac:'#fff',color:active===id?'#fff':'#555',border:`1.5px solid ${active===id?ac:'#ddd'}`,borderRadius:12,padding:'8px 4px',fontSize:11,fontWeight:700,cursor:'pointer'}}>{lb}</button>)}</div>;

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
  const [meatInv,setMeatInv]=useState({});
  const [minerals,setMin]=useState({});
  const [minedTotal,setMTotal]=useState(0);
  const [mineCd,setMineCd]=useState(false);
  const [goldHeld,setGold]=useState(0);
  const [goldPrice,setGP]=useState(92.5);
  const [goldBuy,setGoldBuy]=useState('');
  const [goldSell,setGoldSell]=useState('');
  const [stallCfg,setStall]=useState({name:'My Farm Stall',welcome:'Welcome! Freshest goods in the valley',goodbye:'Thanks for visiting! Come back soon',theme:'green'});
  // Sync stall to Firebase so others can visit
  useEffect(()=>{
    if(!db||!playerId)return;
    const stall={...stallCfg,playerId,farmName,listings:listings.filter(l=>l.sellerId===playerId&&l.expiresAt>Date.now()),lastSeen:Date.now()};
    set(ref(db,`stalls/${playerId}`),stall).catch(()=>{});
  },[stallCfg,listings,farmName,playerId]);

  // Load all stalls from Firebase
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
  const [notifs,setNotifs]=useState([]);
  const [farmName,setFarmName]=useState('Sunny Acres Farm');
  const [themeId,setThemeId]=useState('forest');
  const [worldCode,setWC]=useState('');
  const [playerId]=useState(()=>`P${Math.random().toString(36).substr(2,6).toUpperCase()}`);
  const [tasks,setTasks]=useState([]);
  const [pets,setPets]=useState([]);
  const [petInv,setPetInv]=useState({petFood:5,toys:3,treats:2});
  const [chatMsgs,setChat]=useState(()=>Object.fromEntries(CHAT_CH.map(c=>[c,SEED_CHAT[c].map((m,i)=>({id:i,author:'NPC',farm:'Village',text:m.text,time:Date.now()-i*60000}))])));
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
  // New v7 state
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
  const [visitingStall,setVisitingStall]=useState(null);
  const [allStalls,setAllStalls]=useState([]);
  const [mach,setMach]=useState({
    plow:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
    seeder:{owned:false,tier:0,active:false,dur:100,lastCycle:0,queue:[],qCrop:'wheat'},
    fertiliser:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
    irrigation:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
    harvester:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
  });
  const [fuel,setFuel]=useState(50);
  const [offRep,setOffRep]=useState(null);
  const machR=useRef(null);const tilesR=useRef(null);const siloR=useRef(null);const fuelR=useRef(null);const coinsRf=useRef(500);const upgradesR=useRef({});

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

  useEffect(()=>{
    (async()=>{
      try{
        let saveData=null;
        if(db&&auth?.currentUser){
          try{const sn=await get(child(ref(db),`saves/${auth.currentUser.uid}`));if(sn.exists())saveData=JSON.parse(sn.val());}catch{}
        }
        if(!saveData){const raw=localStorage.getItem('hh7');if(raw)saveData=JSON.parse(raw);}
        if(saveData){
          const s=saveData;
          const k={coins:setCoins,xp:setXp,level:setLevel,silo:setSilo,minerals:setMin,bankBal:setBankBal,goldHeld:setGold,friendship:setFP,streak:setStreak,lastLogin:setLastLogin,petInv:setPetInv,pets:setPets,collected:setCollected,craftInv:setCraftInv,hardTasks:setHT,goldenHarv:setGH,minedTotal:setMTotal,totalEarned:setTE,seasonIdx:setSeasonIdx,totalHarv:setTH,loanDebt:setLoanDebt,dqP:setDQP,dqDone:setDQDone,friendsList:setFriendsList,friendStreak:setFS,lastFriendHelp:setLFH,upgrades:setUpgrades,goldGrowth:setGG,goldGrowthBal:setGGB,jointBal:setJB,listings:setListings};
          Object.entries(k).forEach(([key,fn])=>{if(s[key]!==undefined)fn(s[key]);});
          if(s.tiles)setTiles(s.tiles.map(t=>({...t,crop:t.crop?CROPS.find(c=>c.id===t.crop.id)||null:null})));
        }
}catch(e){console.log('Load error',e);}      try{const r=await window.storage.get('farm_name');if(r)setFarmName(r.value);}catch{}
      try{if(user?.uid){const sn=await get(child(ref(db),`users/${user.uid}/profile`));if(sn.exists()){const p=sn.val();if(p.farmName)setFarmName(p.farmName);}}}catch{}
      try{const r=await window.storage.get('theme_id');if(r)setThemeId(r.value);}catch{}
      try{const r=await window.storage.get('world_code');if(r)setWC(r.value);else{const c=`HVN${Math.random().toString(36).substr(2,3).toUpperCase()}`;await window.storage.set('world_code',c);setWC(c);}}catch{setWC(`HVN${Math.random().toString(36).substr(2,3).toUpperCase()}`);}
      setTasks(genTasks(1));
    })();
  },[]);

const saveGame=useCallback(async()=>{
    try{
      const s={coins,xp,level,silo,minerals,bankBal,goldHeld,friendship,streak,lastLogin,petInv,pets,collected,craftInv,hardTasks,goldenHarv,minedTotal,totalEarned,seasonIdx,totalHarv,loanDebt,dqP,dqDone,friendsList,friendStreak,lastFriendHelp,upgrades,goldGrowth,goldGrowthBal,jointBal,listings,tiles:tiles.map(t=>({...t,crop:t.crop?{id:t.crop.id}:null}))};
      localStorage.setItem('hh7',JSON.stringify(s));
      if(db&&auth?.currentUser){
        try{await set(ref(db,`saves/${auth.currentUser.uid}`),JSON.stringify(s));}catch(e){console.log('Firebase save error',e);}
      }
    }catch(e){console.log('Save error',e);}
  },[coins,xp,level,silo,minerals,bankBal,goldHeld,friendship,streak,lastLogin,petInv,pets,collected,craftInv,hardTasks,goldenHarv,minedTotal,totalEarned,seasonIdx,totalHarv,loanDebt,dqP,dqDone,friendsList,friendStreak,lastFriendHelp,upgrades,goldGrowth,goldGrowthBal,jointBal,listings,tiles]);
useEffect(()=>{const t=setInterval(saveGame,15000);return()=>clearInterval(t);},[saveGame]);
  useEffect(()=>{
    const handler=()=>saveGame();
    document.addEventListener('visibilitychange',handler);
    window.addEventListener('beforeunload',handler);
    return()=>{document.removeEventListener('visibilitychange',handler);window.removeEventListener('beforeunload',handler);};
  },[saveGame]);  useEffect(()=>{const t=setInterval(()=>setStamina(s=>Math.min(100,s+2)),4000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const t=setInterval(()=>setGP(p=>Math.max(82,Math.min(115,+(p+(Math.random()-.48)*.4).toFixed(2)))),20000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    if(xp>0&&xp>=xpFor(level)){
      const newLevel=level+1;
      setLevel(newLevel);
      const coinReward=newLevel*100;
      earn(coinReward);
      if(newLevel>=5)setPetInv(p=>({...p,petFood:p.petFood+2}));
      notify(`🎉 Level ${newLevel}! +🪙${coinReward}`,'gold');
    }
  },[xp]);
  useEffect(()=>{const t=setInterval(()=>{setTiles(ts=>{const now=Date.now();let ch=false;const nx=ts.map(ti=>{if(ti.state==='planted'&&ti.growsAt>0&&now>=ti.growsAt){ch=true;return{...ti,state:'ready'};}return ti;});return ch?nx:ts;});},2000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const t=setInterval(()=>{setPets(ps=>ps.map(p=>({...p,hunger:Math.max(0,p.hunger-1),happiness:Math.max(0,p.happiness-.5)})));},45000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const t=setInterval(()=>setSeasonIdx(i=>(i+1)%4),240000);return()=>clearInterval(t);},[]);
  // Gold Growth Account returns (simulated monthly)
  useEffect(()=>{const t=setInterval(()=>{if(goldGrowthBal>0){const ret=+(goldGrowthBal*.02).toFixed(2);setGG(g=>+(g+ret).toFixed(2));notify(`Gold Growth +${ret}g return!`,'gold');}},120000);return()=>clearInterval(t);},[goldGrowthBal]);
  // Joint fund growth
  useEffect(()=>{const t=setInterval(()=>{if(jointBal>0){const ret=Math.floor(jointBal*.02);setJB(b=>b+ret);notify(`Joint Fund earned 🪙${ret}!`,'gold');}},90000);return()=>clearInterval(t);},[jointBal]);

  const notify=(msg,type='green')=>{const id=Date.now()+Math.random();setNotifs(n=>[...n,{id,msg,type}]);setTimeout(()=>setNotifs(n=>n.filter(x=>x.id!==id)),2800);};

  const earn=amt=>{
    const debt=loanRef.current;
    const bonus=Math.round(amt*friendBonus);
    const total=amt+bonus;
    if(debt>0){
      const debit=Math.min(debt,Math.round(total*.1));
      setLoanDebt(d=>{const nd=Math.max(0,d-debit);if(nd===0&&d>0)notify('Loan fully repaid!','green');return nd;});
      setCoins(c=>c+total-debit);
    }else{
      setCoins(c=>c+total);
    }
    setTE(t=>t+total);setTDE(e=>e+total);
  };
  const spend=amt=>{setCoins(c=>c-amt);setTDS(s=>s+amt);};
  const addCollected=id=>setCollected(c=>{if(c.includes(id))return c;return[...c,id];});
  const updateFN=async n=>{setFarmName(n);try{await window.storage.set('farm_name',n);}catch{}};
  const updateTheme=async id=>{setThemeId(id);try{await window.storage.set('theme_id',id);}catch{}};

  const buyLand=()=>{const idx=landPlots-3;if(idx>=LAND_PRICES.length){notify('Maximum land!','orange');return;}const p=LAND_PRICES[idx];if(coins<p){notify(`Need 🪙${p.toLocaleString()}!`,'orange');return;}spend(p);setLP(l=>l+1);setTiles(ts=>[...ts,...Array(4).fill(null).map((_,i)=>({id:ts.length+i,state:'empty',crop:null,growsAt:0,watered:false}))]);notify('+4 new fields!','green');};

  const tapTile=tile=>{
    if(tile.state==='empty'){setTiles(ts=>ts.map(ti=>ti.id===tile.id?{...ti,state:'plowed'}:ti));setStamina(s=>Math.max(0,s-1));notify('Plowed!');}
    else if(tile.state==='plowed'){if(coins<selCrop.cost){notify('Not enough coins!','orange');return;}spend(selCrop.cost);const at=Date.now()+selCrop.grow*1000;setTiles(ts=>ts.map(ti=>ti.id===tile.id?{...ti,state:'planted',crop:selCrop,growsAt:at,watered:false}:ti));setStamina(s=>Math.max(0,s-.5));notify(`${selCrop.emoji} Planted! ${selCrop.grow}s`);}
    else if(tile.state==='ready'){const crop=tile.crop,sp=cropPrice(crop);setSilo(s=>({...s,[crop.id]:(s[crop.id]||0)+1}));setTH(h=>({...h,[crop.id]:(h[crop.id]||0)+1}));setXp(x=>x+crop.xp);if(crop.id==='golden')setGH(h=>h+1);setTiles(ts=>ts.map(ti=>ti.id===tile.id?{...ti,state:'empty',crop:null,growsAt:0,watered:false}:ti));addCollected(crop.id);setDQP(p=>({...p,dqH:p.dqH+1}));notify(`${crop.emoji} Harvested +🪙${sp}`,'green');}
  };

  const plantAll=()=>{
    const plowed=tiles.filter(t=>t.state==='plowed');
    if(!plowed.length){notify('No plowed fields! Tap tiles first.','orange');return;}
    const cost=plowed.length*selCrop.cost;
    if(coins<cost){notify(`Need 🪙${cost.toLocaleString()} for ${plowed.length} fields!`,'orange');return;}
    spend(cost);const at=Date.now()+selCrop.grow*1000;
    setTiles(ts=>ts.map(t=>t.state==='plowed'?{...t,state:'planted',crop:selCrop,growsAt:at,watered:false}:t));
    setStamina(s=>Math.max(0,s-plowed.length*.3));
    notify(`Planted ${plowed.length}x ${selCrop.emoji}!`,'green');
  };

  const harvestAll=()=>{
    const ready=tiles.filter(t=>t.state==='ready');
    if(!ready.length){notify('Nothing ready to harvest!','orange');return;}
    const ns={...silo},nh={...totalHarv};let txp=0,ng=0,lucky=0;
    ready.forEach(t=>{const c=t.crop;ns[c.id]=(ns[c.id]||0)+1;nh[c.id]=(nh[c.id]||0)+1;txp+=c.xp;if(c.id==='golden')ng++;addCollected(c.id);if(Math.random()<.06)lucky+=50;});
    setSilo(ns);setTH(nh);setXp(x=>x+txp);if(ng)setGH(h=>h+ng);
    if(lucky>0)earn(lucky);
    setTiles(ts=>ts.map(t=>t.state==='ready'?{...t,state:'empty',crop:null,growsAt:0,watered:false}:t));
    setStamina(s=>Math.max(0,s-ready.length*.3));
    setDQP(p=>({...p,dqH:p.dqH+ready.length}));
    notify(`Harvested ${ready.length} crops! +${txp}XP${lucky>0?` Lucky +🪙${lucky}`:''}`, 'gold');
  };

  const waterAll=()=>{let cnt=0;setTiles(ts=>ts.map(t=>{if(t.state!=='planted'||t.watered)return t;cnt++;const rem=Math.max(0,t.growsAt-Date.now());return{...t,watered:true,growsAt:Date.now()+rem*.7};}));if(cnt>0)notify(`Watered ${cnt} crops! -30% grow time`,'blue');else notify('No growing crops!','orange');};

  const sellFrom=(crop,qty)=>{if(!qty)return;const sp=cropPrice(crop);earn(qty*sp);setSilo(s=>({...s,[crop.id]:0}));notify(`Sold ${qty}x ${crop.emoji} 🪙${(qty*sp).toLocaleString()}`,'gold');};
  const sellOne=crop=>{if(!silo[crop.id])return;earn(cropPrice(crop));setSilo(s=>({...s,[crop.id]:s[crop.id]-1}));notify(`Sold 1x ${crop.emoji}`,'gold');};
  const sellAll=()=>{if(!siloTotal){notify('Silo empty!','orange');return;}earn(siloValue);setSilo({});notify(`Sold all 🪙${siloValue.toLocaleString()}`,'gold');};

  const collectAnimal=a=>{if(animalCd[a.id]){notify('Resting...','orange');return;}if(a.value===0){setStamina(s=>Math.min(100,s+15));notify('+15 Stamina!','green');return;}earn(a.value);setXp(x=>x+5);notify(`+🪙${a.value} ${a.pe}`,'gold');setAT(at=>{const n=new Set(at);n.add(a.id);return n;});setAnimalCd(c=>({...c,[a.id]:true}));setDQP(p=>({...p,dqM:p.dqM}));setTimeout(()=>setAnimalCd(c=>{const n={...c};delete n[a.id];return n;}),12000);};
  const slaughter=a=>{if(!a.meat)return;setMeatInv(p=>({...p,[a.id]:(p[a.id]||0)+1}));notify(`${a.me} ${a.meat} added!`,'green');};
  const eatMeat=a=>{if(!meatInv[a.id]){notify('No meat!','orange');return;}setMeatInv(p=>({...p,[a.id]:p[a.id]-1}));setStamina(s=>Math.min(100,s+a.ms));notify(`+${a.ms} Stamina!`,'green');};
  const sellMeat=a=>{const q=meatInv[a.id]||0;if(!q){notify('No meat!','orange');return;}earn(q*a.mv);setMeatInv(p=>({...p,[a.id]:0}));notify(`Sold ${q}x ${a.me} 🪙${(q*a.mv).toLocaleString()}`,'gold');};

  const mine=()=>{
    if(level<5){notify('Mine unlocks at Level 5!','orange');return;}if(mineCd){notify('Mining...','orange');return;}
    setMineCd(true);notify('Mining...');
    setTimeout(()=>{
      const roll=Math.random();let cum=0,found=MINERALS[0];
      for(const m of MINERALS){cum+=m.r*(upgrades.mineBoost&&m.r<.1?2:1);if(roll<Math.min(cum,1)){found=m;break;}}
      setMin(p=>({...p,[found.id]:(p[found.id]||0)+1}));setXp(x=>x+found.xp);setMTotal(t=>t+1);
      addCollected(found.id);setDQP(p=>({...p,dqM:p.dqM+1}));
      notify(`Found ${found.emoji} ${found.name}!`,'gold');setMineCd(false);
    },1600);
  };
  const sellMin=m=>{const q=minerals[m.id]||0;if(!q)return;earn(q*m.v);setMin(p=>({...p,[m.id]:0}));notify(`Sold ${q}x ${m.emoji} 🪙${(q*m.v).toLocaleString()}`,'gold');};

  const buyGoldF=()=>{const g=parseFloat(goldBuy);if(!g||g<=0)return;const c=Math.ceil(g*goldPrice);if(coins<c){notify('Not enough!','orange');return;}spend(c);setGold(h=>+(h+g).toFixed(2));setGoldBuy('');notify(`Bought ${g}g!`,'gold');};
  const sellGoldF=()=>{const g=parseFloat(goldSell);if(!g||g<=0||g>goldHeld){notify('Invalid!','orange');return;}earn(Math.floor(g*goldPrice));setGold(h=>+(h-g).toFixed(2));setGoldSell('');notify(`Sold ${g}g 🪙${Math.floor(g*goldPrice).toLocaleString()}`,'gold');};

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

  const claimDQ=dq=>{
    if(dqDone.includes(dq.id)){notify('Already claimed!','orange');return;}
    if((dqP[dq.key]||0)<dq.target){notify(`Not complete yet! ${dqP[dq.key]||0}/${dq.target}`,'orange');return;}
    earn(dq.reward.coins);setXp(x=>x+dq.reward.xp);
    if(dq.reward.petFood)setPetInv(p=>({...p,petFood:p.petFood+dq.reward.petFood}));
    setDQDone(d=>[...d,dq.id]);
    notify(`Quest done! +🪙${dq.reward.coins} +${dq.reward.xp}XP`,'gold');
  };

  const claimDaily=()=>{if(dailyClaimed){notify('Already claimed today!','orange');return;}const dayIdx=Math.min(streak%7,6);const r=DR[dayIdx];earn(r.coins);setXp(x=>x+r.xp);if(r.petFood)setPetInv(p=>({...p,petFood:p.petFood+r.petFood}));if(r.toys)setPetInv(p=>({...p,toys:p.toys+r.toys}));setStreak(s=>s+1);setLastLogin(todayStr());setDC(true);notify(`Day ${dayIdx+1} reward! +🪙${r.coins}`,'gold');};

  const adoptPet=pt=>{if(coins<pt.cost){notify(`Need 🪙${pt.cost}!`,'orange');return;}if(pets.length>=3){notify('Max 3 pets!','orange');return;}spend(pt.cost);setPets(p=>[...p,{id:`pet_${Date.now()}`,typeId:pt.id,name:pt.name,hunger:100,happiness:100,petXp:0,petLevel:1}]);notify(`${pt.emoji} ${pt.name} adopted!`,'green');};
  const feedPet=id=>{if(petInv.petFood<=0){notify('No Pet Food!','orange');return;}setPetInv(p=>({...p,petFood:p.petFood-1}));setPets(ps=>ps.map(p=>{if(p.id!==id)return p;const nx=p.petXp+5,nl=nx>=p.petLevel*50?p.petLevel+1:p.petLevel;return{...p,hunger:Math.min(100,p.hunger+35),petXp:nx,petLevel:nl};}));setXp(x=>x+5);notify('Pet fed! +5 XP','green');};
  const playPet=id=>{const ht=petInv.toys>0;if(ht)setPetInv(p=>({...p,toys:p.toys-1}));setPets(ps=>ps.map(p=>{if(p.id!==id)return p;const nx=p.petXp+5,nl=nx>=p.petLevel*50?p.petLevel+1:p.petLevel;return{...p,happiness:Math.min(100,p.happiness+(ht?30:15)),petXp:nx,petLevel:nl};}));setXp(x=>x+5);notify(ht?'Played with toy! +5 XP':'Played! +5 XP','green');};

  const sendFriendHelp=async fid=>{
    if(!fid||!worldCode)return;
    const today=todayStr();
    try{
      await window.storage.set(`fhelp:${worldCode}:${playerId}:${fid}:${today}`,'1',true);
      const r=await window.storage.get(`fhelp:${worldCode}:${fid}:${playerId}:${today}`,true);
      if(r){
        const ns=lastFriendHelp===today?friendStreak:friendStreak+1;
        setFS(ns);setLFH(today);
        const bonus=Math.min(ns*50,250);
        earn(bonus);
        notify(`Mutual help! Streak ${ns} days. +🪙${bonus} bonus!`,'gold');
      }else{setLFH(today);notify('Help sent! Both get bonus when friend helps back today.','green');}
    }catch{setLFH(today);notify('Help sent!','green');}
  };

  const takeEmergencyLoan=amt=>{
    const MAX=500;
    if(loanDebt>0){notify('Repay current loan first!','orange');return;}
    if(amt>MAX||amt<=0){notify(`Emergency loan is capped at 🪙${MAX}.`,'orange');return;}
    setCoins(c=>c+amt);setTE(t=>t+amt);setTDE(e=>e+amt);
    setLoanDebt(amt);
    notify(`🪙${amt} loan approved. 10% of earnings auto-debits until repaid.`,'blue');
  };

// ── Automation refs
  useEffect(()=>{machR.current=mach;},[mach]);
  useEffect(()=>{tilesR.current=tiles;},[tiles]);
  useEffect(()=>{siloR.current=silo;},[silo]);
  useEffect(()=>{fuelR.current=fuel;},[fuel]);
  useEffect(()=>{coinsRf.current=coins;},[coins]);
  useEffect(()=>{upgradesR.current=upgrades;},[upgrades]);

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
      if(mId==='plow'){let c=tier.t||1;nT=nT.map(t=>t.state==='empty'&&c-->0?{...t,state:'plowed'}:t);}
      else if(mId==='seeder'){
        const q=[...machR.current.seeder.queue];let c=tier.t||1,qi=0;
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

  const calcOffline=useCallback((elapsed)=>{
    const ms=machR.current,ts=tilesR.current,sl=siloR.current;
    if(!ms||!ts||!sl)return;
    let fl=fuelR.current||0,nT=[...ts],nS={...sl};
    const rep={plowed:0,planted:0,watered:0,harvested:0,fuelUsed:0,earned:0};
    Object.entries(ms).forEach(([mId,m])=>{
      if(!m.owned||!m.active||m.dur<=0)return;
      const def=MACH_DEF[mId],tier=def.tiers[m.tier];
      const cycles=Math.min(Math.floor(elapsed/(tier.s*1000)),80);
      for(let c=0;c<cycles;c++){
        if(fl<tier.f)break;fl-=tier.f;rep.fuelUsed+=tier.f;
        if(mId==='plow'){let cnt=tier.t;nT=nT.map(t=>t.state==='empty'&&cnt-->0?(rep.plowed++,{...t,state:'plowed'}):t);}
        else if(mId==='seeder'&&m.queue?.length){let cnt=tier.t,qi=0,q=[...m.queue];nT=nT.map(t=>{if(t.state==='plowed'&&cnt>0&&qi<q.length){const cr=CROPS.find(x=>x.id===q[qi]);if(cr){qi++;cnt--;rep.planted++;return{...t,state:'planted',crop:cr,growsAt:Date.now()+cr.grow*1000,watered:false};}}return t;});}
        else if(mId==='irrigation'){let cnt=tier.cv;nT=nT.map(t=>t.state==='planted'&&!t.watered&&cnt-->0?(rep.watered++,{...t,watered:true,growsAt:Date.now()+Math.max(0,t.growsAt-Date.now())*.65}):t);}
        else if(mId==='harvester'){let cnt=tier.t;nT=nT.map(t=>{if(t.state==='ready'&&cnt-->0){nS[t.crop.id]=(nS[t.crop.id]||0)+1;rep.harvested++;rep.earned+=t.crop.base;return{...t,state:'empty',crop:null,growsAt:0,watered:false};}return t;});}
      }
    });
    const now=Date.now();nT=nT.map(t=>t.state==='planted'&&t.growsAt>0&&now>=t.growsAt?{...t,state:'ready'}:t);
    setTiles(nT);setSilo(nS);setFuel(Math.max(0,fl));
    if(rep.earned>0){setCoins(c=>c+rep.earned);setTE(t=>t+rep.earned);}
    if(Object.values(rep).some(v=>v>0))setOffRep(rep);
  },[]);

  // Automation interval
  useEffect(()=>{const t=setInterval(runAuto,2500);return()=>clearInterval(t);},[runAuto]);
  // Mach/fuel persist
  useEffect(()=>{const t=setTimeout(async()=>{try{await window.storage.set('hh7_mach',JSON.stringify({mach,fuel}));}catch{}},2000);return()=>clearTimeout(t);},[mach,fuel]);
  // Offline calc on mount
  useEffect(()=>{
    const t=setTimeout(async()=>{
      try{const r=await window.storage.get('hh7_mach');if(r){const s=JSON.parse(r.value);if(s.mach)setMach(s.mach);if(s.fuel!==undefined)setFuel(s.fuel);}}catch{}
      try{const r=await window.storage.get('hh7_ls');if(r){const el=Date.now()-parseInt(r.value);if(el>30000)setTimeout(()=>calcOffline(el),400);}await window.storage.set('hh7_ls',String(Date.now()));}catch{}
    },900);
    return()=>clearTimeout(t);
  },[]);

  // Machine management
  const buyMach=mId=>{const def=MACH_DEF[mId];if(coins<def.cost){notify(`Need 🪙${def.cost.toLocaleString()}!`,'orange');return;}spend(def.cost);setMach(p=>({...p,[mId]:{...p[mId],owned:true}}));notify(`${def.name} purchased!`,'green');};
  const upgMach=mId=>{const m=mach[mId],def=MACH_DEF[mId];if(m.tier>=4){notify('Already max tier!','orange');return;}const cost=def.upg[m.tier+1];if(coins<cost){notify(`Need 🪙${cost.toLocaleString()}!`,'orange');return;}spend(cost);setMach(p=>({...p,[mId]:{...p[mId],tier:p[mId].tier+1}}));notify(`${def.name} → ${def.tiers[m.tier+1].l}!`,'gold');};
  const toggleMach=mId=>{const m=mach[mId];if(!m.owned)return;if(m.dur<=0){notify('Repair first!','orange');return;}if(fuel<=0&&!m.active){notify('Buy fuel first!','orange');return;}const wasActive=m.active;setMach(p=>({...p,[mId]:{...p[mId],active:!p[mId].active,lastCycle:Date.now()}}));notify(!wasActive?'Machine started! 🟢':'Machine stopped.','green');};
  const repairMach=mId=>{if(coins<200){notify('Need 🪙200!','orange');return;}spend(200);setMach(p=>({...p,[mId]:{...p[mId],dur:100}}));notify('Machine repaired! ✅','green');};
  const buyFuelF=item=>{if(coins<item.cost){notify(`Need 🪙${item.cost}!`,'orange');return;}spend(item.cost);setFuel(f=>Math.min(200,f+item.amt));notify(`+${item.amt} fuel! ⛽`,'green');};
  const addToQueue=(cropId,qty=5)=>{setMach(p=>({...p,seeder:{...p.seeder,queue:[...p.seeder.queue,...Array(qty).fill(cropId)]}}));const cr=CROPS.find(c=>c.id===cropId);notify(`Added ${qty}x ${cr?.emoji} to seeder queue!`,'green');};
  const clearQueue=()=>{setMach(p=>({...p,seeder:{...p.seeder,queue:[]}}));notify('Queue cleared.','orange');};

  const canCraft=r=>Object.entries(r.ing).every(([id,qty])=>{const inS=CROPS.find(c=>c.id===id);return inS?(silo[id]||0)>=qty:(minerals[id]||0)>=qty;});
  const craft=r=>{if(!canCraft(r)){notify('Not enough ingredients!','orange');return;}const ns={...silo},nm={...minerals};Object.entries(r.ing).forEach(([id,qty])=>{const inS=CROPS.find(c=>c.id===id);if(inS)ns[id]=(ns[id]||0)-qty;else nm[id]=(nm[id]||0)-qty;});setSilo(ns);setMin(nm);setCraftInv(c=>({...c,[r.id]:(c[r.id]||0)+1}));setXp(x=>x+r.xp);addCollected(r.id);notify(`Crafted ${r.emoji} ${r.name}!`,'gold');};
  const sellCrafted=r=>{const q=craftInv[r.id]||0;if(!q)return;earn(q*r.sell);setCraftInv(c=>({...c,[r.id]:0}));notify(`Sold ${q}x ${r.emoji} 🪙${(q*r.sell).toLocaleString()}`,'gold');};

const addListing=async(itemId,qty,price,type,emoji,name)=>{
    if(type==='silo'&&(silo[itemId]||0)<qty){notify('Not enough in Silo!','orange');return;}
    if(type==='mineral'&&(minerals[itemId]||0)<qty){notify('Not enough minerals!','orange');return;}
    if(type==='silo')setSilo(s=>({...s,[itemId]:(s[itemId]||0)-qty}));
    else setMin(m=>({...m,[itemId]:(m[itemId]||0)-qty}));
    const listing={id:`${Date.now()}_${playerId}`,itemId,qty,price,type,emoji,name,seller:farmName,sellerId:playerId,expiresAt:Date.now()+24*3600000};
    setListings(l=>[...l,listing]);
    if(db){
      try{await set(ref(db,`market/${listing.id}`),listing);}
      catch(e){console.log('Listing error:',e);}
    }
    notify(`Listed ${qty}x ${name}!`,'green');
const buyListing=async l=>{
    if(l.sellerId===playerId){notify('Cannot buy own listing!','orange');return;}
    const total=l.price*l.qty;
    if(coins<total){notify('Not enough coins!','orange');return;}
    spend(total);
    if(l.type==='silo')setSilo(s=>({...s,[l.itemId]:(s[l.itemId]||0)+l.qty}));
    else setMin(m=>({...m,[l.itemId]:(m[l.itemId]||0)+l.qty}));
    setListings(ls=>ls.filter(x=>x.id!==l.id));
    if(db){
      try{await set(ref(db,`market/${l.id}`),null);}
      catch(e){console.log('Buy error:',e);}
    }
    notify(`Bought ${l.qty}x ${l.name}!`,'gold');
  };
  // Load global market listings from Firebase
  useEffect(()=>{
    if(!db)return;
    const marketRef=ref(db,'market');
    const unsub=onValue(marketRef,sn=>{
      if(sn.exists()){
        const data=sn.val();
        if(data&&typeof data==='object'){
          const now=Date.now();
          const allListings=Object.values(data)
            .filter(l=>l&&l.expiresAt>now)
            .sort((a,b)=>b.expiresAt-a.expiresAt);
          setListings(allListings);
        }
      }else{
        setListings([]);
      }
    });
    return()=>unsub();
  },[]);
  const sendChat=async(ch,text)=>{
    if(['spam','scam','hack'].some(w=>text.toLowerCase().includes(w))){notify('Blocked.','orange');return false;}
    const msg={id:`${Date.now()}_${playerId}`,author:playerId,farm:farmName,text:String(text),time:Date.now()};
    setChat(m=>({...m,[ch]:[...m[ch].slice(-49),msg]}));
    if(db){
      try{
        await set(ref(db,`globalchat/${ch}/${msg.id}`),msg);
      }catch(e){console.log('Chat send error:',e);}
    }
    return true;
  };

  const buyUpgrade=up=>{if(upgrades[up.id]){notify('Already owned!','orange');return;}if(coins<up.cost){notify(`Need 🪙${up.cost.toLocaleString()}!`,'orange');return;}spend(up.cost);setUpgrades(u=>({...u,[up.id]:true}));notify(`${up.emoji} ${up.name} activated permanently!`,'gold');};

  const nc={green:'#27ae60',gold:'#b7800a',orange:'#e67e22',blue:'#2980b9'};
  const isHome=screen==='home';
  const screenLabel=MENU_DEF.flatMap(s=>s.items).find(i=>i.id===screen);

  const G={coins,earn,spend,notify,setSilo,setMin,setChat,level,xp,setXp,totalEarned,todayEarned,todaySpent,bankBal,setBankBal,goldHeld,goldPrice,goldBuy,setGoldBuy,goldSell,setGoldSell,buyGoldF,sellGoldF,animalCd,collectAnimal,minerals,mine,mineCd,sellMin,stallCfg,setStall,stamina,setStamina,meatInv,slaughter,eatMeat,sellMeat,silo,siloTotal,siloValue,sellFrom,sellOne,sellAll,totalHarv,setScreen,farmName,updateFN,themeId,updateTheme,worldCode,setWC,playerId,T,season,seasonIdx,setSeasonIdx,cropPrice,tasks,activeTasks,availTasks,acceptTask,abandonTask,canComplete,completeTask,setTasks,pets,petInv,adoptPet,feedPet,playPet,chatMsgs,sendChat,blocked,setBlocked,streak,lastLogin,dailyClaimed,setDC,claimDaily,craftInv,craft,canCraft,sellCrafted,collected,friendship,hardTasks,minedTotal,goldenHarv,animalTypes,listings,addListing,buyListing,loanDebt,takeEmergencyLoan,setLoanDebt,dqP,dqDone,claimDQ,friendsList,setFriendsList,friendStreak,lastFriendHelp,sendFriendHelp,upgrades,buyUpgrade,goldGrowthBal,setGGB,goldGrowth,setGG,jointBal,setJB,friendBonus,plantAll,harvestAll,waterAll,allStalls,visitingStall,setVisitingStall,};

  return(
    <div style={{width:'100%',maxWidth:420,margin:'0 auto',height:'100vh',display:'flex',flexDirection:'column',background:isHome?T.bg:'#f3f4f3',fontFamily:'-apple-system,BlinkMacSystemFont,system-ui,sans-serif',overflow:'hidden',position:'relative'}}>
      <div style={{background:'#fff',padding:isHome?'12px 16px 10px':'10px 16px',borderBottom:'1px solid #e4e4e4',flexShrink:0,boxShadow:'0 1px 6px rgba(0,0,0,.06)'}}>
        {isHome?(
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{fontSize:11,fontWeight:800,color:T.primary,letterSpacing:1.2}}>🌾 HARVEST HAVEN</div>
                  <button onClick={onSignOut} style={{background:'none',border:'1px solid #ddd',borderRadius:8,padding:'2px 8px',fontSize:10,color:'#888',cursor:'pointer',fontWeight:600}}>Sign Out</button>
                </div>
                  <div style={{background:season.col,color:'#fff',borderRadius:20,padding:'1px 8px',fontSize:10,fontWeight:700}}>{season.emoji} {season.name}</div>
                  {loanDebt>0&&<div style={{background:'#e74c3c',color:'#fff',borderRadius:20,padding:'1px 8px',fontSize:10,fontWeight:700}}>Loan 🪙{loanDebt}</div>}
                </div>
                <div style={{fontSize:20,fontWeight:900,color:'#111',lineHeight:1.1}}>{farmName}</div>
                <div style={{fontSize:10,color:'#777',fontWeight:600,marginTop:1}}>Lv {level} · {tiles.length} fields · Streak {streak}{friendStreak>0?` · Friend x${friendStreak}`:''}</div>
              </div>
              <div style={{background:'linear-gradient(135deg,#b7800a,#d4a017)',borderRadius:14,padding:'7px 12px',textAlign:'right'}}>
                <div style={{fontSize:17,fontWeight:800,color:'#fff'}}>🪙 {coins.toLocaleString()}</div>
                {friendBonus>0&&<div style={{fontSize:9,color:'rgba(255,255,255,.85)'}}>+{Math.round(friendBonus*100)}% friend bonus</div>}
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#777',marginBottom:3}}><span>XP Level {level}</span><span>{xpCur}/{xpNeeded}</span></div>
            <div style={{height:5,background:'#e8e8e8',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${(xpCur/xpNeeded)*100}%`,background:`linear-gradient(90deg,${T.primary},${T.accent})`,borderRadius:3,transition:'width .4s'}}/></div>
            {stamina<75&&<><div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#777',marginTop:4,marginBottom:2}}><span>Stamina</span><span>{Math.round(stamina)}%</span></div><div style={{height:4,background:'#e8e8e8',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${stamina}%`,background:stamina>50?'#f1c40f':'#e74c3c',borderRadius:2}}/></div></>}
          </>
        ):(
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={()=>setScreen('home')} style={{background:T.light,border:'none',borderRadius:10,padding:'7px 12px',fontSize:13,fontWeight:800,cursor:'pointer',color:T.primary,flexShrink:0}}>Home</button>
            <div style={{flex:1,fontSize:15,fontWeight:800,color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{screenLabel?`${screenLabel.emoji} ${screenLabel.label}`:screen}</div>
            <div style={{fontWeight:800,color:'#b7800a',fontSize:14,flexShrink:0}}>🪙{coins.toLocaleString()}</div>
          </div>
        )}
      </div>
      <div style={{position:'absolute',top:isHome?128:68,right:10,zIndex:300,display:'flex',flexDirection:'column',gap:5,pointerEvents:'none'}}>
        {notifs.map(n=><div key={n.id} style={{background:nc[n.type]||'#27ae60',color:'#fff',padding:'5px 13px',borderRadius:20,fontSize:12,fontWeight:700,boxShadow:'0 2px 12px rgba(0,0,0,.2)',whiteSpace:'nowrap'}}>{n.msg}</div>)}
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {screen==='home'&&<HomeScreen G={G} siloTotal={siloTotal} siloValue={siloValue} minCount={minCount} activeTasks={activeTasks}/>}
        {screen==='farm'&&<FarmScreen G={G} tiles={tiles} tapTile={tapTile} td={t=>{if(t.state==='empty')return{bg:'#b5835a',emoji:'',sub:'Plow'};if(t.state==='plowed')return{bg:'#7a5230',emoji:'🌱',sub:'Plant'};if(t.state==='planted'){const p=Math.max(0,Math.min(100,((t.growsAt-Date.now())/(t.crop?.grow*1000||1))*100));return{bg:'#2d7a27',emoji:t.watered?'💧':'🌱',sub:`${Math.round(100-p)}%`};}if(t.state==='ready')return{bg:'#27ae60',emoji:t.crop?.emoji,sub:'Harvest!',glow:true};return{bg:'#b5835a',emoji:'',sub:''};}} selCrop={selCrop} setSelCrop={setSelCrop} landPlots={landPlots} buyLand={buyLand}/>}
        {screen==='silo'&&<SiloScreen G={G}/>}
        {screen==='daily'&&<DailyScreen G={G}/>}
        {screen==='crafting'&&<CraftingScreen G={G}/>}
        {screen==='taskboard'&&<TaskBoardScreen G={G}/>}
        {screen==='pets'&&<PetsScreen G={G}/>}
        {screen==='collections'&&<CollectionsScreen G={G}/>}
        {screen==='goals'&&<GoalsScreen G={G}/>}
        {screen==='animals'&&<AnimalsScreen G={G}/>}
        {screen==='butchery'&&<ButcheryScreen G={G}/>}
        {screen==='mine'&&<MineScreen G={G}/>}
        {screen==='market'&&<MarketScreen G={G}/>}
        {screen==='gmb'&&<GmbScreen G={G}/>}
        {screen==='stall'&&<StallScreen G={G}/>}
        {screen==='bank'&&<BankScreen G={G}/>}
        {screen==='gold'&&<GoldScreen G={G}/>}
        {screen==='finance'&&<FinanceScreen G={G}/>}
        {screen==='chat'&&<ChatScreen G={G}/>}
{screen==='garage'&&<GarageScreen G={G}/>}
        {screen==='visitstalls'&&<VisitStallsListScreen G={G}/>}        {screen==='farmhouse'&&<FarmhouseScreen G={G}/>}
        {!ACTIVE.includes(screen)&&screen!=='home'&&<div style={{textAlign:'center',padding:'60px 30px'}}><div style={{fontSize:56,marginBottom:14}}>🚧</div><div style={{fontWeight:800,fontSize:18,color:'#777',marginBottom:8}}>Coming Soon</div></div>}
      </div>
    </div>
  );
}

function HomeScreen({G,siloTotal,siloValue,minCount,activeTasks}){
  const{coins,goldHeld,setScreen,T,level,pets,dailyClaimed,loanDebt,dqDone,friendStreak}=G;
  const badges={silo:siloTotal>0?`${siloTotal}`:null,mine:minCount>0?`${minCount}`:null,taskboard:activeTasks.length>0?`${activeTasks.length}`:null,pets:pets.length>0?`${pets.length}`:null,daily:!dailyClaimed?'Claim!':null};
  const menu=MENU_DEF.map(sec=>{
    if(sec.title!=='YOUR FARM')return sec;
    const daily=sec.items.find(i=>i.id==='daily');
    const rest=sec.items.filter(i=>i.id!=='daily');
    return{...sec,items:dailyClaimed?[...rest,daily]:[daily,...rest]};
  });
  return(
    <div style={{padding:'14px 14px 28px'}}>
      {loanDebt>0&&<div style={{background:'linear-gradient(135deg,#e74c3c,#c0392b)',borderRadius:14,padding:'10px 16px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',boxShadow:'0 3px 12px rgba(231,76,60,.25)'}}>
        <div><div style={{fontSize:12,fontWeight:800,color:'#fff'}}>Active Loan</div><div style={{fontSize:11,color:'rgba(255,255,255,.8)'}}>10% of earnings auto-debited</div></div>
        <div style={{textAlign:'right'}}><div style={{fontSize:16,fontWeight:800,color:'#fff'}}>🪙{loanDebt}</div><div style={{fontSize:10,color:'rgba(255,255,255,.7)'}}>remaining</div></div>
      </div>}
      {friendStreak>0&&<div style={{background:'linear-gradient(135deg,#16a085,#1abc9c)',borderRadius:14,padding:'8px 16px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:12,fontWeight:800,color:'#fff'}}>Friend Streak {friendStreak} days</div>
        <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,.9)'}}>+{Math.round(friendStreak*.05*100)}% earnings bonus</div>
      </div>}
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {[{emoji:'🏗️',label:'Silo',value:siloTotal>0?`🪙${siloValue.toLocaleString()}`:'Empty',s:'silo'},{emoji:'📋',label:'Tasks',value:activeTasks.length>0?`${activeTasks.length} active`:'View tasks',s:'taskboard'},{emoji:'💰',label:'Wallet',value:`🪙${coins.toLocaleString()}`,s:'finance'}].map((st,i)=>(
          <button key={i} onClick={()=>setScreen(st.s)} style={{flex:1,background:'rgba(255,255,255,.92)',border:`1.5px solid ${T.primary}22`,borderRadius:14,padding:'10px 6px',cursor:'pointer',textAlign:'center',boxShadow:'0 2px 8px rgba(0,0,0,.07)'}}>
            <div style={{fontSize:22}}>{st.emoji}</div>
            <div style={{fontSize:11,fontWeight:800,color:'#222',marginTop:2}}>{st.value}</div>
            <div style={{fontSize:9,color:'#888'}}>{st.label}</div>
          </button>
        ))}
      </div>
      {menu.map((sec,si)=>(
        <div key={si} style={{marginBottom:16}}>
          <SecHead label={sec.title} color={T.primary}/>
          <div style={{background:'#fff',borderRadius:18,overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,.07)',border:'1px solid #ececec'}}>
            {sec.items.map((item,ii)=>{
              const locked=level<(item.ml||1),badge=badges[item.id],isLast=ii===sec.items.length-1;
              const isDailyClaimed=item.id==='daily'&&dailyClaimed;
              return(
                <button key={item.id} onClick={()=>!locked&&setScreen(item.id)} style={{width:'100%',background:isDailyClaimed?'#fafafa':'none',border:'none',cursor:locked?'default':'pointer',display:'flex',alignItems:'center',gap:14,padding:'11px 16px',borderBottom:isLast?'none':'1px solid #f2f2f2',opacity:locked?.4:isDailyClaimed?.7:1,textAlign:'left'}}>
                  <div style={{width:44,height:44,background:locked?'#f5f5f5':item.ac+'18',borderRadius:13,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,border:`1.5px solid ${locked?'#eee':item.ac+'30'}`}}>{item.emoji}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:locked?'#ccc':'#111',marginBottom:1}}>{item.label}{isDailyClaimed?' ✓':''}</div>
                    <div style={{fontSize:11,color:'#999',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{locked?`Unlocks at Level ${item.ml}`:isDailyClaimed?'Claimed — come back tomorrow':item.desc}</div>
                  </div>
                  {badge&&!locked&&!isDailyClaimed&&<span style={{background:item.ac,color:'#fff',borderRadius:20,padding:'2px 9px',fontSize:11,fontWeight:700,flexShrink:0}}>{badge}</span>}
                  <span style={{color:locked?'#e0e0e0':'#ccc',fontSize:18,flexShrink:0}}>{locked?'🔒':'›'}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FarmScreen({G,tiles,tapTile,td,selCrop,setSelCrop,landPlots,buyLand}){
  const{coins,setScreen,siloTotal,T,season,cropPrice,waterAll,plantAll,harvestAll,upgrades}=G;
  const nextIdx=landPlots-3,nextPrice=LAND_PRICES[nextIdx],maxed=nextIdx>=LAND_PRICES.length,canAfford=!maxed&&coins>=nextPrice;
  const plowedCount=tiles.filter(t=>t.state==='plowed').length;
  const readyCount=tiles.filter(t=>t.state==='ready').length;
  const growingCount=tiles.filter(t=>t.state==='planted').length;
  const now=Date.now();
  return(
    <div style={{padding:14}}>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button onClick={()=>setScreen('silo')} style={{flex:1,background:'linear-gradient(135deg,#7d6008,#b7800a)',border:'none',borderRadius:12,padding:'9px 14px',display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
          <span style={{fontSize:22}}>🏗️</span><div style={{textAlign:'left'}}><div style={{fontSize:12,fontWeight:800,color:'#fff'}}>Silo</div><div style={{fontSize:10,color:'rgba(255,255,255,.8)'}}>{siloTotal>0?`${siloTotal} crops`:' Empty'}</div></div>
          <span style={{color:'rgba(255,255,255,.6)',fontSize:16,marginLeft:'auto'}}>›</span>
        </button>
        {growingCount>0&&<button onClick={waterAll} style={{background:'#2980b9',border:'none',borderRadius:12,padding:'9px 12px',cursor:'pointer',color:'#fff',fontSize:12,fontWeight:700,flexShrink:0}}>💧 Water ({growingCount})</button>}
      </div>
      {/* Action buttons */}
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        {upgrades.autoPlow&&<button onClick={()=>{let cnt=0;setTiles(ts=>{const n=[...ts];for(let i=0;i<n.length;i++){if(n[i].state==='empty'){n[i]={...n[i],state:'plowed'};cnt++;}}return n;});if(cnt>0)notify(`Auto-plowed ${cnt} fields! 🚜`,'green');}} style={{flex:1,background:'#795548',color:'#fff',border:'none',borderRadius:12,padding:'9px 8px',fontSize:12,fontWeight:700,cursor:'pointer'}}>🚜 Auto-Plow</button>}
        <button onClick={plantAll} disabled={plowedCount===0} style={{flex:1,background:plowedCount>0?T.primary:'#bbb',color:'#fff',border:'none',borderRadius:12,padding:'9px 8px',fontSize:12,fontWeight:700,cursor:plowedCount>0?'pointer':'default'}}>🌱 Plant All ({plowedCount})</button>
        <button onClick={harvestAll} disabled={readyCount===0} style={{flex:1,background:readyCount>0?'#27ae60':'#bbb',color:'#fff',border:'none',borderRadius:12,padding:'9px 8px',fontSize:12,fontWeight:700,cursor:readyCount>0?'pointer':'default'}}>🌾 Harvest All ({readyCount})</button>
      </div>
      <div style={{background:`${season.col}18`,borderRadius:12,padding:'6px 14px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${season.col}33`}}>
        <span style={{fontSize:12,fontWeight:700,color:season.col}}>{season.emoji} {season.name} — price boosts active</span>
      </div>
      <SecHead label="SELECT CROP TO PLANT" color="#777"/>
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:8,marginBottom:10}}>
        {CROPS.map(c=>{const sel=selCrop.id===c.id,sp=cropPrice(c),boosted=sp>c.base;return(
          <button key={c.id} onClick={()=>setSelCrop(c)} style={{background:sel?T.primary:'#fff',border:`2px solid ${sel?T.primary:'#ddd'}`,borderRadius:14,padding:'8px 10px',cursor:'pointer',textAlign:'center',minWidth:74,flexShrink:0,boxShadow:sel?`0 3px 12px ${T.primary}44`:'0 1px 4px rgba(0,0,0,.05)'}}>
            <div style={{fontSize:24}}>{c.emoji}</div>
            <div style={{fontSize:10,fontWeight:800,color:sel?'#fff':'#222',marginTop:1}}>{c.name}</div>
            <div style={{fontSize:9,color:sel?'rgba(255,255,255,.75)':'#888'}}>🪙{c.cost}</div>
            <div style={{fontSize:9,color:boosted?(sel?'#ffe082':'#e67e22'):(sel?'rgba(255,255,255,.7)':'#888'),fontWeight:boosted?800:400}}>+🪙{sp}</div>
            <div style={{fontSize:9,color:sel?'rgba(255,255,255,.6)':'#aaa'}}>{c.grow}s</div>
          </button>
        );})}
      </div>
      <div style={{background:T.primary,borderRadius:12,padding:'8px 14px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:13,fontWeight:700,color:'#fff'}}>{selCrop.emoji} {selCrop.name} selected</span>
        <span style={{fontSize:11,color:'rgba(255,255,255,.85)'}}>🪙{selCrop.cost} · {selCrop.grow}s grow</span>
      </div>
      {!maxed&&<div style={{background:canAfford?'linear-gradient(135deg,#7d6008,#b7800a)':'rgba(160,160,160,.22)',borderRadius:12,padding:'8px 14px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:12,fontWeight:800,color:canAfford?'#fff':'#999'}}>Buy More Land (+4 fields)</div><div style={{fontSize:10,color:canAfford?'rgba(255,255,255,.8)':'#bbb'}}>🪙{nextPrice?.toLocaleString()}</div></div>
        <button onClick={buyLand} style={{background:canAfford?'#fff':'rgba(255,255,255,.3)',color:canAfford?'#b7800a':'#fff',border:'none',borderRadius:10,padding:'7px 12px',fontSize:12,fontWeight:800,cursor:canAfford?'pointer':'default'}}>{canAfford?'Buy':'🔒'}</button>
      </div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7,marginBottom:10}}>
        {tiles.map(tile=>{const d=td(tile);return(
          <button key={tile.id} onClick={()=>tapTile(tile)} style={{aspectRatio:'1',background:d.bg,border:d.glow?'3px solid #52d68a':'3px solid rgba(255,255,255,.5)',borderRadius:13,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:d.glow?'0 0 12px #27ae60':'0 2px 8px rgba(0,0,0,.1)',position:'relative'}}>
            {tile.state==='planted'&&tile.growsAt>0&&<div style={{position:'absolute',top:3,right:3,background:'rgba(0,0,0,.55)',borderRadius:8,padding:'1px 5px',fontSize:8,color:'#fff',fontWeight:700}}>{Math.max(0,Math.ceil((tile.growsAt-now)/1000))}s</div>}
            <span>{d.emoji}</span><span style={{fontSize:8,color:'rgba(255,255,255,.9)',fontWeight:700}}>{d.sub}</span>
          </button>
        );})}
      </div>
    </div>
  );
}

function SiloScreen({G}){
  const{silo,siloTotal,siloValue,sellFrom,sellOne,sellAll,totalHarv,season,cropPrice,upgrades}=G;
  const stored=CROPS.filter(c=>(silo[c.id]||0)>0);
  const lifetime=CROPS.reduce((s,c)=>s+(totalHarv[c.id]||0),0);
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#6d4c07,#b7800a)',borderRadius:20,padding:18,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>SILO STORAGE</div>
        <div style={{fontSize:32,fontWeight:900,margin:'4px 0'}}>🏗️ {siloTotal} crops</div>
        <div style={{fontSize:14,fontWeight:700}}>Value: 🪙{siloValue.toLocaleString()} <span style={{fontSize:11,opacity:.7}}>({season.emoji} prices{upgrades.siloBoost?' +10% boost':''})</span></div>
        <div style={{fontSize:11,opacity:.65,marginTop:3}}>All-time: {lifetime.toLocaleString()} harvested</div>
      </div>
      {stored.length===0?<div style={{textAlign:'center',padding:'40px 20px'}}><div style={{fontSize:56,marginBottom:12}}>🏗️</div><div style={{fontWeight:800,fontSize:16,color:'#888'}}>Silo is Empty</div><div style={{fontSize:13,marginTop:6,color:'#aaa',lineHeight:1.5}}>Plant and harvest crops to fill it</div></div>:(
        <>
          <Btn onClick={sellAll} style={{width:'100%',padding:13,fontSize:15,marginBottom:12}}>Sell Everything — 🪙{siloValue.toLocaleString()}</Btn>
          {stored.map(c=>{const sp=cropPrice(c),boosted=sp>c.base;return(
            <Card key={c.id}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <span style={{fontSize:36}}>{c.emoji}</span>
                <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,color:'#111'}}>{c.name}</div><div style={{fontSize:11,color:'#888'}}>{silo[c.id]} stored · <span style={{color:boosted?'#e67e22':'#888',fontWeight:boosted?700:400}}>🪙{sp}{boosted?' ↑':''}</span></div></div>
                <div style={{fontWeight:900,fontSize:15,color:'#b7800a'}}>🪙{(silo[c.id]*sp).toLocaleString()}</div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>sellOne(c)} style={{flex:1,background:'#f5f5f5',color:'#444',border:'1px solid #ddd',borderRadius:10,padding:9,fontSize:12,fontWeight:700,cursor:'pointer'}}>Sell 1</button>
                <button onClick={()=>sellFrom(c,silo[c.id])} style={{flex:2,background:'#27ae60',color:'#fff',border:'none',borderRadius:10,padding:9,fontSize:12,fontWeight:700,cursor:'pointer'}}>Sell All 🪙{(silo[c.id]*sp).toLocaleString()}</button>
              </div>
            </Card>
          );})}
        </>
      )}
      {lifetime>0&&<Card><SecHead label="LIFETIME RECORDS"/>{CROPS.filter(c=>(totalHarv[c.id]||0)>0).map((c,i,arr)=>(<div key={c.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<arr.length-1?'1px solid #f0f0f0':'none'}}><span style={{fontSize:13,color:'#444'}}>{c.emoji} {c.name}</span><span style={{fontWeight:700,color:'#555'}}>{totalHarv[c.id]} harvested</span></div>))}</Card>}
    </div>
  );
}

function DailyScreen({G}){
  const{streak,claimDaily,dailyClaimed,T,dqP,dqDone,claimDQ}=G;
  const dayIdx=Math.min(streak%7,6);const r=DR[dayIdx];
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#b7800a,#d4a017)',borderRadius:20,padding:18,marginBottom:14,color:'#fff',textAlign:'center'}}>
        <div style={{fontSize:44,marginBottom:6}}>🎁</div>
        <div style={{fontSize:22,fontWeight:900}}>Daily Rewards</div>
        <div style={{fontSize:13,opacity:.85,marginTop:4}}>Login Streak: {streak} days</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5,marginBottom:14}}>
        {DR.map((dr,i)=>{const done=i<dayIdx,cur=i===dayIdx;return(<div key={i} style={{background:done?'#27ae60':cur?T.primary:'#f5f5f5',borderRadius:12,padding:'6px 3px',textAlign:'center',border:`2px solid ${cur?T.accent:done?'#27ae60':'#eee'}`}}><div style={{fontSize:12}}>{done?'✅':cur?'🎁':'📦'}</div><div style={{fontSize:8,fontWeight:800,color:done||cur?'#fff':'#888'}}>Day {i+1}</div><div style={{fontSize:8,color:done||cur?'rgba(255,255,255,.8)':'#aaa'}}>🪙{dr.coins}</div></div>);})}
      </div>
      <Card>
        <div style={{fontWeight:800,fontSize:15,color:'#111',marginBottom:8}}>Today — Day {dayIdx+1}</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
          <div style={{background:'#fff9e6',borderRadius:12,padding:'8px 12px',textAlign:'center'}}><div style={{fontSize:18}}>🪙</div><div style={{fontWeight:800,color:'#b7800a'}}>+{r.coins}</div></div>
          <div style={{background:'#eef7ee',borderRadius:12,padding:'8px 12px',textAlign:'center'}}><div style={{fontSize:18}}>⭐</div><div style={{fontWeight:800,color:'#27ae60'}}>+{r.xp}XP</div></div>
          {r.petFood&&<div style={{background:'#fef3e8',borderRadius:12,padding:'8px 12px',textAlign:'center'}}><div style={{fontSize:18}}>🐾</div><div style={{fontWeight:800,color:'#e67e22'}}>+{r.petFood}</div></div>}
          {r.toys&&<div style={{background:'#f3eafa',borderRadius:12,padding:'8px 12px',textAlign:'center'}}><div style={{fontSize:18}}>🪀</div><div style={{fontWeight:800,color:'#8e44ad'}}>+{r.toys}</div></div>}
        </div>
        <Btn onClick={claimDaily} disabled={dailyClaimed} style={{width:'100%',padding:12,fontSize:14}} color={T.primary}>{dailyClaimed?'Claimed — come back tomorrow!':'Claim Daily Reward!'}</Btn>
      </Card>
      <SecHead label="DAILY QUESTS" color="#555"/>
      {DQ.map(dq=>{
        const prog=dqP[dq.key]||0,done=prog>=dq.target,claimed=dqDone.includes(dq.id);
        return(
          <Card key={dq.id} style={done&&!claimed?{border:'2px solid #27ae60'}:{}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:'#111'}}>{dq.text}</div>
                <div style={{fontSize:11,color:'#888',marginTop:2}}>Reward: 🪙{dq.reward.coins} · {dq.reward.xp}XP{dq.reward.petFood?` · Food x${dq.reward.petFood}`:''}</div>
                <div style={{height:6,background:'#eee',borderRadius:3,overflow:'hidden',marginTop:6}}><div style={{height:'100%',width:`${Math.min(100,(prog/dq.target)*100)}%`,background:done?'#27ae60':T.primary,borderRadius:3}}/></div>
                <div style={{fontSize:10,color:'#aaa',marginTop:3}}>{Math.min(prog,dq.target)}/{dq.target}</div>
              </div>
              {claimed?<span style={{fontSize:20}}>✅</span>:<Btn onClick={()=>claimDQ(dq)} disabled={!done} style={{fontSize:12,padding:'7px 12px',flexShrink:0}}>{done?'Claim':'In progress'}</Btn>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function CraftingScreen({G}){
  const{silo,minerals,craftInv,craft,canCraft,sellCrafted}=G;
  const getH=id=>{const inS=CROPS.find(c=>c.id===id);return inS?(silo[id]||0):(minerals[id]||0);};
  const hasCrafted=RECIPES.some(r=>(craftInv[r.id]||0)>0);
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#5d4037,#795548)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>CRAFTING WORKSHOP</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>🔨 Craft Items</div>
        <div style={{fontSize:11,opacity:.8}}>Combine ingredients to create higher-value goods</div>
      </div>
      {hasCrafted&&<Card style={{background:'#f0fff4',border:'1px solid #c3e6cb'}}>
        <div style={{fontWeight:800,fontSize:13,color:'#1a6b2a',marginBottom:10}}>Your Crafted Items</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {RECIPES.filter(r=>(craftInv[r.id]||0)>0).map(r=>(
            <div key={r.id} style={{background:'#fff',borderRadius:12,padding:'8px 12px',textAlign:'center',border:'1px solid #ddd'}}>
              <div style={{fontSize:22}}>{r.emoji}</div>
              <div style={{fontSize:11,fontWeight:700,color:'#333'}}>{r.name} x{craftInv[r.id]}</div>
              <button onClick={()=>sellCrafted(r)} style={{background:'#27ae60',color:'#fff',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer',marginTop:4}}>Sell 🪙{(craftInv[r.id]*r.sell).toLocaleString()}</button>
            </div>
          ))}
        </div>
      </Card>}
      {RECIPES.map(r=>{const can=canCraft(r);return(
        <Card key={r.id}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
            <span style={{fontSize:34}}>{r.emoji}</span>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14,color:'#111'}}>{r.name}</div><div style={{fontSize:11,color:'#888'}}>{r.desc}</div><div style={{fontSize:12,fontWeight:700,color:'#b7800a',marginTop:2}}>Sells 🪙{r.sell} · +{r.xp}XP</div></div>
            <Btn onClick={()=>craft(r)} disabled={!can} color='#795548' style={{fontSize:11,padding:'7px 11px',flexShrink:0}}>{can?'Craft':'Need More'}</Btn>
          </div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {Object.entries(r.ing).map(([id,qty])=>{const have=getH(id),item=CROPS.find(c=>c.id===id)||MINERALS.find(m=>m.id===id),ok=have>=qty;return(
              <div key={id} style={{background:ok?'#f0fff4':'#fff5f5',border:`1px solid ${ok?'#c3e6cb':'#f5c6cb'}`,borderRadius:10,padding:'3px 9px',fontSize:11,fontWeight:700,color:ok?'#1a6b2a':'#721c24'}}>
                {item?.emoji} {item?.name} {have}/{qty}
              </div>
            );})}
          </div>
        </Card>
      );})}
    </div>
  );
}

function TaskBoardScreen({G}){
  const{tasks,activeTasks,availTasks,acceptTask,abandonTask,canComplete,completeTask,setTasks,level,silo,minerals,friendship}=G;
  const[tab,setTab]=useState('available');
  const fmt=ms=>{const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);return h>0?`${h}h ${m}m`:`${m}m`;};
  const TCard=({task,acc})=>{
    const npc=NPCS[task.npcId],item=CROPS.find(c=>c.id===task.itemId)||MINERALS.find(m=>m.id===task.itemId);
    const have=task.inv==='silo'?(silo[task.itemId]||0):(minerals[task.itemId]||0);
    const ready=canComplete(task),fp=friendship[task.npcId]||0,fl=getFP(fp),isBF=fl.label==='Best Friend';
    return(
      <Card style={acc&&ready?{border:'2px solid #27ae60'}:{}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
          <span style={{fontSize:34,flexShrink:0}}>{npc?.emoji}</span>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:1}}>
              <span style={{fontWeight:800,fontSize:14,color:'#111'}}>{npc?.name}</span>
              <DiffBadge d={task.diff}/>
              {isBF&&<span style={{background:'#8e44ad',color:'#fff',borderRadius:20,padding:'1px 7px',fontSize:9,fontWeight:800}}>BEST FRIEND +20%</span>}
            </div>
            <div style={{fontSize:11,color:fl.col,fontWeight:700,marginBottom:2}}>{fl.label} ({fp}pts)</div>
            <div style={{fontSize:11,fontStyle:'italic',color:'#777',marginBottom:2}}>"{npc?.lines[Math.min(Math.floor(fp/50),4)]}"</div>
          </div>
        </div>
        <div style={{background:ready&&acc?'#f0fff4':'#f8f8f8',borderRadius:12,padding:'7px 12px',marginBottom:8,border:ready&&acc?'1px solid #c3e6cb':'none'}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
            <span style={{color:'#444'}}>Needs: <b>{item?.emoji} {item?.name}</b> x{task.qty}</span>
            <span style={{color:have>=task.qty?'#27ae60':'#e74c3c',fontWeight:700}}>{have}/{task.qty}{have>=task.qty?' ✅':''}</span>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{fontSize:10,color:'#999'}}>{fmt(task.expiresAt-Date.now())} left</div>
          <div style={{fontSize:11,fontWeight:700,color:'#b7800a'}}>🪙{isBF?Math.round(task.coins*1.2):task.coins} · {task.xp}XP{task.rfood?` · 🐾x${task.rfood}`:''}{ task.rtoy?` · 🪀x${task.rtoy}`:''}</div>
        </div>
        {!acc?<Btn onClick={()=>acceptTask(task.id)} style={{width:'100%',padding:9,fontSize:13}}>Accept Task</Btn>
          :<div style={{display:'flex',gap:8}}>
            <button onClick={()=>abandonTask(task.id)} style={{flex:1,background:'#f5f5f5',border:'1px solid #ddd',borderRadius:12,padding:8,fontSize:12,fontWeight:700,cursor:'pointer',color:'#666'}}>Abandon</button>
            <Btn onClick={()=>completeTask(task)} disabled={!ready} color='#27ae60' style={{flex:2,padding:9,fontSize:12}}>{ready?`Complete +🪙${isBF?Math.round(task.coins*1.2):task.coins}`:'Gather Items'}</Btn>
          </div>}
      </Card>
    );
  };
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#6c3483,#8e44ad)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>TASK BOARD</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>📋 Village Requests</div>
        <div style={{fontSize:12,opacity:.85}}>{availTasks.length} available · {activeTasks.length} accepted</div>
      </div>
      <TabRow tabs={[['available',`Available (${availTasks.length})`],['accepted',`Accepted (${activeTasks.length})`],['npcs','NPC Friends']]} active={tab} onSelect={setTab} ac='#8e44ad'/>
      {tab==='available'&&<>
        <button onClick={()=>setTasks(genTasks(level))} style={{width:'100%',background:'#f5f5f5',border:'1.5px solid #e0e0e0',borderRadius:12,padding:9,fontSize:12,fontWeight:700,cursor:'pointer',color:'#555',marginBottom:12}}>Refresh Tasks</button>
        {availTasks.length===0?<div style={{textAlign:'center',padding:40,color:'#aaa'}}><div style={{fontSize:40}}>📭</div><div style={{fontWeight:700,color:'#888',marginTop:8}}>No tasks — tap Refresh</div></div>:availTasks.map(t=><TCard key={t.id} task={t} acc={false}/>)}
      </>}
      {tab==='accepted'&&(activeTasks.length===0?<div style={{textAlign:'center',padding:40,color:'#aaa'}}><div style={{fontSize:40}}>📝</div><div style={{fontWeight:700,color:'#888',marginTop:8}}>No accepted tasks</div></div>:activeTasks.map(t=><TCard key={t.id} task={t} acc={true}/>))}
      {tab==='npcs'&&<div>{Object.entries(NPCS).map(([id,npc])=>{const fp=G.friendship[id]||0,fl=getFP(fp);return(
        <Card key={id}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:36}}>{npc.emoji}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15,color:'#111'}}>{npc.name}</div>
              <div style={{fontSize:12,color:fl.col,fontWeight:700,marginBottom:6}}>{fl.label}</div>
              <div style={{height:6,background:'#eee',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,(fp/300)*100)}%`,background:fl.col,borderRadius:3}}/></div>
              <div style={{fontSize:10,color:'#999',marginTop:3}}>{fp}/300 pts</div>
            </div>
          </div>
        </Card>
      );})}</div>}
    </div>
  );
}

function PetsScreen({G}){
  const{pets,petInv,adoptPet,feedPet,playPet,coins,T}=G;
  const[view,setView]=useState('mypets');
  return(
    <div style={{padding:14}}>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        {[['🐾','Food',petInv.petFood,'#e67e22'],['🪀','Toys',petInv.toys,'#8e44ad'],['🍬','Treats',petInv.treats,'#27ae60']].map(([e,l,v,c],i)=>(
          <div key={i} style={{flex:1,background:'#fff',borderRadius:14,padding:'8px 6px',textAlign:'center',boxShadow:'0 1px 6px rgba(0,0,0,.07)',border:'1px solid #ececec'}}>
            <div style={{fontSize:20}}>{e}</div><div style={{fontSize:15,fontWeight:900,color:v>0?c:'#ccc'}}>{v}</div><div style={{fontSize:9,color:'#888'}}>{l}</div>
          </div>
        ))}
      </div>
      <TabRow tabs={[['mypets',`My Pets (${pets.length}/3)`],['adopt','Adopt']]} active={view} onSelect={setView} ac={T.primary}/>
      {view==='mypets'&&(pets.length===0?<div style={{textAlign:'center',padding:'30px 20px'}}><div style={{fontSize:52}}>🐾</div><div style={{fontWeight:800,fontSize:15,color:'#777',marginTop:8}}>No pets yet!</div><Btn onClick={()=>setView('adopt')} style={{marginTop:12,padding:'9px 22px'}} color={T.primary}>Adopt a Pet</Btn></div>
        :pets.map(pet=>{const pt=PET_TYPES.find(p=>p.id===pet.typeId)||PET_TYPES[0],mood=getMood((pet.hunger+pet.happiness)/2);return(
          <Card key={pet.id}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
              <div style={{fontSize:44}}>{pt.emoji}</div>
              <div style={{flex:1}}><div style={{fontWeight:800,fontSize:16,color:'#111'}}>{pet.name}</div><div style={{fontSize:11,color:'#777',marginBottom:3}}>{pt.bonus}</div><div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:20}}>{mood.emoji}</span><span style={{fontSize:12,fontWeight:700,color:mood.col}}>{mood.mood}</span></div></div>
              <div style={{textAlign:'center',background:'#f8f8f8',borderRadius:12,padding:'7px 10px'}}><div style={{fontSize:9,color:'#888'}}>Lv {pet.petLevel}</div><div style={{fontSize:13,fontWeight:800,color:T.primary}}>{pet.petXp}/{pet.petLevel*50}xp</div></div>
            </div>
            <div style={{marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#555',marginBottom:3}}><span>Hunger</span><span style={{fontWeight:700}}>{Math.round(pet.hunger)}%</span></div><Bar v={pet.hunger} c={pet.hunger>50?'#27ae60':pet.hunger>25?'#f39c12':'#e74c3c'}/></div>
            <div style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#555',marginBottom:3}}><span>Happiness</span><span style={{fontWeight:700}}>{Math.round(pet.happiness)}%</span></div><Bar v={pet.happiness} c={pet.happiness>50?'#3498db':pet.happiness>25?'#9b59b6':'#e74c3c'}/></div>
            <div style={{display:'flex',gap:8}}>
              <Btn onClick={()=>feedPet(pet.id)} disabled={petInv.petFood<=0} color='#e67e22' style={{flex:1,padding:9,fontSize:12}}>Feed ({petInv.petFood})</Btn>
              <Btn onClick={()=>playPet(pet.id)} color='#8e44ad' style={{flex:1,padding:9,fontSize:12}}>Play {petInv.toys>0?'(toy)':'(free)'}</Btn>
            </div>
            {petInv.petFood<=0&&<div style={{fontSize:11,color:'#e67e22',textAlign:'center',marginTop:6,fontWeight:600}}>Complete tasks to earn Pet Food!</div>}
          </Card>
        );})
      )}
      {view==='adopt'&&<>
        {PET_TYPES.map(pt=>{const owned=pets.some(p=>p.typeId===pt.id),canAff=coins>=pt.cost,mx=pets.length>=3;return(
          <Card key={pt.id} style={{opacity:owned?.6:1}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{fontSize:42}}>{pt.emoji}</div>
              <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,color:'#111'}}>{pt.name}</div><div style={{fontSize:12,color:'#666',marginBottom:4}}>{pt.bonus}</div><div style={{fontSize:13,fontWeight:700,color:'#b7800a'}}>🪙{pt.cost.toLocaleString()}</div></div>
              {owned?<span style={{background:'#27ae60',color:'#fff',borderRadius:20,padding:'4px 12px',fontSize:12,fontWeight:700}}>Owned</span>:<Btn onClick={()=>adoptPet(pt)} disabled={!canAff||mx} color={T.primary} style={{fontSize:12,padding:'7px 13px'}}>{mx?'Max':canAff?'Adopt':'Need 🪙'}</Btn>}
            </div>
          </Card>
        );})}
      </>}
    </div>
  );
}

function CollectionsScreen({G}){
  const{collected,T}=G;
  const allItems=[...CROPS.map(c=>({id:c.id,name:c.name,emoji:c.emoji,cat:'Crops'})),...MINERALS.map(m=>({id:m.id,name:m.name,emoji:m.emoji,cat:'Minerals'})),...RECIPES.map(r=>({id:r.id,name:r.name,emoji:r.emoji,cat:'Crafted'}))];
  const total=collected.length,max=allItems.length;
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#16a085,#1abc9c)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>COLLECTION BOOK</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>📖 {total}/{max} Discovered</div>
        <div style={{height:6,background:'rgba(255,255,255,.3)',borderRadius:3,overflow:'hidden',marginTop:6}}><div style={{height:'100%',width:`${(total/max)*100}%`,background:'#fff',borderRadius:3}}/></div>
      </div>
      {['Crops','Minerals','Crafted'].map(cat=>{
        const items=allItems.filter(i=>i.cat===cat),found=items.filter(i=>collected.includes(i.id)).length;
        return(<Card key={cat}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}><div style={{fontWeight:800,fontSize:14,color:'#111'}}>{cat}</div><div style={{fontSize:12,fontWeight:700,color:found===items.length?'#27ae60':'#888'}}>{found}/{items.length}</div></div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {items.map(item=><div key={item.id} style={{width:48,textAlign:'center',opacity:collected.includes(item.id)?1:.2}}><div style={{fontSize:26}}>{item.emoji}</div><div style={{fontSize:8,color:'#555',fontWeight:600,lineHeight:1.2}}>{item.name}</div></div>)}
          </div>
          {found===items.length&&<div style={{marginTop:8,background:'#f0fff4',borderRadius:10,padding:'5px 12px',fontSize:11,fontWeight:700,color:'#27ae60',textAlign:'center'}}>Set Complete!</div>}
        </Card>);
      })}
    </div>
  );
}

function GoalsScreen({G}){
  const{level,totalEarned,hardTasks,minedTotal,goldenHarv,animalTypes,earn,setXp,notify,T}=G;
  const[claimed,setClaimed]=useState([]);
  const getP=g=>{if(g.key==='level')return level;if(g.key==='totalEarned')return totalEarned;if(g.key==='hardTasks')return hardTasks;if(g.key==='minedTotal')return minedTotal;if(g.key==='goldenHarv')return goldenHarv;if(g.key==='animalTypes')return animalTypes.size;return 0;};
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#b7800a,#d4a017)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>LONG-TERM GOALS</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>🏆 Big Milestones</div>
      </div>
      {LONG_GOALS.map(g=>{const prog=getP(g),done=prog>=g.target,cl=claimed.includes(g.id),pct=Math.min(100,(prog/g.target)*100);return(
        <Card key={g.id} style={done?{border:'2px solid #27ae60'}:{}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
            <span style={{fontSize:34}}>{g.emoji}</span>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14,color:'#111'}}>{g.name}</div><div style={{fontSize:11,color:'#777'}}>{g.desc}</div></div>
            <div style={{textAlign:'right',flexShrink:0}}><div style={{fontWeight:800,color:'#b7800a',fontSize:13}}>🪙{g.reward.toLocaleString()}</div></div>
          </div>
          <div style={{height:7,background:'#eee',borderRadius:4,overflow:'hidden',marginBottom:6}}><div style={{height:'100%',width:`${pct}%`,background:done?'#27ae60':T.primary,borderRadius:4}}/></div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:11,color:'#888'}}>{prog.toLocaleString()}/{g.target.toLocaleString()}</div>
            {done&&!cl?<Btn onClick={()=>{earn(g.reward);setXp(x=>x+200);setClaimed(c=>[...c,g.id]);notify(`Goal done! +🪙${g.reward}`,'gold');}} style={{fontSize:12,padding:'5px 13px'}}>Claim!</Btn>:cl?<span style={{fontSize:12,fontWeight:700,color:'#27ae60'}}>Claimed</span>:<span style={{fontSize:12,color:'#aaa'}}>{Math.round(pct)}%</span>}
          </div>
        </Card>
      );})}
    </div>
  );
}

function AnimalsScreen({G}){
  const{level,animalCd,collectAnimal}=G;
  return(<div style={{padding:14}}>{ANIMALS.map(a=>{const ok=level>=a.ml,cd=animalCd[a.id];return(<Card key={a.id} style={{opacity:ok?1:.4,display:'flex',alignItems:'center',gap:13}}><span style={{fontSize:40}}>{a.emoji}</span><div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,color:ok?'#111':'#ccc'}}>{a.name}</div><div style={{fontSize:12,color:'#888'}}>{a.pe} {a.product}</div><div style={{fontSize:11,fontWeight:700,color:ok?(cd?'#e67e22':'#27ae60'):'#ddd',marginTop:2}}>{ok?(cd?'Resting...':'Ready'): `Level ${a.ml}`}</div></div>{ok&&<button onClick={()=>collectAnimal(a)} style={{background:cd?'#eee':'#27ae60',color:cd?'#aaa':'#fff',border:'none',borderRadius:12,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:cd?'default':'pointer'}}>{a.value===0?'Ride':cd?'...': `+🪙${a.value}`}</button>}</Card>);})}</div>);
}

function ButcheryScreen({G}){
  const{level,meatInv,slaughter,eatMeat,sellMeat}=G;
  const avail=ANIMALS.filter(a=>a.meat&&level>=a.ml);
  return(<div style={{padding:14}}><div style={{background:'#fff5f5',borderRadius:14,padding:12,marginBottom:12,border:'1px solid #fce4e4'}}><div style={{fontSize:13,fontWeight:800,color:'#c0392b',marginBottom:3}}>Butchery</div><div style={{fontSize:11,color:'#555',lineHeight:1.5}}>Slaughter animals for meat. Eat for stamina or sell for coins. Horse cannot be slaughtered.</div></div>{avail.length===0?<div style={{textAlign:'center',padding:40,color:'#aaa'}}>Raise animals first</div>:avail.map(a=>{const qty=meatInv[a.id]||0;return(<Card key={a.id}><div style={{display:'flex',alignItems:'center',gap:12,marginBottom:qty>0?10:0}}><span style={{fontSize:32}}>{a.emoji}</span><div style={{flex:1}}><div style={{fontWeight:800,fontSize:14,color:'#111'}}>{a.name} — {a.me} {a.meat}</div><div style={{fontSize:11,color:'#888'}}>+{a.ms} stamina · 🪙{a.mv}</div></div><Btn onClick={()=>slaughter(a)} color='#c0392b' style={{fontSize:11,padding:'7px 11px'}}>Slaughter</Btn></div>{qty>0&&<div style={{display:'flex',alignItems:'center',gap:8,paddingTop:10,borderTop:'1px solid #f0f0f0'}}><span style={{flex:1,fontSize:13,fontWeight:700,color:'#333'}}>{a.me} {qty} in stock</span><Btn onClick={()=>eatMeat(a)} style={{fontSize:11,padding:'6px 11px'}}>Eat (+{a.ms})</Btn><Btn onClick={()=>sellMeat(a)} color='#b7800a' style={{fontSize:11,padding:'6px 11px'}}>Sell All</Btn></div>}</Card>);})}</div>);
}

function MineScreen({G}){
  const{level,minerals,mine,mineCd,sellMin,upgrades}=G;
  const total=Object.values(minerals).reduce((a,b)=>a+b,0);
  if(level<5)return<div style={{textAlign:'center',padding:60,color:'#aaa'}}><div style={{fontSize:52}}>🔒</div><div style={{fontWeight:700,marginTop:10,color:'#777'}}>Mine unlocks at Level 5</div></div>;
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#2c3e50,#4a4a4a)',borderRadius:20,padding:20,marginBottom:14,textAlign:'center',color:'#fff',boxShadow:'0 4px 20px rgba(0,0,0,.2)'}}>
        <div style={{fontSize:48,marginBottom:8}}>⛏️</div>
        {upgrades.mineBoost&&<div style={{background:'#f39c12',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700,color:'#fff',display:'inline-block',marginBottom:8}}>Mine Elevator Active — 2x rare drops!</div>}
        <div style={{fontSize:12,opacity:.8,marginBottom:12}}>Tap to mine — discover rare minerals!</div>
        <button onClick={mine} style={{background:mineCd?'#555':'#f39c12',color:'#fff',border:'none',borderRadius:16,padding:'12px 28px',fontSize:15,fontWeight:800,cursor:mineCd?'default':'pointer'}}>{mineCd?'Mining...':'Mine Now!'}</button>
      </div>
      {total>0&&<Card><div style={{fontWeight:800,fontSize:13,color:'#333',marginBottom:10}}>Minerals ({total})</div>
        {MINERALS.map(m=>{const q=minerals[m.id]||0;if(!q)return null;return(<div key={m.id} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,padding:'8px 10px',background:'#f8f8f8',borderRadius:12}}><span style={{fontSize:22}}>{m.emoji}</span><div style={{flex:1}}><div style={{fontWeight:700,color:'#111'}}>{m.name}</div><div style={{fontSize:11,color:'#888'}}>x{q} · 🪙{m.v}</div></div><Btn onClick={()=>sellMin(m)} style={{fontSize:11,padding:'5px 10px'}}>🪙{(q*m.v).toLocaleString()}</Btn></div>);})}
      </Card>}
      <Card><div style={{fontSize:11,fontWeight:800,color:'#888',marginBottom:8}}>RARITY CHART</div>
        {MINERALS.map(m=>(<div key={m.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}><span style={{fontSize:14,width:20}}>{m.emoji}</span><div style={{flex:1,height:5,background:'#eee',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${m.r*100}%`,background:'linear-gradient(90deg,#27ae60,#52d68a)',borderRadius:3}}/></div><span style={{fontSize:10,color:'#888',width:60,textAlign:'right'}}>🪙{m.v}</span></div>))}
      </Card>
    </div>
  );
}

function MarketScreen({G}){
  const{coins,spend,earn,notify,silo,minerals,listings,addListing,buyListing,farmName,playerId}=G;
  const[tab,setTab]=useState('browse');
  const[lItem,setLItem]=useState(CROPS[0].id);
  const[lQty,setLQty]=useState(1);
  const[lPrice,setLPrice]=useState(30);
  const[lType,setLType]=useState('silo');
  const[filter,setFilter]=useState('all');
  const allL=[...CROPS.filter(c=>(silo[c.id]||0)>0).map(c=>({id:c.id,name:c.name,emoji:c.emoji,type:'silo'})),...MINERALS.filter(m=>(minerals[m.id]||0)>0).map(m=>({id:m.id,name:m.name,emoji:m.emoji,type:'mineral'}))];
  const valid=listings.filter(l=>l&&l.expiresAt>Date.now());
  const mine=valid.filter(l=>l.sellerId===playerId);
  const others=valid.filter(l=>l.sellerId!==playerId&&(filter==='all'||l.type===filter));
  const timeLeft=ms=>{const h=Math.floor((ms-Date.now())/3600000);const m=Math.floor(((ms-Date.now())%3600000)/60000);return h>0?`${h}h ${m}m`:`${m}m`;};
    return(
    <div style={{padding:14}}>
      <TabRow tabs={[['browse','Browse'],['sell','Sell Items'],['npc','NPC Market']]} active={tab} onSelect={setTab} ac='#2980b9'/>
{tab==='browse'&&<>
        <div style={{display:'flex',gap:6,marginBottom:10}}>
          {[['all','All'],['silo','Crops'],['mineral','Minerals']].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{flex:1,background:filter===v?'#2980b9':'#f5f5f5',color:filter===v?'#fff':'#555',border:'none',borderRadius:10,padding:'7px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{l}</button>
          ))}
        </div>
        {others.length===0&&mine.length===0?(
          <div style={{textAlign:'center',padding:30,color:'#aaa'}}>
            <div style={{fontSize:40}}>🏪</div>
            <div style={{fontWeight:700,color:'#888',marginTop:8}}>No listings yet</div>
            <div style={{fontSize:12,marginTop:4}}>Be the first to list something!</div>
          </div>
        ):others.map(l=>(
          <Card key={l.id}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:6}}>
              <span style={{fontSize:30}}>{l.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:14,color:'#111'}}>{l.name} x{l.qty}</div>
                <div style={{fontSize:11,color:'#888'}}>🧑‍🌾 {l.seller}</div>
                <div style={{fontSize:12,color:'#b7800a',fontWeight:700}}>🪙{l.price} each · Total 🪙{(l.price*l.qty).toLocaleString()}</div>
                <div style={{fontSize:10,color:'#aaa'}}>Expires in {timeLeft(l.expiresAt)}</div>
              </div>
              <Btn onClick={()=>buyListing(l)} disabled={coins<l.price*l.qty} style={{fontSize:12,padding:'7px 11px',flexShrink:0}}>Buy</Btn>
            </div>
          </Card>
        ))}
        {mine.length>0&&<>
          <SecHead label="YOUR ACTIVE LISTINGS"/>
          {mine.map(l=>(
            <Card key={l.id} style={{border:'1px solid #c3e6cb',background:'#f0fff4'}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:28}}>{l.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#111'}}>{l.name} x{l.qty}</div>
                  <div style={{fontSize:11,color:'#27ae60',fontWeight:700}}>Listed at 🪙{l.price} each</div>
                  <div style={{fontSize:10,color:'#aaa'}}>Expires in {timeLeft(l.expiresAt)}</div>
                </div>
                <button onClick={async()=>{
                  setListings(ls=>ls.filter(x=>x.id!==l.id));
                  if(db)try{await set(ref(db,`market/${l.id}`),null);}catch{}
                  if(l.type==='silo')G.setSilo(s=>({...s,[l.itemId]:(s[l.itemId]||0)+l.qty}));
                  else G.setMin(m=>({...m,[l.itemId]:(m[l.itemId]||0)+l.qty}));
                  notify('Listing cancelled — items returned','orange');
                }} style={{background:'#fff5f5',border:'1px solid #fce4e4',borderRadius:10,padding:'6px 10px',fontSize:11,fontWeight:700,cursor:'pointer',color:'#e74c3c'}}>Cancel</button>
              </div>
            </Card>
          ))}
        </>}
      </>}      {tab==='sell'&&<>{allL.length===0?<div style={{textAlign:'center',padding:30,color:'#aaa'}}><div style={{fontSize:40}}>📦</div><div style={{fontWeight:700,color:'#888',marginTop:8}}>No items to list</div><div style={{fontSize:12,marginTop:4}}>Harvest crops or mine minerals first</div></div>:<Card>
        <SecHead label="LIST AN ITEM FOR SALE"/>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>{allL.map(i=><button key={i.id} onClick={()=>{setLItem(i.id);setLType(i.type);}} style={{background:lItem===i.id?'#2980b9':'#f5f5f5',color:lItem===i.id?'#fff':'#333',border:`1.5px solid ${lItem===i.id?'#2980b9':'#ddd'}`,borderRadius:10,padding:'5px 11px',fontSize:12,cursor:'pointer',fontWeight:600}}>{i.emoji} {i.name}</button>)}</div>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,color:'#555',marginBottom:4}}>Qty</div><input type="number" min="1" value={lQty} onChange={e=>setLQty(Math.max(1,parseInt(e.target.value)||1))} style={{width:'100%',padding:'8px 10px',borderRadius:10,border:'1.5px solid #ddd',fontSize:13,outline:'none',boxSizing:'border-box',color:'#333'}}/></div>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,color:'#555',marginBottom:4}}>Price Each</div><input type="number" min="1" value={lPrice} onChange={e=>setLPrice(Math.max(1,parseInt(e.target.value)||1))} style={{width:'100%',padding:'8px 10px',borderRadius:10,border:'1.5px solid #ddd',fontSize:13,outline:'none',boxSizing:'border-box',color:'#333'}}/></div>
        </div>
        <div style={{background:'#f8f8f8',borderRadius:10,padding:'6px 12px',marginBottom:10,fontSize:12,color:'#555'}}>Total: <b>🪙{(lQty*lPrice).toLocaleString()}</b> · Expires in 24h</div>
        <Btn onClick={()=>{const it=allL.find(i=>i.id===lItem);if(!it)return;addListing(lItem,lQty,lPrice,lType,it.emoji,it.name);}} style={{width:'100%',padding:11,fontSize:13}} color='#2980b9'>List for Sale</Btn>
      </Card>}</>}
      {tab==='npc'&&<>{MARKET_ITEMS.map((it,i)=>(<Card key={i} style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:26}}>{it.emoji}</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:'#111'}}>{it.name}</div><div style={{fontSize:11,color:it.up?'#27ae60':'#e74c3c',fontWeight:700}}>{it.trend}</div></div><div style={{textAlign:'right'}}><div style={{fontWeight:800,fontSize:13,color:'#b7800a',marginBottom:3}}>🪙{it.price}</div><Btn onClick={()=>{if(coins>=it.price){spend(it.price);notify(`Bought ${it.name}!`);}else notify('Not enough!','orange');}} style={{fontSize:11,padding:'4px 10px'}}>Buy</Btn></div></Card>))}</>}
    </div>
  );
}

function GmbScreen({G}){
  const{coins,earn,spend,notify,cropPrice}=G;
  return(<div style={{padding:14}}><div style={{background:'#fffbea',borderRadius:14,padding:12,marginBottom:12,border:'1px solid #f0e08a'}}><div style={{fontSize:13,fontWeight:800,color:'#b7800a',marginBottom:3}}>Government Marketing Board</div><div style={{fontSize:11,color:'#555',lineHeight:1.5}}>Always buys at 60% and sells at 140% of market. Always check the Player Market first!</div></div>{CROPS.slice(0,6).map((c,i)=>{const sp=cropPrice(c);return(<Card key={i}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}><span style={{fontSize:26}}>{c.emoji}</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:'#111'}}>{c.name}</div><div style={{fontSize:11,color:'#888'}}>Market: 🪙{sp}</div></div></div><div style={{display:'flex',gap:8}}><div style={{flex:1,background:'#fff8e1',borderRadius:12,padding:'7px 10px',textAlign:'center'}}><div style={{fontSize:10,color:'#888',fontWeight:600}}>SELL TO GMB</div><div style={{fontWeight:800,color:'#b7800a',fontSize:14}}>🪙{Math.floor(sp*.6)}</div><div style={{fontSize:9,color:'#e67e22',marginBottom:4}}>60% of market</div><Btn onClick={()=>{earn(Math.floor(sp*.6));notify(`Sold to GMB!`);}} color='#e67e22' style={{fontSize:11,padding:'4px 9px'}}>Sell</Btn></div><div style={{flex:1,background:'#fff0f0',borderRadius:12,padding:'7px 10px',textAlign:'center'}}><div style={{fontSize:10,color:'#888',fontWeight:600}}>BUY FROM GMB</div><div style={{fontWeight:800,color:'#c0392b',fontSize:14}}>🪙{Math.ceil(sp*1.4)}</div><div style={{fontSize:9,color:'#c0392b',marginBottom:4}}>140% of market</div><Btn onClick={()=>{const p=Math.ceil(sp*1.4);if(coins>=p){spend(p);notify(`Bought from GMB!`);}else notify('Not enough!','orange');}} color='#c0392b' style={{fontSize:11,padding:'4px 9px'}}>Buy</Btn></div></div></Card>);})}</div>);
}

function StallScreen({G}){
  const{stallCfg,setStall,notify}=G;
  const[d,setD]=useState({...stallCfg});const theme=STALL_THEMES.find(t=>t.id===d.theme)||STALL_THEMES[0];
  return(<div style={{padding:14}}><div style={{background:theme.color,borderRadius:20,padding:18,marginBottom:14,color:'#fff',textAlign:'center'}}><div style={{fontSize:11,opacity:.8,marginBottom:4}}>PREVIEW</div><div style={{fontSize:20,fontWeight:800}}>🏪 {d.name||'Your Stall'}</div><div style={{fontSize:12,opacity:.85,marginTop:4,fontStyle:'italic'}}>"{d.welcome}"</div></div>
    {[['Stall Name','name',30,false],['Welcome Message','welcome',80,true],['Goodbye Message','goodbye',80,true]].map(([lb,key,mx,multi])=>(<Card key={key}><div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:6}}>{lb} <span style={{color:'#bbb',fontWeight:400}}>({d[key].length}/{mx})</span></div>{multi?<textarea value={d[key]} onChange={e=>setD(x=>({...x,[key]:e.target.value.slice(0,mx)}))} rows={2} style={{width:'100%',padding:'8px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',resize:'none',boxSizing:'border-box',color:'#333'}}/>:<input value={d[key]} onChange={e=>setD(x=>({...x,[key]:e.target.value.slice(0,mx)}))} style={{width:'100%',padding:'8px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box',color:'#333'}}/>}</Card>))}
    <Card><div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:8}}>Colour Theme</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>{STALL_THEMES.map(t=><button key={t.id} onClick={()=>setD(x=>({...x,theme:t.id}))} style={{background:d.theme===t.id?t.color:'#f5f5f5',color:d.theme===t.id?'#fff':'#333',border:`2px solid ${d.theme===t.id?t.color:'#eee'}`,borderRadius:12,padding:'7px 10px',fontSize:12,cursor:'pointer',fontWeight:600}}>{t.label}</button>)}</div></Card>
    <Btn onClick={()=>{setStall({...d});notify('Stall saved!','green');}} style={{width:'100%',padding:12,fontSize:14}}>Save My Stall</Btn>
  </div>);
}

// ─── BANK (Fixed: Emergency Loan cap + auto-debit, Savings, Loans, Services) ──
function BankScreen({G}){
  const{coins,earn,spend,notify,bankBal,setBankBal,loanDebt,takeEmergencyLoan,setLoanDebt,upgrades,goldGrowthBal,setGGB,goldGrowth,setGG,goldHeld,jointBal,setJB}=G;
  const[tab,setTab]=useState('savings');
  const[amt,setAmt]=useState('');
  const[lAmt,setLA]=useState('');
  const[eLoan,setEL]=useState('');
  const profitRate=upgrades.premiumBank?.08:.05;
  const deposit=()=>{const n=parseInt(amt);if(!n||n<=0||n>coins){notify('Invalid amount!','orange');return;}spend(n);setBankBal(b=>b+n);setAmt('');notify(`Deposited 🪙${n.toLocaleString()}!`,'green');};
  const withdraw=()=>{if(!bankBal){notify('Nothing to withdraw!','orange');return;}const p=Math.floor(bankBal*profitRate);earn(bankBal+p);notify(`Withdrew 🪙${(bankBal+p).toLocaleString()} (+🪙${p} profit!)`,'gold');setBankBal(0);};
  const takeLoan=fee=>{const n=parseInt(lAmt);if(!n||n<=0){notify('Enter an amount!','orange');return;}const f=Math.round(n*fee);earn(n);notify(`Loan of 🪙${n} approved. Fixed fee 🪙${f} deducted now.`,'blue');spend(f);setLA('');};
  const repayLoan=()=>{const repay=Math.min(loanDebt,coins);if(!repay){notify('No loan to repay!','orange');return;}spend(repay);setLoanDebt(0);notify(`Loan fully repaid! 🪙${repay}`,'green');};
  const depositGoldGrowth=()=>{if(goldHeld<=0){notify('No gold held!','orange');return;}setGGB(b=>+(b+goldHeld).toFixed(2));G.setGold&&G.setGold(0);notify(`Deposited ${goldHeld}g to Gold Growth Account!`,'gold');};
  const withdrawGoldGrowth=()=>{if(!goldGrowthBal){notify('Nothing deposited!','orange');return;}const tot=+(goldGrowthBal+goldGrowth).toFixed(2);earn(Math.floor(tot*G.goldPrice));setGGB(0);setGG(0);notify(`Withdrew ${tot}g worth 🪙${Math.floor(tot*G.goldPrice).toLocaleString()}!`,'gold');};
  const joinFund=()=>{const n=parseInt(lAmt);if(!n||n>coins){notify('Invalid!','orange');return;}spend(n);setJB(b=>b+n);setLA('');notify(`🪙${n} added to Joint Fund. Returns every 90s!`,'green');};
  const withdrawJoint=()=>{if(!jointBal){notify('Nothing in fund!','orange');return;}earn(jointBal);setJB(0);notify(`Withdrew 🪙${jointBal.toLocaleString()} from Joint Fund!`,'gold');};
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#1a3a50,#2471a3)',borderRadius:20,padding:18,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>HARVEST HAVEN BANK</div>
        <div style={{fontSize:28,fontWeight:800,margin:'4px 0'}}>🪙 {bankBal.toLocaleString()}</div>
        <div style={{fontSize:11,opacity:.75}}>{(profitRate*100).toFixed(0)}% monthly profit share{upgrades.premiumBank?' (Premium)':''}</div>
      </div>
      {loanDebt>0&&<div style={{background:'linear-gradient(135deg,#e74c3c,#c0392b)',borderRadius:14,padding:'10px 16px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:12,fontWeight:800,color:'#fff'}}>Active Emergency Loan</div><div style={{fontSize:11,color:'rgba(255,255,255,.8)'}}>10% of earnings auto-debiting</div></div>
        <div style={{textAlign:'right'}}><div style={{fontSize:16,fontWeight:800,color:'#fff'}}>🪙{loanDebt} left</div><button onClick={repayLoan} style={{background:'rgba(255,255,255,.2)',color:'#fff',border:'1px solid rgba(255,255,255,.4)',borderRadius:10,padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer',marginTop:4}}>Repay Now</button></div>
      </div>}
      <TabRow tabs={[['savings','Savings'],['loans','Loans'],['services','Services']]} active={tab} onSelect={setTab} ac='#1a5276'/>
      {tab==='savings'&&<>
        <Card>
          <div style={{fontWeight:800,fontSize:14,color:'#1a3a50',marginBottom:6}}>Profit Share Account</div>
          <div style={{fontSize:11,color:'#777',marginBottom:10,lineHeight:1.5}}>Deposit coins and earn {(profitRate*100).toFixed(0)}% monthly profit share. No interest — returns come from real farm economy activity.</div>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <input value={amt} onChange={e=>setAmt(e.target.value)} type="number" placeholder="Amount..." style={{flex:1,padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',color:'#333'}}/>
            <Btn onClick={deposit}>Deposit</Btn>
          </div>
          {bankBal>0&&<>
            <div style={{background:'#e8f4f8',borderRadius:12,padding:'9px 14px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span style={{color:'#555'}}>Balance</span><span style={{fontWeight:800,color:'#1a3a50'}}>🪙{bankBal.toLocaleString()}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginTop:4}}><span style={{color:'#888'}}>Profit Share ({(profitRate*100).toFixed(0)}%)</span><span style={{fontWeight:700,color:'#27ae60'}}>+🪙{Math.floor(bankBal*profitRate).toLocaleString()}</span></div>
            </div>
            <Btn onClick={withdraw} color='#e67e22' style={{width:'100%',padding:10}}>Withdraw + Claim Profit</Btn>
          </>}
        </Card>
      </>}
      {tab==='loans'&&<>
        <div style={{background:'#e8f4f8',borderRadius:14,padding:12,marginBottom:12,border:'1px solid #bee3f8'}}>
          <div style={{fontSize:12,fontWeight:800,color:'#1a5276',marginBottom:3}}>Fixed-Fee Loans</div>
          <div style={{fontSize:11,color:'#555',lineHeight:1.5}}>All loans use a one-time fixed fee. Zero interest. Full transparency before you confirm.</div>
        </div>
        <Card>
          <div style={{fontWeight:800,fontSize:13,color:'#e74c3c',marginBottom:6}}>🆘 Emergency Loan</div>
          <div style={{fontSize:11,color:'#777',marginBottom:8,lineHeight:1.5}}>Cap: 🪙500 per loan. No fee. 10% of every earning auto-debits until fully repaid. One loan at a time only. You can also repay manually at any time.</div>
          {loanDebt>0?<div style={{background:'#fff5f5',borderRadius:12,padding:'8px 12px',fontSize:12,color:'#c0392b',fontWeight:700,textAlign:'center'}}>Loan active: 🪙{loanDebt} remaining. Repay before taking another.</div>:<>
            <div style={{display:'flex',gap:8}}>
              <input value={eLoan} onChange={e=>setEL(e.target.value)} type="number" placeholder="Amount (max 500)" max="500" style={{flex:1,padding:'8px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',color:'#333'}}/>
              <Btn onClick={()=>{const n=parseInt(eLoan);takeEmergencyLoan(n);setEL('');}} color='#e74c3c' style={{fontSize:12,padding:'8px 12px'}}>Apply</Btn>
            </div>
            {eLoan&&<div style={{fontSize:11,color:'#888',marginTop:5}}>You receive 🪙{Math.min(parseInt(eLoan)||0,500)} · Zero fee · Auto-debits 10% of earnings</div>}
          </>}
        </Card>
        {[{label:'Equipment Loan',desc:'Buy machinery or farm upgrades',fee:.08,icon:'🏗️'},{label:'Seed and Supply Loan',desc:'Fund seeds, fertilizer and supplies',fee:.05,icon:'🌱'},{label:'Expansion Loan',desc:'Fund land purchases and expansions',fee:.10,icon:'🌍'}].map((l,i)=>(
          <Card key={i}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}><span style={{fontSize:26}}>{l.icon}</span><div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:'#111'}}>{l.label}</div><div style={{fontSize:11,color:'#777'}}>{l.desc}</div><div style={{fontSize:12,fontWeight:700,color:'#b7800a',marginTop:2}}>Fixed fee: {(l.fee*100).toFixed(0)}%</div></div></div>
            <div style={{display:'flex',gap:8}}>
              <input value={lAmt} onChange={e=>setLA(e.target.value)} type="number" placeholder="Loan amount..." style={{flex:1,padding:'8px 12px',borderRadius:10,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',color:'#333'}}/>
              <Btn onClick={()=>takeLoan(l.fee)} color='#1a5276' style={{fontSize:12,padding:'7px 12px'}}>Apply</Btn>
            </div>
            {lAmt&&parseInt(lAmt)>0&&<div style={{fontSize:11,color:'#777',marginTop:5}}>Receive 🪙{parseInt(lAmt)||0} · Fee 🪙{Math.round((parseInt(lAmt)||0)*l.fee)} deducted now</div>}
          </Card>
        ))}
      </>}
      {tab==='services'&&<>
        <Card>
          <div style={{fontWeight:800,fontSize:13,color:'#b7800a',marginBottom:6}}>💛 Gold Growth Account{!upgrades.goldVault?<span style={{fontSize:10,color:'#aaa',fontWeight:400}}> — Buy Gold Vault in Garage</span>:''}</div>
          {!upgrades.goldVault?<div style={{fontSize:11,color:'#aaa',lineHeight:1.5}}>Purchase the Gold Vault upgrade in the Garage (🪙3,000) to unlock this account.</div>:<>
            <div style={{fontSize:11,color:'#777',marginBottom:8,lineHeight:1.5}}>Deposit your gold and earn 2% returns automatically. Credited every 2 minutes in demo. Withdraw anytime with profits.</div>
            <div style={{background:'#fff9e6',borderRadius:12,padding:'8px 12px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'#666'}}>Deposited</span><span style={{fontWeight:800,color:'#b7800a'}}>{goldGrowthBal}g</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginTop:3}}><span style={{color:'#666'}}>Returns earned</span><span style={{fontWeight:700,color:'#27ae60'}}>+{G.goldGrowth}g</span></div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <Btn onClick={depositGoldGrowth} color='#b7800a' style={{flex:1,padding:9,fontSize:12}}>Deposit All Gold ({G.goldHeld}g)</Btn>
              {goldGrowthBal>0&&<Btn onClick={withdrawGoldGrowth} style={{flex:1,padding:9,fontSize:12}}>Withdraw</Btn>}
            </div>
          </>}
        </Card>
        <Card>
          <div style={{fontWeight:800,fontSize:13,color:'#16a085',marginBottom:6}}>👥 Joint Investment Fund</div>
          <div style={{fontSize:11,color:'#777',marginBottom:8,lineHeight:1.5}}>Pool coins with your world. Earn 2% returns every 90 seconds. All players in your world benefit from contributions.</div>
          <div style={{background:'#e8f8f5',borderRadius:12,padding:'8px 12px',marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'#555'}}>Your contribution</span><span style={{fontWeight:800,color:'#16a085'}}>🪙{jointBal.toLocaleString()}</span></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <input value={lAmt} onChange={e=>setLA(e.target.value)} type="number" placeholder="Amount to pool..." style={{flex:1,padding:'8px 12px',borderRadius:10,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',color:'#333'}}/>
            <Btn onClick={joinFund} color='#16a085' style={{fontSize:12,padding:'7px 12px'}}>Pool</Btn>
            {jointBal>0&&<Btn onClick={withdrawJoint} color='#e67e22' style={{fontSize:12,padding:'7px 12px'}}>Withdraw</Btn>}
          </div>
        </Card>
      </>}
    </div>
  );
}

function GoldScreen({G}){
  const{coins,goldHeld,goldPrice,goldBuy,setGoldBuy,goldSell,setGoldSell,buyGoldF,sellGoldF}=G;
  const bc=goldBuy?Math.ceil(parseFloat(goldBuy)*goldPrice):0,sr=goldSell?Math.floor(parseFloat(goldSell)*goldPrice):0;
  return(<div style={{padding:14}}>
    <div style={{background:'linear-gradient(135deg,#7d6008,#b7800a)',borderRadius:20,padding:18,marginBottom:14,color:'#fff',boxShadow:'0 4px 18px rgba(183,128,10,.3)'}}>
      <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>HARVEST GOLD STORE</div>
      <div style={{fontSize:28,fontWeight:800,margin:'4px 0'}}>🥇 {goldHeld}g held</div>
      <div style={{display:'flex',justifyContent:'space-between'}}><div><div style={{fontSize:11,opacity:.8}}>Live Price</div><div style={{fontSize:19,fontWeight:800}}>🪙{goldPrice.toFixed(2)}/g</div></div><div style={{textAlign:'right'}}><div style={{fontSize:11,opacity:.8}}>Portfolio</div><div style={{fontSize:17,fontWeight:800}}>🪙{(goldHeld*goldPrice).toFixed(0)}</div></div></div>
    </div>
    <Card><div style={{fontWeight:800,fontSize:13,color:'#b7800a',marginBottom:8}}>Buy Gold</div>
      <input value={goldBuy} onChange={e=>setGoldBuy(e.target.value)} type="number" step="0.1" placeholder="Grams to buy" style={{width:'100%',padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:6,color:'#333'}}/>
      {goldBuy&&<div style={{fontSize:11,color:'#777',marginBottom:6}}>Cost: 🪙{bc.toLocaleString()} · Wallet: 🪙{coins.toLocaleString()}</div>}
      <Btn onClick={buyGoldF} color='#b7800a' style={{width:'100%',padding:9}}>Buy Gold</Btn>
    </Card>
    {goldHeld>0&&<Card><div style={{fontWeight:800,fontSize:13,color:'#27ae60',marginBottom:8}}>Sell Gold</div>
      <input value={goldSell} onChange={e=>setGoldSell(e.target.value)} type="number" step="0.1" placeholder={`Max ${goldHeld}g`} style={{width:'100%',padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:6,color:'#333'}}/>
      {goldSell&&<div style={{fontSize:11,color:'#777',marginBottom:6}}>You receive: 🪙{sr.toLocaleString()}</div>}
      <Btn onClick={sellGoldF} style={{width:'100%',padding:9}}>Sell Gold</Btn>
    </Card>}
    <Card><div style={{fontSize:11,fontWeight:800,color:'#888',marginBottom:8}}>TIP</div><div style={{fontSize:12,color:'#555',lineHeight:1.5}}>Deposit gold in the Gold Growth Account (Bank Services) to earn automatic returns without selling!</div></Card>
  </div>);
}

function FinanceScreen({G}){
  const{coins,bankBal,goldHeld,goldPrice,totalEarned,todayEarned,todaySpent,loanDebt,friendBonus,jointBal}=G;
  const gv=Math.floor(goldHeld*goldPrice),nw=coins+bankBal+gv+jointBal-loanDebt,net=todayEarned-todaySpent;
  const s=Math.min(100,Math.max(10,50+(net>0?25:net<0?-15:0)+(bankBal>100?15:0)+(goldHeld>0?5:0)-(loanDebt>0?15:0)));
  const[lbl,col]=s>=80?['Excellent','#27ae60']:s>=60?['Good','#b7800a']:s>=40?['Fair','#e67e22']:['Needs Work','#c0392b'];
  return(<div style={{padding:14}}>
    <div style={{background:`linear-gradient(135deg,${col},${col}cc)`,borderRadius:20,padding:18,marginBottom:12,color:'#fff'}}>
      <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>FINANCIAL HEALTH SCORE</div>
      <div style={{fontSize:44,fontWeight:900,lineHeight:1.1,margin:'3px 0'}}>{s}</div>
      <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>{lbl}</div>
      <div style={{height:6,background:'rgba(255,255,255,.3)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${s}%`,background:'#fff',borderRadius:4}}/></div>
    </div>
    {friendBonus>0&&<Card style={{background:'#e8f8f5',border:'1px solid #c3e6cb'}}><div style={{fontSize:13,fontWeight:700,color:'#16a085'}}>Friend Bonus Active: +{Math.round(friendBonus*100)}% on all earnings!</div></Card>}
    <Card><div style={{fontWeight:800,fontSize:13,color:'#333',marginBottom:10}}>Today</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        {[['Earned',todayEarned,'#27ae60'],['Spent',todaySpent,'#e74c3c'],['Net',net,net>=0?'#27ae60':'#e74c3c']].map(([l,v,c],i)=>(<div key={i} style={{background:'#f8f8f8',borderRadius:12,padding:10,textAlign:'center'}}><div style={{fontWeight:800,fontSize:12,color:c}}>{v<0?'-':''}🪙{Math.abs(v).toLocaleString()}</div><div style={{fontSize:9,color:'#aaa',marginTop:2}}>{l}</div></div>))}
      </div>
    </Card>
    <Card><div style={{fontWeight:800,fontSize:13,color:'#333',marginBottom:10}}>Balance Sheet</div>
      {[['Wallet',coins,'#1a6b2a'],['Bank',bankBal,'#1a6b2a'],['Gold',gv,'#b7800a'],['Joint Fund',jointBal,'#16a085']].map(([l,v,c],i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{fontSize:13,color:'#555'}}>{l}</span><span style={{fontWeight:800,color:c}}>🪙{v.toLocaleString()}</span></div>))}
      {loanDebt>0&&<div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{fontSize:13,color:'#e74c3c'}}>Active Loan</span><span style={{fontWeight:800,color:'#e74c3c'}}>-🪙{loanDebt}</span></div>}
      <div style={{display:'flex',justifyContent:'space-between',paddingTop:10}}><span style={{fontSize:15,fontWeight:800,color:'#111'}}>Net Worth</span><span style={{fontWeight:900,fontSize:17,color:'#b7800a'}}>🪙{nw.toLocaleString()}</span></div>
    </Card>
    <Card><SecHead label="ALL TIME"/><div style={{display:'flex',justifyContent:'space-between',fontSize:14}}><span style={{color:'#555'}}>Total Earned</span><span style={{fontWeight:800,color:'#27ae60'}}>🪙{totalEarned.toLocaleString()}</span></div></Card>
  </div>);
}

function GarageScreen({G}){
  const{upgrades,buyUpgrade,coins,T}=G;
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#37474f,#546e7a)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>GARAGE AND UPGRADES</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>🔧 Permanent Farm Upgrades</div>
        <div style={{fontSize:11,opacity:.8}}>Buy once, benefit forever. These are the big investments!</div>
      </div>
      {UPGRADES.map(up=>{const owned=upgrades[up.id],canAff=coins>=up.cost;return(
        <Card key={up.id} style={owned?{border:'2px solid #27ae60',opacity:.85}:{}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:40}}>{up.emoji}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15,color:'#111'}}>{up.name}</div>
              <div style={{fontSize:12,color:'#666',marginBottom:4,lineHeight:1.4}}>{up.desc}</div>
              {!owned&&<div style={{fontSize:14,fontWeight:800,color:'#b7800a'}}>🪙{up.cost.toLocaleString()}</div>}
            </div>
            {owned?<div style={{textAlign:'center'}}><div style={{fontSize:24}}>✅</div><div style={{fontSize:10,color:'#27ae60',fontWeight:700}}>Active</div></div>:<Btn onClick={()=>buyUpgrade(up)} disabled={!canAff} color={T.primary} style={{fontSize:12,padding:'9px 14px',flexShrink:0}}>{canAff?'Buy Now':'Need 🪙'}</Btn>}
          </div>
        </Card>
      );})}
      <Card style={{background:'#f9f9f9'}}>
        <div style={{fontSize:12,fontWeight:800,color:'#555',marginBottom:6}}>Why buy upgrades?</div>
        {['Auto-Plower saves time plowing many fields','Mine Elevator doubles rare mineral drops','Premium Banking raises profit share 5% to 8%','Gold Vault unlocks the Gold Growth Account','Silo Boost raises all crop sell prices by 10%','Pet Luxury House slows pet hunger and happiness decay by 60%'].map((t,i)=><div key={i} style={{fontSize:11,color:'#777',lineHeight:1.8}}>• {t}</div>)}
      </Card>
    </div>
  );
}

function VisitStallsListScreen({G}){
  const{allStalls,T}=G;
  const[visiting,setVisiting]=useState(null);
  if(visiting)return<VisitStallScreen stall={visiting} onClose={()=>setVisiting(null)} G={G}/>;
  return(
    <div style={{padding:14}}>
      <div style={{background:`linear-gradient(135deg,${T.primary},${T.accent})`,borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>PLAYER STALLS</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>🛖 Visit Farm Stalls</div>
        <div style={{fontSize:12,opacity:.85}}>{allStalls.length} stalls open right now</div>
      </div>
      {allStalls.length===0?(
        <div style={{textAlign:'center',padding:40,color:'#aaa'}}>
          <div style={{fontSize:56}}>🛖</div>
          <div style={{fontWeight:800,fontSize:16,color:'#888',marginTop:10}}>No stalls open</div>
          <div style={{fontSize:12,marginTop:6,color:'#aaa'}}>Other players need to set up their stalls first</div>
        </div>
      ):allStalls.map(stall=>{
        const theme=STALL_THEMES.find(t=>t.id===stall.theme)||STALL_THEMES[0];
        return(
          <Card key={stall.playerId}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:46,height:46,background:theme.color,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>🏪</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:15,color:'#111'}}>{stall.name}</div>
                <div style={{fontSize:11,color:'#777'}}>by {stall.farmName}</div>
                <div style={{fontSize:11,color:'#27ae60',fontWeight:700}}>{stall.listings?.length||0} items for sale</div>
              </div>
              <Btn onClick={()=>setVisiting(stall)} color={theme.color} style={{fontSize:12,padding:'8px 14px',flexShrink:0}}>Visit</Btn>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
function VisitStallScreen({stall,onClose,G}){
  const{coins,spend,notify,playerId,setMin,setSilo}=G;
  const theme=STALL_THEMES.find(t=>t.id===stall.theme)||STALL_THEMES[0];
  const[shown,setShown]=useState(true);
  return(
    <div style={{padding:14}}>
      {shown&&<div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{background:theme.color,borderRadius:20,padding:24,maxWidth:340,width:'100%',textAlign:'center',color:'#fff'}}>
          <div style={{fontSize:40,marginBottom:8}}>👋</div>
          <div style={{fontSize:18,fontWeight:900,marginBottom:6}}>{stall.welcome}</div>
          <div style={{fontSize:13,opacity:.85,marginBottom:16}}>Welcome to {stall.name}</div>
          <button onClick={()=>setShown(false)} style={{background:'rgba(255,255,255,.2)',color:'#fff',border:'1.5px solid rgba(255,255,255,.4)',borderRadius:12,padding:'10px 24px',fontSize:14,fontWeight:700,cursor:'pointer'}}>Enter Stall</button>
        </div>
      </div>}
      <div style={{background:theme.color,borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.8,letterSpacing:1,fontWeight:700}}>VISITING</div>
        <div style={{fontSize:22,fontWeight:900}}>🏪 {stall.name}</div>
        <div style={{fontSize:12,opacity:.85}}>by {stall.farmName}</div>
      </div>
      {stall.listings&&stall.listings.length>0?(
        stall.listings.map(l=>(
          <Card key={l.id}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:30}}>{l.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:14,color:'#111'}}>{l.name} x{l.qty}</div>
                <div style={{fontSize:12,color:'#b7800a',fontWeight:700}}>🪙{l.price} each</div>
              </div>
              <Btn onClick={()=>{
                const total=l.price*l.qty;
                if(coins<total){notify('Not enough coins!','orange');return;}
                spend(total);
                if(l.type==='silo')setSilo(s=>({...s,[l.itemId]:(s[l.itemId]||0)+l.qty}));
                else setMin(m=>({...m,[l.itemId]:(m[l.itemId]||0)+l.qty}));
                if(db)set(ref(db,`market/${l.id}`),null).catch(()=>{});
                notify(`Bought ${l.qty}x ${l.name} from ${stall.farmName}!`,'gold');
              }} disabled={coins<l.price*l.qty} style={{fontSize:12,padding:'7px 11px',flexShrink:0}}>Buy</Btn>
            </div>
          </Card>
        ))
      ):<div style={{textAlign:'center',padding:30,color:'#aaa'}}><div style={{fontSize:40}}>📭</div><div style={{fontWeight:700,color:'#888',marginTop:8}}>No items listed</div></div>}
      <button onClick={()=>{notify(stall.goodbye,'green');onClose();}} style={{width:'100%',background:'#f5f5f5',border:'1px solid #ddd',borderRadius:14,padding:13,fontSize:14,fontWeight:700,cursor:'pointer',color:'#555',marginTop:8}}>Leave Stall 👋</button>
    </div>
  );
}
function ChatScreen({G}){
  const{chatMsgs,sendChat,setChat,playerId,blocked,setBlocked,notify}=G;
  const[ch,setCh]=useState('General');
  const[input,setInput]=useState('');
  const[last,setLast]=useState(0);
  const endRef=useRef(null);

  useEffect(()=>{
    if(!db)return;
    const chatRef=ref(db,`globalchat/${ch}`);
    const unsub=onValue(chatRef,sn=>{
      if(sn.exists()){
        const data=sn.val();
        if(data&&typeof data==='object'){
          const msgs=Object.values(data)
            .filter(m=>m&&m.text&&m.time)
            .sort((a,b)=>a.time-b.time)
            .slice(-50);
          G.setChat(m=>({...m,[ch]:msgs}));
        }
      }
    });
    return()=>unsub();
  },[ch]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[chatMsgs[ch]]);
  const send=()=>{
    const txt=input.trim();if(!txt)return;
    if(Date.now()-last<3000){notify('Wait before sending again.','orange');return;}
    if(txt.length>200){notify('Max 200 chars.','orange');return;}
    if(sendChat(ch,txt)){setInput('');setLast(Date.now());}
  };
  const msgs=(chatMsgs[ch]||[]).filter(m=>!blocked.includes(m.author));
  const col=CH_COL[ch]||'#27ae60';
  return(
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 130px)'}}>
      <div style={{display:'flex',background:'#fff',borderBottom:'1px solid #eee',flexShrink:0}}>
        {CHAT_CH.map(c=><button key={c} onClick={()=>setCh(c)} style={{flex:1,background:'none',border:'none',borderBottom:`3px solid ${ch===c?CH_COL[c]:'transparent'}`,padding:'10px 2px',fontSize:11,fontWeight:700,cursor:'pointer',color:ch===c?CH_COL[c]:'#888'}}>{c}</button>)}
      </div>
      <div style={{background:'#f0f0f0',padding:'4px 14px',fontSize:10,color:'#888',flexShrink:0}}>
        {ch==='Missions'&&'Post task help requests here'}{ch==='Trading'&&'Offer and request items'}{ch==='Help'&&'Ask farming questions'}{ch==='General'&&'Chat with all players'}
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'10px 14px',background:'#f3f4f3',display:'flex',flexDirection:'column',gap:8}}>
        {msgs.length===0&&<div style={{textAlign:'center',color:'#bbb',padding:30,fontSize:13}}>No messages yet — say hello!</div>}
        {msgs.map(m=>{
          const isMe=m.author===playerId;
          return(
            <div key={m.id} style={{display:'flex',flexDirection:isMe?'row-reverse':'row',gap:6,alignItems:'flex-end'}}>
              <div style={{maxWidth:'78%'}}>
                {!isMe&&<div style={{fontSize:10,color:'#888',marginBottom:2,fontWeight:600}}>{m.farm}</div>}
                <div style={{background:isMe?col:'#fff',color:isMe?'#fff':'#111',borderRadius:isMe?'16px 16px 4px 16px':'16px 16px 16px 4px',padding:'8px 12px',fontSize:13,lineHeight:1.4,boxShadow:'0 1px 4px rgba(0,0,0,.08)',border:isMe?'none':'1px solid #ececec'}}>{m.text}</div>
                <div style={{fontSize:9,color:'#bbb',marginTop:2,textAlign:isMe?'right':'left'}}>{new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              {!isMe&&<button onClick={()=>{setBlocked(b=>[...b,m.author]);notify('User blocked.','orange');}} style={{background:'none',border:'none',fontSize:12,cursor:'pointer',color:'#ddd',padding:2,flexShrink:0}}>⊗</button>}
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div style={{background:'#fff',borderTop:'1px solid #eee',padding:'10px 14px 16px',display:'flex',gap:8,flexShrink:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={`Message ${ch}...`} maxLength={200} style={{flex:1,padding:'10px 14px',borderRadius:24,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',background:'#f9f9f9',color:'#111'}}/>
        <button onClick={send} style={{background:col,color:'#fff',border:'none',borderRadius:24,padding:'10px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Send</button>
      </div>
    </div>
  );
}

function FarmhouseScreen({G}){
  const{farmName,updateFN,themeId,updateTheme,worldCode,setWC,playerId,level,totalEarned,notify,T,friendsList,setFriendsList,friendStreak,sendFriendHelp,lastFriendHelp}=G;
  const[tab,setTab]=useState('identity');
  const[nameInput,setNI]=useState(farmName);
  const[joinInput,setJI]=useState('');
  const[fidInput,setFID]=useState('');
  const[players,setPlayers]=useState([]);
  const[selBook,setSelBook]=useState(null);
  const[pg,setPg]=useState(0);
  const today=todayStr();

  const regAndLoad=useCallback(async()=>{
    if(!worldCode||!playerId)return;
    try{await window.storage.set(`world:${worldCode}:${playerId}`,JSON.stringify({name:farmName,level,lastSeen:Date.now()}),true);}catch{}
    try{
      const r=await window.storage.list(`world:${worldCode}:`,true);
      if(r?.keys?.length){
        const data=await Promise.all(r.keys.map(async k=>{try{const x=await window.storage.get(k,true);return x?{key:k,isMe:k.includes(playerId),...JSON.parse(x.value)}:null;}catch{return null;}}));
        setPlayers(data.filter(Boolean));
      }else setPlayers([]);
    }catch{setPlayers([]);}
  },[worldCode,playerId,farmName,level]);

  useEffect(()=>{if(tab==='multiplayer'){regAndLoad();const t=setInterval(regAndLoad,8000);return()=>clearInterval(t);}},[tab,regAndLoad]);

  const now=Date.now(),onlineCnt=players.filter(p=>now-p.lastSeen<25000).length;

  const addFriend=()=>{
    const id=fidInput.trim().toUpperCase();
    if(!id||id===playerId){notify('Invalid Player ID!','orange');return;}
    if(friendsList.includes(id)){notify('Already a friend!','orange');return;}
    setFriendsList(f=>[...f,id]);setFID('');
    notify(`Friend ${id} added!`,'green');
  };

  if(selBook){
    const page=selBook.pages[pg];
    return(
      <div style={{padding:14}}>
        <button onClick={()=>{setSelBook(null);setPg(0);}} style={{background:'none',border:'none',color:T.primary,fontSize:14,fontWeight:800,cursor:'pointer',marginBottom:12}}>Back to Guide</button>
        <div style={{background:`linear-gradient(135deg,${T.primary},${T.accent})`,borderRadius:20,padding:18,marginBottom:14,color:'#fff'}}>
          <div style={{fontSize:28,marginBottom:6}}>{selBook.emoji}</div>
          <div style={{fontSize:16,fontWeight:900}}>{selBook.title}</div>
          <div style={{fontSize:11,opacity:.75,marginTop:2}}>Page {pg+1} of {selBook.pages.length}</div>
        </div>
        <Card>
          <div style={{fontSize:15,fontWeight:800,color:'#111',marginBottom:10}}>{page.t}</div>
          {page.c.split('\n').map((line,i)=><div key={i} style={{fontSize:13,color:'#444',lineHeight:1.8,minHeight:line?'auto':10}}>{line}</div>)}
        </Card>
        <div style={{display:'flex',gap:8,marginTop:4}}>
          <button onClick={()=>setPg(p=>Math.max(0,p-1))} disabled={pg===0} style={{flex:1,background:pg===0?'#f5f5f5':'#fff',border:'1.5px solid #ddd',borderRadius:12,padding:10,fontSize:13,fontWeight:700,cursor:pg===0?'default':'pointer',color:pg===0?'#ccc':'#444'}}>Prev</button>
          <button onClick={()=>setPg(p=>Math.min(selBook.pages.length-1,p+1))} disabled={pg===selBook.pages.length-1} style={{flex:1,background:pg===selBook.pages.length-1?'#f5f5f5':T.primary,border:'none',borderRadius:12,padding:10,fontSize:13,fontWeight:700,cursor:pg===selBook.pages.length-1?'default':'pointer',color:pg===selBook.pages.length-1?'#ccc':'#fff'}}>Next</button>
        </div>
      </div>
    );
  }

  const tabs=[['identity','Identity'],['multiplayer','Multiplayer'],['friends','Friends'],['theme','Theme'],['guide','Guide']];
  return(
    <div style={{padding:14}}>
      <TabRow tabs={tabs} active={tab} onSelect={setTab} ac={T.primary}/>
      {tab==='identity'&&<>
        <div style={{background:`linear-gradient(135deg,${T.primary},${T.accent})`,borderRadius:20,padding:18,marginBottom:14,color:'#fff',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:900}}>{nameInput||'My Farm'}</div>
          <div style={{fontSize:12,opacity:.8,marginTop:4}}>Level {level} Farmer</div>
        </div>
        <Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:8}}>Farm Name</div>
          <input value={nameInput} onChange={e=>setNI(e.target.value.slice(0,30))} placeholder="Name your farm..." style={{width:'100%',padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:8,color:'#333'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:10,color:'#aaa'}}>{nameInput.length}/30</span>
            <Btn onClick={()=>{updateFN(nameInput);notify('Farm name saved!','green');}} color={T.primary}>Save</Btn>
          </div>
        </Card>
        <Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:10}}>Stats</div>
          {[['Level',level],['Total Earned',`🪙${totalEarned.toLocaleString()}`],['World Code',worldCode],['Player ID',playerId]].map(([l,v],i,arr)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<arr.length-1?'1px solid #f0f0f0':'none'}}>
              <span style={{fontSize:13,color:'#666'}}>{l}</span><span style={{fontWeight:700,fontSize:13,color:'#333'}}>{v}</span>
            </div>
          ))}
        </Card>
      </>}
      {tab==='multiplayer'&&<>
        <div style={{background:'linear-gradient(135deg,#1a3a50,#2471a3)',borderRadius:20,padding:18,marginBottom:14,color:'#fff'}}>
          <div style={{fontSize:11,opacity:.85,letterSpacing:1,marginBottom:4,fontWeight:700}}>YOUR WORLD CODE</div>
          <div style={{fontSize:34,fontWeight:900,letterSpacing:4,margin:'5px 0'}}>{worldCode}</div>
          <div style={{fontSize:11,opacity:.75,marginBottom:10}}>Share with friends to play together</div>
          <button onClick={()=>notify(`World Code: ${worldCode}`,'blue')} style={{background:'rgba(255,255,255,.2)',color:'#fff',border:'1.5px solid rgba(255,255,255,.4)',borderRadius:12,padding:'7px 16px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Show Code</button>
        </div>
        <Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:8}}>Join a World</div>
          <div style={{display:'flex',gap:8}}>
            <input value={joinInput} onChange={e=>setJI(e.target.value.toUpperCase().slice(0,9))} placeholder="Enter world code..." style={{flex:1,padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:14,outline:'none',fontFamily:'inherit',letterSpacing:2,fontWeight:700,color:'#333'}}/>
            <Btn onClick={async()=>{const c=joinInput.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(!c)return;try{await window.storage.set('world_code',c);}catch{}setWC(c);notify(`Joined ${c}!`,'green');setJI('');}} color={T.primary}>Join</Btn>
          </div>
        </Card>
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:800,color:'#333'}}>Connected Players</div>
            <div style={{fontSize:11,fontWeight:700,color:onlineCnt>1?'#27ae60':'#bbb'}}>{onlineCnt} online</div>
          </div>
          {players.length===0?<div style={{textAlign:'center',padding:16,color:'#bbb'}}><div style={{fontSize:28}}>👥</div><div style={{fontSize:12,marginTop:5}}>Share your code to invite friends</div></div>
            :players.map((p,i)=>{const on=now-p.lastSeen<25000;return(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:i<players.length-1?'1px solid #f0f0f0':'none'}}>
                <div style={{width:9,height:9,borderRadius:'50%',background:on?'#27ae60':'#ddd',flexShrink:0}}/>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:'#111'}}>{p.name}{p.isMe?' (You)':''}</div><div style={{fontSize:11,color:'#777'}}>Level {p.level} · {on?'Online':'Offline'}</div></div>
                {p.isMe&&<span style={{background:T.light,color:T.primary,borderRadius:10,padding:'2px 8px',fontSize:10,fontWeight:700}}>You</span>}
              </div>
            );})}
          <button onClick={regAndLoad} style={{width:'100%',background:'#f5f5f5',border:'1px solid #e0e0e0',borderRadius:12,padding:8,fontSize:12,fontWeight:700,cursor:'pointer',color:'#666',marginTop:10}}>Refresh Players</button>
        </Card>
      </>}
      {tab==='friends'&&<>
        <div style={{background:'linear-gradient(135deg,#16a085,#1abc9c)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
          <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>FRIEND SYSTEM</div>
          <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>🤝 Farm Friends</div>
          <div style={{fontSize:12,opacity:.85}}>Mutual Help Streak: {friendStreak} days · +{Math.round(friendStreak*.05*100)}% earnings bonus</div>
        </div>
        <Card style={{background:'#e8f8f5',border:'1px solid #c3e6cb'}}>
          <div style={{fontSize:12,fontWeight:800,color:'#16a085',marginBottom:6}}>How Friend Bonuses Work</div>
          {['Add friends using their Player ID from their Farmhouse Identity tab.','Send daily help to each other. When both send help on the same day the Mutual Help Streak grows.','Each streak day adds 5% bonus to all earnings up to a maximum of 50%.','Streak breaks if one of you misses a day — help each other every day!'].map((t,i)=><div key={i} style={{fontSize:11,color:'#555',lineHeight:1.8}}>• {t}</div>)}
        </Card>
        <Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:8}}>Add a Friend</div>
          <div style={{display:'flex',gap:8}}>
            <input value={fidInput} onChange={e=>setFID(e.target.value.toUpperCase())} placeholder="Enter Player ID (e.g. PABC12)" style={{flex:1,padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',color:'#333',letterSpacing:1}}/>
            <Btn onClick={addFriend} color='#16a085'>Add</Btn>
          </div>
          <div style={{fontSize:11,color:'#aaa',marginTop:6}}>Your ID: <b style={{color:'#555'}}>{playerId}</b> — share this with friends</div>
        </Card>
        {friendsList.length>0&&<Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:10}}>Your Friends ({friendsList.length})</div>
          {friendsList.map((fid,i)=>{
            const helpedToday=lastFriendHelp===today;
            return(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<friendsList.length-1?'1px solid #f0f0f0':'none'}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'#e8f8f5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🧑‍🌾</div>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:'#111'}}>{fid}</div><div style={{fontSize:11,color:'#888'}}>Streak: {friendStreak} days</div></div>
                <Btn onClick={()=>sendFriendHelp(fid)} disabled={helpedToday} color='#16a085' style={{fontSize:11,padding:'6px 12px'}}>{helpedToday?'Helped ✓':'Send Help'}</Btn>
              </div>
            );
          })}
        </Card>}
        {friendsList.length===0&&<div style={{textAlign:'center',padding:30,color:'#aaa'}}><div style={{fontSize:40}}>🤝</div><div style={{fontWeight:700,color:'#888',marginTop:8}}>No friends yet</div><div style={{fontSize:12,marginTop:4}}>Add a friend using their Player ID above</div></div>}
      </>}
      {tab==='theme'&&<>
        <div style={{background:`linear-gradient(135deg,${T.primary},${T.accent})`,borderRadius:20,padding:16,marginBottom:14,color:'#fff',textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:800}}>{T.name}</div>
          <div style={{fontSize:11,opacity:.75,marginTop:4}}>Current theme</div>
        </div>
        <Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:10}}>Choose Your Style</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {THEMES.map(t=>{const active=themeId===t.id;return(
              <button key={t.id} onClick={()=>updateTheme(t.id)} style={{background:active?t.primary:'#f8f8f8',border:`2.5px solid ${active?t.primary:'#eee'}`,borderRadius:16,padding:'12px 10px',cursor:'pointer',textAlign:'center',position:'relative',boxShadow:active?`0 4px 16px ${t.primary}44`:'none'}}>
                <div style={{width:34,height:34,borderRadius:'50%',background:t.primary,margin:'0 auto 6px',border:'3px solid rgba(255,255,255,.8)'}}/>
                <div style={{fontSize:11,fontWeight:800,color:active?'#fff':'#333'}}>{t.name}</div>
                {active&&<div style={{position:'absolute',top:5,right:8,fontSize:13}}>✓</div>}
              </button>
            );})}
          </div>
        </Card>
      </>}
      {tab==='guide'&&<>
        <div style={{background:'linear-gradient(135deg,#7d5a2a,#b8873a)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
          <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>FARMHOUSE BOOKSHELF</div>
          <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>📚 Farm Guide Library</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {BOOKS.map(book=>{const locked=level<book.ml;return(
            <button key={book.id} onClick={()=>!locked&&(setSelBook(book),setPg(0))} style={{background:locked?'#f5f5f5':'#fff',border:`2px solid ${locked?'#eee':T.primary+'30'}`,borderRadius:16,padding:14,cursor:locked?'default':'pointer',textAlign:'center',boxShadow:locked?'none':'0 2px 8px rgba(0,0,0,.07)',opacity:locked?.5:1}}>
              <div style={{fontSize:36,marginBottom:6}}>{book.emoji}</div>
              <div style={{fontSize:12,fontWeight:800,color:locked?'#bbb':'#111',lineHeight:1.3}}>{book.title}</div>
              <div style={{fontSize:10,color:'#aaa',marginTop:3}}>{locked?`Level ${book.ml}`:`${book.pages.length} pages`}</div>
            </button>
          );})}
        </div>
      </>}
    </div>
  );
}
function AuthScreen({onLogin}){
  const[mode,setMode]=useState('login');
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[username,setUsername]=useState('');
  const[farmNameL,setFarmNameL]=useState('');
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(false);
  const submit=async()=>{
    setError('');setLoading(true);
    try{
      if(mode==='register'){
        if(!username.trim()||!farmNameL.trim()){setError('Please fill in all fields.');setLoading(false);return;}
        const cred=await createUserWithEmailAndPassword(auth,email,password);
        await set(ref(db,`users/${cred.user.uid}/profile`),{username:username.trim(),farmName:farmNameL.trim(),createdAt:Date.now()});
        onLogin(cred.user);
      }else{
        const cred=await signInWithEmailAndPassword(auth,email,password);
        onLogin(cred.user);
      }
    }catch(e){
      const msgs={'auth/email-already-in-use':'Email already registered.','auth/weak-password':'Password needs 6+ characters.','auth/invalid-email':'Invalid email.','auth/user-not-found':'No account found.','auth/wrong-password':'Wrong password.','auth/invalid-credential':'Incorrect email or password.'};
      setError(msgs[e.code]||e.message);
    }
    setLoading(false);
  };
  return(
    <div style={{width:'100%',maxWidth:420,margin:'0 auto',height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'linear-gradient(170deg,#a8d8ea,#b8e4c9 55%,#d4f1b8)',fontFamily:'-apple-system,BlinkMacSystemFont,system-ui,sans-serif',padding:24,boxSizing:'border-box'}}>
      <div style={{fontSize:56,marginBottom:8}}>🌾</div>
      <div style={{fontSize:28,fontWeight:900,color:'#1a6b2a',marginBottom:4}}>Harvest Haven</div>
      <div style={{fontSize:13,color:'#555',marginBottom:32}}>Your farming empire awaits</div>
      <div style={{background:'#fff',borderRadius:20,padding:24,width:'100%',boxShadow:'0 4px 24px rgba(0,0,0,0.10)'}}>
        <div style={{display:'flex',gap:8,marginBottom:20}}>
          {[['login','Sign In'],['register','Create Account']].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setError('');}} style={{flex:1,background:mode===m?'#1a6b2a':'#f5f5f5',color:mode===m?'#fff':'#555',border:'none',borderRadius:12,padding:'10px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{l}</button>
          ))}
        </div>
        {mode==='register'&&<>
          <div style={{fontSize:12,fontWeight:700,color:'#555',marginBottom:6}}>Username</div>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. FarmerJoe" style={{width:'100%',padding:'10px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',boxSizing:'border-box',marginBottom:12,color:'#333'}}/>
          <div style={{fontSize:12,fontWeight:700,color:'#555',marginBottom:6}}>Farm Name</div>
          <input value={farmNameL} onChange={e=>setFarmNameL(e.target.value)} placeholder="e.g. Sunny Acres" style={{width:'100%',padding:'10px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',boxSizing:'border-box',marginBottom:12,color:'#333'}}/>
        </>}
        <div style={{fontSize:12,fontWeight:700,color:'#555',marginBottom:6}}>Email</div>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="your@email.com" style={{width:'100%',padding:'10px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',boxSizing:'border-box',marginBottom:12,color:'#333'}}/>
        <div style={{fontSize:12,fontWeight:700,color:'#555',marginBottom:6}}>Password</div>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Min 6 characters" style={{width:'100%',padding:'10px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',boxSizing:'border-box',marginBottom:16,color:'#333'}}/>
        {error&&<div style={{background:'#fff5f5',border:'1px solid #fce4e4',borderRadius:10,padding:'8px 12px',fontSize:12,color:'#c0392b',marginBottom:12,fontWeight:600}}>{error}</div>}
        <button onClick={submit} disabled={loading} style={{width:'100%',background:loading?'#bbb':'#1a6b2a',color:'#fff',border:'none',borderRadius:12,padding:'12px',fontSize:15,fontWeight:800,cursor:loading?'default':'pointer'}}>
          {loading?'Please wait...':mode==='login'?'Sign In':'Create Account'}
        </button>
      </div>
    </div>
  );
}

export default function Root(){
  const[user,setUser]=useState(null);
  const[checking,setChecking]=useState(true);
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,u=>{setUser(u);setChecking(false);});
    return unsub;
  },[]);
  if(checking)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'linear-gradient(170deg,#a8d8ea,#b8e4c9)',fontFamily:'system-ui',fontSize:18,color:'#1a6b2a',fontWeight:700}}>🌾 Loading...</div>;
  if(!user)return<AuthScreen onLogin={setUser}/>;
  return<HarvestHaven user={user} onSignOut={()=>signOut(auth).then(()=>setUser(null))}/>;
}