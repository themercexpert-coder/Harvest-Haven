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
const THEMES=[
  {id:'forest',name:'🌿 Forest',bg:'linear-gradient(160deg,#1e4d2b 0%,#2d6e3e 40%,#1a5c3a 75%,#0f3321 100%)',primary:'#4ade80',accent:'#86efac',light:'rgba(255,255,255,0.1)'},
  {id:'ocean',name:'🌊 Ocean',bg:'linear-gradient(160deg,#082c4e 0%,#0e4d73 35%,#1060a0 70%,#051a2e 100%)',primary:'#38bdf8',accent:'#7dd3fc',light:'rgba(255,255,255,0.08)'},
  {id:'sunset',name:'🌅 Sunset',bg:'linear-gradient(160deg,#7c1e0a 0%,#b83224 30%,#d4622a 60%,#e8901c 100%)',primary:'#fb923c',accent:'#fbbf24',light:'rgba(255,255,255,0.1)'},
  {id:'night',name:'🌙 Night',bg:'linear-gradient(160deg,#080818 0%,#141430 35%,#1a1a40 70%,#050510 100%)',primary:'#a78bfa',accent:'#c4b5fd',light:'rgba(255,255,255,0.06)'},
  {id:'rose',name:'🌸 Blossom',bg:'linear-gradient(160deg,#5a0a2e 0%,#8b1a52 35%,#b52060 65%,#400020 100%)',primary:'#f472b6',accent:'#fbcfe8',light:'rgba(255,255,255,0.08)'},
  {id:'autumn',name:'🍂 Harvest',bg:'linear-gradient(160deg,#3d1500 0%,#6b2e00 30%,#9a4b0a 65%,#2d0e00 100%)',primary:'#f97316',accent:'#fcd34d',light:'rgba(255,255,255,0.08)'},
  {id:'lavender',name:'🪻 Mystic',bg:'linear-gradient(160deg,#130826 0%,#2e1052 35%,#4c1d8a 65%,#0d0418 100%)',primary:'#c084fc',accent:'#e9d5ff',light:'rgba(255,255,255,0.06)'},
  {id:'teal',name:'💎 Crystal',bg:'linear-gradient(160deg,#022a2a 0%,#065252 30%,#0a7a7a 65%,#011818 100%)',primary:'#2dd4bf',accent:'#99f6e4',light:'rgba(255,255,255,0.08)'},
];
const SEASONS=[{name:'Spring',emoji:'🌸',col:'#c2185b',boost:{wheat:1.1,tomato:1.2,strawberry:1.3,blueberry:1.2}},{name:'Summer',emoji:'☀️',col:'#f57c00',boost:{corn:1.2,pumpkin:1.1,blueberry:1.3,golden:1.1}},{name:'Autumn',emoji:'🍂',col:'#5d4037',boost:{pumpkin:1.4,wheat:1.2,carrot:1.3,corn:1.1}},{name:'Winter',emoji:'❄️',col:'#1565c0',boost:{golden:1.5,carrot:1.2}}];
// All crops max 5 minutes
const CROPS=[
  // Tier 1 - Starter (Level 1)
  {id:'wheat',name:'Wheat',emoji:'🌾',cost:10,base:25,xp:5,grow:30,tier:1,ml:1},
  {id:'corn',name:'Corn',emoji:'🌽',cost:15,base:38,xp:8,grow:45,tier:1,ml:1},
  {id:'carrot',name:'Carrot',emoji:'🥕',cost:18,base:46,xp:9,grow:45,tier:1,ml:1},
  {id:'tomato',name:'Tomato',emoji:'🍅',cost:20,base:52,xp:10,grow:60,tier:1,ml:1},
  // Tier 2 - Basic (Level 3)
  {id:'strawberry',name:'Strawberry',emoji:'🍓',cost:25,base:68,xp:13,grow:90,tier:2,ml:3},
  {id:'pumpkin',name:'Pumpkin',emoji:'🎃',cost:30,base:80,xp:15,grow:120,tier:2,ml:3},
  {id:'sunflower',name:'Sunflower',emoji:'🌻',cost:28,base:74,xp:14,grow:100,tier:2,ml:3},
  {id:'pepper',name:'Pepper',emoji:'🫑',cost:22,base:58,xp:11,grow:65,tier:2,ml:3},
  // Tier 3 - Intermediate (Level 5)
  {id:'blueberry',name:'Blueberry',emoji:'🫐',cost:35,base:95,xp:18,grow:180,tier:3,ml:5},
  {id:'watermelon',name:'Watermelon',emoji:'🍉',cost:40,base:105,xp:20,grow:200,tier:3,ml:5},
  {id:'grape',name:'Grapes',emoji:'🍇',cost:45,base:118,xp:22,grow:220,tier:3,ml:5},
  {id:'lavender',name:'Lavender',emoji:'💜',cost:32,base:85,xp:16,grow:130,tier:3,ml:5},
  // Tier 4 - Advanced (Level 8)
  {id:'sugarcane',name:'Sugarcane',emoji:'🎋',cost:55,base:145,xp:26,grow:260,tier:4,ml:8},
  {id:'cotton',name:'Cotton',emoji:'🌿',cost:60,base:155,xp:28,grow:280,tier:4,ml:8},
  {id:'mushroom',name:'Mushroom',emoji:'🍄',cost:50,base:130,xp:24,grow:240,tier:4,ml:8},
  {id:'chili',name:'Chili',emoji:'🌶️',cost:48,base:125,xp:23,grow:230,tier:4,ml:8},
  // Tier 5 - Expert (Level 12)
  {id:'coffee',name:'Coffee Bean',emoji:'☕',cost:80,base:200,xp:35,grow:320,tier:5,ml:12},
  {id:'cocoa',name:'Cocoa',emoji:'🍫',cost:85,base:210,xp:37,grow:340,tier:5,ml:12},
  {id:'olive',name:'Olive',emoji:'🫒',cost:90,base:220,xp:40,grow:360,tier:5,ml:12},
  {id:'vanilla',name:'Vanilla',emoji:'🌸',cost:95,base:240,xp:42,grow:400,tier:5,ml:12},
  // Tier 6 - Master (Level 18)
  {id:'truffle',name:'Truffle',emoji:'🍄',cost:150,base:380,xp:65,grow:480,tier:6,ml:18},
  {id:'saffron',name:'Saffron',emoji:'🌺',cost:180,base:450,xp:75,grow:520,tier:6,ml:18},
  {id:'dragonroot',name:'Dragon Root',emoji:'🐉',cost:200,base:500,xp:80,grow:560,tier:6,ml:18},
  // Tier 7 - Legendary (Level 25)
  {id:'golden',name:'Golden Grain',emoji:'✨',cost:300,base:800,xp:120,grow:600,tier:7,ml:25},
  {id:'moonflower',name:'Moonflower',emoji:'🌙',cost:500,base:1500,xp:200,grow:800,tier:7,ml:30},
  {id:'starcrop',name:'Star Crop',emoji:'⭐',cost:1000,base:3000,xp:400,grow:1200,tier:7,ml:40},
];
const ANIMALS=[{id:'cow',emoji:'🐄',name:'Cow',product:'Milk',pe:'🥛',value:40,ml:1,meat:'Beef',me:'🥩',ms:80,mv:120,buyCost:300,feedItem:'wheat',feedEmoji:'🌾'},{id:'chicken',emoji:'🐔',name:'Chicken',product:'Eggs',pe:'🥚',value:25,ml:1,meat:'Chicken',me:'🍗',ms:40,mv:60,buyCost:150,feedItem:'corn',feedEmoji:'🌽'},{id:'sheep',emoji:'🐑',name:'Sheep',product:'Wool',pe:'🧶',value:55,ml:5,meat:'Lamb',me:'🍖',ms:60,mv:90,buyCost:350,feedItem:'carrot',feedEmoji:'🥕'},{id:'goat',emoji:'🐐',name:'Goat',product:'Goat Milk',pe:'🥛',value:35,ml:8,meat:'Goat Meat',me:'🍖',ms:55,mv:80,buyCost:280,feedItem:'wheat',feedEmoji:'🌾'},{id:'horse',emoji:'🐎',name:'Horse',product:'Stamina',pe:'⚡',value:0,ml:10,meat:null,me:null,ms:0,mv:0,buyCost:800,feedItem:'carrot',feedEmoji:'🥕'},{id:'duck',emoji:'🦆',name:'Duck',product:'Feathers',pe:'🪶',value:30,ml:12,meat:'Duck Meat',me:'🍗',ms:45,mv:70,buyCost:220,feedItem:'corn',feedEmoji:'🌽'},{id:'rabbit',emoji:'🐇',name:'Rabbit',product:'Lucky Drops',pe:'🍀',value:45,ml:15,meat:'Rabbit Meat',me:'🍖',ms:35,mv:55,buyCost:200,feedItem:'carrot',feedEmoji:'🥕'},{id:'camel',emoji:'🐪',name:'Camel',product:'Camel Milk',pe:'🥛',value:55,ml:8,meat:null,me:null,ms:0,mv:0,buyCost:400,feedItem:'pumpkin',feedEmoji:'🎃'},{id:'bee',emoji:'🐝',name:'Bee Hive',product:'Honey',pe:'🍯',value:35,ml:5,meat:null,me:null,ms:0,mv:0,buyCost:180,feedItem:'sunflower',feedEmoji:'🌻'},{id:'turkey',emoji:'🦃',name:'Turkey',product:'Turkey Egg',pe:'🥚',value:22,ml:10,meat:'Turkey Meat',me:'🍗',ms:50,mv:85,buyCost:200,feedItem:'corn',feedEmoji:'🌽'},{id:'alpaca',emoji:'🦙',name:'Alpaca',product:'Alpaca Wool',pe:'🧶',value:45,ml:5,meat:null,me:null,ms:0,mv:0,buyCost:280,feedItem:'wheat',feedEmoji:'🌾'}];
const MINERALS=[
  {id:'coal',name:'Coal',emoji:'⚫',r:.35,v:30,xp:5,ml:1},
  {id:'copper',name:'Copper',emoji:'🔶',r:.28,v:55,xp:8,ml:1},
  {id:'iron',name:'Iron',emoji:'🪨',r:.22,v:80,xp:12,ml:1},
  {id:'silver',name:'Silver',emoji:'🪙',r:.15,v:150,xp:18,ml:3},
  {id:'goldore',name:'Gold Ore',emoji:'🟡',r:.10,v:300,xp:25,ml:5},
  {id:'diamond',name:'Diamond',emoji:'💎',r:.05,v:800,xp:50,ml:7},
  {id:'emerald',name:'Emerald',emoji:'🟢',r:.03,v:1200,xp:70,ml:8},
  {id:'ruby',name:'Ruby',emoji:'🔴',r:.025,v:1800,xp:90,ml:10},
  {id:'sapphire',name:'Sapphire',emoji:'🔷',r:.02,v:2200,xp:110,ml:12},
  {id:'titanium',name:'Titanium',emoji:'⚙️',r:.015,v:2800,xp:130,ml:14},
  {id:'crystal',name:'Crystal',emoji:'🔮',r:.01,v:3500,xp:150,ml:16},
  {id:'mythril',name:'Mythril',emoji:'🌀',r:.007,v:5000,xp:180,ml:20},
  {id:'opal',name:'Opal',emoji:'🌈',r:.004,v:7000,xp:220,ml:25},
  {id:'stardust',name:'Stardust',emoji:'✨',r:.002,v:12000,xp:300,ml:30},
  {id:'voidstone',name:'Void Stone',emoji:'🕳️',r:.001,v:25000,xp:500,ml:40},
];

// ─── FISHING ──────────────────────────────────────────────────────────────
const BAITS=[
  {id:'worm',name:'Earthworm',emoji:'🪱',cost:5,desc:'Basic bait, catches common fish',bonus:0},
  {id:'bread',name:'Bread Crust',emoji:'🍞',cost:8,desc:'Cheap and effective for freshwater fish',bonus:0.05},
  {id:'corn_bait',name:'Corn Kernel',emoji:'🌽',cost:12,desc:'Attracts medium fish',bonus:0.1},
  {id:'cricket',name:'Cricket',emoji:'🦗',cost:20,desc:'Lively bait, better rare catch rate',bonus:0.2},
  {id:'golden_lure',name:'Golden Lure',emoji:'✨',cost:80,desc:'Best bait  -  doubles rare fish chance',bonus:0.4},
];
const FISH=[
  // Common (always catchable)
  {id:'minnow',name:'Minnow',emoji:'🐟',rarity:'common',r:0.22,value:8,xp:3,bait:['worm','bread','corn_bait','cricket','golden_lure'],minLevel:1},
  {id:'bluegill',name:'Bluegill',emoji:'🐡',rarity:'common',r:0.18,value:12,xp:4,bait:['worm','bread','corn_bait','cricket','golden_lure'],minLevel:1},
  {id:'carp',name:'Carp',emoji:'🎏',rarity:'common',r:0.15,value:18,xp:5,bait:['bread','corn_bait','cricket','golden_lure'],minLevel:1},
  {id:'catfish',name:'Catfish',emoji:'🐠',rarity:'common',r:0.14,value:22,xp:6,bait:['worm','corn_bait','cricket','golden_lure'],minLevel:2},
  {id:'perch',name:'Yellow Perch',emoji:'🐟',rarity:'common',r:0.12,value:25,xp:7,bait:['worm','bread','corn_bait','cricket','golden_lure'],minLevel:2},
  // Uncommon
  {id:'bass',name:'Largemouth Bass',emoji:'🐟',rarity:'uncommon',r:0.07,value:45,xp:12,bait:['cricket','corn_bait','golden_lure'],minLevel:3},
  {id:'trout',name:'Rainbow Trout',emoji:'🌈',rarity:'uncommon',r:0.06,value:55,xp:15,bait:['cricket','worm','golden_lure'],minLevel:3},
  {id:'pike',name:'Northern Pike',emoji:'🐟',rarity:'uncommon',r:0.05,value:65,xp:18,bait:['cricket','golden_lure'],minLevel:4},
  {id:'salmon',name:'Atlantic Salmon',emoji:'🍣',rarity:'uncommon',r:0.04,value:80,xp:20,bait:['cricket','golden_lure'],minLevel:5},
  {id:'tilapia',name:'Tilapia',emoji:'🐡',rarity:'uncommon',r:0.04,value:70,xp:18,bait:['corn_bait','cricket','golden_lure'],minLevel:4},
  // Rare
  {id:'sturgeon',name:'Sturgeon',emoji:'🦈',rarity:'rare',r:0.025,value:150,xp:35,bait:['cricket','golden_lure'],minLevel:7},
  {id:'eel',name:'Electric Eel',emoji:'🐍',rarity:'rare',r:0.02,value:180,xp:40,bait:['worm','golden_lure'],minLevel:6},
  {id:'swordfish',name:'Swordfish',emoji:'🗡️',rarity:'rare',r:0.015,value:220,xp:50,bait:['golden_lure'],minLevel:8},
  {id:'anglerfish',name:'Anglerfish',emoji:'🎣',rarity:'rare',r:0.012,value:280,xp:60,bait:['golden_lure'],minLevel:10},
  {id:'puffer',name:'Puffer Fish',emoji:'🐡',rarity:'rare',r:0.01,value:320,xp:70,bait:['golden_lure'],minLevel:9},
  // Legendary
  {id:'goldfish',name:'Golden Koi',emoji:'🥇',rarity:'legendary',r:0.006,value:600,xp:120,bait:['golden_lure'],minLevel:10},
  {id:'dragon_fish',name:'Dragon Fish',emoji:'🐉',rarity:'legendary',r:0.004,value:900,xp:180,bait:['golden_lure'],minLevel:15},
  {id:'moonfish',name:'Moonfish',emoji:'🌕',rarity:'legendary',r:0.003,value:1200,xp:240,bait:['golden_lure'],minLevel:18},
  {id:'phantom',name:'Phantom Eel',emoji:'👻',rarity:'legendary',r:0.002,value:2000,xp:400,bait:['golden_lure'],minLevel:20},
  {id:'leviathan',name:'Leviathan',emoji:'🦕',rarity:'legendary',r:0.001,value:5000,xp:1000,bait:['golden_lure'],minLevel:25},
];
const FISH_RECIPES=[
  {id:'fish_soup',name:'Fish Soup',emoji:'🍲',ing:{minnow:3,carrot:2},sell:120,xp:15,desc:'3 Minnow + 2 Carrot'},
  {id:'grilled_bass',name:'Grilled Bass',emoji:'🍽️',ing:{bass:2,corn:2},sell:250,xp:28,desc:'2 Bass + 2 Corn'},
  {id:'salmon_sushi',name:'Salmon Sushi',emoji:'🍣',ing:{salmon:2,wheat:3},sell:400,xp:45,desc:'2 Salmon + 3 Wheat'},
  {id:'sturgeon_steak',name:'Sturgeon Steak',emoji:'🥩',ing:{sturgeon:1,pumpkin:2},sell:600,xp:70,desc:'1 Sturgeon + 2 Pumpkin'},
  {id:'fish_pie',name:"Fisherman's Pie",emoji:'🥧',ing:{catfish:2,wheat:4,carrot:2},sell:350,xp:40,desc:'2 Catfish + 4 Wheat + 2 Carrot'},
  {id:'eel_curry',name:'Eel Curry',emoji:'🍛',ing:{eel:1,tomato:3,corn:2},sell:500,xp:60,desc:'1 Eel + 3 Tomato + 2 Corn'},
  {id:'golden_koi_feast',name:'Golden Koi Feast',emoji:'🥗',ing:{goldfish:1,truffle:1,lavender:2},sell:2000,xp:200,desc:'1 Golden Koi + 1 Truffle + 2 Lavender'},
];
const FISH_RARITY_COL={common:'#888',uncommon:'#27ae60',rare:'#2980b9',legendary:'#f39c12'};
// ──────────────────────────────────────────────────────────────────────────

const KITCHEN_RECIPES=[
  // Basic meals (Level 1+)
  {id:'bread',name:'Bread',emoji:'🍞',ing:{wheat:5},sell:80,xp:10,desc:'5 Wheat',tier:1},
  {id:'cornmeal',name:'Corn Porridge',emoji:'🌽',ing:{corn:4},sell:70,xp:8,desc:'4 Corn',tier:1},
  {id:'carrotsoup',name:'Carrot Soup',emoji:'🥣',ing:{carrot:4,corn:2},sell:120,xp:14,desc:'4 Carrot + 2 Corn',tier:1},
  {id:'tomatosauce',name:'Tomato Sauce',emoji:'🍅',ing:{tomato:5},sell:100,xp:12,desc:'5 Tomato',tier:1},
  // Intermediate (Level 5+)
  {id:'jam',name:'Strawberry Jam',emoji:'🍓',ing:{strawberry:4},sell:150,xp:18,desc:'4 Strawberry',tier:2},
  {id:'cake',name:'Blueberry Cake',emoji:'🎂',ing:{wheat:3,blueberry:2},sell:200,xp:22,desc:'3 Wheat + 2 Blueberry',tier:2},
  {id:'pumpkinsoup',name:'Pumpkin Soup',emoji:'🎃',ing:{pumpkin:2,carrot:2},sell:180,xp:20,desc:'2 Pumpkin + 2 Carrot',tier:2},
  {id:'grapejuice',name:'Grape Juice',emoji:'🍷',ing:{grape:4},sell:240,xp:28,desc:'4 Grapes',tier:2},
  {id:'lavperfume',name:'Lavender Perfume',emoji:'🌸',ing:{lavender:5,sunflower:3},sell:320,xp:35,desc:'5 Lavender + 3 Sunflower',tier:2},
  // Advanced (Level 10+)
  {id:'goldenbread',name:'Golden Bread',emoji:'✨',ing:{golden:2,wheat:3},sell:600,xp:65,desc:'2 Golden Grain + 3 Wheat',tier:3},
  {id:'chocolatecake',name:'Chocolate Cake',emoji:'🍫',ing:{cocoa:3,wheat:4,blueberry:2},sell:800,xp:80,desc:'3 Cocoa + 4 Wheat + 2 Blueberry',tier:3},
  {id:'oliveoil',name:'Olive Oil',emoji:'🫒',ing:{olive:5,sunflower:2},sell:650,xp:68,desc:'5 Olive + 2 Sunflower',tier:3},
  {id:'coffeecake',name:'Coffee Cake',emoji:'☕',ing:{coffee:3,wheat:4},sell:750,xp:75,desc:'3 Coffee + 4 Wheat',tier:3},
  // Fish meals
  {id:'fish_soup',name:'Fish Soup',emoji:'🍲',ing:{minnow:3,carrot:2},sell:150,xp:18,desc:'3 Minnow + 2 Carrot',tier:2},
  {id:'grilled_bass',name:'Grilled Bass',emoji:'🍽️',ing:{bass:2,corn:2},sell:300,xp:32,desc:'2 Bass + 2 Corn',tier:3},
  {id:'salmon_sushi',name:'Salmon Sushi',emoji:'🍣',ing:{salmon:2,wheat:3},sell:500,xp:50,desc:'2 Salmon + 3 Wheat',tier:3},
  {id:'fish_pie',name:"Fisherman's Pie",emoji:'🥧',ing:{catfish:2,wheat:4,carrot:2},sell:420,xp:45,desc:'2 Catfish + 4 Wheat + 2 Carrot',tier:3},
  {id:'eel_curry',name:'Eel Curry',emoji:'🍛',ing:{eel:1,tomato:3,corn:2},sell:600,xp:65,desc:'1 Eel + 3 Tomato + 2 Corn',tier:4},
  {id:'sturgeon_steak',name:'Sturgeon Steak',emoji:'🥩',ing:{sturgeon:1,pumpkin:2},sell:800,xp:80,desc:'1 Sturgeon + 2 Pumpkin',tier:4},
  // Legendary meals (Level 20+)
  {id:'trufflepasta',name:'Truffle Pasta',emoji:'🍝',ing:{truffle:2,wheat:5,tomato:3},sell:2000,xp:120,desc:'2 Truffle + 5 Wheat + 3 Tomato',tier:5},
  {id:'moonflowertea',name:'Moonflower Tea',emoji:'🍵',ing:{moonflower:1,lavender:3},sell:5000,xp:300,desc:'1 Moonflower + 3 Lavender',tier:5},
  {id:'golden_koi_feast',name:'Golden Koi Feast',emoji:'🥗',ing:{goldfish:1,truffle:1,lavender:2},sell:8000,xp:500,desc:'1 Golden Koi + 1 Truffle + 2 Lavender',tier:5},
  {id:'starfeast',name:'Star Crop Feast',emoji:'⭐',ing:{starcrop:1,truffle:2,golden:3},sell:15000,xp:800,desc:'1 Star Crop + 2 Truffle + 3 Golden Grain',tier:5},
  // Biofuel (crafted, used to top up fuel for free)
  {id:'biofuel',name:'Biofuel',emoji:'🌿',ing:{sugarcane:5,corn:3},sell:0,xp:15,desc:'5 Sugarcane + 3 Corn - refuels machines +25',tier:2},
  {id:'biofuel_premium',name:'Premium Biofuel',emoji:'⚗️',ing:{sugarcane:10,cotton:5,corn:5},sell:0,xp:35,desc:'10 Sugarcane + 5 Cotton + 5 Corn - refuels +75',tier:3},
];
const RECIPES=[
  // Basic Tools (Level 3+)
  {id:'irontools',name:'Iron Tools',emoji:'⚒️',ing:{iron:3,coal:2},sell:350,xp:40,desc:'3 Iron + 2 Coal',tier:1},
  {id:'copperring',name:'Copper Ring',emoji:'💍',ing:{copper:4},sell:280,xp:30,desc:'4 Copper',tier:1},
  {id:'coalfuel',name:'Coal Fuel',emoji:'🪨',ing:{coal:5},sell:200,xp:20,desc:'5 Coal - fuel for machines',tier:1},
  // Intermediate (Level 6+)
  {id:'silverjewel',name:'Silver Jewel',emoji:'🔮',ing:{silver:2,copper:3},sell:600,xp:55,desc:'2 Silver + 3 Copper',tier:2},
  {id:'gemring',name:'Gem Ring',emoji:'💎',ing:{diamond:1,silver:2},sell:1200,xp:90,desc:'1 Diamond + 2 Silver',tier:2},
  {id:'ironarmor',name:'Iron Armor',emoji:'🛡️',ing:{iron:5,coal:3},sell:800,xp:70,desc:'5 Iron + 3 Coal',tier:2},
  // Advanced (Level 10+)
  {id:'goldenring',name:'Golden Crown',emoji:'👑',ing:{goldore:3,diamond:1,emerald:1},sell:3000,xp:150,desc:'3 Gold Ore + 1 Diamond + 1 Emerald',tier:3},
  {id:'emeraldstaff',name:'Emerald Staff',emoji:'🪄',ing:{emerald:2,goldore:2,crystal:1},sell:4000,xp:180,desc:'2 Emerald + 2 Gold + 1 Crystal',tier:3},
  {id:'rubyamulet',name:'Ruby Amulet',emoji:'❤️',ing:{ruby:1,goldore:3},sell:5000,xp:200,desc:'1 Ruby + 3 Gold Ore',tier:3},
  // Master (Level 18+)
  {id:'mysticpotion',name:'Mystic Potion',emoji:'🧪',ing:{crystal:2,emerald:1,mythril:1},sell:8000,xp:300,desc:'2 Crystal + 1 Emerald + 1 Mythril',tier:4},
  {id:'dragonsword',name:'Dragon Sword',emoji:'⚔️',ing:{mythril:2,ruby:1,titanium:3},sell:12000,xp:400,desc:'2 Mythril + 1 Ruby + 3 Titanium',tier:4},
  // Legendary (Level 30+)
  {id:'voidcrystal',name:'Void Crystal',emoji:'🌀',ing:{voidstone:1,mythril:2,stardust:1},sell:50000,xp:1000,desc:'1 Void Stone + 2 Mythril + 1 Stardust',tier:5},
  {id:'legendcrown',name:'Legend Crown',emoji:'✨',ing:{voidstone:2,diamond:3,stardust:2},sell:100000,xp:2000,desc:'2 Void Stone + 3 Diamond + 2 Stardust',tier:5},
  // Pet food stays in crafting
  {id:'petfood_dog',name:'Dog Biscuit',emoji:'🦴',ing:{wheat:3,carrot:1},sell:15,xp:5,desc:'3 Wheat + 1 Carrot',tier:1},
  {id:'petfood_cat',name:'Fish Snack',emoji:'🐟',ing:{wheat:2,corn:1},sell:15,xp:5,desc:'2 Wheat + 1 Corn',tier:1},
  {id:'petfood_parrot',name:'Seed Mix',emoji:'🌱',ing:{wheat:4,sunflower:1},sell:15,xp:5,desc:'4 Wheat + 1 Sunflower',tier:1},
  {id:'petfood_bunny',name:'Carrot Treat',emoji:'🥕',ing:{carrot:3},sell:15,xp:5,desc:'3 Carrot',tier:1},
  {id:'petfood_bear',name:'Honey Pot',emoji:'🍯',ing:{sunflower:3,corn:2},sell:25,xp:8,desc:'3 Sunflower + 2 Corn',tier:2},
  {id:'feedmix_basic',name:'Basic Feed Mix',emoji:'🌾',ing:{wheat:5,corn:3},sell:40,xp:8,desc:'5 Wheat + 3 Corn',tier:1},
  {id:'feedmix_premium',name:'Premium Feed Mix',emoji:'🥇',ing:{wheat:8,corn:5,carrot:3},sell:100,xp:20,desc:'8 Wheat + 5 Corn + 3 Carrot',tier:2},
];
const NPCS={joe:{name:'Farmer Joe',emoji:'👨‍🌾',col:'#27ae60',lines:['Hello neighbour!','Great work today!','Fields look wonderful!','Really appreciate you!','Best farmer I know!']},mary:{name:'Market Mary',emoji:'👩‍💼',col:'#2980b9',lines:['Perfect quality!','My stall thanks you!','Fair deal always!','Premium goods!','My best supplier!']},tom:{name:'Miner Tom',emoji:'⛏️',col:'#546e7a',lines:['Good ore today!','Mine yields well!','Solid work!','Sharp pick!','Best miner!']},lily:{name:'Florist Lily',emoji:'🌸',col:'#c2185b',lines:['Beautiful harvest!','Blooms lovely!','Nature smiles!','Wonderful!','Garden thanks you!']},chef:{name:'Chef Carlos',emoji:'👨‍🍳',col:'#e67e22',lines:['Delicious!','Soup perfect!','Customers love it!','Finest produce!','You feed the town!']}};
const TASK_POOL=[
  // ── Easy single-item ──────────────────────────────────────────────
  {npcId:'joe',itemId:'wheat',qty:3,inv:'silo',itemEmoji:'🌾',itemName:'Wheat',coins:75,xp:15,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  {npcId:'chef',itemId:'tomato',qty:3,inv:'silo',itemEmoji:'🍅',itemName:'Tomato',coins:110,xp:18,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  {npcId:'lily',itemId:'corn',qty:4,inv:'silo',itemEmoji:'🌽',itemName:'Corn',coins:95,xp:16,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  {npcId:'mary',itemId:'carrot',qty:5,inv:'silo',itemEmoji:'🥕',itemName:'Carrot',coins:140,xp:20,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  {npcId:'joe',itemId:'pumpkin',qty:2,inv:'silo',itemEmoji:'🎃',itemName:'Pumpkin',coins:130,xp:19,fp:5,diff:'easy',hrs:24,rfood:0,rtoy:0},
  // ── Easy multi-item (2 farm categories) ───────────────────────────
  {npcId:'chef',items:[{itemId:'wheat',qty:5,inv:'silo',itemEmoji:'🌾',itemName:'Wheat'},{itemId:'tomato',qty:3,inv:'silo',itemEmoji:'🍅',itemName:'Tomato'}],coins:200,xp:30,fp:8,diff:'easy',hrs:24,rfood:1,rtoy:0},
  {npcId:'lily',items:[{itemId:'sunflower',qty:4,inv:'silo',itemEmoji:'🌻',itemName:'Sunflower'},{itemId:'lavender',qty:3,inv:'silo',itemEmoji:'💜',itemName:'Lavender'}],coins:220,xp:32,fp:8,diff:'easy',hrs:24,rfood:1,rtoy:0},
  {npcId:'joe',items:[{itemId:'carrot',qty:4,inv:'silo',itemEmoji:'🥕',itemName:'Carrot'},{itemId:'corn',qty:4,inv:'silo',itemEmoji:'🌽',itemName:'Corn'}],coins:190,xp:28,fp:8,diff:'easy',hrs:24,rfood:1,rtoy:0},
  // ── Medium single-item ────────────────────────────────────────────
  {npcId:'mary',itemId:'strawberry',qty:6,inv:'silo',itemEmoji:'🍓',itemName:'Strawberry',coins:320,xp:45,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'chef',itemId:'blueberry',qty:5,inv:'silo',itemEmoji:'🫐',itemName:'Blueberry',coins:380,xp:50,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'tom',itemId:'iron',qty:2,inv:'mineral',itemEmoji:'🪨',itemName:'Iron',coins:200,xp:38,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'tom',itemId:'copper',qty:2,inv:'mineral',itemEmoji:'🔶',itemName:'Copper',coins:260,xp:42,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'joe',itemId:'wheat',qty:10,inv:'silo',itemEmoji:'🌾',itemName:'Wheat',coins:350,xp:48,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  // ── Medium multi-item (crops + minerals, 2-3 categories) ──────────
  {npcId:'tom',items:[{itemId:'iron',qty:3,inv:'mineral',itemEmoji:'🪨',itemName:'Iron'},{itemId:'coal',qty:5,inv:'mineral',itemEmoji:'⚫',itemName:'Coal'},{itemId:'copper',qty:2,inv:'mineral',itemEmoji:'🔶',itemName:'Copper'}],coins:500,xp:68,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'mary',items:[{itemId:'strawberry',qty:5,inv:'silo',itemEmoji:'🍓',itemName:'Strawberry'},{itemId:'blueberry',qty:4,inv:'silo',itemEmoji:'🫐',itemName:'Blueberry'}],coins:540,xp:72,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'chef',items:[{itemId:'wheat',qty:8,inv:'silo',itemEmoji:'🌾',itemName:'Wheat'},{itemId:'corn',qty:6,inv:'silo',itemEmoji:'🌽',itemName:'Corn'},{itemId:'carrot',qty:5,inv:'silo',itemEmoji:'🥕',itemName:'Carrot'}],coins:460,xp:60,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'joe',items:[{itemId:'pumpkin',qty:3,inv:'silo',itemEmoji:'🎃',itemName:'Pumpkin'},{itemId:'coal',qty:4,inv:'mineral',itemEmoji:'⚫',itemName:'Coal'}],coins:420,xp:56,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'lily',items:[{itemId:'lavender',qty:5,inv:'silo',itemEmoji:'💜',itemName:'Lavender'},{itemId:'silver',qty:1,inv:'mineral',itemEmoji:'🪙',itemName:'Silver'}],coins:560,xp:75,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  {npcId:'chef',items:[{itemId:'bass',qty:2,inv:'fish',itemEmoji:'🐟',itemName:'Bass'},{itemId:'corn',qty:5,inv:'silo',itemEmoji:'🌽',itemName:'Corn'}],coins:480,xp:65,fp:15,diff:'medium',hrs:48,rfood:1,rtoy:0},
  // ── Hard multi-item (crops + minerals + fish + cooked, 3 categories) ─
  {npcId:'tom',items:[{itemId:'diamond',qty:1,inv:'mineral',itemEmoji:'💎',itemName:'Diamond'},{itemId:'golden',qty:2,inv:'silo',itemEmoji:'✨',itemName:'Golden Grain'},{itemId:'iron',qty:5,inv:'mineral',itemEmoji:'🪨',itemName:'Iron'}],coins:2400,xp:240,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'chef',items:[{itemId:'salmon',qty:3,inv:'fish',itemEmoji:'🍣',itemName:'Salmon'},{itemId:'tomato',qty:8,inv:'silo',itemEmoji:'🍅',itemName:'Tomato'},{itemId:'wheat',qty:10,inv:'silo',itemEmoji:'🌾',itemName:'Wheat'}],coins:2000,xp:200,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'mary',items:[{itemId:'emerald',qty:1,inv:'mineral',itemEmoji:'🟢',itemName:'Emerald'},{itemId:'blueberry',qty:10,inv:'silo',itemEmoji:'🫐',itemName:'Blueberry'},{itemId:'strawberry',qty:8,inv:'silo',itemEmoji:'🍓',itemName:'Strawberry'}],coins:2600,xp:260,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'lily',items:[{itemId:'lavender',qty:8,inv:'silo',itemEmoji:'💜',itemName:'Lavender'},{itemId:'sunflower',qty:6,inv:'silo',itemEmoji:'🌻',itemName:'Sunflower'},{itemId:'silver',qty:2,inv:'mineral',itemEmoji:'🪙',itemName:'Silver'}],coins:1800,xp:185,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'joe',items:[{itemId:'golden',qty:3,inv:'silo',itemEmoji:'✨',itemName:'Golden Grain'},{itemId:'pumpkin',qty:10,inv:'silo',itemEmoji:'🎃',itemName:'Pumpkin'},{itemId:'goldore',qty:2,inv:'mineral',itemEmoji:'🟡',itemName:'Gold Ore'}],coins:3200,xp:320,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'chef',items:[{itemId:'sturgeon',qty:2,inv:'fish',itemEmoji:'🦈',itemName:'Sturgeon'},{itemId:'truffle',qty:2,inv:'silo',itemEmoji:'🍄',itemName:'Truffle'},{itemId:'wheat',qty:15,inv:'silo',itemEmoji:'🌾',itemName:'Wheat'}],coins:4000,xp:380,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
  {npcId:'tom',items:[{itemId:'ruby',qty:1,inv:'mineral',itemEmoji:'🔴',itemName:'Ruby'},{itemId:'titanium',qty:2,inv:'mineral',itemEmoji:'⚙️',itemName:'Titanium'},{itemId:'goldore',qty:3,inv:'mineral',itemEmoji:'🟡',itemName:'Gold Ore'}],coins:5000,xp:450,fp:30,diff:'hard',hrs:72,rfood:2,rtoy:1},
];
const MARKET_EVENTS=[
  {id:'drought',name:'Drought',emoji:'🌵',desc:'Crop shortage — prices surge!',affected:'crops',mult:1.8,dur:3600000},
  {id:'pest',name:'Pest Outbreak',emoji:'🐛',desc:'Certain crops wiped out — buy now!',affected:'crops',mult:2.0,dur:2700000},
  {id:'festival',name:'Harvest Festival',emoji:'🎪',desc:'All goods in high demand!',affected:'all',mult:1.5,dur:1800000},
  {id:'export',name:'Export Deal',emoji:'🚢',desc:'Bulk buyers in town — bonus prices!',affected:'all',mult:1.7,dur:3600000},
  {id:'cold',name:'Cold Snap',emoji:'❄️',desc:'Animal products scarce — prices up!',affected:'animals',mult:2.2,dur:2700000},
  {id:'minecollapse',name:'Mine Collapse',emoji:'⛏️',desc:'Mineral supply cut — rare minerals surge!',affected:'minerals',mult:2.5,dur:3600000},
  {id:'diamondrush',name:'Diamond Rush',emoji:'💎',desc:'Everyone mining — diamond price crashes!',affected:'minerals',mult:0.4,dur:1800000},
  {id:'goldfever',name:'Gold Fever',emoji:'🥇',desc:'Gold demand skyrockets!',affected:'gold',mult:3.0,dur:1800000},
];
const DR=[{coins:50,xp:10},{coins:100,xp:20},{coins:150,xp:30,petFood:1},{coins:200,xp:40},{coins:300,xp:50,petFood:2},{coins:400,xp:60,toys:1},{coins:600,xp:100,petFood:3,toys:1}];
const DQ=[{id:'dq1',text:'Harvest 5 crops',key:'dqH',target:5,reward:{coins:80,xp:15}},{id:'dq2',text:'Mine 2 minerals',key:'dqM',target:2,reward:{coins:100,xp:20}},{id:'dq3',text:'Complete 1 NPC task',key:'dqT',target:1,reward:{coins:150,xp:25,petFood:1}}];
const PET_TYPES=[
  {id:'dog',name:'Farm Dog',emoji:'🐕',cost:200,bonus:'Barks when crops are ready',xpBoost:.1},
  {id:'cat',name:'Lucky Cat',emoji:'🐈',cost:300,bonus:'+5% coin bonus on sells',xpBoost:.12},
  {id:'parrot',name:'Wise Parrot',emoji:'🦜',cost:500,bonus:'+10% XP from all tasks',xpBoost:.2},
  {id:'bunny',name:'Lucky Bunny',emoji:'🐇',cost:400,bonus:'Finds bonus crops when harvesting',xpBoost:.15},
  {id:'fox',name:'Clever Fox',emoji:'🦊',cost:800,bonus:'+15% market sale price',xpBoost:.18},
  {id:'bear',name:'Honey Bear',emoji:'🐻',cost:1200,bonus:'Doubles honey and bee products',xpBoost:.22},
  {id:'owl',name:'Night Owl',emoji:'🦉',cost:600,bonus:'Earns coins while you sleep',xpBoost:.16},
  {id:'horse',name:'Racing Horse',emoji:'🐎',cost:1500,bonus:'Auto-plows 2 extra fields',xpBoost:.25},
  {id:'penguin',name:'Ice Penguin',emoji:'🐧',cost:700,bonus:'+20% mining rewards',xpBoost:.17},
  {id:'dragon',name:'Mini Dragon',emoji:'🐲',cost:5000,bonus:'Doubles all XP earned',xpBoost:.5},
  {id:'phoenix',name:'Phoenix',emoji:'🦅',cost:8000,bonus:'Revives dead crops automatically',xpBoost:.6},
  {id:'unicorn',name:'Unicorn',emoji:'🦄',cost:10000,bonus:'+50% to all coin earnings',xpBoost:.8},
];
const BOOKS=[{id:'b1',title:"Beginner's Guide",emoji:'📗',ml:1,pages:[{t:'Welcome',c:"Plow fields, plant crops, wait for them to grow, harvest to Silo, sell for coins."},{t:'First Harvest',c:"1. Tap brown tile to plow\n2. Choose crop at top\n3. Tap plowed tile to plant\n4. Wait for the timer\n5. Tap glowing tile to harvest\n6. Go to Silo to sell!"}]},{id:'b2',title:'Farming Tips',emoji:'🌾',ml:1,pages:[{t:'Plant and Harvest All',c:"Use Plant All to plant your selected crop in every plowed tile at once. Use Harvest All to collect every ready crop in one tap."},{t:'Seasons',c:"Prices change each season. Pumpkins earn 40% more in Autumn. Golden Grain earns 50% more in Winter. Plan your planting!"}]},{id:'b3',title:'Missions',emoji:'📋',ml:1,pages:[{t:'Task Board',c:"NPCs post requests. Completing tasks earns coins, XP and pet supplies. Daily quests reset every day for extra bonuses."},{t:'NPC Friendship',c:"Each task builds friendship. Best Friend status gives a 20% coin bonus on that NPC's rewards. Check the NPC Friends tab."}]},{id:'b4',title:'Pets',emoji:'🐾',ml:1,pages:[{t:'Adopting',c:"Adopt up to 3 pets from My Pets. Each has a unique farm skill."},{t:'Care',c:"Feed pets with Pet Food earned from tasks. Play with Toys to boost happiness. Pets decay slowly and are forgiving."}]},{id:'b5',title:'Finance',emoji:'💰',ml:3,pages:[{t:'Bank Loans',c:"Emergency Loan is capped at 500 coins. 10% of every earning auto-debits until fully repaid. You can also repay manually at any time."},{t:'Gold Growth',c:"Deposit gold grams in the Gold Growth Account. Earn a simulated 2% return. Withdraw anytime with profits added."}]},{id:'b6',title:'Friends',emoji:'🤝',ml:1,pages:[{t:'Friend Bonuses',c:"Add friends by entering their Player ID in Farmhouse Friends tab. Send daily help to each other."},{t:'Mutual Streak',c:"When both you and a friend send help on the same day, your Mutual Help Streak grows. Each streak day adds a 5% earnings bonus up to 50%."}]}];
const CHAT_CH=['General','Help','Missions','Trading'];
const CH_COL={General:'#27ae60',Help:'#2980b9',Missions:'#8e44ad',Trading:'#e67e22'};
const SEED_CHAT={General:[{text:'Welcome to Harvest Haven!'},{text:'Anyone want to trade?'}],Help:[{text:'How do I unlock the mine?'},{text:'Best crop for level 3?'}],Missions:[{text:'Need diamonds!'},{text:'Just completed a hard task!'}],Trading:[{text:'Selling iron ore!'},{text:'Need golden grain'}]};
const MARKET_ITEMS=[{emoji:'🌾',name:'Wheat',price:45,trend:'+5%',up:true},{emoji:'🍅',name:'Tomato',price:80,trend:'-3%',up:false},{emoji:'🥛',name:'Milk',price:60,trend:'+8%',up:true},{emoji:'🥚',name:'Eggs',price:50,trend:'+2%',up:true},{emoji:'🪨',name:'Iron',price:120,trend:'+12%',up:true},{emoji:'🟡',name:'Gold Ore',price:350,trend:'+1%',up:true},{emoji:'🌹',name:'Roses',price:90,trend:'-1%',up:false},{emoji:'🧶',name:'Wool',price:75,trend:'+6%',up:true}];
const STALL_THEMES=[{id:'green',label:'Forest Fresh',color:'#1a6b2a'},{id:'gold',label:'Golden Harvest',color:'#b7800a'},{id:'rose',label:'Rose Garden',color:'#b5174f'},{id:'blue',label:'Cool Morning',color:'#1a5276'},{id:'purple',label:'Lavender Dream',color:'#6c3483'},{id:'dark',label:'Midnight Farm',color:'#212f3c'}];
const LAND_PRICES=[300,800,1800,3500,7000,14000,28000];
const LONG_GOALS=[
  // Level milestones
  {id:'g1',name:'First Steps',emoji:'👣',desc:'Reach Level 5',key:'level',target:5,reward:500},
  {id:'g2',name:'Farmer',emoji:'🌾',desc:'Reach Level 10',key:'level',target:10,reward:1500},
  {id:'g3',name:'Expert Farmer',emoji:'👨‍🌾',desc:'Reach Level 20',key:'level',target:20,reward:5000},
  {id:'g4',name:'Master Farmer',emoji:'🏆',desc:'Reach Level 35',key:'level',target:35,reward:12000},
  {id:'g5',name:'Legend',emoji:'👑',desc:'Reach Level 50',key:'level',target:50,reward:30000},
  {id:'g6',name:'Grand Master',emoji:'💫',desc:'Reach Level 75',key:'level',target:75,reward:80000},
  {id:'g7',name:'Immortal Farmer',emoji:'🌟',desc:'Reach Level 100',key:'level',target:100,reward:250000},
  // Wealth milestones
  {id:'g8',name:'First Sale',emoji:'🪙',desc:'Earn 1,000 coins',key:'totalEarned',target:1000,reward:200},
  {id:'g9',name:'Merchant',emoji:'💰',desc:'Earn 50,000 coins',key:'totalEarned',target:50000,reward:2000},
  {id:'g10',name:'Tycoon',emoji:'🏦',desc:'Earn 500,000 coins',key:'totalEarned',target:500000,reward:15000},
  {id:'g11',name:'Millionaire',emoji:'💎',desc:'Earn 1,000,000 coins',key:'totalEarned',target:1000000,reward:50000},
  {id:'g12',name:'Billionaire',emoji:'🌍',desc:'Earn 10,000,000 coins',key:'totalEarned',target:10000000,reward:200000},
  {id:'g13',name:'Quadrillionaire',emoji:'🚀',desc:'Earn 1,000,000,000 coins',key:'totalEarned',target:1000000000,reward:5000000},
  // Farming milestones
  {id:'g14',name:'First Harvest',emoji:'🌱',desc:'Harvest 100 crops',key:'totalHarv',target:100,reward:300},
  {id:'g15',name:'Harvest Hero',emoji:'🌾',desc:'Harvest 10,000 crops',key:'totalHarv',target:10000,reward:5000},
  {id:'g16',name:'Harvest God',emoji:'⚡',desc:'Harvest 1,000,000 crops',key:'totalHarv',target:1000000,reward:100000},
  {id:'g17',name:'Golden Touch',emoji:'✨',desc:'Harvest 50 Golden Grain',key:'goldenHarv',target:50,reward:2000},
  {id:'g18',name:'Golden Master',emoji:'👑',desc:'Harvest 1,000 Golden Grain',key:'goldenHarv',target:1000,reward:30000},
  {id:'g19',name:'Star Farmer',emoji:'⭐',desc:'Harvest 100 Star Crops',key:'goldenHarv',target:100,reward:500000},
  // Mining milestones
  {id:'g20',name:'Digger',emoji:'⛏️',desc:'Mine 100 minerals',key:'minedTotal',target:100,reward:500},
  {id:'g21',name:'Miner',emoji:'🪨',desc:'Mine 1,000 minerals',key:'minedTotal',target:1000,reward:5000},
  {id:'g22',name:'Mine Baron',emoji:'💎',desc:'Mine 10,000 minerals',key:'minedTotal',target:10000,reward:25000},
  {id:'g23',name:'Deep Earth Lord',emoji:'🕳️',desc:'Mine 100,000 minerals',key:'minedTotal',target:100000,reward:200000},
  {id:'g24',name:'Void Miner',emoji:'🌀',desc:'Mine 1,000,000 minerals',key:'minedTotal',target:1000000,reward:2000000},
  // Animals milestones
  {id:'g25',name:'Animal Lover',emoji:'🐄',desc:'Own 3 animal types',key:'animalTypes',target:3,reward:600},
  {id:'g26',name:'Rancher',emoji:'🐎',desc:'Own 7 animal types',key:'animalTypes',target:7,reward:3000},
  {id:'g27',name:'Zoo Owner',emoji:'🦒',desc:'Own all 11 animal types',key:'animalTypes',target:11,reward:10000},
  // Tasks milestones
  {id:'g28',name:'Helper',emoji:'🤝',desc:'Complete 10 hard tasks',key:'hardTasks',target:10,reward:800},
  {id:'g29',name:'Task Champion',emoji:'📋',desc:'Complete 100 hard tasks',key:'hardTasks',target:100,reward:8000},
  {id:'g30',name:'Task Legend',emoji:'🏆',desc:'Complete 1,000 hard tasks',key:'hardTasks',target:1000,reward:100000},
  // Fishing milestones
  {id:'g31',name:'First Cast',emoji:'🎣',desc:'Catch 10 fish',key:'totalFishCaught',target:10,reward:300},
  {id:'g32',name:'Angler',emoji:'🐟',desc:'Catch 500 fish',key:'totalFishCaught',target:500,reward:3000},
  {id:'g33',name:'Master Angler',emoji:'🦈',desc:'Catch 5,000 fish',key:'totalFishCaught',target:5000,reward:30000},
  {id:'g34',name:'Sea Legend',emoji:'🌊',desc:'Catch 50,000 fish',key:'totalFishCaught',target:50000,reward:300000},
];
const MACH_DEF={
  plow:{id:'plow',name:'Plow Tractor',emoji:'🚜',desc:'Automatically plows empty tiles each cycle',cost:800,tiers:[{t:1,s:30,f:2,l:'Mk1'},{t:2,s:24,f:2.5,l:'Mk2'},{t:4,s:18,f:3,l:'Mk3'},{t:8,s:12,f:3.5,l:'Mk4'},{t:16,s:7,f:4,l:'Mk5'}],upg:[0,600,1400,3000,6000]},
  seeder:{id:'seeder',name:'Seeder Tractor',emoji:'🌱',desc:'Plants queued crops in plowed tiles automatically',cost:1000,tiers:[{t:1,s:35,f:2,l:'Mk1'},{t:2,s:28,f:2.5,l:'Mk2'},{t:3,s:22,f:3,l:'Mk3'},{t:4,s:16,f:3.5,l:'Mk4'},{t:6,s:10,f:4,l:'Mk5'}],upg:[0,800,2000,4000,8000]},
  fertiliser:{id:'fertiliser',name:'Fertiliser Spreader',emoji:'🌿',desc:'Boosts growth speed and harvest yield',cost:900,tiers:[{sb:.15,s:50,f:1.5,l:'Mk1'},{sb:.2,s:42,f:2,l:'Mk2'},{sb:.25,s:35,f:2.5,l:'Mk3'},{sb:.3,s:28,f:3,l:'Mk4'},{sb:.4,s:18,f:3.5,l:'Mk5'}],upg:[0,700,1600,3500,7000]},
  irrigation:{id:'irrigation',name:'Water Tank',emoji:'💧',desc:'Waters growing crops, cuts grow time 35%',cost:700,tiers:[{cv:4,s:60,f:1,l:'Mk1'},{cv:8,s:50,f:1.5,l:'Mk2'},{cv:16,s:40,f:2,l:'Mk3'},{cv:32,s:30,f:2.5,l:'Mk4'},{cv:999,s:20,f:3,l:'Mk5'}],upg:[0,500,1200,2500,5000]},
  harvester:{id:'harvester',name:'Combine Harvester',emoji:'🌾',desc:'Auto-harvests ready crops directly into silo',cost:2000,tiers:[{t:2,s:20,f:3,bc:.05,l:'Mk1'},{t:4,s:15,f:3.5,bc:.1,l:'Mk2'},{t:6,s:11,f:4,bc:.15,l:'Mk3'},{t:8,s:8,f:4.5,bc:.2,l:'Mk4'},{t:16,s:5,f:5,bc:.3,l:'Mk5'}],upg:[0,1200,2800,5500,10000]},
};
const FUEL_SHOP=[{name:'Small Can',emoji:'⛽',amt:25,cost:120},{name:'Large Can',emoji:'🪣',amt:75,cost:320},{name:'Full Tank',emoji:'🚛',amt:200,cost:750}];
const UPGRADES=[
  {id:'autoPlow',name:'Auto-Plower',emoji:'🚜',desc:'One-tap plow ALL fields instantly  -  no limit',cost:2000},
  {id:'mineBoost',name:'Mine Elevator',emoji:'⛏️',desc:'Double rare mineral drop rates permanently',cost:5000},
  {id:'premiumBank',name:'Premium Banking',emoji:'🏦',desc:'Profit share increases from 5% to 8%',cost:2500},
  {id:'petHouse',name:'Pet Luxury House',emoji:'🏠',desc:'Pets decay 60% slower',cost:1500},
  {id:'goldVault',name:'Gold Vault',emoji:'🥇',desc:'Unlocks Gold Growth Account in Bank',cost:3000},
  {id:'siloBoost',name:'Super Silo',emoji:'🏗️',desc:'All crop sell prices +10% permanently',cost:1800},
  {id:'greenhouse',name:'Greenhouse',emoji:'🌿',desc:'All crops grow 40% faster permanently',cost:4000},
  {id:'richSoil',name:'Rich Soil',emoji:'🌱',desc:'Every harvest yields +1 extra crop',cost:3500},
  {id:'staminaBoost',name:'Iron Farmer',emoji:'💪',desc:'Max stamina +50, drains 50% slower',cost:2800},
  {id:'animalFeed',name:'Auto Feeder',emoji:'🐾',desc:'Animals produce 2x more per collection',cost:3200},
  {id:'marketBoost',name:'Premium Stall',emoji:'🏪',desc:'Your market listings last 48hrs',cost:2200},
  {id:'fuelTank2',name:'Large Fuel Tank',emoji:'⛽',desc:'Increases max fuel capacity to 500',cost:4500},
  {id:'fuelTank3',name:'Mega Fuel Tank',emoji:'🏭',desc:'Increases max fuel capacity to 1000',cost:9000},
  {id:'doubleXp',name:'XP Booster',emoji:'⭐',desc:'+50% XP from all activities permanently',cost:6000},
];
const MENU_DEF=[
  {title:'YOUR FARM',items:[{id:'daily',emoji:'🎁',label:'Daily Rewards',desc:'Claim daily bonus and streak',ac:'#f39c12',ml:1},{id:'farm',emoji:'🌾',label:'Farming Fields',desc:'Plow, plant, water and harvest',ac:'#27ae60',ml:1},{id:'silo',emoji:'🏗️',label:'Silo',desc:'View and sell stored crops',ac:'#8B6914',ml:1},{id:'crafting',emoji:'🔨',label:'Crafting Workshop',desc:'Forge tools and goods from minerals',ac:'#795548',ml:3},{id:'kitchen',emoji:'🍳',label:'Kitchen',desc:'Cook recipes from crops, fish and produce',ac:'#e74c3c',ml:1},{id:'taskboard',emoji:'📋',label:'Task Board',desc:'Accept NPC missions for rewards',ac:'#8e44ad',ml:1},{id:'pets',emoji:'🐾',label:'My Pets',desc:'Feed and care for your pets',ac:'#e67e22',ml:1},{id:'animals',emoji:'🐄',label:'Animals',desc:'Collect milk, eggs, wool',ac:'#795548',ml:1},{id:'butchery',emoji:'🔪',label:'Butchery',desc:'Process meat for stamina or sell',ac:'#c0392b',ml:1},{id:'mine',emoji:'⛏️',label:'Mine',desc:'Extract rare minerals',ac:'#4a4a4a',ml:5},{id:'fishing',emoji:'🎣',label:'Farm Lake',desc:'Fish, craft and trade catches',ac:'#2980b9',ml:1},{id:'collections',emoji:'📖',label:'Collections',desc:'Track discoveries',ac:'#16a085',ml:1}]},
  {title:'COMMERCE',items:[{id:'market',emoji:'🏪',label:'Player Market',desc:'List and buy from other players',ac:'#2980b9',ml:1},{id:'gmb',emoji:'🏛️',label:'Gov. Marketing Board',desc:'Last resort buyer and seller',ac:'#7f8c8d',ml:1},{id:'stall',emoji:'🛖',label:'My Farm Stall',desc:'Customise your personal stall',ac:'#e67e22',ml:1},{id:'visitstalls',emoji:'🏘️',label:'Visit Stalls',desc:'Browse and buy from other players',ac:'#16a085',ml:1}]},
  {title:'FINANCE',items:[{id:'bank',emoji:'🏦',label:'Bank',desc:'Savings, loans and profit share',ac:'#1a5276',ml:1},{id:'gold',emoji:'🥇',label:'Gold Store',desc:'Buy and sell at live rates',ac:'#b7800a',ml:1},{id:'finance',emoji:'💰',label:'Financial Dashboard',desc:'Income, expenses and net worth',ac:'#1a6b2a',ml:1}]},
  {title:'COMMUNITY',items:[{id:'chat',emoji:'💬',label:'Farm Chat',desc:'Talk, trade and get help',ac:'#16a085',ml:1},{id:'goals',emoji:'🏆',label:'Long-Term Goals',desc:'Big milestones and rewards',ac:'#f39c12',ml:1}]},
  {title:'MANAGEMENT',items:[{id:'farmhouse',emoji:'🏡',label:'Farmhouse',desc:'Guide, friends, settings and multiplayer',ac:'#795548',ml:1},{id:'garage',emoji:'🔧',label:'Garage & Upgrades',desc:'Buy permanent farm upgrades',ac:'#546e7a',ml:1},{id:'workers',emoji:'👔',label:'Farm Workers',desc:'Hire workers and a manager',ac:'#2c3e50',ml:8}]},
];
const ACTIVE=['farm','silo','animals','butchery','mine','fishing','market','gmb','stall','bank','finance','farmhouse','taskboard','pets','chat','daily','crafting','kitchen','collections','goals','garage','workers'];
const xpFor=l=>{
  // Scales up - never truly maxes out
  if(l<10)return l*100;
  if(l<25)return l*150;
  if(l<50)return l*250;
  if(l<100)return l*500;
  return l*1000; // 100+ - very long grind
};
const todayStr=()=>new Date().toISOString().split('T')[0];
const genTasks=lvl=>{
  const lvScale=Math.max(1,Math.floor(lvl/5));
  const base=[...TASK_POOL].filter(t=>!(t.diff==='hard'&&lvl<10)&&!(t.diff==='medium'&&lvl<4)).sort(()=>Math.random()-.5).slice(0,6);
  // Add crafted item tasks at level 5+
  const crafted=lvl>=5?RECIPES.slice(0,Math.min(RECIPES.length,Math.floor(lvl/4)+1)).sort(()=>Math.random()-.5).slice(0,2).map((r,i)=>({
    id:`craft_${r.id}_${i}`,itemId:r.id,itemEmoji:r.emoji,itemName:r.name,inv:'crafted',
    qty:Math.max(1,Math.floor(Math.random()*2)+1),diff:'medium',coins:r.sell*1.5,xp:r.xp*2,
    npcId:Object.keys(NPCS)[Math.floor(Math.random()*Object.keys(NPCS).length)],
    hrs:24,rfood:1,rtoy:0
  })):[];
  return [...base,...crafted].map((t,i)=>({
    ...t,
    id:`t${Date.now()}${i}`,
    qty:Math.max(t.qty||1,Math.round((t.qty||1)*(1+lvScale*0.2))),
    accepted:false,
    expiresAt:Date.now()+(t.hrs||24)*3600000
  }));
};
const getMood=a=>a>=80?{mood:'Thriving',emoji:'😄',col:'#27ae60'}:a>=60?{mood:'Happy',emoji:'😊',col:'#2ecc71'}:a>=40?{mood:'Content',emoji:'😐',col:'#f39c12'}:a>=20?{mood:'Sad',emoji:'😟',col:'#e67e22'}:{mood:'Hungry',emoji:'😢',col:'#e74c3c'};
const getFP=p=>p>=200?{label:'Best Friend',col:'#8e44ad'}:p>=100?{label:'Good Friend',col:'#2980b9'}:p>=50?{label:'Friend',col:'#27ae60'}:p>=20?{label:'Acquaintance',col:'#f39c12'}:{label:'Stranger',col:'#aaa'};

const Card=({children,style={}})=><div style={{background:'#fff',borderRadius:16,padding:14,boxShadow:'0 1px 8px rgba(0,0,0,.07)',border:'1px solid #ececec',marginBottom:10,...style}}>{children}</div>;
const Btn=({onClick,color='#27ae60',disabled,children,style={}})=><button onClick={onClick} disabled={disabled} style={{background:disabled?'#bbb':color,color:'#fff',border:'none',borderRadius:12,padding:'9px 16px',fontSize:13,fontWeight:700,cursor:disabled?'default':'pointer',...style}}>{children}</button>;
const Bar=({v,c})=><div style={{height:8,background:'#eee',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.max(0,Math.min(100,v))}%`,background:c,borderRadius:4,transition:'width .5s'}}/></div>;
const DiffBadge=({d})=>{const c=d==='easy'?'#27ae60':d==='medium'?'#e67e22':'#e74c3c';return<span style={{background:c,color:'#fff',borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:800}}>{d.toUpperCase()}</span>;};
const SecHead=({label,color='#777'})=><div style={{fontSize:11,fontWeight:800,color,letterSpacing:1.1,marginBottom:8,paddingLeft:2}}>{label}</div>;
const TabRow=({tabs,active,onSelect,ac='#1a6b2a'})=><div style={{display:'flex',gap:4,marginBottom:14,background:'rgba(0,0,0,0.07)',borderRadius:16,padding:3}}>{tabs.map(([id,lb])=><button key={id} onClick={()=>onSelect(id)} style={{flex:1,background:active===id?'#fff':'transparent',color:active===id?ac:'#666',border:'none',borderRadius:13,padding:'8px 4px',fontSize:11,fontWeight:active===id?800:600,cursor:'pointer',transition:'all .2s',boxShadow:active===id?'0 2px 8px rgba(0,0,0,0.12)':'none'}}>{lb}</button>)}</div>;

function HarvestHaven({user,onSignOut}){
  const [screen,setScreen]=useState('home');
  const [tiles,setTiles]=useState(Array(12).fill(null).map((_,i)=>({id:i,state:'empty',crop:null,growsAt:0,watered:false})));
  const [landPlots,setLP]=useState(3);
  const [selCrop,setSelCrop]=useState(CROPS[0]);
  const [coins,setCoins]=useState(500);
  const [stamina,setStamina]=useState(100);
  const [marketEvent,setMarketEvent]=useState(null);
  const [eventEndsAt,setEventEndsAt]=useState(0);
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
  const [allStalls,setAllStalls]=useState([]);
  const [visitingStall,setVisitingStall]=useState(null);
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
  const [unreadChat,setUnreadChat]=useState(0);
  const [lastSeenChat,setLastSeenChat]=useState(()=>parseInt(localStorage.getItem('hh_lastseen_chat')||'0'));
  const [globalEvents,setGlobalEvents]=useState([]); // in-game event feed
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
  const [poolTotal,setPoolTotal]=useState(0);
  const [myPoolShare,setMyPoolShare]=useState(0);
  const [lastPoolDist,setLastPoolDist]=useState('');
  const [mach,setMach]=useState({
    plow:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
    seeder:{owned:false,tier:0,active:false,dur:100,lastCycle:0,queue:[],qCrop:'wheat'},
    fertiliser:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
    irrigation:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
    harvester:{owned:false,tier:0,active:false,dur:100,lastCycle:0},
  });
  const [fuel,setFuel]=useState(50);
  const [offRep,setOffRep]=useState(null);
  // Fishing state
  const [fishInv,setFishInv]=useState({});
  const [baitInv,setBaitInv]=useState({worm:5});
  const [fishCd,setFishCd]=useState(false);
  const [selBait,setSelBait]=useState('worm');
  const [totalFishCaught,setTFC]=useState(0);
  const [fishChatMsgs,setFishChat]=useState([]);
  const [ownedAnimals,setOwnedAnimals]=useState({});
  const [animalLevels,setAnimalLevels]=useState({});
  const [animalXp,setAnimalXp]=useState({});
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
  const cropPrice=crop=>{
  const base=crop.base||25;
  const seasonal=season.boost?.[crop.id]||1;
  const tierBonus=crop.tier>=7?1.5:crop.tier>=6?1.3:crop.tier>=5?1.1:1;
  const evMult=(marketEvent&&(marketEvent.affected==='all'||marketEvent.affected==='crops'))?marketEvent.mult:1;
  return Math.round(base*seasonal*siloMult*tierBonus*evMult);
};
  const friendBonus=Math.min(friendStreak*.05,.5);

  useEffect(()=>{loanRef.current=loanDebt;},[loanDebt]);

  useEffect(()=>{
    (async()=>{
      try{
        let saveData=null;
        if(db&&auth?.currentUser){
          try{const sn=await get(child(ref(db),`saves/${auth.currentUser.uid}`));if(sn.exists())saveData=JSON.parse(sn.val());}catch{}
        }
        if(!saveData){const raw=localStorage.getItem('hh7')||localStorage.getItem('hh6')||localStorage.getItem('hh_save');if(raw)saveData=JSON.parse(raw);}
        if(saveData){
          const s=saveData;
          const k={coins:setCoins,xp:setXp,level:setLevel,silo:setSilo,minerals:setMin,bankBal:setBankBal,goldHeld:setGold,friendship:setFP,streak:setStreak,lastLogin:setLastLogin,petInv:setPetInv,pets:setPets,collected:setCollected,craftInv:setCraftInv,hardTasks:setHT,goldenHarv:setGH,minedTotal:setMTotal,totalEarned:setTE,seasonIdx:setSeasonIdx,totalHarv:setTH,loanDebt:setLoanDebt,dqP:setDQP,dqDone:setDQDone,friendsList:setFriendsList,friendStreak:setFS,lastFriendHelp:setLFH,upgrades:setUpgrades,goldGrowth:setGG,goldGrowthBal:setGGB,jointBal:setJB,ownedAnimals:setOwnedAnimals,meatInv:setMeatInv,landPlots:setLP,animalLevels:setAnimalLevels,animalXp:setAnimalXp,fishInv:setFishInv,baitInv:setBaitInv,totalFishCaught:setTFC};
          Object.entries(k).forEach(([key,fn])=>{if(s[key]!==undefined)fn(s[key]);});
          if(s.tiles)setTiles(s.tiles.map(t=>({...t,crop:t.crop?CROPS.find(c=>c.id===t.crop.id)||null:null})));if(s.mach)setMach(s.mach);if(s.fuel!==undefined)setFuel(s.fuel);
        }
}catch(e){console.log('Load error',e);}      try{const r=await window.storage.get('farm_name');if(r)setFarmName(r.value);}catch{}
      try{if(user?.uid){const sn=await get(child(ref(db),`users/${user.uid}/profile`));if(sn.exists()){const p=sn.val();if(p.farmName)setFarmName(p.farmName);}}}catch{}
      try{const r=await window.storage.get('theme_id');if(r)setThemeId(r.value);}catch{}
      setWC('GLOBAL'); // All users share one global community
      setTasks(genTasks(1));
      // Immediately write correct state to Firebase after load so next interval save is correct
      if(db&&auth?.currentUser){
        try{
          const raw=localStorage.getItem('hh7');
          if(raw)await set(ref(db,`saves/${auth.currentUser.uid}`),raw);
        }catch(e){console.log('Post-load Firebase sync error',e);}
      }
    })();
  },[]);

const saveGame=useCallback(async()=>{
    try{
      const s={coins,xp,level,silo,minerals,bankBal,goldHeld,friendship,streak,lastLogin,petInv,pets,collected,craftInv,hardTasks,goldenHarv,minedTotal,totalEarned,seasonIdx,totalHarv,loanDebt,dqP,dqDone,friendsList,friendStreak,lastFriendHelp,upgrades,goldGrowth,goldGrowthBal,jointBal,ownedAnimals,meatInv,landPlots,mach,fuel,animalLevels,animalXp,fishInv,baitInv,totalFishCaught,tiles:tiles.map(t=>({...t,crop:t.crop?{id:t.crop.id}:null}))};
      localStorage.setItem('hh7',JSON.stringify(s));
      if(db&&auth?.currentUser){
        try{await set(ref(db,`saves/${auth.currentUser.uid}`),JSON.stringify(s));}catch(e){console.log('Firebase save error',e);}
      }
    }catch(e){console.log('Save error',e);}
  },[coins,xp,level,silo,minerals,bankBal,goldHeld,friendship,streak,lastLogin,petInv,pets,collected,craftInv,hardTasks,goldenHarv,minedTotal,totalEarned,seasonIdx,totalHarv,loanDebt,dqP,dqDone,friendsList,friendStreak,lastFriendHelp,upgrades,goldGrowth,goldGrowthBal,jointBal,listings,tiles,ownedAnimals,meatInv,landPlots,mach,fuel,animalLevels,animalXp,fishInv,baitInv,totalFishCaught]);
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
      const coinReward=newLevel*200;
      earn(coinReward);
      if(newLevel>=5)setPetInv(p=>({...p,petFood:p.petFood+2}));
      if(newLevel%10===0)setPetInv(p=>({...p,toys:p.toys+1})); // bonus every 10 levels
      notify(`🎉 Level ${newLevel}! +🪙${coinReward.toLocaleString()}`,'gold');
      if(db){const evId=`lvl_${Date.now()}_${playerId}`;set(ref(db,`globalevents/${evId}`),{type:'level_up',farm:farmName,level:newLevel,time:Date.now()}).catch(()=>{});}
    }
  },[xp]);
  useEffect(()=>{const t=setInterval(()=>{setTiles(ts=>{const now=Date.now();let ch=false;const nx=ts.map(ti=>{if(ti.state==='planted'&&ti.growsAt>0&&now>=ti.growsAt){ch=true;return{...ti,state:'ready'};}return ti;});return ch?nx:ts;});},2000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const t=setInterval(()=>{setPets(ps=>ps.map(p=>({...p,hunger:Math.max(0,p.hunger-1),happiness:Math.max(0,p.happiness-.5)})));},45000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const t=setInterval(()=>setSeasonIdx(i=>(i+1)%4),240000);return()=>clearInterval(t);},[]);
  // Gold Growth Account returns (simulated monthly)
  useEffect(()=>{const t=setInterval(()=>{if(goldGrowthBal>0){const ret=+(goldGrowthBal*.02).toFixed(2);setGG(g=>+(g+ret).toFixed(2));notify(`Gold Growth +${ret}g return!`,'gold');}},120000);return()=>clearInterval(t);},[goldGrowthBal]);
  // Joint fund growth
  // Global Joint Fund - sync to Firebase
  useEffect(()=>{
    if(!db||!playerId||!jointBal)return;
    set(ref(db,`jointfund/${playerId}`),{amount:jointBal,name:farmName,time:Date.now()}).catch(()=>{});
  },[jointBal,farmName,playerId]);

  // ─── Global Events Feed ───
  useEffect(()=>{
    if(!db)return;
    const unsub=onValue(ref(db,'globalevents'),sn=>{
      if(!sn.exists())return;
      const events=Object.values(sn.val())
        .filter(e=>e&&e.time&&Date.now()-e.time<3600000) // last hour only
        .sort((a,b)=>b.time-a.time)
        .slice(0,20);
      setGlobalEvents(events);
      // Show in-game notification for very recent events from others
      events.filter(e=>e.farm!==farmName&&Date.now()-e.time<8000).forEach(e=>{
        if(e.type==='chat')notify(`💬 ${e.farm} in ${e.ch}: "${e.preview}"...`,'blue');
        else if(e.type==='pool')notify(`🌍 ${e.farm} pooled 🪙${e.amount?.toLocaleString()}!`,'green');
        else if(e.type==='rare_fish')notify(`🎣 ${e.farm} caught a ${e.fishName}!`,'#2980b9');
        else if(e.type==='level_up')notify(`⭐ ${e.farm} reached Level ${e.level}!`,'gold');
        else if(e.type==='legendary')notify(`🏆 ${e.farm} found ${e.item}!`,'gold');
      });
    });
    return()=>unsub();
  },[farmName]);

  // Daily profit distribution from global pool
  useEffect(()=>{
    if(!db)return;
    const unsub=onValue(ref(db,'jointfund'),sn=>{
      if(!sn.exists())return;
      const data=sn.val();
      const total=Object.values(data).reduce((s,p)=>s+(p?.amount||0),0);
      const myShare=jointBal>0&&total>0?jointBal/total:0;
      // Store total pool for display
      setPoolTotal(total);
      setMyPoolShare(myShare);
    });
    return()=>unsub();
  },[jointBal]);

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

  const autoPlow=()=>{
    const limit=upgrades.autoPlow?9999:(mach&&mach.plow&&mach.plow.owned?MACH_DEF.plow.tiers[mach.plow.tier].t:4);
    let cnt=0;
    setTiles(ts=>{
      const n=[...ts].map(t=>{
        if(t.state==='empty'&&cnt<limit){cnt++;return{...t,state:'plowed'};}
        return t;
      });
      return n;
    });
    setTimeout(()=>{if(cnt>0)notify(`Auto-plowed ${cnt} fields! 🚜`,'green');else notify('No empty fields!','orange');},100);
  };

  const waterAll=()=>{let cnt=0;setTiles(ts=>ts.map(t=>{if(t.state!=='planted'||t.watered)return t;cnt++;const rem=Math.max(0,t.growsAt-Date.now());return{...t,watered:true,growsAt:Date.now()+rem*.7};}));if(cnt>0)notify(`Watered ${cnt} crops! -30% grow time`,'blue');else notify('No growing crops!','orange');};

  const sellFrom=(crop,qty)=>{if(!qty)return;const sp=cropPrice(crop);earn(qty*sp);setSilo(s=>({...s,[crop.id]:0}));notify(`Sold ${qty}x ${crop.emoji} 🪙${(qty*sp).toLocaleString()}`,'gold');};
  const sellOne=crop=>{if(!silo[crop.id])return;earn(cropPrice(crop));setSilo(s=>({...s,[crop.id]:s[crop.id]-1}));notify(`Sold 1x ${crop.emoji}`,'gold');};
  const sellAll=()=>{if(!siloTotal){notify('Silo empty!','orange');return;}earn(siloValue);setSilo({});notify(`Sold all 🪙${siloValue.toLocaleString()}`,'gold');};

  const collectAnimal=a=>{
    if(animalCd[a.id]){notify('Animal is resting! Come back in 1 hour.','orange');return;}
    if(a.value===0){setStamina(s=>Math.min(100,s+15));notify('+15 Stamina!','green');return;}
    const qty=ownedAnimals[a.id]||1;
    const levels=animalLevels[a.id]||Array(qty).fill(1);
    const avgLevel=Math.max(1,Math.round(levels.reduce((s,l)=>s+l,0)/Math.max(1,levels.length)));
    const levelBonus=1+(avgLevel-1)*0.15; // +15% per level
    const total=Math.round(a.value*qty*levelBonus);
    earn(total);
    setXp(x=>x+5*qty);
    setAT(at=>{const n=new Set(at);n.add(a.id);return n;});
    // Give XP to animals
    setAnimalXp(p=>{
      const arr=[...(p[a.id]||Array(qty).fill(0))];
      const newArr=arr.map(x=>x+10);
      return {...p,[a.id]:newArr};
    });
    // Level up animals that have enough XP
    setAnimalLevels(p=>{
      const xpArr=animalXp[a.id]||Array(qty).fill(0);
      const lvArr=[...(p[a.id]||Array(qty).fill(1))];
      const newLv=lvArr.map((lv,i)=>{const xp=(xpArr[i]||0)+10;return xp>=(lv*50)?lv+1:lv;});
      if(newLv.some((l,i)=>l>(p[a.id]||[])[i]||0))notify(`🎉 ${a.emoji} leveled up!`,'gold');
      return {...p,[a.id]:newLv};
    });
    setAnimalCd(c=>({...c,[a.id]:true}));
    setTimeout(()=>setAnimalCd(c=>{const n={...c};delete n[a.id];return n;}),3600000);
    notify(`+🪙${total} from ${qty}x ${a.emoji} (Lv${avgLevel} avg)`,'gold');
  };
  const buyAnimal=a=>{
    const cost=a.buyCost||300;
    if(coins<cost){notify(`Need 🪙${cost.toLocaleString()}!`,'orange');return;}
    const totalOwned=Object.values(ownedAnimals).reduce((s,v)=>s+(v||0),0);
    if(totalOwned>=level){notify(`Reach Level ${totalOwned+1} to own more animals!`,'orange');return;}
    spend(cost);
    setOwnedAnimals(p=>({...p,[a.id]:(p[a.id]||0)+1}));
    setAnimalLevels(p=>({...p,[a.id]:[...(p[a.id]||[]),1]}));
    setAnimalXp(p=>({...p,[a.id]:[...(p[a.id]||[]),0]}));
    notify(`${a.emoji} ${a.name} bought! Total: ${(ownedAnimals[a.id]||0)+1}`,'green');
  };

  const slaughter=a=>{
    if(!a.meat){notify('This animal cannot be slaughtered!','orange');return;}
    const owned=ownedAnimals[a.id]||0;
    if(owned<1){notify(`You don't own any ${a.name}!`,'orange');return;}
    if(owned<=1){notify(`Keep at least 1 ${a.name} alive for ongoing rewards! Buy more to slaughter.`,'orange');return;}
    // Deduct one animal
    setOwnedAnimals(p=>({...p,[a.id]:p[a.id]-1}));
    // Remove its level data
    setAnimalLevels(p=>{const n={...p};const arr=[...(n[a.id]||[1])];arr.pop();n[a.id]=arr;return n;});
    // Meat yield scales with animal level (avg level of herd)
    const levels=animalLevels[a.id]||[1];
    const avgLevel=Math.round(levels.reduce((s,l)=>s+l,0)/levels.length);
    const meatQty=Math.max(1,avgLevel);
    setMeatInv(p=>({...p,[a.id]:(p[a.id]||0)+meatQty}));
    notify(`Slaughtered 1x ${a.emoji} ${a.name} (Lv${avgLevel}) → ${meatQty}x ${a.me} ${a.meat}!`,'green');
  };
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
  const getInv=(inv,id)=>{if(inv==='silo')return silo[id]||0;if(inv==='crafted')return craftInv[id]||0;if(inv==='fish')return fishInv[id]||0;if(inv==='meat')return meatInv[id]||0;return minerals[id]||0;};
  const canComplete=task=>{const items=task.items||[{itemId:task.itemId,qty:task.qty,inv:task.inv}];return items.every(({itemId,qty,inv})=>getInv(inv,itemId)>=qty);};
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

  const claimDaily=()=>{const today=todayStr();const lastClaim=localStorage.getItem('hh_lastclaim');if(lastClaim===today){notify('Already claimed today! Come back tomorrow 🌅','orange');setDC(true);return;}const dayIdx=Math.min(streak%7,6);const r=DR[dayIdx];earn(r.coins);setXp(x=>x+r.xp);if(r.petFood)setPetInv(p=>({...p,petFood:p.petFood+r.petFood}));if(r.toys)setPetInv(p=>({...p,toys:p.toys+r.toys}));setStreak(s=>s+1);setLastLogin(today);setDC(true);localStorage.setItem('hh_lastclaim',today);notify(`Day ${dayIdx+1} reward! +🪙${r.coins}`,'gold');};

  const adoptPet=pt=>{if(coins<pt.cost){notify(`Need 🪙${pt.cost}!`,'orange');return;}if(pets.length>=3){notify('Max 3 pets!','orange');return;}spend(pt.cost);setPets(p=>[...p,{id:`pet_${Date.now()}`,typeId:pt.id,name:pt.name,hunger:100,happiness:100,petXp:0,petLevel:1}]);notify(`${pt.emoji} ${pt.name} adopted!`,'green');};
  const feedPet=id=>{if(petInv.petFood<=0){notify('No Pet Food!','orange');return;}setPetInv(p=>({...p,petFood:p.petFood-1}));setPets(ps=>ps.map(p=>{if(p.id!==id)return p;const nx=p.petXp+5,nl=nx>=p.petLevel*50?p.petLevel+1:p.petLevel;return{...p,hunger:Math.min(100,p.hunger+35),petXp:nx,petLevel:nl};}));setXp(x=>x+5);notify('Pet fed! +5 XP','green');};
  const playPet=id=>{const ht=petInv.toys>0;if(ht)setPetInv(p=>({...p,toys:p.toys-1}));setPets(ps=>ps.map(p=>{if(p.id!==id)return p;const nx=p.petXp+5,nl=nx>=p.petLevel*50?p.petLevel+1:p.petLevel;return{...p,happiness:Math.min(100,p.happiness+(ht?30:15)),petXp:nx,petLevel:nl};}));setXp(x=>x+5);notify(ht?'Played with toy! +5 XP':'Played! +5 XP','green');};

  const sendFriendHelp=async fid=>{
    if(!fid)return;
    const today=todayStr();
    try{
      await window.storage.set(`fhelp:GLOBAL:${playerId}:${fid}:${today}`,'1',true);
      const r=await window.storage.get(`fhelp:GLOBAL:${fid}:${playerId}:${today}`,true);
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
      if(nF<tier.f){setMach(p=>({...p,[mId]:{...p[mId],active:false}}));notify(`${def.name} stopped  -  out of fuel! ⛽`,'orange');return;}
      // Only consume fuel if machine actually does useful work
      let didWork=false;
      if(mId==='plow'){const before=nT.filter(t=>t.state==='empty').length;let c=tier.t||1;nT=nT.map(t=>t.state==='empty'&&c-->0?{...t,state:'plowed'}:t);if(nT.filter(t=>t.state==='empty').length<before)didWork=true;}
      else if(mId==='seeder'){
        const q=[...machR.current.seeder.queue];let c=tier.t||1,qi=0;
        nT=nT.map(t=>{if(t.state==='plowed'&&c>0&&qi<q.length){const cr=CROPS.find(x=>x.id===q[qi]);if(cr&&coinsRf.current-cD>=cr.cost){cD+=cr.cost;qi++;c--;return{...t,state:'planted',crop:cr,growsAt:now+cr.grow*1000,watered:false};}return t;}return t;});
        if(qi>0)setMach(p=>({...p,seeder:{...p.seeder,queue:p.seeder.queue.slice(qi)}}));
      }
      else if(mId==='fertiliser'){let c=8;nT=nT.map(t=>t.state==='planted'&&!t.fertilised&&c-->0?{...t,fertilised:true,growsAt:now+Math.max(0,t.growsAt-now)*(1-tier.sb)}:t);}
      else if(mId==='irrigation'){let c=tier.cv;nT=nT.map(t=>t.state==='planted'&&!t.watered&&c-->0?{...t,watered:true,growsAt:now+Math.max(0,t.growsAt-now)*.65}:t);}
      else if(mId==='harvester'){const before=nT.filter(t=>t.state==='ready').length;let c=tier.t;nT=nT.map(t=>{if(t.state==='ready'&&c-->0){const cr=t.crop,qty=Math.random()<tier.bc?2:1;nS[cr.id]=(nS[cr.id]||0)+qty;cE+=cr.base*smult*qty;xpG+=cr.xp;didWork=true;return{...t,state:'empty',crop:null,growsAt:0,watered:false,fertilised:false};}return t;});}
      if(didWork){nF-=tier.f;durUpd[mId]=Math.max(0,m.dur-0.4);anyChg=true;}
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

  // Sync stall to Firebase
  useEffect(()=>{
    if(!db||!playerId)return;
    const myListings=listings.filter(l=>l.sellerId===playerId&&l.expiresAt>Date.now());
    const stall={...stallCfg,playerId,farmName,listings:myListings,lastSeen:Date.now()};
    set(ref(db,`stalls/${playerId}`),stall).catch(()=>{});
  },[stallCfg,listings,farmName,playerId]);
  useEffect(()=>{
    if(!db)return;
    const unsub=onValue(ref(db,'stalls'),sn=>{
      if(sn.exists()){const seen=new Set();const data=sn.val();const stalls=Object.values(data).filter(s=>{if(!s.playerId||s.playerId===playerId)return false;if(Date.now()-s.lastSeen>3600000)return false;if(seen.has(s.playerId))return false;seen.add(s.playerId);return true;});setAllStalls(stalls);}else setAllStalls([]);
    });
    return()=>unsub();
  },[playerId]);
  useEffect(()=>{
    if(!db)return;
    const unsub=onValue(ref(db,'market'),sn=>{
      if(sn.exists()){const data=sn.val();if(data&&typeof data==='object'){const now=Date.now();setListings(Object.values(data).filter(l=>l&&l.expiresAt>now).sort((a,b)=>b.expiresAt-a.expiresAt));}}else setListings([]);
    });
    return()=>unsub();
  },[]);
  useEffect(()=>{
    if(!db||!playerId)return;
    const unsub=onValue(ref(db,`payments/${playerId}`),sn=>{
      if(sn.exists()){const data=sn.val();Object.entries(data).forEach(([id,p])=>{if(p&&p.amount&&p.time&&Date.now()-p.time<60000){earn(p.amount);notify(`💰 ${p.item} sold! +🪙${p.amount}`,'gold');set(ref(db,`payments/${playerId}/${id}`),null).catch(()=>{});}});}
    });
    return()=>unsub();
  },[playerId]);
  // Global market events - Firebase sync
  useEffect(()=>{
    if(!db)return;
    const unsub=onValue(ref(db,'marketEvent'),sn=>{
      if(!sn.exists()){setMarketEvent(null);setEventEndsAt(0);return;}
      const ev=sn.val();
      if(ev&&ev.endsAt&&ev.endsAt>Date.now()){setMarketEvent(ev);setEventEndsAt(ev.endsAt);}
      else{setMarketEvent(null);setEventEndsAt(0);}
    });
    return()=>unsub();
  },[]);
  useEffect(()=>{
    if(!db)return;
    const t=setTimeout(()=>{
      const lastEvt=parseInt(localStorage.getItem('hh_lastevt')||'0');
      if(Date.now()-lastEvt>7200000&&Math.random()<0.4){
        const ev=MARKET_EVENTS[Math.floor(Math.random()*MARKET_EVENTS.length)];
        localStorage.setItem('hh_lastevt',String(Date.now()));
        set(ref(db,'marketEvent'),{...ev,endsAt:Date.now()+ev.dur,startedAt:Date.now()}).catch(()=>{});
      }
    },5000);
    return()=>clearTimeout(t);
  },[]);

  // Machine management
  const buyMach=mId=>{const def=MACH_DEF[mId];if(coins<def.cost){notify(`Need 🪙${def.cost.toLocaleString()}!`,'orange');return;}spend(def.cost);setMach(p=>({...p,[mId]:{...p[mId],owned:true}}));notify(`${def.name} purchased!`,'green');};
  const upgMach=mId=>{const m=mach[mId],def=MACH_DEF[mId];if(m.tier>=4){notify('Already max tier!','orange');return;}const cost=def.upg[m.tier+1];if(coins<cost){notify(`Need 🪙${cost.toLocaleString()}!`,'orange');return;}spend(cost);setMach(p=>({...p,[mId]:{...p[mId],tier:p[mId].tier+1}}));notify(`${def.name} → ${def.tiers[m.tier+1].l}!`,'gold');};
  const toggleMach=mId=>{const m=mach[mId];if(!m.owned)return;if(m.dur<=0){notify('Repair first!','orange');return;}if(fuel<=0&&!m.active){notify('Buy fuel first!','orange');return;}const wasActive=m.active;setMach(p=>({...p,[mId]:{...p[mId],active:!p[mId].active,lastCycle:Date.now()}}));notify(!wasActive?'Machine started! 🟢':'Machine stopped.','green');};
  const repairMach=mId=>{if(coins<200){notify('Need 🪙200!','orange');return;}spend(200);setMach(p=>({...p,[mId]:{...p[mId],dur:100}}));notify('Machine repaired! ✅','green');};
  const buyFuelF=item=>{
    if(coins<item.cost){notify(`Need 🪙${item.cost}!`,'orange');return;}
    const maxFuel=upgrades.fuelTank3?1000:upgrades.fuelTank2?500:200;
    spend(item.cost);
    setFuel(f=>Math.min(maxFuel,f+item.amt));
    notify(`+${item.amt} fuel! ⛽`,'green');
  };
  const addToQueue=(cropId,qty=5)=>{setMach(p=>({...p,seeder:{...p.seeder,queue:[...p.seeder.queue,...Array(qty).fill(cropId)]}}));const cr=CROPS.find(c=>c.id===cropId);notify(`Added ${qty}x ${cr?.emoji} to seeder queue!`,'green');};
  const clearQueue=()=>{setMach(p=>({...p,seeder:{...p.seeder,queue:[]}}));notify('Queue cleared.','orange');};

  const canCraft=r=>Object.entries(r.ing).every(([id,qty])=>{const inS=CROPS.find(c=>c.id===id);return inS?(silo[id]||0)>=qty:(minerals[id]||0)>=qty;});
  const craft=r=>{if(!canCraft(r)){notify('Not enough ingredients!','orange');return;}const ns={...silo},nm={...minerals};Object.entries(r.ing).forEach(([id,qty])=>{const inS=CROPS.find(c=>c.id===id);if(inS)ns[id]=(ns[id]||0)-qty;else nm[id]=(nm[id]||0)-qty;});setSilo(ns);setMin(nm);setCraftInv(c=>({...c,[r.id]:(c[r.id]||0)+1}));setXp(x=>x+r.xp);addCollected(r.id);notify(`Crafted ${r.emoji} ${r.name}!`,'gold');};
  const sellCrafted=r=>{const q=craftInv[r.id]||0;if(!q)return;earn(q*r.sell);setCraftInv(c=>({...c,[r.id]:0}));notify(`Sold ${q}x ${r.emoji} 🪙${(q*r.sell).toLocaleString()}`,'gold');};

  const addListing=async(itemId,qty,price,type,emoji,name)=>{if(type==='silo'&&(silo[itemId]||0)<qty){notify('Not enough in Silo!','orange');return;}if(type==='mineral'&&(minerals[itemId]||0)<qty){notify('Not enough minerals!','orange');return;}if(type==='silo')setSilo(s=>({...s,[itemId]:(s[itemId]||0)-qty}));else setMin(m=>({...m,[itemId]:(m[itemId]||0)-qty}));const listing={id:`${Date.now()}_${playerId}`,itemId,qty,price,type,emoji,name,seller:farmName,sellerId:playerId,expiresAt:Date.now()+24*3600000};if(db){try{await set(ref(db,`market/${listing.id}`),listing);}catch{}}notify(`Listed ${qty}x ${name}!`,'green');};
  const buyListing=async l=>{if(l.sellerId===playerId){notify('Cannot buy own listing!','orange');return;}const total=l.price*l.qty;if(coins<total){notify('Not enough coins!','orange');return;}spend(total);if(l.type==='silo')setSilo(s=>({...s,[l.itemId]:(s[l.itemId]||0)+l.qty}));else setMin(m=>({...m,[l.itemId]:(m[l.itemId]||0)+l.qty}));if(db){try{await set(ref(db,`market/${l.id}`),null);await set(ref(db,`payments/${l.sellerId}/${l.id}`),{amount:total,from:playerId,item:l.name,time:Date.now()});}catch{}}setListings(ls=>ls.filter(x=>x.id!==l.id));notify(`Bought ${l.qty}x ${l.name}!`,'gold');};

  const sendChat=async(ch,text)=>{
    if(['spam','scam','hack'].some(w=>text.toLowerCase().includes(w))){notify('Blocked.','orange');return false;}
    const msg={id:`${Date.now()}_${playerId}`,author:playerId,farm:farmName,text:String(text),time:Date.now()};
    setChat(m=>({...m,[ch]:[...m[ch].slice(-49),msg]}));
    if(db){
      try{
        await set(ref(db,`globalchat/${ch}/${msg.id}`),msg);
        // Post global event
        await set(ref(db,`globalevents/${msg.id}`),{type:'chat',farm:farmName,ch,preview:text.slice(0,40),time:Date.now()});
      }catch(e){console.log('Chat send error:',e);}
    }
    return true;
  };

  const buyUpgrade=up=>{if(upgrades[up.id]){notify('Already owned!','orange');return;}if(coins<up.cost){notify(`Need 🪙${up.cost.toLocaleString()}!`,'orange');return;}spend(up.cost);setUpgrades(u=>({...u,[up.id]:true}));notify(`${up.emoji} ${up.name} activated permanently!`,'gold');};

  const nc={green:'#27ae60',gold:'#b7800a',orange:'#e67e22',blue:'#2980b9'};
  const isHome=screen==='home';
  const screenLabel=MENU_DEF.flatMap(s=>s.items).find(i=>i.id===screen);

  // ─── Fishing functions ───
  const castLine=()=>{
    if(fishCd){notify('Wait for your line! 🎣','orange');return;}
    const bait=BAITS.find(b=>b.id===selBait);
    if(!baitInv[selBait]||baitInv[selBait]<1){notify(`No ${bait?.name||'bait'} left! Buy more from the Tackle Shop.`,'orange');return;}
    setBaitInv(b=>({...b,[selBait]:b[selBait]-1}));
    setFishCd(true);
    // Fishing takes 2-4 seconds (suspense!)
    const waitTime=2000+Math.random()*2000;
    setTimeout(()=>{
      const bonus=bait?.bonus||0;
      // Roll for fish
      const roll=Math.random();
      let cumulative=0;
      let caught=null;
      const availFish=FISH.filter(f=>level>=f.minLevel&&f.bait.includes(selBait));
      // Apply bait bonus to rare fish
      for(const f of availFish){
        const chance=f.rarity==='rare'||f.rarity==='legendary'?f.r*(1+bonus*2):f.r*(1+bonus);
        cumulative+=chance;
        if(roll<cumulative){caught=f;break;}
      }
      // Fallback to minnow if nothing caught
      if(!caught&&Math.random()<0.85)caught=FISH.find(f=>f.id==='minnow');
      if(caught){
        setFishInv(fi=>({...fi,[caught.id]:(fi[caught.id]||0)+1}));
        setXp(x=>x+caught.xp);
        setTFC(t=>t+1);
        addCollected(caught.id);
        const rarityMsg=caught.rarity==='legendary'?'🏆 LEGENDARY! ':caught.rarity==='rare'?'⭐ RARE! ':'';
        notify(`${rarityMsg}Caught ${caught.emoji} ${caught.name}! +🪙${caught.value} value, +${caught.xp}XP`,'#2980b9');
        // Post to fish village chat + global events for rare/legendary
        if(caught.rarity!=='common'){
          const msgId=`fish_${Date.now()}_${playerId}`;
          const msg={id:msgId,author:playerId,farm:farmName,text:`🎣 Just caught a ${caught.rarity==='legendary'?'LEGENDARY ':'rare '}${caught.emoji} ${caught.name}!`,time:Date.now(),type:'fish'};
          if(db){
            set(ref(db,`fishchat/${msgId}`),msg).catch(()=>{});
            // Also post to global events feed
            set(ref(db,`globalevents/${msgId}`),{type:'rare_fish',farm:farmName,fishName:caught.name,fishEmoji:caught.emoji,rarity:caught.rarity,time:Date.now()}).catch(()=>{});
          }
        }
      }else{
        notify('Nothing bit this time... try a different bait! 🎣','#aaa');
      }
      setFishCd(false);
    },waitTime);
  };

  const sellFish=(fish,qty=1)=>{
    if((fishInv[fish.id]||0)<qty){notify('Not enough fish!','orange');return;}
    const total=fish.value*qty;
    earn(total);
    setFishInv(fi=>({...fi,[fish.id]:(fi[fish.id]||0)-qty}));
    notify(`Sold ${qty}x ${fish.emoji} ${fish.name} for 🪙${total.toLocaleString()}!`,'gold');
  };

  const sellAllFish=()=>{
    let total=0;
    const updates={};
    FISH.forEach(f=>{const q=fishInv[f.id]||0;if(q>0){total+=f.value*q;updates[f.id]=0;}});
    if(!total){notify('No fish to sell!','orange');return;}
    earn(total);
    setFishInv(fi=>({...fi,...updates}));
    notify(`Sold all fish for 🪙${total.toLocaleString()}!`,'gold');
  };

  const buyBait=(bait,qty=5)=>{
    const cost=bait.cost*qty;
    if(coins<cost){notify(`Need 🪙${cost}!`,'orange');return;}
    spend(cost);
    setBaitInv(b=>({...b,[bait.id]:(b[bait.id]||0)+qty}));
    notify(`Bought ${qty}x ${bait.emoji} ${bait.name}!`,'green');
  };

  const craftFishRecipe=(recipe)=>{
    // Check ingredients (fish + crops)
    for(const [id,qty] of Object.entries(recipe.ing)){
      const inFish=(fishInv[id]||0)>=qty;
      const inSilo=(silo[id]||0)>=qty;
      const inMin=(minerals[id]||0)>=qty;
      if(!inFish&&!inSilo&&!inMin){notify(`Need ${qty}x ${id}!`,'orange');return;}
    }
    // Deduct
    for(const [id,qty] of Object.entries(recipe.ing)){
      if((fishInv[id]||0)>=qty)setFishInv(fi=>({...fi,[id]:fi[id]-qty}));
      else if((silo[id]||0)>=qty)setSilo(s=>({...s,[id]:s[id]-qty}));
      else setMin(m=>({...m,[id]:m[id]-qty}));
    }
    setCraftInv(c=>({...c,[recipe.id]:(c[recipe.id]||0)+1}));
    setXp(x=>x+recipe.xp);
    notify(`Crafted ${recipe.emoji} ${recipe.name}! (+${recipe.xp}XP)`,'green');
  };

  const canCraftFish=(recipe)=>{
    for(const [id,qty] of Object.entries(recipe.ing)){
      const have=(fishInv[id]||0)+(silo[id]||0)+(minerals[id]||0);
      if(have<qty)return false;
    }
    return true;
  };

    const G={coins,earn,spend,notify,setChat,level,xp,setXp,totalEarned,todayEarned,todaySpent,bankBal,setBankBal,goldHeld,goldPrice,goldBuy,setGoldBuy,goldSell,setGoldSell,buyGoldF,sellGoldF,animalCd,collectAnimal,minerals,mine,mineCd,sellMin,stallCfg,setStall,stamina,setStamina,meatInv,slaughter,eatMeat,sellMeat,silo,siloTotal,siloValue,sellFrom,sellOne,sellAll,totalHarv,setScreen,farmName,updateFN,themeId,updateTheme,playerId,T,season,seasonIdx,setSeasonIdx,cropPrice,tasks,activeTasks,availTasks,acceptTask,abandonTask,canComplete,completeTask,setTasks,pets,petInv,adoptPet,feedPet,playPet,chatMsgs,sendChat,blocked,setBlocked,unreadChat,setUnreadChat,lastSeenChat,setLastSeenChat,globalEvents,streak,lastLogin,dailyClaimed,setDC,claimDaily,craftInv,craft,canCraft,sellCrafted,collected,friendship,hardTasks,minedTotal,goldenHarv,animalTypes,listings,addListing,buyListing,loanDebt,takeEmergencyLoan,setLoanDebt,dqP,dqDone,claimDQ,friendsList,setFriendsList,friendStreak,lastFriendHelp,sendFriendHelp,upgrades,buyUpgrade,goldGrowthBal,setGGB,goldGrowth,setGG,jointBal,setJB,poolTotal,myPoolShare,friendBonus,plantAll,harvestAll,waterAll,autoPlow,ownedAnimals,buyAnimal,animalLevels,animalXp,mach,fuel,buyMach,upgMach,toggleMach,repairMach,buyFuelF,addToQueue,clearQueue,MACH_DEF,FUEL_SHOP,allStalls,setSilo:s=>setSilo(s),setMin:m=>setMin(m),setFuel:f=>setFuel(f),setCraftInv:c=>setCraftInv(c),setFishInv:f=>setFishInv(f),landPlots,buyLand,fishInv,baitInv,selBait,setSelBait,fishCd,castLine,sellFish,sellAllFish,buyBait,craftFishRecipe,canCraftFish,totalFishCaught,fishChatMsgs,setFishChat};

  return(
    <div style={{width:'100%',maxWidth:430,margin:'0 auto',height:'100vh',display:'flex',flexDirection:'column',background:T.bg,fontFamily:'system-ui,sans-serif',overflow:'hidden',position:'relative'}}>

      {/* ── HEADER ── */}
      <div style={{
        background:isHome?'transparent':'rgba(0,0,0,0.4)',
        backdropFilter:isHome?'none':'blur(16px)',
        WebkitBackdropFilter:isHome?'none':'blur(16px)',
        padding:isHome?'14px 16px 10px':'10px 14px',
        flexShrink:0,
        borderBottom:isHome?'none':'1px solid rgba(255,255,255,0.1)',
        position:'relative',zIndex:10
      }}>
        {isHome?(
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap'}}>
                  <div style={{fontSize:9,fontWeight:900,color:'rgba(255,255,255,0.6)',letterSpacing:2.5,textTransform:'uppercase'}}>🌾 Harvest Haven · codAR</div>
                  <div style={{background:season.col,color:'#fff',borderRadius:20,padding:'1px 8px',fontSize:9,fontWeight:800,boxShadow:'0 2px 6px rgba(0,0,0,0.3)'}}>{season.emoji} {season.name}</div>
                  {loanDebt>0&&<div style={{background:'rgba(220,38,38,0.85)',backdropFilter:'blur(8px)',color:'#fff',borderRadius:20,padding:'1px 8px',fontSize:9,fontWeight:800}}>⚠️ Loan</div>}
                </div>
                <div style={{fontSize:26,fontWeight:900,color:'#fff',textShadow:'0 3px 12px rgba(0,0,0,0.5)',lineHeight:1.1,letterSpacing:-.5}}>{farmName}</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:700,marginTop:3,display:'flex',gap:8}}>
                  <span>⭐ Lv {level}</span><span>🏡 {tiles.length} fields</span><span>🔥 {streak}d</span>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5,alignItems:'flex-end'}}>
                <div style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',borderRadius:16,padding:'8px 16px',border:'1px solid rgba(255,215,0,0.3)',boxShadow:'0 4px 16px rgba(0,0,0,0.3)'}}>
                  <div style={{fontSize:20,fontWeight:900,color:'#ffd700',textShadow:'0 2px 8px rgba(255,200,0,0.5)',letterSpacing:-.5}}>🪙 {coins.toLocaleString()}</div>
                  {friendBonus>0&&<div style={{fontSize:8,color:'rgba(255,255,255,0.6)',textAlign:'right'}}>+{Math.round(friendBonus*100)}% bonus</div>}
                </div>
                <button onClick={onSignOut} style={{background:'rgba(255,255,255,0.08)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'3px 10px',fontSize:9,color:'rgba(255,255,255,0.55)',cursor:'pointer',fontWeight:700,letterSpacing:.5,textTransform:'uppercase'}}>Sign Out</button>
              </div>
            </div>
            <div style={{background:'rgba(0,0,0,0.25)',borderRadius:16,padding:'7px 12px',border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'rgba(255,255,255,0.65)',marginBottom:4,fontWeight:800,textTransform:'uppercase',letterSpacing:.8}}>
                <span>⭐ Experience</span><span>{xpCur} / {xpNeeded} XP</span>
              </div>
              <div style={{height:7,background:'rgba(0,0,0,0.35)',borderRadius:20,overflow:'hidden',marginBottom:stamina<80?4:0}}>
                <div style={{height:'100%',width:`${(xpCur/xpNeeded)*100}%`,background:`linear-gradient(90deg,${T.primary},${T.accent})`,borderRadius:20,transition:'width .5s',boxShadow:`0 0 10px ${T.accent}88`}}/>
              </div>
              {stamina<80&&<>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'rgba(255,255,255,0.55)',marginBottom:3,fontWeight:700}}>
                  <span>💪 Stamina</span><span>{Math.round(stamina)}%</span>
                </div>
                <div style={{height:5,background:'rgba(0,0,0,0.35)',borderRadius:20,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${stamina}%`,background:stamina>60?'#facc15':stamina>30?'#f97316':'#ef4444',borderRadius:20,boxShadow:stamina<30?'0 0 8px #ef4444':'none'}}/>
                </div>
              </>}
            </div>
          </>
        ):(
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={()=>setScreen('home')} style={{background:'rgba(255,255,255,0.12)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:12,padding:'7px 14px',fontSize:12,fontWeight:900,cursor:'pointer',color:'#fff',flexShrink:0,letterSpacing:.5,textTransform:'uppercase'}}>← Back</button>
            <div style={{flex:1,fontSize:15,fontWeight:900,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textShadow:'0 2px 6px rgba(0,0,0,0.4)',letterSpacing:-.2}}>{screenLabel?`${screenLabel.emoji} ${screenLabel.label}`:screen}</div>
            <div style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(8px)',borderRadius:12,padding:'6px 12px',fontWeight:900,color:'#ffd700',fontSize:14,textShadow:'0 1px 6px rgba(0,0,0,0.4)',border:'1px solid rgba(255,215,0,0.25)',letterSpacing:-.3}}>🪙{coins.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* ── NOTIFICATIONS ── */}
      <div style={{position:'absolute',top:isHome?150:66,left:'50%',transform:'translateX(-50%)',zIndex:999,display:'flex',flexDirection:'column',gap:5,alignItems:'center',pointerEvents:'none',width:'90%',maxWidth:380}}>
        {notifs.map(n=>(
          <div key={n.id} style={{background:nc[n.type]||'#16a34a',color:'#fff',padding:'8px 18px',borderRadius:24,fontSize:12,fontWeight:800,boxShadow:'0 6px 24px rgba(0,0,0,0.35)',whiteSpace:'nowrap',letterSpacing:.3,border:'1px solid rgba(255,255,255,0.15)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}}>
            {n.msg}
          </div>
        ))}
      </div>

      {/* ── SCREEN CONTENT ── */}
      <div style={{flex:1,overflowY:'auto',overscrollBehavior:'contain',background:'rgba(0,0,0,0.18)',backdropFilter:'blur(2px)'}}>
        {screen==='home'&&<HomeScreen G={G} siloTotal={siloTotal} siloValue={siloValue} minCount={minCount} activeTasks={activeTasks}/>}
        {screen==='farm'&&<FarmScreen G={G} tiles={tiles} tapTile={tapTile} td={t=>{if(t.state==='empty')return{bg:'#7a5c2a',emoji:'🌍',sub:'Plow'};if(t.state==='plowed')return{bg:'#4a3010',emoji:'🟫',sub:'Plant'};if(t.state==='planted'){const p=Math.max(0,Math.min(100,((t.growsAt-Date.now())/(t.crop?.grow*1000||1))*100));const growEmoji=t.watered?'💧'+(t.crop?.emoji||''):t.crop?.emoji||'🌱';return{bg:'#1a5c20',emoji:growEmoji,sub:`${Math.round(100-p)}%`};}if(t.state==='ready')return{bg:'#166534',emoji:t.crop?.emoji,sub:'✅',glow:true};return{bg:'#6b5010',emoji:'',sub:''};}} selCrop={selCrop} setSelCrop={setSelCrop} landPlots={landPlots} buyLand={buyLand}/>}
        {screen==='silo'&&<SiloScreen G={G}/>}
        {screen==='daily'&&<DailyScreen G={G}/>}
        {screen==='crafting'&&<CraftingScreen G={G}/>}
        {screen==='kitchen'&&<KitchenScreen G={G}/>}
        {screen==='taskboard'&&<TaskBoardScreen G={G}/>}
        {screen==='pets'&&<PetsScreen G={G}/>}
        {screen==='collections'&&<CollectionsScreen G={G}/>}
        {screen==='goals'&&<GoalsScreen G={G}/>}
        {screen==='animals'&&<AnimalsScreen G={G}/>}
        {screen==='butchery'&&<ButcheryScreen G={G}/>}
        {screen==='mine'&&<MineScreen G={G}/>}
        {screen==='fishing'&&<FishingScreen G={G}/>}
        {screen==='market'&&<MarketScreen G={G}/>}
        {screen==='gmb'&&<GmbScreen G={G}/>}
        {screen==='stall'&&<StallScreen G={G}/>}
        {screen==='bank'&&<BankScreen G={G}/>}
        {screen==='finance'&&<FinanceScreen G={G}/>}
        {screen==='chat'&&<ChatScreen G={G}/>}
        {screen==='garage'&&<GarageScreen G={G}/>}
        {screen==='workers'&&<WorkersScreen G={G}/>}
        {screen==='visitstalls'&&<VisitStallsListScreen G={G}/>}
        {screen==='farmhouse'&&<FarmhouseScreen G={G}/>}
        {!ACTIVE.includes(screen)&&screen!=='home'&&<div style={{textAlign:'center',padding:'80px 30px'}}><div style={{fontSize:64,marginBottom:16}}>🚧</div><div style={{fontWeight:900,fontSize:18,color:'rgba(255,255,255,0.6)'}}>Coming Soon</div></div>}
      </div>
      <style>{`@keyframes rippleAnim{from{transform:translate(-50%,-50%) scale(0);opacity:1}to{transform:translate(-50%,-50%) scale(3);opacity:0}}*{-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:0;height:0}`}</style>
    </div>
  );

}

function HomeScreen({G,siloTotal,siloValue,minCount,activeTasks}){
  const{coins,setScreen,T,level,pets,dailyClaimed,loanDebt,dqDone,friendStreak,streak,farmName,totalEarned,xp,fishInv}=G;
  const totalFish=Object.values(fishInv||{}).reduce((a,b)=>a+b,0);
  const{unreadChat}=G;
  const badges={silo:siloTotal>0?`${siloTotal}`:null,mine:minCount>0?`${minCount}`:null,taskboard:activeTasks.length>0?`${activeTasks.length}`:null,pets:pets.length>0?`${pets.length}`:null,daily:!dailyClaimed?'!':null,chat:unreadChat>0?`${unreadChat}`:null};
  const menu=MENU_DEF.map(sec=>{
    if(sec.title!=='YOUR FARM')return sec;
    const daily=sec.items.find(i=>i.id==='daily');
    const rest=sec.items.filter(i=>i.id!=='daily');
    return{...sec,items:dailyClaimed?[...rest,daily]:[daily,...rest]};
  });
  return(
    <div style={{padding:'14px 14px 32px'}}>
      {/* Quick stats strip */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {[
          {emoji:'🏗️',label:'Silo',value:siloTotal>0?`🪙${siloValue.toLocaleString()}`:'Empty',s:'silo',color:'#f59e0b'},
          {emoji:'📋',label:'Tasks',value:activeTasks.length>0?`${activeTasks.length} active`:'No tasks',s:'taskboard',color:'#8b5cf6'},
          {emoji:'🎣',label:'Fish',value:totalFish>0?`${totalFish} fish`:'Go fish!',s:'fishing',color:'#0ea5e9'},
        ].map((st,i)=>(
          <button key={i} onClick={()=>setScreen(st.s)} style={{flex:1,background:'rgba(255,255,255,0.12)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:16,padding:'10px 6px',cursor:'pointer',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:22}}>{st.emoji}</div>
            <div style={{fontSize:11,fontWeight:900,color:'#fff',marginTop:3,textShadow:'0 1px 4px rgba(0,0,0,0.4)'}}>{st.value}</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.6)',fontWeight:700,letterSpacing:.5,textTransform:'uppercase'}}>{st.label}</div>
          </button>
        ))}
      </div>

      {/* Active Market Event Banner */}
      {G.marketEvent&&G.eventEndsAt>Date.now()&&<div style={{background:`linear-gradient(135deg,#f39c12,#e67e22)`,borderRadius:16,padding:'10px 14px',marginBottom:10,border:'1px solid rgba(255,255,255,0.2)',boxShadow:'0 4px 16px rgba(243,156,18,0.3)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{fontSize:28}}>{G.marketEvent.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:900,color:'#fff'}}>{G.marketEvent.name} Active!</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.85)'}}>{G.marketEvent.desc}</div>
          </div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',fontWeight:700}}>
            {Math.round((G.eventEndsAt-Date.now())/60000)}m left
          </div>
        </div>
      </div>}

      {/* Global Events Ticker */}
      {G.globalEvents&&G.globalEvents.length>0&&<div style={{background:'rgba(0,0,0,0.25)',backdropFilter:'blur(8px)',borderRadius:16,padding:'8px 14px',marginBottom:10,border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden'}}>
        <div style={{fontSize:9,fontWeight:900,color:'rgba(255,255,255,0.5)',letterSpacing:2,marginBottom:6,textTransform:'uppercase'}}>🌍 Live Activity</div>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          {G.globalEvents.slice(0,4).map((e,i)=>{
            const icon=e.type==='chat'?'💬':e.type==='pool'?'🏦':e.type==='rare_fish'?'🎣':e.type==='level_up'?'⭐':'🏆';
            const msg=e.type==='chat'?`${e.farm} in ${e.ch}: "${e.preview}"`:e.type==='pool'?`${e.farm} pooled 🪙${(e.amount||0).toLocaleString()} to Global Pool`:e.type==='level_up'?`${e.farm} reached Level ${e.level}!`:e.type==='rare_fish'?`${e.farm} caught a ${e.fishName||'rare fish'}!`:`${e.farm}: ${e.item||'big catch!'}`;
            const ago=Math.floor((Date.now()-e.time)/60000);
            return(
              <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:14}}>{icon}</span>
                <div style={{flex:1,fontSize:11,color:'rgba(255,255,255,0.8)',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{msg}</div>
                <span style={{fontSize:9,color:'rgba(255,255,255,0.35)',flexShrink:0}}>{ago===0?'now':`${ago}m`}</span>
              </div>
            );
          })}
        </div>
      </div>}

      {/* Alerts */}
      {loanDebt>0&&<div style={{background:'rgba(220,38,38,0.85)',backdropFilter:'blur(8px)',borderRadius:16,padding:'10px 16px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid rgba(255,255,255,0.15)',boxShadow:'0 4px 16px rgba(220,38,38,0.3)'}}>
        <div><div style={{fontSize:12,fontWeight:900,color:'#fff'}}>⚠️ Active Loan</div><div style={{fontSize:10,color:'rgba(255,255,255,0.8)'}}>10% auto-debited from earnings</div></div>
        <div style={{fontSize:16,fontWeight:900,color:'#fff'}}>🪙{loanDebt}</div>
      </div>}
      {friendStreak>0&&<div style={{background:'rgba(5,150,105,0.75)',backdropFilter:'blur(8px)',borderRadius:16,padding:'8px 16px',marginBottom:10,display:'flex',justifyContent:'space-between',border:'1px solid rgba(255,255,255,0.12)'}}>
        <div style={{fontSize:12,fontWeight:900,color:'#fff'}}>🤝 Friend Streak {friendStreak} days</div>
        <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.9)'}}>+{Math.round(friendStreak*.05*100)}% bonus</div>
      </div>}

      {/* Menu sections */}
      {menu.map((sec,si)=>(
        <div key={si} style={{marginBottom:20}}>
          <div style={{fontSize:10,fontWeight:900,color:'rgba(255,255,255,0.5)',letterSpacing:2.5,marginBottom:8,paddingLeft:2,textTransform:'uppercase'}}>{sec.title}</div>
          <div style={{background:'rgba(255,255,255,0.08)',backdropFilter:'blur(8px)',borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,0.12)',boxShadow:'0 4px 24px rgba(0,0,0,0.2)'}}>
            {sec.items.map((item,ii)=>{
              const locked=level<(item.ml||1),badge=badges[item.id],isLast=ii===sec.items.length-1;
              const isDailyClaimed=item.id==='daily'&&dailyClaimed;
              return(
                <button key={item.id} onClick={()=>!locked&&setScreen(item.id)} style={{
                  width:'100%',background:'transparent',border:'none',
                  borderBottom:isLast?'none':'1px solid rgba(255,255,255,0.07)',
                  padding:'13px 16px',cursor:locked?'default':'pointer',
                  display:'flex',alignItems:'center',gap:14,textAlign:'left',
                  opacity:locked?0.4:1,
                  transition:'background .15s'
                }}>
                  <div style={{width:42,height:42,background:locked?'rgba(255,255,255,0.06)':`${item.ac}22`,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,border:`1px solid ${item.ac}44`}}>{item.emoji}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:900,fontSize:14,color:isDailyClaimed?'rgba(255,255,255,0.4)':'#fff',textShadow:'0 1px 4px rgba(0,0,0,0.3)',display:'flex',alignItems:'center',gap:6}}>
                      {item.label}
                      {badge&&!locked&&<span style={{background:item.ac,color:'#fff',borderRadius:20,padding:'1px 7px',fontSize:9,fontWeight:900,boxShadow:`0 2px 6px ${item.ac}66`}}>{badge}</span>}
                      {isDailyClaimed&&<span style={{fontSize:10,color:'rgba(255,255,255,0.35)',fontWeight:600}}>claimed</span>}
                    </div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:1,fontWeight:600}}>{locked?`🔒 Unlocks at Level ${item.ml}`:item.desc}</div>
                  </div>
                  {!locked&&<div style={{color:'rgba(255,255,255,0.3)',fontSize:16}}>›</div>}
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
        {upgrades.autoPlow&&<button onClick={()=>G.autoPlow()} style={{flex:1,background:'#795548',color:'#fff',border:'none',borderRadius:12,padding:'9px 8px',fontSize:12,fontWeight:700,cursor:'pointer'}}>🚜 Auto-Plow</button>}
        <button onClick={plantAll} disabled={plowedCount===0} style={{flex:1,background:plowedCount>0?T.primary:'#bbb',color:'#fff',border:'none',borderRadius:12,padding:'9px 8px',fontSize:12,fontWeight:700,cursor:plowedCount>0?'pointer':'default'}}>🌱 Plant All ({plowedCount})</button>
        <button onClick={harvestAll} disabled={readyCount===0} style={{flex:1,background:readyCount>0?'#27ae60':'#bbb',color:'#fff',border:'none',borderRadius:12,padding:'9px 8px',fontSize:12,fontWeight:700,cursor:readyCount>0?'pointer':'default'}}>🌾 Harvest All ({readyCount})</button>
      </div>
      <div style={{background:`${season.col}18`,borderRadius:12,padding:'6px 14px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${season.col}33`}}>
        <span style={{fontSize:12,fontWeight:700,color:season.col}}>{season.emoji} {season.name}  -  price boosts active</span>
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
          <Btn onClick={sellAll} style={{width:'100%',padding:13,fontSize:15,marginBottom:12}}>Sell Everything  -  🪙{siloValue.toLocaleString()}</Btn>
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
        <div style={{fontWeight:800,fontSize:15,color:'#111',marginBottom:8}}>Today  -  Day {dayIdx+1}</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
          <div style={{background:'#fff9e6',borderRadius:12,padding:'8px 12px',textAlign:'center'}}><div style={{fontSize:18}}>🪙</div><div style={{fontWeight:800,color:'#b7800a'}}>+{r.coins}</div></div>
          <div style={{background:'#eef7ee',borderRadius:12,padding:'8px 12px',textAlign:'center'}}><div style={{fontSize:18}}>⭐</div><div style={{fontWeight:800,color:'#27ae60'}}>+{r.xp}XP</div></div>
          {r.petFood&&<div style={{background:'#fef3e8',borderRadius:12,padding:'8px 12px',textAlign:'center'}}><div style={{fontSize:18}}>🐾</div><div style={{fontWeight:800,color:'#e67e22'}}>+{r.petFood}</div></div>}
          {r.toys&&<div style={{background:'#f3eafa',borderRadius:12,padding:'8px 12px',textAlign:'center'}}><div style={{fontSize:18}}>🪀</div><div style={{fontWeight:800,color:'#8e44ad'}}>+{r.toys}</div></div>}
        </div>
        <Btn onClick={claimDaily} disabled={dailyClaimed} style={{width:'100%',padding:12,fontSize:14}} color={T.primary}>{dailyClaimed?'Claimed  -  come back tomorrow!':'Claim Daily Reward!'}</Btn>
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
  const{tasks,canComplete,completeTask,setTasks,level,silo,minerals,craftInv,friendship,notify,T,earn,setXp,setPetInv,petInv}=G;
  const[tab,setTab]=useState('available');
  const available=tasks.filter(t=>!t.accepted&&t.expiresAt>Date.now());
  const active=tasks.filter(t=>t.accepted&&t.expiresAt>Date.now());
  const isBF=friendship>=100;

  const quickComplete=task=>{
    if(!canComplete(task)){notify('You do not have the required items!','orange');return;}
    completeTask(task);
  };

  const acceptAndComplete=task=>{
    if(canComplete(task)){
      // Has items - complete immediately
      completeTask(task);
    } else {
      // Accept for later
      setTasks(ts=>ts.map(t=>t.id===task.id?{...t,accepted:true}:t));
      notify(`Task accepted - gather the items then come back!`,'green');
    }
  };

  const renderTask=(task,isActive)=>{
    const npc=G.NPCS?.[task.npcId]||{name:'Farmer',emoji:'👨‍🌾',col:'#27ae60'};
    const ready=canComplete(task);
    const isBFBonus=isBF&&task.diff==='hard';
    return(
      <Card key={task.id}>
        <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:10}}>
          <div style={{width:42,height:42,background:`${npc.col}22`,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0,border:`1px solid ${npc.col}44`}}>{npc.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:14,color:'#111'}}>{npc.name}</div>
            <div style={{fontSize:12,color:'#555',margin:'2px 0'}}>Needs: {task.qty}x {task.itemEmoji||''} {task.itemName||task.itemId}</div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:12,fontWeight:800,color:'#f39c12'}}>🪙{isBFBonus?Math.round(task.coins*1.2):task.coins}</span>
              <span style={{fontSize:11,color:'#888'}}>+{task.xp}XP</span>
              {task.rfood>0&&<span style={{fontSize:11,color:'#e67e22'}}>🐾×{task.rfood}</span>}
              <span style={{background:task.diff==='hard'?'#e74c3c':task.diff==='medium'?'#f39c12':'#27ae60',color:'#fff',borderRadius:20,padding:'1px 8px',fontSize:9,fontWeight:800,textTransform:'uppercase'}}>{task.diff}</span>
              {isBFBonus&&<span style={{fontSize:9,color:'#27ae60',fontWeight:800}}>🤝 BF +20%</span>}
            </div>
          </div>
        </div>
        {isActive?(
          <div style={{display:'flex',gap:6}}>
            <Btn onClick={()=>setTasks(ts=>ts.map(t=>t.id===task.id?{...t,accepted:false}:t))} color='#aaa' style={{flex:1,padding:9,fontSize:12}}>Pass</Btn>
            <Btn onClick={()=>quickComplete(task)} disabled={!ready} color='#27ae60' style={{flex:2,padding:9,fontSize:13}}>{ready?`Complete +🪙${isBFBonus?Math.round(task.coins*1.2):task.coins}`:'Need items'}</Btn>
          </div>
        ):(
          <Btn onClick={()=>acceptAndComplete(task)} color={ready?'#27ae60':'#2980b9'} style={{width:'100%',padding:10,fontSize:13}}>
            {ready?`Complete Now +🪙${task.coins}`:'Accept Task'}
          </Btn>
        )}
      </Card>
    );
  };

  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#6c3483dd,#8e44adcc)',backdropFilter:'blur(8px)',borderRadius:20,padding:16,marginBottom:14,color:'#fff',border:'1px solid rgba(255,255,255,0.15)'}}>
        <div style={{fontSize:11,opacity:.8,letterSpacing:1,fontWeight:800,textTransform:'uppercase',marginBottom:2}}>Missions</div>
        <div style={{fontSize:22,fontWeight:900,letterSpacing:-.3}}>📋 Task Board</div>
        <div style={{fontSize:12,opacity:.75,marginTop:2}}>{active.length} active · {available.length} available · {isBF?'🤝 Best Friend bonus active!':'Friendship: '+friendship+'%'}</div>
      </div>
      <TabRow tabs={[['available',`Available (${available.length})`],['active',`Active (${active.length})`]]} active={tab} onSelect={setTab} ac='#8e44ad'/>
      {tab==='available'&&(available.length===0
        ?<div style={{textAlign:'center',padding:30,color:'rgba(255,255,255,0.4)'}}><div style={{fontSize:48}}>📋</div><div style={{marginTop:8,fontWeight:700}}>No tasks right now</div><div style={{fontSize:12,marginTop:4,opacity:.6}}>Check back soon!</div></div>
        :available.map(t=>renderTask(t,false))
      )}
      {tab==='active'&&(active.length===0
        ?<div style={{textAlign:'center',padding:30,color:'rgba(255,255,255,0.4)'}}><div style={{fontSize:48}}>✅</div><div style={{marginTop:8,fontWeight:700}}>No active tasks</div><div style={{fontSize:12,marginTop:4,opacity:.6}}>Accept tasks from Available tab</div></div>
        :active.map(t=>renderTask(t,true))
      )}
    </div>
  );
}

function PetsScreen({G}){
  const{pets,petInv,adoptPet,feedPet,playPet,coins,T,level}=G;
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
      <TabRow tabs={[['mypets',`My Pets (${pets.length}/${Math.floor(level/2)+2})`],['adopt','Adopt']]} active={view} onSelect={setView} ac={T.primary}/>
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
          <Card key={pt.id} style={{opacity:owned?0.6:1}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{fontSize:42}}>{pt.emoji}</div>
              <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,color:'#111'}}>{pt.name}</div><div style={{fontSize:12,color:'#666',marginBottom:4}}>{pt.bonus}</div><div style={{fontSize:13,fontWeight:700,color:'#b7800a'}}>🪙{pt.cost.toLocaleString()}</div></div>
              {owned?<span style={{background:'#27ae60',color:'#fff',borderRadius:20,padding:'4px 12px',fontSize:12,fontWeight:700}}>Owned</span>:<Btn onClick={()=>adoptPet(pt)} disabled={!canAff||mx||(pets.length>=(Math.floor(level/2)+2))} color={T.primary} style={{fontSize:12,padding:'7px 13px'}}>{mx?'Owned':pets.length>=(Math.floor(level/2)+2)?`Max (Lv${((pets.length-2)*2)+1}+)`:canAff?'Adopt':'Need 🪙'}</Btn>}
            </div>
          </Card>
        );})}
      </>}
    </div>
  );
}

function AnimalsScreen({G}){
  const{ownedAnimals,animalLevels,animalXp,meatInv,collectAnimal,buyAnimal,slaughter,eatMeat,sellMeat,coins,level,T,animalCd}=G;
  const [tab,setTab]=useState('owned');

  const totalOwned=Object.values(ownedAnimals||{}).reduce((sum,amt)=>sum+(amt||0),0);

  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#5d4037,#795548)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>ANIMAL HUSBANDRY</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>🐄 Barn & Herd</div>
        <div style={{fontSize:12,opacity:.75,marginTop:2}}>{totalOwned} animals across {ANIMALS.filter(a=>(ownedAnimals[a.id]||0)>0).length} types · {Object.values(meatInv||{}).reduce((sum,v)=>sum+(v||0),0)} meat stored</div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button onClick={()=>setTab('owned')} style={{flex:1,background:tab==='owned'?T.primary:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:12,padding:'10px 12px',color:'#fff',fontWeight:700,cursor:'pointer'}}>My Herd</button>
        <button onClick={()=>setTab('buy')} style={{flex:1,background:tab==='buy'?T.primary:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:12,padding:'10px 12px',color:'#fff',fontWeight:700,cursor:'pointer'}}>Buy</button>
        <button onClick={()=>setTab('meat')} style={{flex:1,background:tab==='meat'?T.primary:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:12,padding:'10px 12px',color:'#fff',fontWeight:700,cursor:'pointer'}}>Meat</button>
      </div>

      {tab==='owned' && (
        totalOwned===0 ? (
          <Card>
            <div style={{textAlign:'center',padding:'12px 0'}}>
              <div style={{fontSize:42,marginBottom:8}}>🐄</div>
              <div style={{fontWeight:800,fontSize:15,color:'#111'}}>No animals yet</div>
              <div style={{fontSize:12,color:'#666',marginTop:4}}>Buy your first animal to start collecting rewards.</div>
              <button onClick={()=>setTab('buy')} style={{marginTop:10,background:T.primary,color:'#fff',border:'none',borderRadius:10,padding:'8px 14px',fontWeight:800,cursor:'pointer'}}>Buy an Animal</button>
            </div>
          </Card>
        ) : (
          ANIMALS.map(a=>{
            const owned=ownedAnimals[a.id]||0;
            if(owned===0) return null;

            const lvArray=animalLevels[a.id]||Array(owned).fill(1);
            const avgLevel=Math.max(1,Math.round(lvArray.reduce((sum,v)=>sum+v,0)/lvArray.length));
            const xpArray=animalXp[a.id]||Array(owned).fill(0);
            const totalXp=xpArray.reduce((sum,v)=>sum+v,0);
            const resting=!!animalCd?.[a.id];
            const meatCount=meatInv[a.id]||0;

            return(
              <Card key={a.id}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                  <div style={{fontSize:38}}>{a.emoji}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:15,color:'#111'}}>{a.name}</div>
                    <div style={{fontSize:11,color:'#666',marginTop:2}}>Owns {owned} · Avg Lv {avgLevel} · {totalXp} XP</div>
                  </div>
                  <div style={{background:'#f8f8f8',borderRadius:12,padding:'6px 10px',textAlign:'center'}}>
                    <div style={{fontSize:9,color:'#888'}}>Avg Lv</div>
                    <div style={{fontWeight:900,fontSize:14,color:T.primary}}>{avgLevel}</div>
                  </div>
                </div>

                <div style={{display:'flex',gap:8,marginBottom:8}}>
                  <button
                    onClick={()=>collectAnimal(a)}
                    disabled={resting || owned===0}
                    style={{flex:1,background:resting?'#bbb':T.primary,color:'#fff',border:'none',borderRadius:10,padding:'9px 10px',fontWeight:800,cursor:resting?'default':'pointer',fontSize:12}}
                  >
                    {resting?'Resting 1h':a.value===0?'Restore Stamina':'Collect'}
                  </button>
                  <button
                    onClick={()=>buyAnimal(a)}
                    disabled={coins<a.buyCost || totalOwned>=level}
                    style={{flex:1,background:(coins<a.buyCost || totalOwned>=level)?'#bbb':'#27ae60',color:'#fff',border:'none',borderRadius:10,padding:'9px 10px',fontWeight:800,cursor:(coins<a.buyCost || totalOwned>=level)?'default':'pointer',fontSize:12}}
                  >
                    {totalOwned>=level?'Max Herd':coins<a.buyCost?'Need 🪙':'Buy'}
                  </button>
                </div>

                <div style={{display:'flex',gap:8}}>
                  <button
                    onClick={()=>slaughter(a)}
                    disabled={owned<=1}
                    style={{flex:1,background:owned<=1?'#bbb':'#c0392b',color:'#fff',border:'none',borderRadius:10,padding:'9px 10px',fontWeight:800,cursor:owned<=1?'default':'pointer',fontSize:12}}
                  >
                    Slaughter
                  </button>
                  {meatCount>0 && (
                    <>
                      <button
                        onClick={()=>eatMeat(a)}
                        style={{flex:1,background:'#e67e22',color:'#fff',border:'none',borderRadius:10,padding:'9px 10px',fontWeight:800,cursor:'pointer',fontSize:12}}
                      >
                        Eat Meat
                      </button>
                      <button
                        onClick={()=>sellMeat(a)}
                        style={{flex:1,background:'#b7800a',color:'#fff',border:'none',borderRadius:10,padding:'9px 10px',fontWeight:800,cursor:'pointer',fontSize:12}}
                      >
                        Sell Meat
                      </button>
                    </>
                  )}
                </div>

                {resting && (
                  <div style={{fontSize:11,color:'#e67e22',fontWeight:700,marginTop:8}}>This animal is resting and can’t collect yet.</div>
                )}
                {meatCount>0 && (
                  <div style={{fontSize:11,color:'#666',marginTop:8}}>Stored meat: {meatCount}x {a.me || a.emoji}</div>
                )}
              </Card>
            );
          })
        )
      )}

      {tab==='buy' && (
        ANIMALS.map(a=>{
          const owned=ownedAnimals[a.id]||0;
          const canAfford=coins>=a.buyCost;
          const maxed=totalOwned>=level;

          return(
            <Card key={a.id}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{fontSize:38}}>{a.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:15,color:'#111'}}>{a.name}</div>
                  <div style={{fontSize:11,color:'#666',marginTop:2}}>Product: {a.product} · Feed: {a.feedEmoji} {a.feedItem}</div>
                  <div style={{fontSize:12,fontWeight:700,color:'#b7800a',marginTop:4}}>🪙{a.buyCost.toLocaleString()}</div>
                </div>
                <div style={{background:'#f8f8f8',borderRadius:10,padding:'6px 10px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#888'}}>Owned</div>
                  <div style={{fontWeight:900,fontSize:14,color:T.primary}}>{owned}</div>
                </div>
              </div>
              <button
                onClick={()=>buyAnimal(a)}
                disabled={!canAfford || maxed}
                style={{marginTop:10,background:(!canAfford || maxed)?'#bbb':'#27ae60',color:'#fff',border:'none',borderRadius:10,padding:'9px 12px',fontWeight:800, cursor:(!canAfford || maxed)?'default':'pointer', width:'100%', fontSize:12}}
              >
                {!canAfford?'Need 🪙':maxed?'Max Herd Reached':'Buy Animal'}
              </button>
            </Card>
          );
        })
      )}

      {tab==='meat' && (
        ANIMALS.filter(a=>(meatInv[a.id]||0)>0).length===0 ? (
          <Card>
            <div style={{textAlign:'center',padding:'12px 0'}}>
              <div style={{fontSize:42,marginBottom:8}}>🥩</div>
              <div style={{fontWeight:800,fontSize:15,color:'#111'}}>No meat stored</div>
              <div style={{fontSize:12,color:'#666',marginTop:4}}>Slaughter animals to collect meat for stamina or sales.</div>
            </div>
          </Card>
        ) : (
          ANIMALS.filter(a=>(meatInv[a.id]||0)>0).map(a=>{
            const qty=meatInv[a.id]||0;

            return(
              <Card key={a.id}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                  <div style={{fontSize:34}}>{a.me}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:15,color:'#111'}}>{a.meat}</div>
                    <div style={{fontSize:11,color:'#666',marginTop:2}}>Stored from {a.name}</div>
                  </div>
                  <div style={{background:'#f8f8f8',borderRadius:10,padding:'6px 10px',fontWeight:900,color:'#c0392b'}}>×{qty}</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>eatMeat(a)} style={{flex:1,background:'#e67e22',color:'#fff',border:'none',borderRadius:10,padding:'9px 10px',fontWeight:800,cursor:'pointer',fontSize:12}}>Eat Meat</button>
                  <button onClick={()=>sellMeat(a)} style={{flex:1,background:'#27ae60',color:'#fff',border:'none',borderRadius:10,padding:'9px 10px',fontWeight:800,cursor:'pointer',fontSize:12}}>Sell Meat</button>
                </div>
              </Card>
            );
          })
        )
      )}
    </div>
  );
}

function CollectionsScreen({G}){
  const{collected,T}=G;
  const allItems=[...CROPS.map(c=>({id:c.id,name:c.name,emoji:c.emoji,cat:'Crops'})),...MINERALS.map(m=>({id:m.id,name:m.name,emoji:m.emoji,cat:'Minerals'})),...RECIPES.map(r=>({id:r.id,name:r.name,emoji:r.emoji,cat:'Crafted'})),...KITCHEN_RECIPES.map(r=>({id:r.id,name:r.name,emoji:r.emoji,cat:'Cooked'})),...FISH.map(f=>({id:f.id,name:f.name,emoji:f.emoji,cat:'Fish'}))];
  const total=collected.length,max=allItems.length;
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#16a085,#1abc9c)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>COLLECTION BOOK</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>📖 {total}/{max} Discovered</div>
        <div style={{height:6,background:'rgba(255,255,255,.3)',borderRadius:3,overflow:'hidden',marginTop:6}}><div style={{height:'100%',width:`${(total/max)*100}%`,background:'#fff',borderRadius:3}}/></div>
      </div>
      {['Crops','Minerals','Crafted','Fish'].map(cat=>{
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
  const{T,level,totalEarned,hardTasks,goldenHarv,animalTypes,totalHarv,minedTotal,totalFishCaught,earn,setXp,notify,collected}=G;
  const[claimed,setClaimed]=useState(()=>{try{return JSON.parse(localStorage.getItem('hh_goals_claimed')||'[]');}catch{return[];}});
  const vals={level,totalEarned,hardTasks,goldenHarv,animalTypes:animalTypes?.size||0,totalHarv:totalHarv||0,minedTotal:minedTotal||0,totalFishCaught:totalFishCaught||0};

  const claimGoal=(g)=>{
    earn(g.reward);
    setXp(x=>x+Math.floor(g.reward/10));
    const nc=[...claimed,g.id];
    setClaimed(nc);
    localStorage.setItem('hh_goals_claimed',JSON.stringify(nc));
    notify(`🏆 ${g.name} complete! +🪙${g.reward.toLocaleString()}`,'gold');
  };

  const completed=LONG_GOALS.filter(g=>(vals[g.key]||0)>=g.target);
  const inProgress=LONG_GOALS.filter(g=>(vals[g.key]||0)<g.target);
  const unclaimed=completed.filter(g=>!claimed.includes(g.id));

  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#f39c12dd,#e67e22cc)',backdropFilter:'blur(8px)',borderRadius:20,padding:16,marginBottom:14,color:'#fff',border:'1px solid rgba(255,255,255,0.15)'}}>
        <div style={{fontSize:11,opacity:.8,letterSpacing:1,fontWeight:800,textTransform:'uppercase',marginBottom:2}}>Achievements</div>
        <div style={{fontSize:22,fontWeight:900,letterSpacing:-.3}}>🏆 Long-Term Goals</div>
        <div style={{fontSize:12,opacity:.75,marginTop:2}}>{completed.length}/{LONG_GOALS.length} complete · {unclaimed.length} to claim</div>
      </div>
      {unclaimed.length>0&&<>
        <div style={{fontSize:10,fontWeight:900,color:'rgba(255,255,255,0.6)',letterSpacing:2,marginBottom:8,textTransform:'uppercase'}}>Ready to Claim!</div>
        {unclaimed.map(g=>(
          <Card key={g.id} style={{border:'2px solid #f39c12'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{fontSize:32}}>{g.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:900,fontSize:15}}>{g.name}</div>
                <div style={{fontSize:12,color:'#666'}}>{g.desc}</div>
              </div>
              <div style={{fontWeight:900,color:'#f39c12',fontSize:14}}>🪙{g.reward.toLocaleString()}</div>
            </div>
            <Btn onClick={()=>claimGoal(g)} color='#f39c12' style={{width:'100%',padding:10,fontSize:13}}>Claim Reward!</Btn>
          </Card>
        ))}
      </>}
      <div style={{fontSize:10,fontWeight:900,color:'rgba(255,255,255,0.5)',letterSpacing:2,marginBottom:8,textTransform:'uppercase',marginTop:unclaimed.length?12:0}}>In Progress</div>
      {inProgress.map(g=>{
        const cur=vals[g.key]||0;
        const pct=Math.min(100,(cur/g.target)*100);
        return(
          <Card key={g.id}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{fontSize:28}}>{g.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:14}}>{g.name}</div>
                <div style={{fontSize:11,color:'#666'}}>{g.desc}</div>
              </div>
              <div style={{fontWeight:800,color:'#f39c12',fontSize:12}}>🪙{g.reward.toLocaleString()}</div>
            </div>
            <div style={{background:'rgba(0,0,0,0.07)',borderRadius:20,height:7,marginBottom:4}}>
              <div style={{background:T.primary,height:7,borderRadius:20,width:`${pct}%`,transition:'width .5s',boxShadow:`0 0 6px ${T.primary}66`}}/>
            </div>
            <div style={{fontSize:10,color:'#888',display:'flex',justifyContent:'space-between'}}>
              <span>{cur.toLocaleString()} / {g.target.toLocaleString()}</span>
              <span>{pct.toFixed(1)}%</span>
            </div>
          </Card>
        );
      })}
      {completed.filter(g=>claimed.includes(g.id)).length>0&&<>
        <div style={{fontSize:10,fontWeight:900,color:'rgba(255,255,255,0.35)',letterSpacing:2,marginBottom:8,textTransform:'uppercase',marginTop:12}}>Completed</div>
        {completed.filter(g=>claimed.includes(g.id)).map(g=>(
          <Card key={g.id} style={{opacity:.5}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:24}}>{g.emoji}</div>
              <div style={{flex:1,fontSize:13,fontWeight:700,color:'#444'}}>{g.name}</div>
              <div style={{fontSize:12,color:'#27ae60',fontWeight:800}}>✅ Done</div>
            </div>
          </Card>
        ))}
      </>}
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
  const allL=[...CROPS.filter(c=>(silo[c.id]||0)>0).map(c=>({id:c.id,name:c.name,emoji:c.emoji,type:'silo'})),...MINERALS.filter(m=>(minerals[m.id]||0)>0).map(m=>({id:m.id,name:m.name,emoji:m.emoji,type:'mineral'}))];
  const valid=listings.filter(l=>l.expiresAt>Date.now());
  const mine=valid.filter(l=>l.sellerId===playerId);
  const others=valid.filter(l=>l.sellerId!==playerId);
  return(
    <div style={{padding:14}}>
      <TabRow tabs={[['browse','Browse'],['sell','Sell Items'],['npc','NPC Market']]} active={tab} onSelect={setTab} ac='#2980b9'/>
      {tab==='browse'&&<>{others.length===0&&mine.length===0?<div style={{textAlign:'center',padding:30,color:'#aaa'}}><div style={{fontSize:40}}>🏪</div><div style={{fontWeight:700,color:'#888',marginTop:8}}>No listings yet</div><div style={{fontSize:12,marginTop:4}}>Go to Sell tab to list your items</div></div>:others.map(l=>(<Card key={l.id}><div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:30}}>{l.emoji}</span><div style={{flex:1}}><div style={{fontWeight:800,fontSize:14,color:'#111'}}>{l.name} x{l.qty}</div><div style={{fontSize:11,color:'#888'}}>From: {l.seller}</div><div style={{fontSize:12,color:'#b7800a',fontWeight:700}}>🪙{l.price} each · Total: 🪙{(l.price*l.qty).toLocaleString()}</div></div><Btn onClick={()=>buyListing(l)} disabled={coins<l.price*l.qty} style={{fontSize:12,padding:'7px 11px',flexShrink:0}}>Buy</Btn></div></Card>))}
        {mine.length>0&&<><SecHead label="YOUR LISTINGS"/>{mine.map(l=><Card key={l.id} style={{border:'1px solid #c3e6cb'}}><div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:28}}>{l.emoji}</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:'#111'}}>{l.name} x{l.qty}</div><div style={{fontSize:11,color:'#27ae60',fontWeight:700}}>Listed 🪙{l.price} each</div></div></div></Card>)}</>}
      </>}
      {tab==='sell'&&<>{allL.length===0?<div style={{textAlign:'center',padding:30,color:'#aaa'}}><div style={{fontSize:40}}>📦</div><div style={{fontWeight:700,color:'#888',marginTop:8}}>No items to list</div><div style={{fontSize:12,marginTop:4}}>Harvest crops or mine minerals first</div></div>:<Card>
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
  const{stallCfg,setStall,notify,silo,minerals,addListing,listings,playerId,farmName,allStalls,coins,T}=G;
  const[tab,setTab]=useState('market');
  const[selItem,setSelItem]=useState('');
  const[qty,setQty]=useState(1);
  const[price,setPrice]=useState(10);
  const[visiting,setVisiting]=useState(null);
  const myListings=listings.filter(l=>l.sellerId===playerId);
  const theme=STALL_THEMES.find(t=>t.id===stallCfg.theme)||STALL_THEMES[0];
  const allSellable=[
    ...CROPS.filter(c=>(silo[c.id]||0)>0).map(c=>({id:c.id,name:c.name,emoji:c.emoji,type:'silo',stock:silo[c.id]||0})),
    ...MINERALS.filter(m=>(minerals[m.id]||0)>0).map(m=>({id:m.id,name:m.name,emoji:m.emoji,type:'mineral',stock:minerals[m.id]||0})),
  ];
  if(visiting)return<VisitStallScreen stall={visiting} onClose={()=>setVisiting(null)} G={G}/>;
  return(
    <div style={{padding:14}}>
      <div style={{background:theme.color,borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.8,letterSpacing:1,fontWeight:700}}>MARKET</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>🏪 {stallCfg.name}</div>
        <div style={{fontSize:12,opacity:.85}}>{myListings.length} listed · {allStalls.length} other stalls open</div>
      </div>
      <TabRow tabs={[['market','🏘️ Market'],['sell','+ List Item'],['my','My Listings'],['setup','⚙️ Setup']]} active={tab} onSelect={setTab} ac={theme.color}/>

      {tab==='market'&&<>
        {allStalls.length===0&&myListings.length===0
          ?<div style={{textAlign:'center',padding:30,color:'#aaa'}}><div style={{fontSize:48}}>🛖</div><div style={{fontWeight:700,marginTop:8}}>No stalls open yet</div><div style={{fontSize:12,marginTop:4}}>List your first item to get started!</div></div>
          :<>
            {/* Own listings first */}
            {myListings.length>0&&<>
              <div style={{fontSize:11,fontWeight:800,color:'#888',marginBottom:6,paddingLeft:2}}>YOUR LISTINGS</div>
              {myListings.map(l=>(
                <Card key={l.id}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{fontSize:26}}>{l.emoji}</div>
                    <div style={{flex:1}}><div style={{fontWeight:700}}>{l.name} ×{l.qty}</div><div style={{fontSize:11,color:'#888'}}>🪙{l.price} each</div></div>
                    <div style={{fontWeight:800,color:'#f39c12'}}>🪙{(l.price*l.qty).toLocaleString()}</div>
                  </div>
                </Card>
              ))}
            </>}
            {/* Other stalls */}
            {allStalls.length>0&&<>
              <div style={{fontSize:11,fontWeight:800,color:'#888',marginBottom:6,paddingLeft:2,marginTop:8}}>FRIEND STALLS</div>
              {allStalls.map(stall=>{const st=STALL_THEMES.find(t=>t.id===stall.theme)||STALL_THEMES[0];return(
                <Card key={stall.playerId}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:44,height:44,background:st.color,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🏪</div>
                    <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14}}>{stall.name}</div><div style={{fontSize:11,color:'#777'}}>by {stall.farmName} · {stall.listings?.length||0} items</div></div>
                    <Btn onClick={()=>setVisiting(stall)} color={st.color} style={{fontSize:12,padding:'8px 12px'}}>Visit</Btn>
                  </div>
                </Card>
              );})}
            </>}
          </>
        }
      </>}

      {tab==='sell'&&<Card>
        <div style={{fontSize:13,fontWeight:800,marginBottom:10}}>Select item to list</div>
        {allSellable.length===0
          ?<div style={{textAlign:'center',padding:20,color:'#aaa'}}>Harvest crops or mine minerals first!</div>
          :<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
            {allSellable.map(i=>(
              <button key={i.id} onClick={()=>setSelItem(i.id)} style={{background:selItem===i.id?theme.color:'#f5f5f5',color:selItem===i.id?'#fff':'#333',border:`2px solid ${selItem===i.id?theme.color:'#eee'}`,borderRadius:10,padding:'6px 10px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                {i.emoji} {i.name} ({i.stock})
              </button>
            ))}
          </div>
        }
        {selItem&&<>
          <div style={{display:'flex',gap:8,marginBottom:10}}>
            <div style={{flex:1}}><div style={{fontSize:11,color:'#888',marginBottom:4}}>Qty</div><input type="number" value={qty} onChange={e=>setQty(Math.max(1,+e.target.value))} min={1} style={{width:'100%',border:'1.5px solid #eee',borderRadius:8,padding:8,fontSize:13,boxSizing:'border-box'}}/></div>
            <div style={{flex:1}}><div style={{fontSize:11,color:'#888',marginBottom:4}}>Price each 🪙</div><input type="number" value={price} onChange={e=>setPrice(Math.max(1,+e.target.value))} min={1} style={{width:'100%',border:'1.5px solid #eee',borderRadius:8,padding:8,fontSize:13,boxSizing:'border-box'}}/></div>
          </div>
          <Btn onClick={()=>{const item=allSellable.find(i=>i.id===selItem);if(!item)return;if(qty>item.stock){notify(`Only ${item.stock} available!`,'orange');return;}addListing(selItem,qty,price,item.type,item.emoji,item.name);setSelItem('');setQty(1);setPrice(10);setTab('my');}} color={theme.color} style={{width:'100%',padding:11}}>List in Stall</Btn>
        </>}
      </Card>}

      {tab==='my'&&(myListings.length===0
        ?<div style={{textAlign:'center',padding:30,color:'#aaa'}}><div style={{fontSize:40}}>📭</div><div style={{marginTop:8,fontWeight:700}}>Nothing listed yet</div></div>
        :myListings.map(l=>(
          <Card key={l.id}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:28}}>{l.emoji}</div>
              <div style={{flex:1}}><div style={{fontWeight:800}}>{l.name}</div><div style={{fontSize:11,color:'#888'}}>×{l.qty} · 🪙{l.price} each</div><div style={{fontSize:10,color:'#aaa'}}>Expires {new Date(l.expiresAt).toLocaleDateString()}</div></div>
              <div style={{fontWeight:800,color:'#f39c12'}}>🪙{(l.price*l.qty).toLocaleString()}</div>
            </div>
          </Card>
        ))
      )}

      {tab==='setup'&&<>
        {[['Stall Name','name',30,false],['Welcome Message','welcome',80,true],['Goodbye Message','goodbye',80,true]].map(([lb,key,mx,multi])=>(
          <Card key={key}>
            <div style={{fontSize:12,fontWeight:800,marginBottom:6}}>{lb}</div>
            {multi?<textarea value={stallCfg[key]} onChange={e=>setStall(s=>({...s,[key]:e.target.value.slice(0,mx)}))} rows={2} style={{width:'100%',padding:'8px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',resize:'none',boxSizing:'border-box'}}/>:<input value={stallCfg[key]} onChange={e=>setStall(s=>({...s,[key]:e.target.value.slice(0,mx)}))} style={{width:'100%',padding:'8px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',boxSizing:'border-box'}}/>}
          </Card>
        ))}
        <Card>
          <div style={{fontSize:12,fontWeight:800,marginBottom:8}}>Theme</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            {STALL_THEMES.map(t=><button key={t.id} onClick={()=>setStall(s=>({...s,theme:t.id}))} style={{background:stallCfg.theme===t.id?t.color:'#f5f5f5',color:stallCfg.theme===t.id?'#fff':'#333',border:`2px solid ${stallCfg.theme===t.id?t.color:'#eee'}`,borderRadius:12,padding:'7px 10px',fontSize:12,cursor:'pointer',fontWeight:600}}>{t.label}</button>)}
          </div>
        </Card>
        <Btn onClick={()=>{setStall(s=>({...s}));notify('Stall saved! ✅','green');}} style={{width:'100%',padding:12}}>Save Stall</Btn>
      </>}
    </div>
  );
}

function BankScreen({G}){
  const{coins,earn,spend,notify,bankBal,setBankBal,loanDebt,takeEmergencyLoan,setLoanDebt,upgrades,goldGrowthBal,setGGB,goldGrowth,setGG,goldHeld,jointBal,setJB,poolTotal,myPoolShare,farmName,playerId}=G;
  const[tab,setTab]=useState('savings');
  const[amt,setAmt]=useState('');
  const[jAmt,setJAmt]=useState('');
  const[lAmt,setLA]=useState('');
  const[eLoan,setEL]=useState('');
  const profitRate=upgrades.premiumBank?.08:.05;
  const myDailyReturn=poolTotal>0&&jointBal>0?Math.floor(poolTotal*0.02*(jointBal/poolTotal)):0;

  const deposit=()=>{const n=parseInt(amt);if(!n||n<=0||n>coins){notify('Invalid amount!','orange');return;}spend(n);setBankBal(b=>b+n);setAmt('');notify(`Deposited 🪙${n.toLocaleString()}!`,'green');};
  const withdraw=()=>{if(!bankBal){notify('Nothing to withdraw!','orange');return;}const p=Math.floor(bankBal*profitRate);earn(bankBal+p);notify(`Withdrew 🪙${(bankBal+p).toLocaleString()} (+🪙${p} profit!)`,'gold');setBankBal(0);};
  const repayLoan=()=>{const repay=Math.min(loanDebt,coins);if(!repay){notify('No loan!','orange');return;}spend(repay);setLoanDebt(0);notify(`Loan repaid! 🪙${repay}`,'green');};
  const poolCoins=async()=>{
    const n=parseInt(jAmt);
    if(!n||n<=0||n>coins){notify('Invalid!','orange');return;}
    spend(n);setJB(b=>b+n);setJAmt('');
    notify(`🪙${n.toLocaleString()} pooled with all players! 🌍`,'green');
    // Post global event
    if(db){
      const evId=`pool_${Date.now()}_${playerId}`;
      try{await set(ref(db,`globalevents/${evId}`),{type:'pool',farm:farmName,amount:n,time:Date.now()});}catch{}
    }
  };
  const withdrawPool=()=>{if(!jointBal){notify('Nothing pooled!','orange');return;}earn(jointBal);setJB(0);if(db)set(ref(db,`jointfund/${playerId}`),null).catch(()=>{});notify(`Withdrew 🪙${jointBal.toLocaleString()} from pool`,'gold');};
  const claimDailyProfit=()=>{
    const today=todayStr();
    const lastDist=localStorage.getItem('hh_lastdist');
    if(lastDist===today){notify('Already claimed today! Come back tomorrow 🌅','orange');return;}
    if(!jointBal||myDailyReturn<=0){notify('Pool something first to earn daily profit!','orange');return;}
    earn(myDailyReturn);
    localStorage.setItem('hh_lastdist',today);
    notify(`🏦 Daily pool profit: +🪙${myDailyReturn.toLocaleString()}!`,'gold');
  };

  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#1a3a50,#2471a3)',borderRadius:20,padding:18,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>HARVEST HAVEN BANK</div>
        <div style={{fontSize:28,fontWeight:800,margin:'4px 0'}}>🪙 {bankBal.toLocaleString()}</div>
        <div style={{fontSize:11,opacity:.75}}>{(profitRate*100).toFixed(0)}% profit share{upgrades.premiumBank?' (Premium)':''} · Pool: 🪙{poolTotal.toLocaleString()}</div>
      </div>

      {loanDebt>0&&<div style={{background:'linear-gradient(135deg,#e74c3c,#c0392b)',borderRadius:14,padding:'10px 16px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:12,fontWeight:800,color:'#fff'}}>Active Emergency Loan</div><div style={{fontSize:11,color:'rgba(255,255,255,.8)'}}>10% auto-debiting</div></div>
        <div style={{textAlign:'right'}}><div style={{fontSize:16,fontWeight:800,color:'#fff'}}>🪙{loanDebt} left</div><button onClick={repayLoan} style={{background:'rgba(255,255,255,.2)',color:'#fff',border:'1px solid rgba(255,255,255,.4)',borderRadius:10,padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer',marginTop:4}}>Repay Now</button></div>
      </div>}

      <TabRow tabs={[['savings','💰 Savings'],['pool','🌍 Global Pool'],['loans','🤝 Loans']]} active={tab} onSelect={setTab} ac='#1a5276'/>

      {tab==='savings'&&<>
        <Card>
          <div style={{fontWeight:800,fontSize:14,color:'#1a3a50',marginBottom:6}}>Profit Share Account</div>
          <div style={{fontSize:11,color:'#777',marginBottom:10,lineHeight:1.5}}>Deposit coins, earn {(profitRate*100).toFixed(0)}% profit share. Withdraw anytime with profits.</div>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <input value={amt} onChange={e=>setAmt(e.target.value)} type="number" placeholder='Amount...' style={{flex:1,padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',color:'#333'}}/>
            <Btn onClick={deposit}>Deposit</Btn>
          </div>
          {bankBal>0&&<>
            <div style={{background:'#e8f4f8',borderRadius:12,padding:'9px 14px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span style={{color:'#555'}}>Balance</span><span style={{fontWeight:800,color:'#1a3a50'}}>🪙{bankBal.toLocaleString()}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginTop:4}}><span style={{color:'#888'}}>Profit ({(profitRate*100).toFixed(0)}%)</span><span style={{fontWeight:700,color:'#27ae60'}}>+🪙{Math.floor(bankBal*profitRate).toLocaleString()}</span></div>
            </div>
            <Btn onClick={withdraw} color='#e67e22' style={{width:'100%',padding:10}}>Withdraw + Claim Profit</Btn>
          </>}
        </Card>
        {upgrades.goldVault&&<Card>
          <div style={{fontWeight:800,fontSize:13,color:'#b7800a',marginBottom:6}}>💛 Gold Growth Account</div>
          <div style={{fontSize:11,color:'#777',marginBottom:8,lineHeight:1.5}}>Deposit gold and earn 2% returns every 2 minutes.</div>
          <div style={{background:'#fff9e6',borderRadius:12,padding:'8px 12px',marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span>Deposited</span><span style={{fontWeight:800,color:'#b7800a'}}>{goldGrowthBal}g</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginTop:3}}><span>Returns</span><span style={{fontWeight:700,color:'#27ae60'}}>+{goldGrowth}g</span></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn onClick={()=>{if(goldHeld<=0){notify('No gold!','orange');return;}setGGB(b=>+(b+goldHeld).toFixed(2));G.setGold&&G.setGold(0);notify(`Deposited ${goldHeld}g!`,'gold');}} color='#b7800a' style={{flex:1,padding:9,fontSize:12}}>Deposit ({goldHeld}g)</Btn>
            {goldGrowthBal>0&&<Btn onClick={()=>{const tot=+(goldGrowthBal+goldGrowth).toFixed(2);earn(Math.floor(tot*G.goldPrice));setGGB(0);setGG(0);notify(`Withdrew ${tot}g!`,'gold');}} style={{flex:1,padding:9,fontSize:12}}>Withdraw</Btn>}
          </div>
        </Card>}
      </>}

      {tab==='pool'&&<>
        <div style={{background:'linear-gradient(135deg,#16a085,#1abc9c)',borderRadius:16,padding:14,marginBottom:12,color:'#fff'}}>
          <div style={{fontSize:11,opacity:.8,letterSpacing:1,fontWeight:700}}>GLOBAL POOL</div>
          <div style={{fontSize:24,fontWeight:900,margin:'4px 0'}}>🌍 🪙{poolTotal.toLocaleString()}</div>
          <div style={{fontSize:12,opacity:.85}}>All players pooled · Daily profit distributed</div>
          <div style={{background:'rgba(255,255,255,.2)',borderRadius:10,height:8,marginTop:8}}>
            <div style={{background:'#fff',height:8,borderRadius:10,width:`${Math.min(100,poolTotal/10000*100)}%`}}/>
          </div>
        </div>
        <Card>
          <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>Your Contribution</div>
          <div style={{fontSize:11,color:'#777',marginBottom:10,lineHeight:1.5}}>Pool coins with ALL players worldwide. Pool earns 2% daily. You receive your share every 24hrs. The more pooled by everyone, the bigger the daily payout.</div>
          <div style={{background:'#e8f8f5',borderRadius:12,padding:10,marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:3}}><span style={{color:'#555'}}>Your pool</span><span style={{fontWeight:800,color:'#16a085'}}>🪙{jointBal.toLocaleString()}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}><span style={{color:'#888'}}>Your share</span><span style={{fontWeight:700,color:'#16a085'}}>{poolTotal>0?((jointBal/poolTotal)*100).toFixed(1):0}%</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'#888'}}>Daily profit est.</span><span style={{fontWeight:700,color:'#27ae60'}}>🪙{myDailyReturn.toLocaleString()}</span></div>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <input value={jAmt} onChange={e=>setJAmt(e.target.value)} type="number" placeholder='Amount to pool...' style={{flex:1,padding:'8px 12px',borderRadius:10,border:'1.5px solid #ddd',fontSize:13,outline:'none',color:'#333'}}/>
            <Btn onClick={poolCoins} color='#16a085' style={{fontSize:12,padding:'7px 12px'}}>Pool</Btn>
          </div>
          {jointBal>0&&<div style={{display:'flex',gap:8}}>
            <Btn onClick={claimDailyProfit} color='#f39c12' style={{flex:2,padding:10,fontSize:13}}>Claim Daily Profit 🪙{myDailyReturn}</Btn>
            <Btn onClick={withdrawPool} color='#e74c3c' style={{flex:1,padding:10,fontSize:12}}>Withdraw</Btn>
          </div>}
        </Card>
      </>}

      {tab==='loans'&&<>
        <Card>
          <div style={{fontWeight:800,fontSize:13,color:'#e74c3c',marginBottom:6}}>🆘 Emergency Loan</div>
          <div style={{fontSize:11,color:'#777',marginBottom:8,lineHeight:1.5}}>Cap 🪙500. No fee. 10% of earnings auto-debits until repaid.</div>
          {loanDebt>0?<div style={{background:'#fff5f5',borderRadius:12,padding:'8px 12px',fontSize:12,color:'#c0392b',fontWeight:700,textAlign:'center'}}>Active: 🪙{loanDebt} remaining</div>:<>
            <div style={{display:'flex',gap:8}}>
              <input value={eLoan} onChange={e=>setEL(e.target.value)} type="number" placeholder='Amount (max 500)' max="500" style={{flex:1,padding:'8px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',color:'#333'}}/>
              <Btn onClick={()=>{const n=parseInt(eLoan);takeEmergencyLoan(n);setEL('');}} color='#e74c3c' style={{fontSize:12,padding:'8px 12px'}}>Apply</Btn>
            </div>
          </>}
        </Card>
        {[{label:'Equipment Loan',desc:'Buy machinery or upgrades',fee:.08,icon:'🏗️'},{label:'Seed & Supply Loan',desc:'Fund seeds and supplies',fee:.05,icon:'🌱'},{label:'Expansion Loan',desc:'Fund land purchases',fee:.10,icon:'🌍'}].map((l,i)=>(
          <Card key={i}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}><span style={{fontSize:26}}>{l.icon}</span><div style={{flex:1}}><div style={{fontWeight:800,fontSize:13}}>{l.label}</div><div style={{fontSize:11,color:'#777'}}>{l.desc} · Fee: {(l.fee*100).toFixed(0)}%</div></div></div>
            <div style={{display:'flex',gap:8}}>
              <input value={lAmt} onChange={e=>setLA(e.target.value)} type="number" placeholder='Amount...' style={{flex:1,padding:'8px 12px',borderRadius:10,border:'1.5px solid #ddd',fontSize:13,outline:'none',color:'#333'}}/>
              <Btn onClick={()=>{const n=parseInt(lAmt);if(!n||n<=0){notify('Enter amount!','orange');return;}const f=Math.round(n*l.fee);earn(n);spend(f);setLA('');notify(`Loan 🪙${n} approved. Fee 🪙${f} deducted.`,'blue');}} color='#1a5276' style={{fontSize:12,padding:'7px 12px'}}>Apply</Btn>
            </div>
            {lAmt&&parseInt(lAmt)>0&&<div style={{fontSize:11,color:'#777',marginTop:5}}>Receive 🪙{parseInt(lAmt)||0} · Fee 🪙{Math.round((parseInt(lAmt)||0)*l.fee)}</div>}
          </Card>
        ))}
      </>}
    </div>
  );
}


function FinanceScreen({G}){
  const{coins,bankBal,goldHeld,goldPrice,totalEarned,todayEarned,todaySpent,loanDebt,jointBal,poolTotal,level,farmName,playerId,T}=G;
  const[tab,setTab]=useState('overview');
  const[leaderboard,setLeaderboard]=useState([]);

  // Load leaderboard from Firebase
  useEffect(()=>{
    if(!db)return;
    const unsub=onValue(ref(db,'leaderboard'),sn=>{
      if(sn.exists()){
        const data=Object.values(sn.val()).sort((a,b)=>b.totalEarned-a.totalEarned).slice(0,20);
        setLeaderboard(data);
      }
    });
    return()=>unsub();
  },[]);

  // Push own stats
  useEffect(()=>{
    if(!db||!playerId)return;
    set(ref(db,`leaderboard/${playerId}`),{farmName,level,totalEarned,coins,playerId,time:Date.now()}).catch(()=>{});
  },[totalEarned,level,coins,farmName,playerId]);

  const netWorth=coins+bankBal+Math.floor(goldHeld*goldPrice)-loanDebt+jointBal;
  const rows=[
    ['💰 Coins in hand',`🪙${coins.toLocaleString()}`],
    ['🏦 Bank balance',`🪙${bankBal.toLocaleString()}`],
    ['🥇 Gold value',`🪙${Math.floor(goldHeld*goldPrice).toLocaleString()}`],
    ['🌍 Pooled funds',`🪙${jointBal.toLocaleString()}`],
    ['📈 Total earned',`🪙${totalEarned.toLocaleString()}`],
    ['📅 Earned today',`🪙${todayEarned.toLocaleString()}`],
    ['📅 Spent today',`🪙${todaySpent.toLocaleString()}`],
    ['⚠️ Loan debt',loanDebt?`🪙${loanDebt}`:'None'],
  ];

  return(
    <div style={{padding:14}}>
      <div style={{background:`linear-gradient(135deg,#1a6b2add,#27ae60cc)`,backdropFilter:'blur(8px)',borderRadius:20,padding:16,marginBottom:14,color:'#fff',border:'1px solid rgba(255,255,255,0.15)'}}>
        <div style={{fontSize:11,opacity:.8,letterSpacing:1,fontWeight:800,textTransform:'uppercase',marginBottom:2}}>Finance</div>
        <div style={{fontSize:22,fontWeight:900,letterSpacing:-.3}}>💰 Dashboard</div>
        <div style={{fontSize:13,opacity:.85,marginTop:4}}>Net Worth: <span style={{fontWeight:900,color:'#ffd700'}}>🪙{netWorth.toLocaleString()}</span></div>
      </div>
      <TabRow tabs={[['overview','📊 Overview'],['leaderboard','🏆 Top Farmers']]} active={tab} onSelect={setTab} ac='#27ae60'/>

      {tab==='overview'&&rows.map(([k,v])=>(
        <Card key={k}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:13,color:'#555'}}>{k}</div>
            <div style={{fontWeight:900,fontSize:14,color:T.primary}}>{v}</div>
          </div>
        </Card>
      ))}

      {tab==='leaderboard'&&<>
        <div style={{background:'linear-gradient(135deg,#f39c12,#e67e22)',borderRadius:16,padding:12,marginBottom:12,color:'#fff',textAlign:'center'}}>
          <div style={{fontSize:11,opacity:.8,letterSpacing:1,fontWeight:800,textTransform:'uppercase'}}>Global Rankings</div>
          <div style={{fontSize:16,fontWeight:900,marginTop:2}}>Top Farmers Worldwide 🌍</div>
        </div>
        {leaderboard.length===0&&<div style={{textAlign:'center',padding:30,color:'rgba(255,255,255,0.4)'}}><div style={{fontSize:48}}>🏆</div><div style={{fontWeight:700,marginTop:8}}>Loading rankings...</div></div>}
        {leaderboard.map((p,i)=>{
          const medals=['🥇','🥈','🥉'];
          const isMe=p.playerId===playerId;
          return(
            <Card key={p.playerId} style={isMe?{border:'2px solid #f39c12'}:{}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{fontSize:24,width:36,textAlign:'center'}}>{medals[i]||`#${i+1}`}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:900,fontSize:14}}>{p.farmName}{isMe?' (You)':''}</div>
                  <div style={{fontSize:11,color:'#888'}}>Level {p.level||1}</div>
                </div>
                <div style={{fontWeight:900,color:'#f39c12',fontSize:13}}>🪙{(p.totalEarned||0).toLocaleString()}</div>
              </div>
            </Card>
          );
        })}
      </>}
    </div>
  );
}

function GarageScreen({G}){
  const{upgrades,buyUpgrade,coins,T,mach,fuel,buyMach,upgMach,toggleMach,repairMach,buyFuelF,MACH_DEF,FUEL_SHOP}=G;
  const[tab,setTab]=useState('machines');
  const maxFuel=upgrades.fuelTank3?1000:upgrades.fuelTank2?500:200;
  const fuelPct=Math.min(100,(fuel/maxFuel)*100);
  const fuelCol=fuel>maxFuel*0.5?'#27ae60':fuel>maxFuel*0.2?'#f39c12':'#e74c3c';
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#37474f,#546e7a)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>GARAGE & UPGRADES</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>🔧 Machines & Upgrades</div>
        <div style={{marginTop:8}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,opacity:.85,marginBottom:4}}>
            <span>⛽ Fuel Tank</span>
            <span style={{fontWeight:800,color:fuel<maxFuel*0.2?'#ffcccc':'#fff'}}>{fuel.toFixed(0)}/{maxFuel} {fuel<maxFuel*0.2?'⚠️ LOW':fuel===0?'🚨 EMPTY':''}</span>
          </div>
          <div style={{background:'rgba(255,255,255,.2)',borderRadius:20,height:10}}>
            <div style={{background:fuelCol,height:10,borderRadius:20,width:`${fuelPct}%`,transition:'width .5s'}}/>
          </div>
        </div>
      </div>
      <TabRow tabs={[['machines','🚜 Machines'],['fuel','⛽ Fuel'],['upgrades','⬆️ Upgrades']]} active={tab} onSelect={setTab} ac='#546e7a'/>

      {tab==='machines'&&Object.entries(MACH_DEF).map(([id,def])=>{
        const m=mach[id];
        const tier=def.tiers[m.tier];
        const maxTier=def.tiers.length-1;
        const durCol=m.dur>60?'#27ae60':m.dur>25?'#f39c12':'#e74c3c';
        return(
          <Card key={id}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{fontSize:36}}>{def.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:15}}>{def.name}</div>
                <div style={{fontSize:11,color:'#888'}}>{def.desc}</div>
                {m.owned&&<div style={{display:'flex',gap:8,marginTop:4,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:11,fontWeight:700,color:T.primary}}>{tier.l}</span>
                  <span style={{fontSize:11,color:durCol,fontWeight:700}}>Dur: {Math.round(m.dur)}%</span>
                  <span style={{fontSize:11,color:m.active?'#27ae60':'#aaa',fontWeight:700}}>{m.active?'🟢 Running':'⚫ Idle'}</span>
                  {m.active&&<span style={{fontSize:10,color:'#888'}}>⛽{tier.f}/cycle (only when working)</span>}
                </div>}
              </div>
            </div>
            {m.owned&&<div style={{marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#aaa',marginBottom:2}}><span>Durability</span><span>{Math.round(m.dur)}%</span></div>
              <div style={{background:'#eee',borderRadius:10,height:6}}><div style={{background:durCol,height:6,borderRadius:10,width:`${m.dur}%`,transition:'width .3s'}}/></div>
            </div>}
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {!m.owned&&<Btn onClick={()=>buyMach(id)} color={T.primary} style={{flex:1,padding:9,fontSize:12}}>Buy 🪙{def.cost.toLocaleString()}</Btn>}
              {m.owned&&<Btn onClick={()=>toggleMach(id)} color={m.active?'#e74c3c':'#27ae60'} style={{flex:1,padding:9,fontSize:12}}>{m.active?'Stop ⏹':'Start ▶'}</Btn>}
              {m.owned&&m.tier<maxTier&&<Btn onClick={()=>upgMach(id)} color='#f39c12' style={{flex:1,padding:9,fontSize:12}}>→{def.tiers[m.tier+1]?.l} 🪙{(def.upg[m.tier+1]||0).toLocaleString()}</Btn>}
              {m.owned&&m.dur<50&&<Btn onClick={()=>repairMach(id)} color='#e74c3c' style={{flex:1,padding:9,fontSize:12}}>Repair 🪙200</Btn>}
              {m.owned&&m.tier>=maxTier&&<div style={{flex:1,background:'#f0fff4',borderRadius:10,padding:9,textAlign:'center',fontSize:12,fontWeight:700,color:'#27ae60'}}>✅ Max Tier</div>}
            </div>
          </Card>
        );
      })}

      {tab==='fuel'&&<>
        <Card>
          <div style={{textAlign:'center',marginBottom:12}}>
            <div style={{fontSize:48}}>⛽</div>
            <div style={{fontSize:28,fontWeight:900,color:fuelCol}}>{fuel.toFixed(0)}</div>
            <div style={{fontSize:12,color:'#888'}}>out of {maxFuel} units{upgrades.fuelTank3?' (Mega Tank 🏭)':upgrades.fuelTank2?' (Large Tank)':' (Standard)'}</div>
          </div>
          <div style={{background:'#eee',borderRadius:20,height:16,marginBottom:8,overflow:'hidden'}}>
            <div style={{background:`linear-gradient(90deg,${fuelCol},${fuelCol}cc)`,height:16,borderRadius:20,width:`${fuelPct}%`,transition:'width .5s'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888',marginBottom:4}}>
            <span>Empty</span>
            <span style={{fontWeight:700,color:fuelCol}}>{fuel===0?'🚨 Buy fuel now!':fuel<maxFuel*0.2?'⚠️ Running low!':'✅ Good'}</span>
            <span>Full ({maxFuel})</span>
          </div>
          <div style={{fontSize:11,color:'#aaa',textAlign:'center',marginTop:4}}>Fuel only consumed when machines are running AND actively working</div>
        </Card>
        {!upgrades.fuelTank2&&<Card style={{background:'#fffbea',border:'1px solid #f39c12'}}>
          <div style={{fontSize:12,fontWeight:800,color:'#b7800a',marginBottom:4}}>💡 Upgrade your tank!</div>
          <div style={{fontSize:11,color:'#888'}}>Buy Large Tank (🪙4,500) or Mega Tank (🪙9,000) in the Upgrades tab to hold more fuel.</div>
        </Card>}
        <div style={{fontSize:11,fontWeight:800,color:'#888',marginBottom:8,paddingLeft:2}}>REFUEL OPTIONS</div>
        {FUEL_SHOP.map(item=>(
          <Card key={item.name}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{fontSize:36}}>{item.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:15}}>{item.name}</div>
                <div style={{fontSize:12,color:'#27ae60',fontWeight:700}}>+{item.amt} fuel</div>
                <div style={{fontSize:11,color:'#888'}}>→ {Math.min(maxFuel,fuel+item.amt).toFixed(0)}/{maxFuel}</div>
              </div>
              <Btn onClick={()=>buyFuelF(item)} disabled={coins<item.cost||fuel>=maxFuel} color='#e67e22' style={{fontSize:12,padding:'9px 14px',flexShrink:0}}>🪙{item.cost.toLocaleString()}</Btn>
            </div>
          </Card>
        ))}
      </>}

      {tab==='upgrades'&&<>
        {UPGRADES.map(up=>{const owned=upgrades[up.id],canAff=coins>=up.cost;return(
          <Card key={up.id} style={owned?{border:'2px solid #27ae60'}:{}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:36}}>{up.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:14}}>{up.name}</div>
                <div style={{fontSize:12,color:'#666',lineHeight:1.4}}>{up.desc}</div>
                {!owned&&<div style={{fontSize:13,fontWeight:800,color:'#b7800a',marginTop:4}}>🪙{up.cost.toLocaleString()}</div>}
              </div>
              {owned?<div style={{textAlign:'center'}}><div style={{fontSize:22}}>✅</div><div style={{fontSize:10,color:'#27ae60',fontWeight:700}}>Active</div></div>
              :<Btn onClick={()=>buyUpgrade(up)} disabled={!canAff} color={T.primary} style={{fontSize:12,padding:'9px 14px',flexShrink:0}}>{canAff?'Buy':'Need 🪙'}</Btn>}
            </div>
          </Card>
        );})}
      </>}
    </div>
  );
}

function ChatScreen({G}){
  const{chatMsgs,sendChat,setChat,playerId,blocked,setBlocked,notify,unreadChat,setUnreadChat,lastSeenChat,setLastSeenChat,globalEvents,T}=G;
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
          // Count unread messages (newer than last seen, not from self)
          const newMsgs=msgs.filter(m=>m.time>G.lastSeenChat&&m.author!==G.playerId);
          if(newMsgs.length>0)G.setUnreadChat(n=>Math.max(n,newMsgs.length));
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
        {msgs.length===0&&<div style={{textAlign:'center',color:'#bbb',padding:30,fontSize:13}}>No messages yet  -  say hello!</div>}
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
  const{farmName,updateFN,themeId,updateTheme,playerId,level,totalEarned,notify,T,friendsList,setFriendsList,friendStreak,sendFriendHelp,lastFriendHelp}=G;
  const[tab,setTab]=useState('identity');
  const[nameInput,setNI]=useState(farmName);
  const[joinInput,setJI]=useState('');
  const[fidInput,setFID]=useState('');
  const[players,setPlayers]=useState([]);
  const[selBook,setSelBook]=useState(null);
  const[pg,setPg]=useState(0);
  const today=todayStr();

  const regAndLoad=useCallback(async()=>{
    if(!playerId)return;
    try{await window.storage.set(`world:GLOBAL:${playerId}`,JSON.stringify({name:farmName,level,lastSeen:Date.now()}),true);}catch{}
    try{
      const r=await window.storage.list(`world:GLOBAL:`,true);
      if(r?.keys?.length){
        const data=await Promise.all(r.keys.map(async k=>{try{const x=await window.storage.get(k,true);return x?{key:k,isMe:k.includes(playerId),...JSON.parse(x.value)}:null;}catch{return null;}}));
        setPlayers(data.filter(Boolean));
      }else setPlayers([]);
    }catch{setPlayers([]);}
  },[playerId,farmName,level]);

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
        <div style={{background:`linear-gradient(135deg,${T.primary}dd,${T.accent}cc)`,backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:20,padding:18,marginBottom:14,color:'#fff'}}>
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
        <div style={{background:`linear-gradient(135deg,${T.primary}dd,${T.accent}cc)`,backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:20,padding:18,marginBottom:14,color:'#fff',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:900}}>{nameInput||'My Farm'}</div>
          <div style={{fontSize:12,opacity:.8,marginTop:4}}>Level {level} Farmer</div>
        </div>
        <Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:8}}>Farm Name</div>
          <input value={nameInput} onChange={e=>setNI(e.target.value.slice(0,30))} placeholder='Name your farm...' style={{width:'100%',padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:8,color:'#333'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:10,color:'#aaa'}}>{nameInput.length}/30</span>
            <Btn onClick={()=>{updateFN(nameInput);notify('Farm name saved!','green');}} color={T.primary}>Save</Btn>
          </div>
        </Card>
        <Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:10}}>Stats</div>
          {[['Level',level],['Total Earned',`🪙${totalEarned.toLocaleString()}`],['Player ID',playerId]].map(([l,v],i,arr)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<arr.length-1?'1px solid #f0f0f0':'none'}}>
              <span style={{fontSize:13,color:'#666'}}>{l}</span><span style={{fontWeight:700,fontSize:13,color:'#333'}}>{v}</span>
            </div>
          ))}
        </Card>
      </>}
      {tab==='multiplayer'&&<>
        <div style={{background:'linear-gradient(135deg,#1a3a50,#2471a3)',borderRadius:20,padding:18,marginBottom:14,color:'#fff'}}>
          <div style={{fontSize:11,opacity:.85,letterSpacing:1,marginBottom:4,fontWeight:700}}>GLOBAL COMMUNITY</div>
          <div style={{fontSize:22,fontWeight:900,margin:'5px 0'}}>🌍 Harvest Haven World</div>
          <div style={{fontSize:11,opacity:.75,marginBottom:10}}>All players are in one global world. Chat, trade and pool resources together!</div>
          <div style={{background:'rgba(255,255,255,.1)',borderRadius:12,padding:'8px 14px',marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,.9)'}}>Your Player ID:</div>
            <div style={{fontSize:16,fontWeight:900,letterSpacing:1,margin:'3px 0'}}>{playerId}</div>
          </div>
          <button onClick={()=>{try{navigator.clipboard.writeText(playerId);}catch{}notify('Player ID copied!','green');}} style={{background:'rgba(255,255,255,.2)',color:'#fff',border:'1.5px solid rgba(255,255,255,.4)',borderRadius:12,padding:'7px 16px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Copy Player ID</button>
        </div>
        <Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:8}}>Join a World</div>
          <div style={{display:'flex',gap:8}}>
            <input value={joinInput} onChange={e=>setJI(e.target.value.toUpperCase().slice(0,9))} placeholder='Enter world code...' style={{flex:1,padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:14,outline:'none',fontFamily:'inherit',letterSpacing:2,fontWeight:700,color:'#333'}}/>
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
          {['Add friends using their Player ID from their Farmhouse Identity tab.','Send daily help to each other. When both send help on the same day the Mutual Help Streak grows.','Each streak day adds 5% bonus to all earnings up to a maximum of 50%.','Streak breaks if one of you misses a day  -  help each other every day!'].map((t,i)=><div key={i} style={{fontSize:11,color:'#555',lineHeight:1.8}}>• {t}</div>)}
        </Card>
        <Card>
          <div style={{fontSize:12,fontWeight:800,color:'#333',marginBottom:8}}>Add a Friend</div>
          <div style={{display:'flex',gap:8}}>
            <input value={fidInput} onChange={e=>setFID(e.target.value.toUpperCase())} placeholder='Enter Player ID (e.g. PABC12)' style={{flex:1,padding:'9px 12px',borderRadius:12,border:'1.5px solid #ddd',fontSize:13,outline:'none',fontFamily:'inherit',color:'#333',letterSpacing:1}}/>
            <Btn onClick={addFriend} color='#16a085'>Add</Btn>
          </div>
          <div style={{fontSize:11,color:'#aaa',marginTop:6}}>Your ID: <b style={{color:'#555'}}>{playerId}</b>  -  share this with friends</div>
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
        <div style={{background:`linear-gradient(135deg,${T.primary}dd,${T.accent}cc)`,backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:20,padding:16,marginBottom:14,color:'#fff',textAlign:'center'}}>
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

function VisitStallScreen({stall,onClose,G}){
  const{coins,spend,notify,playerId,T}=G;
  const theme=STALL_THEMES.find(t=>t.id===stall.theme)||STALL_THEMES[0];
  const[shown,setShown]=useState(true);
  const[localListings,setLocalListings]=useState(stall.listings||[]);
  const[buying,setBuying]=useState(null);
  const buyItem=async l=>{
    if(buying||l.sellerId===playerId)return;
    const total=l.price*l.qty;
    if(coins<total){notify('Not enough coins!','orange');return;}
    setBuying(l.id);spend(total);
    if(l.type==='silo')G.setSilo(s=>({...s,[l.itemId]:(s[l.itemId]||0)+l.qty}));
    else G.setMin(m=>({...m,[l.itemId]:(m[l.itemId]||0)+l.qty}));
    if(db){try{await set(ref(db,`market/${l.id}`),null);await set(ref(db,`payments/${l.sellerId}/${l.id}`),{amount:total,from:playerId,item:l.name,time:Date.now()});}catch{}}
    setLocalListings(p=>p.filter(x=>x.id!==l.id));
    setBuying(null);
    notify(`✅ Bought ${l.qty}x ${l.name}!`,'gold');
  };
  return(
    <div style={{padding:14}}>
      {shown&&<div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.55)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{background:theme.color,borderRadius:24,padding:28,maxWidth:340,width:'100%',textAlign:'center',color:'#fff'}}>
          <div style={{fontSize:48,marginBottom:8}}>👋</div>
          <div style={{fontSize:20,fontWeight:900,marginBottom:6}}>{stall.welcome||'Welcome!'}</div>
          <div style={{fontSize:13,opacity:.85,marginBottom:20}}>Welcome to {stall.name}</div>
          <button onClick={()=>setShown(false)} style={{background:'rgba(255,255,255,.25)',color:'#fff',border:'1.5px solid rgba(255,255,255,.5)',borderRadius:14,padding:'11px 28px',fontSize:14,fontWeight:800,cursor:'pointer'}}>Enter Stall</button>
        </div>
      </div>}
      <div style={{background:theme.color,borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <button onClick={onClose} style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',borderRadius:8,padding:'4px 12px',fontSize:12,fontWeight:700,cursor:'pointer',marginBottom:8}}>← Back</button>
        <div style={{fontSize:22,fontWeight:900}}>🏪 {stall.name}</div>
        <div style={{fontSize:12,opacity:.85}}>by {stall.farmName}</div>
      </div>
      {localListings.length>0?localListings.map(l=>(
        <Card key={l.id}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{fontSize:28}}>{l.emoji}</div>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14}}>{l.name}</div><div style={{fontSize:11,color:'#777'}}>×{l.qty}</div><div style={{fontWeight:800,color:'#f39c12'}}>🪙{l.price} each</div></div>
            {l.sellerId!==playerId&&<Btn onClick={()=>buyItem(l)} color={theme.color} disabled={coins<l.price*l.qty||buying===l.id} style={{fontSize:12,padding:'8px 12px',flexShrink:0}}>{buying===l.id?'..':'Buy'}</Btn>}
          </div>
        </Card>
      )):<div style={{textAlign:'center',padding:40,color:'#aaa'}}><div style={{fontSize:48}}>📭</div><div style={{fontWeight:700,color:'#888',marginTop:8}}>No items for sale</div></div>}
      <button onClick={()=>{notify(stall.goodbye||'Goodbye! 👋','green');onClose();}} style={{width:'100%',background:'#f5f5f5',border:'1px solid #ddd',borderRadius:14,padding:13,fontSize:14,fontWeight:700,cursor:'pointer',color:'#555',marginTop:8}}>Leave Stall 👋</button>
    </div>
  );
}

function VisitStallsListScreen({G}){
  const{allStalls,T}=G;
  const[visiting,setVisiting]=useState(null);
  if(visiting)return<VisitStallScreen stall={visiting} onClose={()=>setVisiting(null)} G={G}/>;
  return(
    <div style={{padding:14}}>
      <div style={{background:`linear-gradient(135deg,${T.primary}dd,${T.accent}cc)`,backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>PLAYER STALLS</div>
        <div style={{fontSize:20,fontWeight:900,margin:'3px 0'}}>🛖 Visit Farm Stalls</div>
        <div style={{fontSize:12,opacity:.85}}>{allStalls.length} stalls open right now</div>
      </div>
      {allStalls.length===0?<div style={{textAlign:'center',padding:40,color:'#aaa'}}><div style={{fontSize:56}}>🛖</div><div style={{fontWeight:800,fontSize:16,color:'#888',marginTop:10}}>No stalls open yet</div></div>
      :allStalls.map(stall=>{const theme=STALL_THEMES.find(t=>t.id===stall.theme)||STALL_THEMES[0];return(
        <Card key={stall.playerId}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:46,height:46,background:theme.color,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>🏪</div>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,color:'#111'}}>{stall.name}</div><div style={{fontSize:11,color:'#777'}}>by {stall.farmName}</div><div style={{fontSize:11,color:'#27ae60',fontWeight:700}}>{stall.listings?.length||0} items for sale</div></div>
            <Btn onClick={()=>setVisiting(stall)} color={theme.color} style={{fontSize:12,padding:'8px 14px',flexShrink:0}}>Visit</Btn>
          </div>
        </Card>
      );})}
    </div>
  );
}


function FishingScreen({G}){
  const{level,coins,fishInv,baitInv,selBait,setSelBait,fishCd,castLine,sellFish,sellAllFish,buyBait,craftFishRecipe,canCraftFish,totalFishCaught,T,notify,earn}=G;
  const[tab,setTab]=useState('lake');
  const[ripple,setRipple]=useState(false);
  const[lastCatch,setLastCatch]=useState(null);
  const[villageMsgs,setVillageMsgs]=useState([]);

  // Load fish village chat from Firebase
  useEffect(()=>{
    if(!db)return;
    const unsub=onValue(ref(db,'fishchat'),sn=>{
      if(sn.exists()){
        const msgs=Object.values(sn.val()).filter(m=>m&&m.text&&m.time).sort((a,b)=>a.time-b.time).slice(-30);
        setVillageMsgs(msgs);
      } else {
        // Seed with welcome message if empty
        const welcome={id:'welcome_001',author:'system',farm:'Harvest Haven',text:'🌊 Welcome to the Fishing Village! Catch rare or legendary fish to appear here.',time:Date.now(),type:'system'};
        set(ref(db,'fishchat/welcome_001'),welcome).catch(()=>{});
      }
    });
    return()=>unsub();
  },[]);

  const handleCast=()=>{
    if(fishCd)return;
    setRipple(true);
    setTimeout(()=>setRipple(false),600);
    castLine();
  };

  const myFish=FISH.filter(f=>(fishInv[f.id]||0)>0);
  const totalFishValue=FISH.reduce((s,f)=>s+(fishInv[f.id]||0)*f.value,0);
  const selBaitObj=BAITS.find(b=>b.id===selBait)||BAITS[0];

  return(
    <div style={{padding:14}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#1a6b8a,#2980b9)',borderRadius:20,padding:16,marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:11,opacity:.85,letterSpacing:1,fontWeight:700}}>FARM LAKE</div>
        <div style={{fontSize:22,fontWeight:900,margin:'3px 0'}}>🎣 Fishing</div>
        <div style={{fontSize:12,opacity:.85}}>{totalFishCaught} fish caught · Worth 🪙{totalFishValue.toLocaleString()} in inventory</div>
      </div>

      <TabRow tabs={[['lake','🌊 Lake'],['tackle','🧰 Tackle'],['catch','🐟 Catch'],['recipes','🍽️ Recipes'],['village','🏘️ Village']]} active={tab} onSelect={setTab} ac='#2980b9'/>

      {/* LAKE TAB - Main fishing */}
      {tab==='lake'&&<>
        {/* Lake visual */}
        <div onClick={handleCast} style={{
          background:'linear-gradient(180deg,#a8d8ea 0%,#1a6b8a 60%,#0d4a6b 100%)',
          borderRadius:20,padding:20,marginBottom:14,textAlign:'center',cursor:'pointer',
          position:'relative',overflow:'hidden',minHeight:180,
          boxShadow:ripple?'0 0 30px rgba(26,107,138,0.6)':'0 4px 20px rgba(0,0,0,0.15)',
          transition:'box-shadow .3s',
          userSelect:'none'
        }}>
          {/* Clouds */}
          <div style={{position:'absolute',top:10,left:20,fontSize:24,opacity:.6}}>☁️</div>
          <div style={{position:'absolute',top:6,right:30,fontSize:18,opacity:.5}}>☁️</div>
          {/* Trees */}
          <div style={{position:'absolute',bottom:40,left:10,fontSize:28}}>🌲</div>
          <div style={{position:'absolute',bottom:40,right:10,fontSize:22}}>🌲</div>
          {/* Ripple */}
          {ripple&&<div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,0.3)',animation:'rippleAnim .6s ease-out'}}/>}
          {/* Fisher */}
          <div style={{fontSize:40,marginBottom:4}}>{fishCd?'⏳':'🎣'}</div>
          <div style={{color:'#fff',fontWeight:800,fontSize:16,marginBottom:4}}>
            {fishCd?'Waiting for a bite...':'Tap to cast your line!'}
          </div>
          <div style={{color:'rgba(255,255,255,.7)',fontSize:12}}>
            Using: {selBaitObj.emoji} {selBaitObj.name} ({baitInv[selBait]||0} left)
          </div>
          {/* Water ripple effect */}
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:50,background:'rgba(255,255,255,0.05)',borderRadius:'50% 50% 0 0'}}/>
        </div>

        {/* Bait selector */}
        <Card>
          <div style={{fontWeight:800,fontSize:13,marginBottom:8}}>🪱 Select Bait</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {BAITS.map(b=>{
              const qty=baitInv[b.id]||0;
              const active=selBait===b.id;
              return(
                <button key={b.id} onClick={()=>setSelBait(b.id)} style={{
                  background:active?'#2980b9':'#f5f5f5',color:active?'#fff':'#333',
                  border:`2px solid ${active?'#2980b9':'#eee'}`,borderRadius:12,
                  padding:'6px 10px',fontSize:11,fontWeight:700,cursor:'pointer',textAlign:'center',minWidth:70
                }}>
                  <div style={{fontSize:16}}>{b.emoji}</div>
                  <div>{b.name.split(' ')[0]}</div>
                  <div style={{opacity:.7}}>×{qty}</div>
                </button>
              );
            })}
          </div>
          <div style={{fontSize:11,color:'#888',marginTop:8}}>{selBaitObj.desc}</div>
          {(baitInv[selBait]||0)===0&&<div style={{fontSize:11,color:'#e74c3c',fontWeight:700,marginTop:4}}>⚠️ No bait! Go to Tackle Shop to buy more.</div>}
        </Card>

        {/* Quick fish stats */}
        <div style={{display:'flex',gap:8}}>
          {[['🎣','Total Caught',totalFishCaught],['🐟','In Inventory',myFish.reduce((s,f)=>s+(fishInv[f.id]||0),0)],['🪙','Value',`🪙${totalFishValue.toLocaleString()}`]].map(([e,l,v])=>(
            <div key={l} style={{flex:1,background:'#fff',borderRadius:14,padding:'10px 8px',textAlign:'center',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
              <div style={{fontSize:20}}>{e}</div>
              <div style={{fontSize:11,color:'#888',fontWeight:700}}>{l}</div>
              <div style={{fontSize:13,fontWeight:900,color:'#2980b9'}}>{v}</div>
            </div>
          ))}
        </div>
        <style>{`@keyframes rippleAnim{from{transform:translate(-50%,-50%) scale(0);opacity:1}to{transform:translate(-50%,-50%) scale(3);opacity:0}}`}</style>
      </>}

      {/* TACKLE SHOP TAB */}
      {tab==='tackle'&&<>
        <div style={{background:'#e8f4f8',borderRadius:14,padding:12,marginBottom:12,fontSize:12,color:'#1a6b8a',fontWeight:600}}>
          💡 Better bait = higher chance of rare and legendary fish. Golden Lure is the best!
        </div>
        {BAITS.map(b=>{
          const qty=baitInv[b.id]||0;
          return(
            <Card key={b.id}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                <div style={{fontSize:32}}>{b.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:14}}>{b.name}</div>
                  <div style={{fontSize:11,color:'#888'}}>{b.desc}</div>
                  {b.bonus>0&&<div style={{fontSize:11,color:'#27ae60',fontWeight:700}}>+{(b.bonus*100).toFixed(0)}% rare catch bonus</div>}
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:12,color:'#888'}}>Owned: {qty}</div>
                  <div style={{fontSize:13,fontWeight:800,color:'#b7800a'}}>🪙{b.cost} each</div>
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                {[5,10,20].map(n=>(
                  <Btn key={n} onClick={()=>buyBait(b,n)} disabled={coins<b.cost*n} color='#2980b9' style={{flex:1,padding:8,fontSize:12}}>
                    ×{n} 🪙{(b.cost*n).toLocaleString()}
                  </Btn>
                ))}
              </div>
            </Card>
          );
        })}
      </>}

      {/* CATCH TAB */}
      {tab==='catch'&&<>
        {myFish.length===0?(
          <div style={{textAlign:'center',padding:40,color:'#aaa'}}>
            <div style={{fontSize:56}}>🎣</div>
            <div style={{fontWeight:800,fontSize:16,color:'#888',marginTop:10}}>No fish yet!</div>
            <div style={{fontSize:12,marginTop:6}}>Head to the Lake tab and start fishing</div>
          </div>
        ):<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:800,color:'#555'}}>{myFish.length} species caught</div>
            {totalFishValue>0&&<Btn onClick={sellAllFish} color='#27ae60' style={{fontSize:12,padding:'7px 14px'}}>Sell All 🪙{totalFishValue.toLocaleString()}</Btn>}
          </div>
          {['legendary','rare','uncommon','common'].map(rarity=>{
            const rareFish=myFish.filter(f=>FISH.find(ff=>ff.id===f.id)?.rarity===rarity);
            if(rareFish.length===0)return null;
            return(
              <div key={rarity}>
                <div style={{fontSize:11,fontWeight:800,color:FISH_RARITY_COL[rarity]||'#888',marginBottom:6,paddingLeft:2,textTransform:'uppercase',letterSpacing:1}}>{rarity}</div>
                {rareFish.map(entry=>{
                  const fish=FISH.find(f=>f.id===entry.id);
                  const qty=fishInv[entry.id]||0;
                  if(!fish||qty===0)return null;
                  return(
                    <Card key={fish.id}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{fontSize:28}}>{fish.emoji}</div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:800,fontSize:14,color:FISH_RARITY_COL[fish.rarity]}}>{fish.name}</div>
                          <div style={{fontSize:11,color:'#888'}}>×{qty} · 🪙{fish.value} each</div>
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          <Btn onClick={()=>sellFish(fish,1)} color='#888' style={{fontSize:11,padding:'6px 10px'}}>×1</Btn>
                          <Btn onClick={()=>sellFish(fish,qty)} color='#27ae60' style={{fontSize:11,padding:'6px 10px'}}>All 🪙{(fish.value*qty).toLocaleString()}</Btn>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </>}
      </>}

      {/* RECIPES TAB */}
      {tab==='recipes'&&<>
        <div style={{background:'#e8f4f8',borderRadius:14,padding:12,marginBottom:12,fontSize:12,color:'#1a6b8a',fontWeight:600}}>
          🍽️ Combine fish with farm produce for premium dishes worth much more!
        </div>
        {KITCHEN_RECIPES.filter(r=>Object.keys(r.ing).some(id=>FISH.some(f=>f.id===id))).map(recipe=>{
          const can=canCraftFish(recipe);
          const owned=G.craftInv[recipe.id]||0;
          return(
            <Card key={recipe.id}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <div style={{fontSize:32}}>{recipe.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:14}}>{recipe.name}</div>
                  <div style={{fontSize:11,color:'#888'}}>{recipe.desc}</div>
                  <div style={{fontSize:12,color:'#b7800a',fontWeight:700}}>Sells 🪙{recipe.sell} · +{recipe.xp}XP</div>
                </div>
                {owned>0&&<div style={{fontWeight:800,color:'#27ae60',fontSize:13}}>×{owned}</div>}
              </div>
              {/* Ingredient status */}
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                {Object.entries(recipe.ing).map(([id,qty])=>{
                  const have=(fishInv[id]||0)+(G.silo[id]||0)+(G.minerals[id]||0);
                  const ok=have>=qty;
                  const item=FISH.find(f=>f.id===id)||CROPS.find(c=>c.id===id)||MINERALS.find(m=>m.id===id);
                  return(
                    <div key={id} style={{background:ok?'#f0fff4':'#fff5f5',border:`1px solid ${ok?'#c3e6cb':'#f5c6cb'}`,borderRadius:10,padding:'3px 9px',fontSize:11,fontWeight:700,color:ok?'#1a6b2a':'#721c24'}}>
                      {item?.emoji} {have}/{qty}
                    </div>
                  );
                })}
              </div>
              <div style={{display:'flex',gap:6}}>
                <Btn onClick={()=>craftFishRecipe(recipe)} disabled={!can} color='#2980b9' style={{flex:1,padding:8,fontSize:12}}>{can?`Craft ${recipe.emoji}`:'Need ingredients'}</Btn>
                {owned>0&&<Btn onClick={()=>{earn(recipe.sell*owned);G.setCraftInv&&G.setCraftInv(c=>({...c,[recipe.id]:0}));G.notify(`Sold ${owned}x ${recipe.name} 🪙${(recipe.sell*owned).toLocaleString()}`,'gold');}} color='#f39c12' style={{flex:1,padding:8,fontSize:12}}>Sell All 🪙{recipe.sell*owned}</Btn>}
              </div>
            </Card>
          );
        })}
      </>}

      {/* VILLAGE TAB - Fish chat */}
      {tab==='village'&&<>
        <div style={{background:'linear-gradient(135deg,#1a6b8a,#2980b9)',borderRadius:16,padding:14,marginBottom:12,color:'#fff'}}>
          <div style={{fontSize:13,fontWeight:800,marginBottom:4}}>🏘️ Fishing Village</div>
          <div style={{fontSize:11,opacity:.85}}>When players catch rare or legendary fish it shows here. Catch something special to get featured!</div>
        </div>
        {villageMsgs.length===0?(
          <div style={{textAlign:'center',padding:30,color:'#aaa'}}>
            <div style={{fontSize:40}}>🌊</div>
            <div style={{fontWeight:700,marginTop:8}}>Village is quiet...</div>
            <div style={{fontSize:12,marginTop:4}}>Catch a rare fish to be the first post!</div>
          </div>
        ):(<>
          {[...villageMsgs].reverse().map((m,i)=>(
            <Card key={m.id||i}>
              <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                <div style={{fontSize:28}}>🎣</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:13,color:'#1a6b8a'}}>{m.farm}</div>
                  <div style={{fontSize:13,color:'#333',margin:'3px 0'}}>{m.text}</div>
                  <div style={{fontSize:10,color:'#aaa'}}>{new Date(m.time).toLocaleTimeString()}</div>
                </div>
              </div>
            </Card>
          ))}
        </>)}
      </>}
    </div>
  );
}


function WorkersScreen({G}){
  const{coins,spend,earn,notify,level,T,upgrades,plantAll,harvestAll,waterAll,autoPlow,mine,collectAnimal,ownedAnimals}=G;
  const[workers,setWorkers]=useState(()=>{try{const w=localStorage.getItem('hh_workers');return w?JSON.parse(w):[];}catch{return[];}});
  const WORKER_TYPES=[
    {id:'plower',name:'Field Hand',emoji:'👨‍🌾',desc:'Auto-plows and plants all fields every 5 min',cost:500,minLevel:1},
    {id:'harvester',name:'Crop Harvester',emoji:'🌾',desc:'Auto-harvests all ready crops every 3 min',cost:800,minLevel:3},
    {id:'miner',name:'Mine Operator',emoji:'⛏️',desc:'Mines automatically every 4 min',cost:1200,minLevel:5},
    {id:'animal_keeper',name:'Animal Keeper',emoji:'🐄',desc:'Collects from all animals every 6 min',cost:1000,minLevel:3},
    {id:'manager',name:'Farm Manager',emoji:'👔',desc:'Boosts all worker efficiency by 20%',cost:5000,minLevel:10},
  ];
  const hire=wt=>{
    if(level<wt.minLevel){notify(`Need Level ${wt.minLevel}!`,'orange');return;}
    if(coins<wt.cost){notify(`Need 🪙${wt.cost.toLocaleString()}!`,'orange');return;}
    if(workers.find(w=>w.id===wt.id)){notify('Already hired!','orange');return;}
    spend(wt.cost);
    const nw=[...workers,{...wt,hiredAt:Date.now()}];
    setWorkers(nw);localStorage.setItem('hh_workers',JSON.stringify(nw));
    notify(`${wt.emoji} ${wt.name} hired!`,'green');
  };
  const fire=id=>{
    const nw=workers.filter(w=>w.id!==id);
    setWorkers(nw);localStorage.setItem('hh_workers',JSON.stringify(nw));
    notify('Worker let go.','orange');
  };
  useEffect(()=>{
    const hasManager=workers.some(w=>w.id==='manager');
    const mult=hasManager?.8:1;
    const intervals=workers.map(w=>{
      if(w.id==='plower')return setInterval(()=>{autoPlow();plantAll();},300000*mult);
      if(w.id==='harvester')return setInterval(()=>harvestAll(),180000*mult);
      if(w.id==='miner')return setInterval(()=>mine(),240000*mult);
      if(w.id==='animal_keeper')return setInterval(()=>{ANIMALS.filter(a=>(ownedAnimals[a.id]||0)>0).forEach(a=>collectAnimal(a));},360000*mult);
      return null;
    }).filter(Boolean);
    return()=>intervals.forEach(clearInterval);
  },[workers,ownedAnimals]);
  const hasManager=workers.some(w=>w.id==='manager');
  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#2c3e50dd,#34495ecc)',backdropFilter:'blur(8px)',borderRadius:20,padding:16,marginBottom:14,color:'#fff',border:'1px solid rgba(255,255,255,0.1)'}}>
        <div style={{fontSize:11,opacity:.8,letterSpacing:1,fontWeight:800,textTransform:'uppercase',marginBottom:2}}>Management</div>
        <div style={{fontSize:22,fontWeight:900}}>👔 Farm Workers</div>
        <div style={{fontSize:12,opacity:.7,marginTop:2}}>{workers.length} hired{hasManager?' · Manager on duty ✅':''}</div>
      </div>
      {workers.length>0&&<>
        <div style={{fontSize:10,fontWeight:900,color:'rgba(255,255,255,0.5)',letterSpacing:2,marginBottom:8,textTransform:'uppercase'}}>Your Team</div>
        {workers.map(w=>(
          <Card key={w.id}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:32}}>{w.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:14}}>{w.name}</div>
                <div style={{fontSize:11,color:'#666'}}>{w.desc}</div>
              </div>
              <button onClick={()=>fire(w.id)} style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:10,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>Fire</button>
            </div>
          </Card>
        ))}
        {hasManager&&<div style={{background:'rgba(39,174,96,0.15)',border:'1px solid rgba(39,174,96,0.3)',borderRadius:14,padding:'8px 14px',marginBottom:12,fontSize:12,color:'#27ae60',fontWeight:700}}>✅ Manager active — all workers 20% faster</div>}
      </>}
      <div style={{fontSize:10,fontWeight:900,color:'rgba(255,255,255,0.5)',letterSpacing:2,marginBottom:8,textTransform:'uppercase'}}>Hire Workers</div>
      {WORKER_TYPES.map(wt=>{
        const hired=workers.find(w=>w.id===wt.id);
        const locked=level<wt.minLevel;
        return(
          <Card key={wt.id} style={{opacity:locked?.5:1}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{fontSize:32}}>{wt.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:14}}>{wt.name}</div>
                <div style={{fontSize:11,color:'#666'}}>{wt.desc}</div>
                <div style={{fontSize:11,color:'#f59e0b',fontWeight:700,marginTop:2}}>🪙{wt.cost.toLocaleString()} · Lv{wt.minLevel}+</div>
              </div>
            </div>
            {hired?<div style={{background:'#f0fff4',borderRadius:10,padding:'7px 12px',fontSize:12,fontWeight:700,color:'#27ae60',textAlign:'center'}}>✅ Working on your farm</div>
            :locked?<div style={{background:'#f5f5f5',borderRadius:10,padding:'7px 12px',fontSize:12,color:'#aaa',textAlign:'center'}}>🔒 Unlock at Level {wt.minLevel}</div>
            :<Btn onClick={()=>hire(wt)} color='#2c3e50' style={{width:'100%',padding:10,fontSize:13}}>Hire 🪙{wt.cost.toLocaleString()}</Btn>}
          </Card>
        );
      })}
    </div>
  );
}

function KitchenScreen({G}){
  const{silo,minerals,craftInv,setCraftInv,fishInv,earn,setXp,notify,T,level}=G;
  const[tab,setTab]=useState('cook');
  const[search,setSearch]=useState('');

  const getQty=(id)=>(silo[id]||0)+(craftInv[id]||0)+(fishInv[id]||0);

  const canCookRecipe=(r)=>Object.entries(r.ing).every(([id,qty])=>getQty(id)>=qty);

  const cookRecipe=(r)=>{
    if(!canCookRecipe(r)){notify('Missing ingredients!','orange');return;}
    // Deduct from inventories (silo first, then craftInv, then fishInv)
    for(const[id,qty] of Object.entries(r.ing)){
      let remaining=qty;
      if((silo[id]||0)>0){
        const take=Math.min(remaining,silo[id]);
        G.setSilo(s=>({...s,[id]:s[id]-take}));
        remaining-=take;
      }
      if(remaining>0&&(fishInv[id]||0)>0){
        const take=Math.min(remaining,fishInv[id]);
        G.setFishInv(f=>({...f,[id]:f[id]-take}));
        remaining-=take;
      }
    }
    if(r.id==='biofuel'||r.id==='biofuel_premium'){
      const fuelAmt=r.id==='biofuel'?25:75;
      G.setFuel&&G.setFuel(f=>Math.min(G.upgrades?.fuelTank3?1000:G.upgrades?.fuelTank2?500:200,f+fuelAmt));
      setXp(x=>x+r.xp);
      notify(`${r.emoji} Biofuel crafted! +${fuelAmt} fuel!`,'#27ae60');
    } else {
      setCraftInv(c=>({...c,[r.id]:(c[r.id]||0)+1}));
      setXp(x=>x+r.xp);
      notify(`Cooked ${r.emoji} ${r.name}! +${r.xp}XP`,'green');
    }
  };

  const sellMeal=(r)=>{
    const qty=craftInv[r.id]||0;
    if(!qty){notify('Nothing to sell!','orange');return;}
    earn(r.sell*qty);
    setCraftInv(c=>({...c,[r.id]:0}));
    notify(`Sold ${qty}x ${r.emoji} ${r.name} for 🪙${(r.sell*qty).toLocaleString()}!`,'gold');
  };

  const tierColors={1:'#27ae60',2:'#f39c12',3:'#e67e22',4:'#e74c3c',5:'#8e44ad'};
  const tierLabels={1:'Basic',2:'Intermediate',3:'Advanced',4:'Expert',5:'Legendary'};

  const cooked=KITCHEN_RECIPES.filter(r=>(craftInv[r.id]||0)>0);
  const filtered=KITCHEN_RECIPES.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase()));

  return(
    <div style={{padding:14}}>
      <div style={{background:'linear-gradient(135deg,#c0392bdd,#e74c3ccc)',backdropFilter:'blur(8px)',borderRadius:20,padding:16,marginBottom:14,color:'#fff',border:'1px solid rgba(255,255,255,0.15)'}}>
        <div style={{fontSize:11,opacity:.8,letterSpacing:1,fontWeight:800,textTransform:'uppercase',marginBottom:2}}>Farm Kitchen</div>
        <div style={{fontSize:22,fontWeight:900,letterSpacing:-.3}}>🍳 Cook Meals</div>
        <div style={{fontSize:12,opacity:.75,marginTop:2}}>Combine crops and fish into premium dishes · {cooked.length} dishes ready to sell</div>
      </div>
      <TabRow tabs={[['cook','🍳 Recipes'],['pantry','🥫 Pantry'],['ready','🍽️ Ready ('+cooked.length+')']]} active={tab} onSelect={setTab} ac='#e74c3c'/>

      {tab==='cook'&&<>
        <div style={{marginBottom:10}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes..." style={{width:'100%',background:'rgba(255,255,255,0.1)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:14,padding:'10px 16px',fontSize:13,outline:'none',color:'#fff',boxSizing:'border-box',fontFamily:'inherit'}}/>
        </div>
        {[1,2,3,4,5].map(tier=>{
          const tierRecipes=filtered.filter(r=>r.tier===tier);
          if(!tierRecipes.length)return null;
          return(
            <div key={tier} style={{marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:900,color:tierColors[tier],letterSpacing:2,marginBottom:8,textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:8,height:8,background:tierColors[tier],borderRadius:20,display:'inline-block'}}/>
                {tierLabels[tier]} Recipes
              </div>
              {tierRecipes.map(r=>{
                const can=canCookRecipe(r);
                const owned=craftInv[r.id]||0;
                return(
                  <Card key={r.id}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <div style={{fontSize:36,filter:can?'none':'grayscale(80%)'}}>{r.emoji}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:900,fontSize:14}}>{r.name}</div>
                        <div style={{fontSize:11,color:'#888'}}>{r.desc}</div>
                        <div style={{fontSize:12,fontWeight:700,color:'#f39c12',marginTop:2}}>🪙{r.sell.toLocaleString()} · +{r.xp}XP</div>
                      </div>
                      {owned>0&&<div style={{background:'#f0fff4',borderRadius:12,padding:'4px 10px',fontSize:12,fontWeight:900,color:'#27ae60'}}>×{owned}</div>}
                    </div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                      {Object.entries(r.ing).map(([id,qty])=>{
                        const have=getQty(id);
                        const ok=have>=qty;
                        const item=CROPS.find(c=>c.id===id)||MINERALS.find(m=>m.id===id)||FISH.find(f=>f.id===id);
                        return(
                          <div key={id} style={{background:ok?'rgba(39,174,96,0.15)':'rgba(231,76,60,0.15)',border:`1px solid ${ok?'rgba(39,174,96,0.4)':'rgba(231,76,60,0.4)'}`,borderRadius:10,padding:'3px 9px',fontSize:11,fontWeight:700,color:ok?'#1a6b2a':'#c0392b'}}>
                            {item?.emoji||'❓'} {have}/{qty}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <Btn onClick={()=>cookRecipe(r)} disabled={!can} color='#e74c3c' style={{flex:2,padding:9,fontSize:12}}>{can?`Cook ${r.emoji}`:'Missing ingredients'}</Btn>
                      {owned>0&&<Btn onClick={()=>sellMeal(r)} color='#f39c12' style={{flex:1,padding:9,fontSize:12}}>Sell 🪙{(r.sell*owned).toLocaleString()}</Btn>}
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </>}

      {tab==='pantry'&&<>
        <div style={{fontSize:10,fontWeight:900,color:'rgba(255,255,255,0.5)',letterSpacing:2,marginBottom:10,textTransform:'uppercase'}}>Available Ingredients</div>
        {[
          {label:'🌾 Crops',items:CROPS.filter(c=>(silo[c.id]||0)>0).map(c=>({...c,qty:silo[c.id]||0}))},
          {label:'🐟 Fish',items:FISH.filter(f=>(fishInv[f.id]||0)>0).map(f=>({...f,qty:fishInv[f.id]||0}))},
        ].map(cat=>cat.items.length>0&&(
          <div key={cat.label} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>{cat.label}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {cat.items.map(i=>(
                <div key={i.id} style={{background:'rgba(255,255,255,0.1)',backdropFilter:'blur(8px)',borderRadius:14,padding:'8px 12px',textAlign:'center',border:'1px solid rgba(255,255,255,0.15)',minWidth:70}}>
                  <div style={{fontSize:22}}>{i.emoji}</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.8)',fontWeight:700,marginTop:2}}>{i.name}</div>
                  <div style={{fontSize:12,fontWeight:900,color:'#4ade80'}}>×{i.qty}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {CROPS.every(c=>(silo[c.id]||0)===0)&&FISH.every(f=>(fishInv[f.id]||0)===0)&&
          <div style={{textAlign:'center',padding:30,color:'rgba(255,255,255,0.4)'}}><div style={{fontSize:48}}>🥫</div><div style={{marginTop:8,fontWeight:700}}>Pantry is empty</div><div style={{fontSize:12,marginTop:4,opacity:.6}}>Harvest crops or catch fish to cook!</div></div>
        }
      </>}

      {tab==='ready'&&<>
        {cooked.length===0?(
          <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.4)'}}>
            <div style={{fontSize:56}}>🍽️</div>
            <div style={{fontWeight:800,fontSize:16,marginTop:10}}>No meals ready</div>
            <div style={{fontSize:12,marginTop:6,opacity:.6}}>Cook something from the Recipes tab!</div>
          </div>
        ):<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.7)'}}>Ready to sell</div>
            <Btn onClick={()=>{
              let total=0;
              cooked.forEach(r=>{total+=r.sell*(craftInv[r.id]||0);});
              earn(total);
              cooked.forEach(r=>setCraftInv(c=>({...c,[r.id]:0})));
              notify(`Sold all meals for 🪙${total.toLocaleString()}!`,'gold');
            }} color='#27ae60' style={{fontSize:12,padding:'7px 14px'}}>Sell All</Btn>
          </div>
          {cooked.map(r=>(
            <Card key={r.id}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{fontSize:32}}>{r.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:14}}>{r.name}</div>
                  <div style={{fontSize:11,color:'#888'}}>×{craftInv[r.id]} portions · 🪙{r.sell} each</div>
                </div>
                <Btn onClick={()=>sellMeal(r)} color='#f39c12' style={{fontSize:12,padding:'8px 12px'}}>🪙{(r.sell*(craftInv[r.id]||0)).toLocaleString()}</Btn>
              </div>
            </Card>
          ))}
        </>}
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
        if(!username.trim()||!farmNameL.trim()){setError('Please fill all fields.');setLoading(false);return;}
        const cred=await createUserWithEmailAndPassword(auth,email,password);
        if(db)await set(ref(db,`users/${cred.user.uid}/profile`),{username:username.trim(),farmName:farmNameL.trim(),email,createdAt:Date.now()});
        try{await window.storage.set('farm_name',farmNameL.trim());}catch{}
        onLogin(cred.user);
      }else{
        const cred=await signInWithEmailAndPassword(auth,email,password);
        onLogin(cred.user);
      }
    }catch(e){
      const msgs={'auth/email-already-in-use':'Email already registered.','auth/wrong-password':'Wrong password.','auth/user-not-found':'No account found.','auth/weak-password':'Password needs 6+ characters.','auth/invalid-email':'Invalid email.','auth/invalid-credential':'Incorrect email or password.'};
      setError(msgs[e.code]||e.message);
    }
    setLoading(false);
  };

  const inp={width:'100%',border:'1.5px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.08)',backdropFilter:'blur(8px)',borderRadius:14,padding:'13px 16px',fontSize:14,marginBottom:10,boxSizing:'border-box',outline:'none',color:'#fff',fontFamily:'inherit',placeholder:'rgba(255,255,255,0.4)'};

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#1e4d2b 0%,#2d6e3e 40%,#1a5c3a 75%,#0f3321 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:'system-ui,sans-serif',position:'relative',overflow:'hidden'}}>
      {/* Background decorations */}
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundImage:'radial-gradient(circle at 20% 30%, rgba(74,222,128,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(134,239,172,0.1) 0%, transparent 50%)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',fontSize:80,top:20,right:20,opacity:.08,transform:'rotate(15deg)',pointerEvents:'none'}}>🌾</div>
      <div style={{position:'absolute',fontSize:60,bottom:30,left:10,opacity:.06,transform:'rotate(-10deg)',pointerEvents:'none'}}>🌿</div>

      <div style={{background:'rgba(255,255,255,0.08)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',borderRadius:28,padding:30,width:'100%',maxWidth:380,boxShadow:'0 24px 64px rgba(0,0,0,0.4)',border:'1px solid rgba(255,255,255,0.15)',position:'relative'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:60,marginBottom:8,filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.4))'}}>🌾</div>
          <div style={{fontSize:28,fontWeight:900,color:'#fff',textShadow:'0 3px 12px rgba(0,0,0,0.5)',letterSpacing:-.5}}>Harvest Haven</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.55)',marginTop:4,fontWeight:600}}>Your farming adventure awaits! · by codAR</div>
        </div>

        <div style={{display:'flex',background:'rgba(0,0,0,0.25)',borderRadius:16,padding:3,marginBottom:22}}>
          {['login','register'].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError('');}} style={{flex:1,background:mode===m?'rgba(255,255,255,0.15)':'transparent',backdropFilter:mode===m?'blur(8px)':'none',border:'none',borderRadius:13,padding:'10px 0',fontSize:13,fontWeight:800,color:mode===m?'#fff':'rgba(255,255,255,0.45)',cursor:'pointer',transition:'all .2s',boxShadow:mode===m?'0 2px 12px rgba(0,0,0,0.2)':'none',letterSpacing:.3}}>
              {m==='login'?'Sign In':'Create Account'}
            </button>
          ))}
        </div>

        {mode==='register'&&<>
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder='Username' style={inp}/>
          <input value={farmNameL} onChange={e=>setFarmNameL(e.target.value)} placeholder='🏡 Farm Name' style={inp}/>
        </>}
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder='Email address' type="email" style={inp}/>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder='Password' type="password" style={{...inp,marginBottom:error?10:18}}/>

        {error&&<div style={{background:'rgba(220,38,38,0.3)',border:'1px solid rgba(255,100,100,0.4)',borderRadius:12,padding:'9px 14px',fontSize:12,color:'#fca5a5',marginBottom:14,fontWeight:700}}>{error}</div>}

        <button onClick={submit} disabled={loading} style={{width:'100%',background:loading?'rgba(255,255,255,0.1)':'linear-gradient(135deg,#4ade80,#22c55e)',color:'#fff',border:'none',borderRadius:16,padding:'14px',fontSize:15,fontWeight:900,cursor:loading?'default':'pointer',boxShadow:loading?'none':'0 6px 24px rgba(74,222,128,0.4)',transition:'all .2s',letterSpacing:.3}}>
          {loading?'⏳ Please wait..':mode==='login'?'🌾 Sign In':'🚀 Start Farming'}
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
  if(checking)return<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'linear-gradient(160deg,#1e4d2b 0%,#2d6e3e 40%,#0f3321 100%)',fontFamily:'system-ui,sans-serif'}}><div style={{fontSize:64,marginBottom:16,filter:'drop-shadow(0 4px 16px rgba(0,0,0,0.4))'}}>🌾</div><div style={{fontSize:18,color:'#fff',fontWeight:900,letterSpacing:1,textShadow:'0 2px 8px rgba(0,0,0,0.4)'}}>Loading Harvest Haven...</div><div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:8,letterSpacing:1}}>by codAR</div><div style={{width:120,height:4,background:'rgba(255,255,255,0.2)',borderRadius:20,marginTop:16,overflow:'hidden'}}><div style={{width:'60%',height:'100%',background:'#4ade80',borderRadius:20,animation:'none'}}/></div></div>;
  if(!user)return<AuthScreen onLogin={setUser}/>;
  return<HarvestHaven user={user} onSignOut={()=>signOut(auth).then(()=>setUser(null))}/>;
}