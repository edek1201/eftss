/**
 * EFT Tactical 2D - Authoritative Weapons Arsenal & Ballistics Data
 * Extended with full tactical arsenal, rare barter items, medicals, body armor, and loot tables.
 */

export const WEAPON_REGISTRY = {
  m4a1: {
    id: 'm4a1',
    name: 'Colt M4A1 5.56x45',
    type: 'weapon',
    category: 'assault_rifle',
    caliber: '5.56x45mm NATO',
    ammoType: '5.56x45mm M855A1 AP',
    magSize: 30,
    rpm: 800,
    cyclicRateMs: 105,
    fireModes: ['SEMI', 'AUTO'],
    defaultFireMode: 'AUTO',
    bulletSpeed: 950,
    damage: 42,
    spread: 0.012,
    bloom: 0.02,
    recoil: 3.5,
    soundType: 'm4a1',
    w: 5, h: 2,
    color: '#d4a359',
    tag: 'PRIMARY',
    sub: '5.56x45 NATO',
    rarity: 'tactical',
    price: 95000,
    compatibleMags: ['mag_stanag_30'],
    defaultMag: 'mag_stanag_30',
    compatibleAmmo: ['ammo_m855a1']
  },
  ak74m: {
    id: 'ak74m',
    name: 'Kalashnikov AK-74M 5.45x39',
    type: 'weapon',
    category: 'assault_rifle',
    caliber: '5.45x39mm',
    ammoType: '5.45x39mm BT Armor Piercing',
    magSize: 30,
    rpm: 650,
    cyclicRateMs: 135,
    fireModes: ['SEMI', 'AUTO'],
    defaultFireMode: 'AUTO',
    bulletSpeed: 890,
    damage: 49,
    spread: 0.015,
    bloom: 0.026,
    recoil: 4.8,
    soundType: 'ak74m',
    w: 5, h: 2,
    color: '#e67e22',
    tag: 'PRIMARY',
    sub: '5.45x39 Russian',
    rarity: 'tactical',
    price: 48000,
    compatibleMags: ['mag_ak74_30', 'mag_rpk_95'],
    defaultMag: 'mag_ak74_30',
    compatibleAmmo: ['ammo_bt']
  },
  asval: {
    id: 'asval',
    name: 'AS VAL Suppressed 9x39',
    type: 'weapon',
    category: 'assault_rifle',
    caliber: '9x39mm SP-6',
    ammoType: '9x39mm SP-6 Armor Piercing',
    magSize: 20,
    rpm: 900,
    cyclicRateMs: 66,
    fireModes: ['SEMI', 'AUTO'],
    defaultFireMode: 'AUTO',
    bulletSpeed: 750,
    damage: 54,
    spread: 0.011,
    bloom: 0.022,
    recoil: 2.8,
    soundType: 'val_suppressed',
    w: 5, h: 2,
    color: '#16a085',
    tag: 'PRIMARY',
    sub: '9x39mm Subsonic',
    rarity: 'rare',
    price: 135000,
    compatibleMags: ['mag_val_20', 'mag_vss_10'],
    defaultMag: 'mag_val_20',
    compatibleAmmo: ['ammo_sp6']
  },
  vss: {
    id: 'vss',
    name: 'VSS Vintorez Marksman 9x39',
    type: 'weapon',
    category: 'marksman',
    caliber: '9x39mm SP-5',
    ammoType: '9x39mm SP-5 Sniper Subsonic',
    magSize: 10,
    rpm: 700,
    cyclicRateMs: 85,
    fireModes: ['SEMI', 'AUTO'],
    defaultFireMode: 'SEMI',
    bulletSpeed: 760,
    damage: 64,
    spread: 0.007,
    bloom: 0.035,
    recoil: 3.2,
    soundType: 'val_suppressed',
    w: 5, h: 2,
    color: '#27ae60',
    tag: 'MARKSMAN',
    sub: '9x39mm Marksman',
    rarity: 'rare',
    price: 120000,
    compatibleMags: ['mag_vss_10', 'mag_val_20'],
    defaultMag: 'mag_vss_10',
    compatibleAmmo: ['ammo_sp6']
  },
  vector: {
    id: 'vector',
    name: 'KRISS Vector Gen II 9x19',
    type: 'weapon',
    category: 'smg',
    caliber: '9x19mm Parabellum',
    ammoType: '9x19mm Pst gzh AP',
    magSize: 33,
    rpm: 1100,
    cyclicRateMs: 54,
    fireModes: ['SEMI', 'AUTO'],
    defaultFireMode: 'AUTO',
    bulletSpeed: 840,
    damage: 34,
    spread: 0.017,
    bloom: 0.018,
    recoil: 2.1,
    soundType: 'smg_fast',
    w: 4, h: 2,
    color: '#9b59b6',
    tag: 'PRIMARY',
    sub: '1100 RPM CQB',
    rarity: 'rare',
    price: 98000,
    compatibleMags: ['mag_vector_33', 'mag_glock_17'],
    defaultMag: 'mag_vector_33',
    compatibleAmmo: ['ammo_pst']
  },
  mpx: {
    id: 'mpx',
    name: 'SIG MPX 9x19 CQB',
    type: 'weapon',
    category: 'smg',
    caliber: '9x19mm Parabellum',
    ammoType: '9x19mm Pst gzh',
    magSize: 30,
    rpm: 850,
    cyclicRateMs: 70,
    fireModes: ['SEMI', 'AUTO'],
    defaultFireMode: 'AUTO',
    bulletSpeed: 820,
    damage: 36,
    spread: 0.014,
    bloom: 0.016,
    recoil: 2.3,
    soundType: 'mp5',
    w: 4, h: 2,
    color: '#2980b9',
    tag: 'PRIMARY',
    sub: '9x19mm Tactical',
    rarity: 'tactical',
    price: 74000,
    compatibleMags: ['mag_mpx_30'],
    defaultMag: 'mag_mpx_30',
    compatibleAmmo: ['ammo_pst']
  },
  saiga12: {
    id: 'saiga12',
    name: 'Saiga-12K Semi-Auto 12ga',
    type: 'weapon',
    category: 'shotgun',
    caliber: '12/70 Gauge',
    ammoType: '12/70 Magnum Buckshot',
    magSize: 10,
    rpm: 350,
    cyclicRateMs: 170,
    fireModes: ['SEMI'],
    defaultFireMode: 'SEMI',
    bulletSpeed: 680,
    damage: 82,
    spread: 0.045,
    bloom: 0.05,
    recoil: 6.8,
    soundType: 'shotgun',
    w: 5, h: 2,
    color: '#c0392b',
    tag: 'SHOTGUN',
    sub: '12/70 Devastator',
    rarity: 'tactical',
    price: 52000,
    compatibleMags: ['mag_saiga_10'],
    defaultMag: 'mag_saiga_10',
    compatibleAmmo: ['ammo_12ga']
  },
  mp5: {
    id: 'mp5',
    name: 'HK MP5 9x19',
    type: 'weapon',
    category: 'smg',
    caliber: '9x19mm',
    ammoType: '9x19mm Pst gzh',
    magSize: 30,
    rpm: 850,
    cyclicRateMs: 95,
    fireModes: ['SEMI', 'AUTO'],
    defaultFireMode: 'AUTO',
    bulletSpeed: 820,
    damage: 34,
    spread: 0.018,
    bloom: 0.015,
    recoil: 2.2,
    soundType: 'mp5',
    w: 4, h: 2,
    color: '#3498db',
    tag: 'PRIMARY',
    sub: '9x19mm Submachine',
    rarity: 'tactical',
    price: 42000,
    compatibleMags: ['mag_mp5_30'],
    defaultMag: 'mag_mp5_30',
    compatibleAmmo: ['ammo_pst']
  },
  mosin: {
    id: 'mosin',
    name: 'Mosin Nagant 7.62x54R Sniper',
    type: 'weapon',
    category: 'sniper',
    caliber: '7.62x54R',
    ammoType: '7.62x54R LPS Gzh AP',
    magSize: 5,
    rpm: 42,
    cyclicRateMs: 1400,
    fireModes: ['SEMI'],
    defaultFireMode: 'SEMI',
    bulletSpeed: 1150,
    damage: 98,
    spread: 0.003,
    bloom: 0.06,
    recoil: 8.5,
    soundType: 'mosin',
    w: 6, h: 1,
    color: '#8e44ad',
    tag: 'SNIPER',
    sub: '7.62x54R Bolt Action',
    rarity: 'tactical',
    price: 38000,
    internalMag: true,
    compatibleMags: [],
    compatibleAmmo: ['ammo_lps']
  },
  rpk16: {
    id: 'rpk16',
    name: 'RPK-16 Light Machine Gun 5.45x39',
    type: 'weapon',
    category: 'lmg',
    caliber: '5.45x39mm',
    ammoType: '5.45x39mm PPGS Drum',
    magSize: 60,
    rpm: 650,
    cyclicRateMs: 92,
    fireModes: ['SEMI', 'AUTO'],
    defaultFireMode: 'AUTO',
    bulletSpeed: 910,
    damage: 50,
    spread: 0.013,
    bloom: 0.024,
    recoil: 3.8,
    soundType: 'ak74m',
    w: 6, h: 2,
    color: '#f39c12',
    tag: 'LMG',
    sub: '60-RND Drum Boss Gear',
    rarity: 'gold',
    price: 180000,
    compatibleMags: ['mag_rpk_95', 'mag_ak74_30'],
    defaultMag: 'mag_rpk_95',
    compatibleAmmo: ['ammo_bt']
  },
  goldentt: {
    id: 'goldentt',
    name: 'Golden TT-33 7.62x25',
    type: 'weapon',
    category: 'pistol',
    caliber: '7.62x25mm Tokarev',
    ammoType: '7.62x25mm Pst Gzh',
    magSize: 8,
    rpm: 450,
    cyclicRateMs: 130,
    fireModes: ['SEMI'],
    defaultFireMode: 'SEMI',
    bulletSpeed: 820,
    damage: 46,
    spread: 0.014,
    bloom: 0.02,
    recoil: 2.6,
    soundType: 'pistol',
    w: 2, h: 1,
    color: '#f1c40f',
    tag: 'SIDEARM',
    sub: 'Solid Gold Reshala Sidearm',
    rarity: 'gold',
    price: 120000,
    compatibleMags: ['mag_tt_8'],
    defaultMag: 'mag_tt_8',
    compatibleAmmo: ['ammo_tt']
  },
  glock17: {
    id: 'glock17',
    name: 'Glock 17 9x19',
    type: 'weapon',
    category: 'pistol',
    caliber: '9x19mm',
    ammoType: '9x19mm Pst gzh',
    magSize: 17,
    rpm: 450,
    cyclicRateMs: 160,
    fireModes: ['SEMI'],
    defaultFireMode: 'SEMI',
    bulletSpeed: 780,
    damage: 32,
    spread: 0.016,
    bloom: 0.025,
    recoil: 2.8,
    soundType: 'pistol',
    w: 2, h: 1,
    color: '#95a5a6',
    tag: 'SIDEARM',
    sub: '9x19mm Handgun',
    rarity: 'common',
    price: 18000,
    compatibleMags: ['mag_glock_17', 'mag_vector_33'],
    defaultMag: 'mag_glock_17',
    compatibleAmmo: ['ammo_pst']
  },
  melee: {
    id: 'melee',
    name: 'BARE HANDS / HATCHET',
    type: 'melee',
    category: 'melee',
    caliber: 'None',
    ammoType: 'NONE',
    magSize: 0,
    rpm: 60,
    cyclicRateMs: 600,
    fireModes: ['SEMI'],
    defaultFireMode: 'SEMI',
    bulletSpeed: 0,
    damage: 35,
    spread: 0,
    bloom: 0,
    recoil: 0,
    soundType: 'none',
    w: 1, h: 1,
    color: '#7f8c8d',
    tag: 'MELEE',
    sub: 'Hatchet Run',
    rarity: 'common',
    price: 0,
    internalMag: false,
    compatibleMags: [],
    compatibleAmmo: []
  }
};

/**
 * Universal Item Database for In-Raid Containers, Traders, and Stash
 */
export const ITEM_CATALOG = {
  // --- MEDICAL & PAINKILLERS ---
  golden_star: {
    id: 'golden_star',
    name: 'GOLDEN STAR BALM',
    type: 'med',
    category: 'painkiller',
    w: 1, h: 1,
    color: '#f1c40f',
    tag: 'PAIN',
    sub: '90s No-Pain (10 uses)',
    rarity: 'rare',
    price: 42000,
    uses: 10,
    painDurationSec: 90
  },
  morphine: {
    id: 'morphine',
    name: 'MORPHINE INJECTOR',
    type: 'med',
    category: 'painkiller',
    w: 1, h: 1,
    color: '#1abc9c',
    tag: 'INJECTOR',
    sub: 'Instant 90s Sprint',
    rarity: 'tactical',
    price: 24000,
    uses: 1,
    painDurationSec: 90
  },
  grizzly: {
    id: 'grizzly',
    name: 'GRIZZLY MEDICAL KIT',
    type: 'med',
    category: 'medkit',
    w: 2, h: 2,
    color: '#e74c3c',
    tag: 'TRAUMA',
    sub: '1800 / 1800 HP & All Wounds',
    rarity: 'gold',
    price: 85000,
    hpCapacity: 1800,
    healsBleed: true,
    healsFracture: true
  },
  salewa: {
    id: 'salewa',
    name: 'SALEWA FIRST AID',
    type: 'med',
    category: 'medkit',
    w: 2, h: 2,
    color: '#e74c3c',
    tag: 'HEAL',
    sub: '400 / 400 HP',
    rarity: 'tactical',
    price: 28000,
    hpCapacity: 400,
    healsBleed: true
  },
  ai2: {
    id: 'ai2',
    name: 'AI-2 MEDKIT',
    type: 'med',
    category: 'medkit',
    w: 1, h: 2,
    color: '#e67e22',
    tag: 'MED',
    sub: '100 / 100 HP',
    rarity: 'common',
    price: 8000,
    hpCapacity: 100
  },
  bandage: {
    id: 'bandage',
    name: 'ESMARCH TOURNIQUET',
    type: 'med',
    category: 'bleed',
    w: 1, h: 1,
    color: '#2ecc71',
    tag: 'BLEED',
    sub: 'Heavy Bleed Stop',
    rarity: 'common',
    price: 3500
  },
  splint: {
    id: 'splint',
    name: 'IMMOBILIZING SPLINT',
    type: 'med',
    category: 'fracture',
    w: 1, h: 1,
    color: '#9b59b6',
    tag: 'FRACTURE',
    sub: 'Repairs Broken Bones',
    rarity: 'common',
    price: 4000
  },

  // --- BODY ARMOR & HELMETS ---
  armor_trooper: {
    id: 'armor_trooper',
    name: 'HIGHCOM TROOPER T4',
    type: 'armor',
    armorClass: 4,
    durability: 85,
    maxDurability: 85,
    w: 2, h: 3,
    color: '#27ae60',
    tag: 'ARMOR T4',
    sub: '85 / 85 Durability',
    rarity: 'tactical',
    price: 72000
  },
  armor_korund: {
    id: 'armor_korund',
    name: 'KORUND-VM ARMOR T5',
    type: 'armor',
    armorClass: 5,
    durability: 45,
    maxDurability: 45,
    w: 2, h: 3,
    color: '#2c3e50',
    tag: 'ARMOR T5',
    sub: '45 / 45 Heavy Ceramic',
    rarity: 'rare',
    price: 95000
  },
  armor_maska: {
    id: 'armor_maska',
    name: 'MASKA-1SCH HELMET T5',
    type: 'helmet',
    armorClass: 5,
    durability: 60,
    maxDurability: 60,
    w: 2, h: 2,
    color: '#34495e',
    tag: 'HELMET T5',
    sub: 'Killa Steel Visor',
    rarity: 'gold',
    price: 110000
  },

  // --- HIGH-TIER BARTER, TECH & VALUABLES ---
  bitcoin: {
    id: 'bitcoin',
    name: 'PHYSICAL BITCOIN (0.2 BTC)',
    type: 'valuable',
    w: 1, h: 1,
    color: '#f1c40f',
    tag: 'VALUABLE',
    sub: 'Crypto Currency Gold',
    rarity: 'gold',
    price: 450000
  },
  gpu: {
    id: 'gpu',
    name: 'GRAPHICS CARD (GPU)',
    type: 'valuable',
    w: 1, h: 2,
    color: '#00d2d3',
    tag: 'TECH',
    sub: 'Rare Mining Hardware',
    rarity: 'gold',
    price: 320000
  },
  ledx: {
    id: 'ledx',
    name: 'LEDX TRANSILLUMINATOR',
    type: 'valuable',
    w: 1, h: 1,
    color: '#a55eea',
    tag: 'TECH',
    sub: 'Ultra-Rare Medical Device',
    rarity: 'gold',
    price: 680000
  },
  flashdrive: {
    id: 'flashdrive',
    name: 'SECURE FLASH DRIVE',
    type: 'valuable',
    w: 1, h: 1,
    color: '#3498db',
    tag: 'INTEL',
    sub: 'Classified Encrypted Data',
    rarity: 'rare',
    price: 95000
  },
  tetriz: {
    id: 'tetriz',
    name: 'TETRIZ PORTABLE GAME',
    type: 'valuable',
    w: 1, h: 2,
    color: '#e67e22',
    tag: 'BARTER',
    sub: 'Retro Game Consoles',
    rarity: 'rare',
    price: 180000
  },
  labs_keycard: {
    id: 'labs_keycard',
    name: 'LABS ACCESS KEYCARD',
    type: 'valuable',
    w: 1, h: 1,
    color: '#e74c3c',
    tag: 'KEYCARD',
    sub: 'TerraGroup Labs Entry',
    rarity: 'gold',
    price: 250000
  },

  // --- TACTICAL MAGAZINES & DRUMS ---
  mag_stanag_30: {
    id: 'mag_stanag_30',
    name: 'STANAG 30-rnd 5.56x45',
    type: 'magazine',
    category: 'magazine',
    caliber: '5.56x45mm NATO',
    ammo: 30,
    maxAmmo: 30,
    w: 1, h: 2,
    color: '#d4a359',
    tag: 'MAG 5.56',
    sub: '30 / 30 Rounds',
    rarity: 'tactical',
    price: 9500
  },
  mag_ak74_30: {
    id: 'mag_ak74_30',
    name: '6L23 30-rnd 5.45x39',
    type: 'magazine',
    category: 'magazine',
    caliber: '5.45x39mm',
    ammo: 30,
    maxAmmo: 30,
    w: 1, h: 2,
    color: '#e67e22',
    tag: 'MAG 5.45',
    sub: '30 / 30 Rounds',
    rarity: 'tactical',
    price: 6500
  },
  mag_rpk_95: {
    id: 'mag_rpk_95',
    name: 'RPK-16 60-rnd 5.45 Drum',
    type: 'magazine',
    category: 'magazine',
    caliber: '5.45x39mm',
    ammo: 60,
    maxAmmo: 60,
    w: 2, h: 2,
    color: '#f39c12',
    tag: 'DRUM 5.45',
    sub: '60 / 60 Drum Mag',
    rarity: 'gold',
    price: 45000
  },
  mag_val_20: {
    id: 'mag_val_20',
    name: '6P29 20-rnd 9x39',
    type: 'magazine',
    category: 'magazine',
    caliber: '9x39mm SP-6',
    ammo: 20,
    maxAmmo: 20,
    w: 1, h: 2,
    color: '#16a085',
    tag: 'MAG 9x39',
    sub: '20 / 20 Rounds',
    rarity: 'rare',
    price: 18000
  },
  mag_vss_10: {
    id: 'mag_vss_10',
    name: 'VSS 10-rnd 9x39',
    type: 'magazine',
    category: 'magazine',
    caliber: '9x39mm SP-5',
    ammo: 10,
    maxAmmo: 10,
    w: 1, h: 1,
    color: '#27ae60',
    tag: 'MAG 9x39',
    sub: '10 / 10 Rounds',
    rarity: 'tactical',
    price: 9000
  },
  mag_vector_33: {
    id: 'mag_vector_33',
    name: 'Vector 33-rnd 9x19',
    type: 'magazine',
    category: 'magazine',
    caliber: '9x19mm Parabellum',
    ammo: 33,
    maxAmmo: 33,
    w: 1, h: 2,
    color: '#9b59b6',
    tag: 'MAG 9x19',
    sub: '33 / 33 Rounds',
    rarity: 'rare',
    price: 14000
  },
  mag_mpx_30: {
    id: 'mag_mpx_30',
    name: 'MPX 30-rnd 9x19',
    type: 'magazine',
    category: 'magazine',
    caliber: '9x19mm Parabellum',
    ammo: 30,
    maxAmmo: 30,
    w: 1, h: 2,
    color: '#2980b9',
    tag: 'MAG 9x19',
    sub: '30 / 30 Rounds',
    rarity: 'tactical',
    price: 11000
  },
  mag_mp5_30: {
    id: 'mag_mp5_30',
    name: 'MP5 30-rnd 9x19',
    type: 'magazine',
    category: 'magazine',
    caliber: '9x19mm',
    ammo: 30,
    maxAmmo: 30,
    w: 1, h: 2,
    color: '#3498db',
    tag: 'MAG 9x19',
    sub: '30 / 30 Rounds',
    rarity: 'tactical',
    price: 7500
  },
  mag_saiga_10: {
    id: 'mag_saiga_10',
    name: 'Saiga-12 10-rnd 12ga',
    type: 'magazine',
    category: 'magazine',
    caliber: '12/70 Gauge',
    ammo: 10,
    maxAmmo: 10,
    w: 1, h: 2,
    color: '#c0392b',
    tag: 'MAG 12GA',
    sub: '10 / 10 Shells',
    rarity: 'tactical',
    price: 8500
  },
  mag_glock_17: {
    id: 'mag_glock_17',
    name: 'Glock 17-rnd 9x19',
    type: 'magazine',
    category: 'magazine',
    caliber: '9x19mm',
    ammo: 17,
    maxAmmo: 17,
    w: 1, h: 1,
    color: '#95a5a6',
    tag: 'MAG 9x19',
    sub: '17 / 17 Rounds',
    rarity: 'common',
    price: 4000
  },
  mag_tt_8: {
    id: 'mag_tt_8',
    name: 'TT-33 8-rnd 7.62x25',
    type: 'magazine',
    category: 'magazine',
    caliber: '7.62x25mm Tokarev',
    ammo: 8,
    maxAmmo: 8,
    w: 1, h: 1,
    color: '#f1c40f',
    tag: 'MAG TT',
    sub: '8 / 8 Rounds',
    rarity: 'common',
    price: 3500
  },

  // --- AMMUNITION PACKS ---
  ammo_m855a1: {
    id: 'ammo_m855a1',
    name: '5.56x45 M855A1 AP (60)',
    type: 'ammo',
    category: 'ammo',
    caliber: '5.56x45mm NATO',
    count: 60,
    maxCount: 60,
    w: 1, h: 1,
    color: '#f1c40f',
    tag: 'AMMO',
    sub: '60 AP Rounds',
    rarity: 'tactical',
    price: 18000
  },
  ammo_bt: {
    id: 'ammo_bt',
    name: '5.45x39 BT AP (60)',
    type: 'ammo',
    category: 'ammo',
    caliber: '5.45x39mm',
    count: 60,
    maxCount: 60,
    w: 1, h: 1,
    color: '#f39c12',
    tag: 'AMMO',
    sub: '60 Tracer AP',
    rarity: 'tactical',
    price: 16000
  },
  ammo_sp6: {
    id: 'ammo_sp6',
    name: '9x39mm SP-6 AP (40)',
    type: 'ammo',
    category: 'ammo',
    caliber: '9x39mm SP-6',
    count: 40,
    maxCount: 40,
    w: 1, h: 1,
    color: '#16a085',
    tag: 'AMMO',
    sub: '40 Subsonic AP',
    rarity: 'rare',
    price: 22000
  },
  ammo_lps: {
    id: 'ammo_lps',
    name: '7.62x54R LPS GZH (20)',
    type: 'ammo',
    category: 'ammo',
    caliber: '7.62x54R',
    count: 20,
    maxCount: 20,
    w: 1, h: 1,
    color: '#8e44ad',
    tag: 'AMMO',
    sub: '20 Sniper Rounds',
    rarity: 'tactical',
    price: 15000
  },
  ammo_pst: {
    id: 'ammo_pst',
    name: '9x19mm PST GZH (50)',
    type: 'ammo',
    category: 'ammo',
    caliber: '9x19mm',
    count: 50,
    maxCount: 50,
    w: 1, h: 1,
    color: '#95a5a6',
    tag: 'AMMO',
    sub: '50 SMG Rounds',
    rarity: 'common',
    price: 9000
  },
  ammo_12ga: {
    id: 'ammo_12ga',
    name: '12/70 Magnum Buckshot (20)',
    type: 'ammo',
    category: 'ammo',
    caliber: '12/70 Gauge',
    count: 20,
    maxCount: 20,
    w: 1, h: 1,
    color: '#c0392b',
    tag: 'AMMO',
    sub: '20 Shotgun Shells',
    rarity: 'common',
    price: 8000
  },
  ammo_tt: {
    id: 'ammo_tt',
    name: '7.62x25mm Pst Gzh (35)',
    type: 'ammo',
    category: 'ammo',
    caliber: '7.62x25mm Tokarev',
    count: 35,
    maxCount: 35,
    w: 1, h: 1,
    color: '#bdc3c7',
    tag: 'AMMO',
    sub: '35 Pistol Rounds',
    rarity: 'common',
    price: 7000
  }
};

export function isWeaponItem(item) {
  if (!item) return false;
  if (item.type === 'weapon') return true;
  if (item.weaponType && WEAPON_REGISTRY[item.weaponType]) return true;
  if (item.id && WEAPON_REGISTRY[item.id]) return true;
  const tag = (item.tag || '').toUpperCase();
  const sub = (item.sub || '').toUpperCase();
  return tag.includes('PRIMARY') || tag.includes('SIDEARM') || tag.includes('SNIPER') ||
         tag.includes('MARKSMAN') || tag.includes('LMG') || tag.includes('SHOTGUN') ||
         tag.includes('RIFLE') || tag.includes('SMG') || sub.includes('RIFLE') || sub.includes('SHOTGUN');
}

export function isMagazineItem(item) {
  if (!item) return false;
  if (item.type === 'magazine' || item.type === 'mag' || item.category === 'magazine') return true;
  const tag = (item.tag || '').toUpperCase();
  const id = (item.id || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  return tag.includes('MAG') || tag.includes('DRUM') || id.startsWith('mag_') || name.includes('rnd') || name.includes('round mag') || name.includes('drum');
}

export function isAmmoItem(item) {
  if (!item) return false;
  if (item.type === 'ammo' || item.category === 'ammo') return true;
  const tag = (item.tag || '').toUpperCase();
  const id = (item.id || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  return tag.includes('AMMO') || id.startsWith('ammo_') || name.includes('ammo') || name.includes('rounds');
}

export function isCompatibleMagazine(weapon, magItem) {
  if (!weapon || !magItem) return false;
  const wepCfg = getWeaponConfig(weapon.weaponType || weapon.type || weapon.id || weapon);
  if (!wepCfg || wepCfg.type === 'melee' || wepCfg.internalMag) return false;
  if (wepCfg.compatibleMags && wepCfg.compatibleMags.includes(magItem.id)) return true;
  if (magItem.itemKey && wepCfg.compatibleMags && wepCfg.compatibleMags.includes(magItem.itemKey)) return true;

  // Caliber match
  if (wepCfg.caliber && magItem.caliber) {
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const c1 = norm(wepCfg.caliber);
    const c2 = norm(magItem.caliber);
    if (c1.slice(0, 4) === c2.slice(0, 4)) return true;
  }
  return false;
}

export function isCompatibleAmmo(target, ammoItem) {
  if (!target || !ammoItem) return false;
  let targetCaliber = target.caliber;
  if (!targetCaliber) {
    const wepCfg = getWeaponConfig(target.weaponType || target.type || target.id || target);
    if (wepCfg) targetCaliber = wepCfg.caliber;
  }
  const ammoCaliber = ammoItem.caliber;
  if (!targetCaliber || !ammoCaliber) return false;

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const c1 = norm(targetCaliber);
  const c2 = norm(ammoCaliber);
  return c1.includes(c2.slice(0, 4)) || c2.includes(c1.slice(0, 4));
}

export function getWeaponConfig(key) {
  if (!key) return null;

  if (typeof key === 'object') {
    const candidates = [key.weaponType, key.id, key.type, key.itemKey];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate) continue;
      const match = WEAPON_REGISTRY[candidate] || WEAPON_REGISTRY[candidate.toLowerCase()];
      if (match) return match;
    }
    return null;
  }

  if (typeof key !== 'string') return null;
  return WEAPON_REGISTRY[key] || WEAPON_REGISTRY[key.toLowerCase()] || null;
}

export function getRarityColor(rarity = 'common') {
  switch (rarity) {
    case 'gold': return '#f1c40f';
    case 'rare': return '#9b59b6';
    case 'tactical': return '#2ecc71';
    case 'common':
    default: return '#7f8c8d';
  }
}
