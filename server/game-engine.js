/**
 * EFT Tactical 2D - Server Authoritative Game Engine & Room Manager
 * Features:
 * - Authoritative 20Hz Simulation
 * - Server-Authoritative PVE Scav Bot Engine (Patrol, LOS Detection, 0.8s Reaction, Combat Firing, Death -> Lootable Corpse)
 * - Real-time Player Damage & Projectile Collision
 * - Multi-Map Room Management (Factory 60x60, Customs 100x100, Bunker 80x80)
 */

import { TacticalMap, MAP_CONFIGS } from '../shared/map.js';
import { updatePlayerMovement, resolveMapCollisions, PHYSICS_CONFIG } from '../shared/physics.js';
import { WEAPON_REGISTRY, ITEM_CATALOG } from '../shared/weapons.js';

export const SERVER_TICK_RATE = 30; // 30 Hz Authoritative Simulation
export const SERVER_TICK_DELTA = 1.0 / SERVER_TICK_RATE; // ~33.3ms
export const RAID_DURATION_SECONDS = 600; // 10:00 minutes
export const EXTRACT_REQUIRED_TIME = 7.0;

const SQUAD_COLORS = ['#2ecc71', '#00d2d3', '#ff9f43', '#a55eea'];

const SCAV_NAMES = [
  'Dima Cheburek', 'Vasya Truba', 'Grisha Zub', 'Kolyan Orez',
  'Sanya Kedr', 'Borya Lopata', 'Misha Rezkiy', 'Pasha Klesh',
  'Yura Topor', 'Kostya Shilo', 'Tolik Karas', 'Vanya Gvozd'
];

const SCAV_WEAPONS = [
  { id: 'ak74m', name: 'AK-74M 5.45x39', type: 'weapon', w: 5, h: 2, color: '#e67e22', tag: 'PRIMARY', sub: '5.45x39 PS' },
  { id: 'saiga12', name: 'Saiga-12K 12ga', type: 'weapon', w: 5, h: 2, color: '#c0392b', tag: 'SHOTGUN', sub: '12/70 Buckshot' },
  { id: 'mp5', name: 'HK MP5 9x19', type: 'weapon', w: 4, h: 2, color: '#3498db', tag: 'PRIMARY', sub: '9x19mm PM' },
  { id: 'mosin', name: 'Mosin Nagant 7.62x54R', type: 'weapon', w: 6, h: 1, color: '#8e44ad', tag: 'SNIPER', sub: '7.62x54R Bolt' }
];

export class GameRoom {
  constructor(roomCode, hostSocketId) {
    this.code = roomCode;
    this.hostSocketId = hostSocketId;
    this.state = 'LOBBY';
    this.mapId = 'factory';
    this.map = new TacticalMap(this.mapId);
    this.players = new Map();
    this.bots = []; // Living Scav AI Bots & Bosses
    this.projectiles = []; // Server-authoritative Scav & player projectiles
    this.grenades = []; // Active simulated flash & HE grenades
    this.containers = new Map();
    this.tickCount = 0;
    this.raidTimeRemaining = RAID_DURATION_SECONDS;
    this.maxPlayers = 4;
    this.intervalId = null;
    this.onSnapshotCallback = null;
    this.onBroadcastCallback = null;

    this._seedContainerLoot();
  }

  _seedContainerLoot() {
    this.containers.clear();

    const helperPlaceItem = (items, itemDef, gridW, gridH) => {
      if (!itemDef) return false;
      const w = Math.min(gridW, itemDef.w || 1);
      const h = Math.min(gridH, itemDef.h || 1);

      for (let r = 0; r <= gridH - h; r++) {
        for (let c = 0; c <= gridW - w; c++) {
          let overlap = false;
          for (const it of items) {
            const overlapX = (c < it.gx + it.w) && (c + w > it.gx);
            const overlapY = (r < it.gy + it.h) && (r + h > it.gy);
            if (overlapX && overlapY) {
              overlap = true;
              break;
            }
          }
          if (!overlap) {
            const clone = {
              id: `loot_${Math.random().toString(36).substring(2, 9)}`,
              name: itemDef.name,
              type: itemDef.type,
              w: w, h: h,
              gx: c, gy: r,
              color: itemDef.color || '#2ecc71',
              tag: itemDef.tag || 'ITEM',
              sub: itemDef.sub || '',
              rarity: itemDef.rarity || 'common',
              weaponType: itemDef.id
            };
            items.push(clone);
            return true;
          }
        }
      }
      return false;
    };

    const weaponKeys = ['asval', 'vss', 'vector', 'mpx', 'saiga12', 'm4a1', 'ak74m', 'mp5', 'mosin'];
    const techKeys = ['bitcoin', 'gpu', 'ledx', 'flashdrive', 'tetriz', 'labs_keycard'];
    const medKeys = ['golden_star', 'morphine', 'grizzly', 'salewa', 'ai2', 'bandage', 'splint'];
    const ammoKeys = ['ammo_m855a1', 'ammo_bt', 'ammo_sp6', 'ammo_lps', 'ammo_pst'];

    for (const c of this.map.containers) {
      const items = [];
      const gridW = c.gridW || 4;
      const gridH = c.gridH || 3;

      if (c.type === 'crate_military') {
        const wepKey = weaponKeys[Math.floor(Math.random() * weaponKeys.length)];
        const wepDef = WEAPON_REGISTRY[wepKey];
        if (wepDef) helperPlaceItem(items, wepDef, gridW, gridH);

        const ammoKey = ammoKeys[Math.floor(Math.random() * ammoKeys.length)];
        if (ITEM_CATALOG[ammoKey]) helperPlaceItem(items, ITEM_CATALOG[ammoKey], gridW, gridH);

        if (Math.random() < 0.35 && ITEM_CATALOG.armor_trooper) {
          helperPlaceItem(items, ITEM_CATALOG.armor_trooper, gridW, gridH);
        }
      } else if (c.type === 'corpse_scav') {
        const techKey = techKeys[Math.floor(Math.random() * techKeys.length)];
        if (ITEM_CATALOG[techKey]) helperPlaceItem(items, ITEM_CATALOG[techKey], gridW, gridH);

        const medKey = medKeys[Math.floor(Math.random() * medKeys.length)];
        if (ITEM_CATALOG[medKey]) helperPlaceItem(items, ITEM_CATALOG[medKey], gridW, gridH);

        if (Math.random() < 0.40) {
          helperPlaceItem(items, WEAPON_REGISTRY.glock17, gridW, gridH);
        }
      } else if (c.type === 'ammo_box') {
        const count = 2 + Math.floor(Math.random() * 2);
        for (let k = 0; k < count; k++) {
          const aKey = ammoKeys[Math.floor(Math.random() * ammoKeys.length)];
          if (ITEM_CATALOG[aKey]) helperPlaceItem(items, ITEM_CATALOG[aKey], gridW, gridH);
        }
      } else if (c.type === 'med_bag') {
        const count = 2 + Math.floor(Math.random() * 2);
        for (let k = 0; k < count; k++) {
          const mKey = medKeys[Math.floor(Math.random() * medKeys.length)];
          if (ITEM_CATALOG[mKey]) helperPlaceItem(items, ITEM_CATALOG[mKey], gridW, gridH);
        }
      } else {
        const pool = [...techKeys, ...medKeys, ...ammoKeys];
        for (let k = 0; k < 2; k++) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          if (ITEM_CATALOG[pick]) helperPlaceItem(items, ITEM_CATALOG[pick], gridW, gridH);
        }
      }

      this.containers.set(c.id, {
        id: c.id,
        name: c.name,
        type: c.type,
        x: c.x, y: c.y,
        gridW: gridW,
        gridH: gridH,
        items: items
      });
    }
  }

  _spawnScavBots() {
    this.bots = [];
    const count = this.map.scavCount || 8;
    const zones = this.map.scavSpawnZones || [];

    // 30% Probability of Boss Spawn per raid
    const spawnBoss = Math.random() < 0.30;
    let bossSpawned = false;

    if (spawnBoss && zones.length > 0) {
      const bossName = (this.mapId === 'bunker') ? 'Reshala' : 'Killa';
      const bossWep = (bossName === 'Killa') ? WEAPON_REGISTRY.rpk16 : WEAPON_REGISTRY.asval;
      const centerZone = zones[Math.floor(zones.length / 2)] || { x: 960, y: 960, radius: 100 };

      const bossBot = {
        id: 'scav_boss_1',
        name: `BOSS ${bossName.toUpperCase()}`,
        isScav: true,
        isBoss: true,
        bossType: bossName.toLowerCase(),
        x: centerZone.x,
        y: centerZone.y,
        vx: 0,
        vy: 0,
        radius: PHYSICS_CONFIG.PLAYER_RADIUS + 2,
        angle: Math.random() * Math.PI * 2,
        speed: 95,
        runSpeed: 215, // Fast aggressive sprint
        health: {
          head: 70, // 3x standard PMC HP
          thorax: 160,
          stomach: 140,
          leftArm: 120,
          rightArm: 120,
          leftLeg: 130,
          rightLeg: 130
        },
        maxHpTotal: 870,
        armorClass: 5,
        helmetClass: 5,
        isAlive: true,
        state: 'PATROL',
        patrolCenter: { x: centerZone.x, y: centerZone.y, radius: 140 },
        patrolTarget: { x: centerZone.x, y: centerZone.y },
        patrolTimer: 2.0,
        targetPlayerId: null,
        acquireDelay: 0.35,
        attackCooldown: 0.45,
        grenadeCooldown: 8.0,
        speechText: `${bossName.toUpperCase()} ON PATROL`,
        speechTimer: 2.5,
        voiceCooldown: 4.0,
        weapon: bossWep,
        loot: [
          {
            id: 'boss_wep_primary',
            name: bossWep.name,
            type: 'weapon',
            weaponType: bossWep.id,
            w: bossWep.w, h: bossWep.h, gx: 0, gy: 0,
            color: bossWep.color, tag: bossWep.tag, sub: bossWep.sub, rarity: 'gold'
          },
          {
            id: 'boss_wep_secondary',
            name: WEAPON_REGISTRY.goldentt.name,
            type: 'weapon',
            weaponType: 'goldentt',
            w: 2, h: 1, gx: 0, gy: 2,
            color: '#f1c40f', tag: 'SIDEARM', sub: 'Solid Gold 7.62x25', rarity: 'gold'
          },
          {
            id: 'boss_loot_keycard',
            name: 'LABS ACCESS KEYCARD',
            type: 'valuable',
            w: 1, h: 1, gx: 2, gy: 2,
            color: '#e74c3c', tag: 'KEYCARD', sub: 'TerraGroup Labs Entry', rarity: 'gold'
          },
          {
            id: 'boss_loot_bitcoin',
            name: 'PHYSICAL BITCOIN (0.2 BTC)',
            type: 'valuable',
            w: 1, h: 1, gx: 2, gy: 3,
            color: '#f1c40f', tag: 'VALUABLE', sub: '0.2 BTC Crypto', rarity: 'gold'
          },
          {
            id: 'boss_loot_grizzly',
            name: 'GRIZZLY MEDICAL KIT',
            type: 'med',
            w: 2, h: 2, gx: 0, gy: 3,
            color: '#e74c3c', tag: 'TRAUMA', sub: '1800 / 1800 HP', rarity: 'gold'
          }
        ]
      };
      this.bots.push(bossBot);
      bossSpawned = true;

      // Spawn 1-2 Armored Guards
      for (let g = 0; g < 2; g++) {
        const guardWep = (g === 0) ? WEAPON_REGISTRY.ak74m : WEAPON_REGISTRY.saiga12;
        const gAngle = Math.random() * Math.PI * 2;
        const guardBot = {
          id: `boss_guard_${g + 1}`,
          name: `Zavodskoy Guard ${g + 1}`,
          isScav: true,
          isGuard: true,
          leaderBotId: bossBot.id,
          x: centerZone.x + Math.cos(gAngle) * 55,
          y: centerZone.y + Math.sin(gAngle) * 55,
          vx: 0, vy: 0,
          radius: PHYSICS_CONFIG.PLAYER_RADIUS,
          angle: gAngle,
          speed: 85,
          runSpeed: 180,
          health: {
            head: 45, thorax: 110, stomach: 90, leftArm: 80, rightArm: 80, leftLeg: 85, rightLeg: 85
          },
          maxHpTotal: 575,
          armorClass: 4,
          isAlive: true,
          state: 'PATROL',
          patrolCenter: { x: centerZone.x, y: centerZone.y, radius: 120 },
          patrolTarget: { x: centerZone.x, y: centerZone.y },
          patrolTimer: 2.0,
          targetPlayerId: null,
          acquireDelay: 0.5,
          attackCooldown: 0.7,
          speechText: null,
          speechTimer: 0,
          voiceCooldown: 6.0,
          weapon: guardWep,
          loot: [
            {
              id: `guard_wep_${g}`,
              name: guardWep.name,
              type: 'weapon',
              weaponType: guardWep.id,
              w: guardWep.w, h: guardWep.h, gx: 0, gy: 0,
              color: guardWep.color, tag: guardWep.tag, sub: guardWep.sub, rarity: 'rare'
            },
            {
              id: `guard_armor_${g}`,
              name: 'HIGHCOM TROOPER T4',
              type: 'armor',
              w: 2, h: 3, gx: 0, gy: 2,
              color: '#27ae60', tag: 'ARMOR T4', sub: '85 / 85 Durability', rarity: 'tactical'
            },
            {
              id: `guard_med_${g}`,
              name: 'SALEWA FIRST AID',
              type: 'med',
              w: 2, h: 2, gx: 2, gy: 2,
              color: '#e74c3c', tag: 'HEAL', sub: '400 / 400 HP', rarity: 'tactical'
            }
          ]
        };
        this.bots.push(guardBot);
      }
      console.log(`[👑] BOSS ${bossName.toUpperCase()} & Elite Guards Spawned in raid!`);
    }

    // Spawn Regular Scavs in pairs / fireteams
    const regularCount = Math.max(4, count - (bossSpawned ? 3 : 0));
    for (let i = 0; i < regularCount; i++) {
      const zoneIdx = Math.floor(i / 2) % zones.length;
      const zone = zones[zoneIdx] || { x: 500, y: 500, radius: 100 };
      const name = SCAV_NAMES[i % SCAV_NAMES.length];
      const wep = SCAV_WEAPONS[i % SCAV_WEAPONS.length];

      const isLeader = (i % 2 === 0);
      const leaderId = isLeader ? null : `scav_bot_${i}`;

      const ox = (Math.random() * 2 - 1) * (zone.radius * 0.5);
      const oy = (Math.random() * 2 - 1) * (zone.radius * 0.5);

      const bot = {
        id: `scav_bot_${i + 1}`,
        name: name,
        isScav: true,
        isLeader: isLeader,
        leaderBotId: leaderId,
        x: zone.x + ox,
        y: zone.y + oy,
        vx: 0,
        vy: 0,
        radius: PHYSICS_CONFIG.PLAYER_RADIUS,
        angle: Math.random() * Math.PI * 2,
        speed: 70,
        runSpeed: 160,
        health: {
          head: 35, thorax: 85, stomach: 70, leftArm: 60, rightArm: 60, leftLeg: 65, rightLeg: 65
        },
        maxHpTotal: 440,
        armorClass: 2,
        isAlive: true,
        state: 'PATROL',
        patrolCenter: { x: zone.x, y: zone.y, radius: zone.radius },
        patrolTarget: { x: zone.x + ox, y: zone.y + oy },
        patrolTimer: Math.random() * 4,
        targetPlayerId: null,
        acquireDelay: 0.6,
        attackCooldown: 0.7,
        speechText: null,
        speechTimer: 0,
        voiceCooldown: Math.random() * 10 + 5,
        weapon: wep,
        loot: [
          {
            id: `loot_bot_${i}_wep`,
            name: wep.name,
            type: 'weapon',
            weaponType: wep.id,
            w: wep.w, h: wep.h, gx: 0, gy: 0,
            color: wep.color, tag: wep.tag, sub: wep.sub, rarity: 'common'
          },
          {
            id: `loot_bot_${i}_ammo`,
            name: 'Scav Loose Ammo',
            type: 'ammo',
            w: 1, h: 1, gx: 0, gy: 2,
            color: '#f39c12', tag: 'AMMO', sub: '30 Rounds', rarity: 'common'
          },
          {
            id: `loot_bot_${i}_rubles`,
            name: 'Roubles Stack (8500₽)',
            type: 'valuable',
            w: 1, h: 1, gx: 1, gy: 2,
            color: '#f1c40f', tag: 'CASH', sub: '8,500 ₽', rarity: 'common'
          }
        ]
      };
      this.bots.push(bot);
    }
    console.log(`[+] Spawned ${this.bots.length} Scav AI Bots across patrol zones on [${this.map.name}]`);
  }

  addPlayer(socketId, playerName = 'USEC_Operator') {
    if (this.players.size >= this.maxPlayers) return null;

    if (!this.hostSocketId) this.hostSocketId = socketId;

    const slot = this._findAvailableSlot();
    const spawn = this.map.getSpawnPoint(slot);

    const player = {
      id: socketId,
      name: (playerName || `Operator_${slot + 1}`).substring(0, 16),
      slot: slot,
      color: SQUAD_COLORS[slot],
      isHost: (socketId === this.hostSocketId),
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      radius: PHYSICS_CONFIG.PLAYER_RADIUS,
      angle: spawn.angle,
      stamina: PHYSICS_CONFIG.MAX_STAMINA,
      isSprinting: false,
      isCrouching: false,
      isAiming: false,
      isFiring: false,
      isAlive: true,
      extracted: false,
      extractTimer: 0,
      currentExtractZone: null,
      scavKills: 0,
      isBleeding: false,
      bleedTimer: 0,
      painkillerTimer: 0,
      health: {
        head: 35,
        thorax: 85,
        stomach: 70,
        leftArm: 60,
        rightArm: 60,
        leftLeg: 65,
        rightLeg: 65
      },
      lastProcessedInputSeq: 0,
      inputQueue: []
    };

    this.players.set(socketId, player);
    return player;
  }

  _findAvailableSlot() {
    const usedSlots = new Set();
    for (const p of this.players.values()) usedSlots.add(p.slot);
    for (let i = 0; i < this.maxPlayers; i++) {
      if (!usedSlots.has(i)) return i;
    }
    return 0;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;

    this.players.delete(socketId);

    if (this.hostSocketId === socketId && this.players.size > 0) {
      const nextHost = this.players.values().next().value;
      this.hostSocketId = nextHost.id;
      nextHost.isHost = true;
    }

    return player;
  }

  selectMap(socketId, newMapId) {
    if (socketId !== this.hostSocketId) return { success: false, reason: 'Only squad host can select map.' };
    if (this.state !== 'LOBBY') return { success: false, reason: 'Cannot change map during raid.' };
    if (!MAP_CONFIGS[newMapId]) return { success: false, reason: 'Invalid map.' };

    this.mapId = newMapId;
    this.map = new TacticalMap(newMapId);
    this._seedContainerLoot();

    for (const p of this.players.values()) {
      const sp = this.map.getSpawnPoint(p.slot);
      p.x = sp.x;
      p.y = sp.y;
      p.angle = sp.angle;
    }

    return { success: true, mapId: this.mapId, mapName: this.map.name };
  }

  deployRaid(socketId) {
    if (socketId !== this.hostSocketId) return { success: false, reason: 'Only host can deploy.' };
    if (this.state === 'IN_RAID') return { success: false, reason: 'Raid already started.' };

    this.state = 'IN_RAID';
    this.raidTimeRemaining = RAID_DURATION_SECONDS;
    this.tickCount = 0;

    for (const p of this.players.values()) {
      const sp = this.map.getSpawnPoint(p.slot);
      p.x = sp.x;
      p.y = sp.y;
      p.vx = 0;
      p.vy = 0;
      p.angle = sp.angle;
      p.stamina = PHYSICS_CONFIG.MAX_STAMINA;
      p.extracted = false;
      p.extractTimer = 0;
      p.isAlive = true;
      p.scavKills = 0;
      p.inputQueue = [];
    }

    // Spawn Living PVE Scav Bots & clear projectiles
    this.projectiles = [];
    this._spawnScavBots();

    return { success: true };
  }

  getLobbyState() {
    const squadList = [];
    for (const p of this.players.values()) {
      squadList.push({
        id: p.id,
        name: p.name,
        slot: p.slot,
        color: p.color,
        isHost: (p.id === this.hostSocketId)
      });
    }

    return {
      roomCode: this.code,
      hostId: this.hostSocketId,
      state: this.state,
      mapId: this.mapId,
      mapName: this.map.name,
      cqbTag: this.map.cqbTag,
      description: this.map.description,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      squad: squadList
    };
  }

  getContainerData(containerId) {
    return this.containers.get(containerId) || null;
  }

  transferContainerItem(containerId, itemId, action, targetItem) {
    const container = this.containers.get(containerId);
    if (!container) return false;

    if (action === 'take') {
      const idx = container.items.findIndex(it => it.id === itemId);
      if (idx !== -1) {
        container.items.splice(idx, 1);
        if (container.type === 'weapon_drop' && container.items.length === 0) {
          this.containers.delete(containerId);
        }
        return true;
      }
    } else if (action === 'put' && targetItem) {
      container.items.push(targetItem);
      return true;
    }
    return false;
  }

  dropWeapon(socketId, itemId, weaponType, sourceContainerId = null, ammoCur = null, ammoMax = null) {
    const player = this.players.get(socketId);
    if (this.state !== 'IN_RAID' || !player || !player.isAlive || player.extracted) return null;

    const weaponDef = WEAPON_REGISTRY[weaponType];
    if (!weaponDef) return null;

    let itemState = null;
    let sourceContainer = null;
    let sourceItemIndex = -1;
    if (sourceContainerId) {
      sourceContainer = this.containers.get(sourceContainerId);
      if (!sourceContainer) return null;
      sourceItemIndex = sourceContainer.items.findIndex(item =>
        item.id === itemId && item.weaponType === weaponType
      );
      if (sourceItemIndex === -1) return null;
      itemState = sourceContainer.items[sourceItemIndex];
    }

    const groundItem = {
      ...weaponDef,
      ...(itemState || {}),
      id: `ground_weapon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'weapon',
      weaponType: weaponDef.id,
      name: weaponDef.name,
      w: weaponDef.w,
      h: weaponDef.h,
      gx: 0,
      gy: 0,
      color: weaponDef.color,
      tag: weaponDef.tag,
      rarity: weaponDef.rarity
    };
    const savedAmmoCur = itemState?.ammoCur ?? ammoCur;
    const savedAmmoMax = itemState?.ammoMax ?? ammoMax;
    if (Number.isFinite(savedAmmoCur)) groundItem.ammoCur = savedAmmoCur;
    if (Number.isFinite(savedAmmoMax)) groundItem.ammoMax = savedAmmoMax;
    const groundContainer = {
      id: groundItem.id,
      name: groundItem.name,
      type: 'weapon_drop',
      x: player.x,
      y: player.y,
      gridW: weaponDef.w,
      gridH: weaponDef.h,
      items: [groundItem]
    };

    if (sourceContainer) {
      sourceContainer.items.splice(sourceItemIndex, 1);
      if (sourceContainer.type === 'weapon_drop' && sourceContainer.items.length === 0) {
        this.containers.delete(sourceContainerId);
      }
    }
    this.containers.set(groundContainer.id, groundContainer);
    return groundContainer;
  }

  enqueueInput(socketId, inputPayload) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive || player.extracted || this.state !== 'IN_RAID') return;

    if (inputPayload.seq > player.lastProcessedInputSeq) {
      player.inputQueue.push(inputPayload);
      if (player.inputQueue.length > 30) player.inputQueue.shift();
    }
  }

  startTickLoop(onSnapshot) {
    this.onSnapshotCallback = onSnapshot;
    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000 / SERVER_TICK_RATE);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 20Hz Authoritative Tick Loop
   */
  tick() {
    if (this.state !== 'IN_RAID') return;

    this.tickCount++;
    const dt = SERVER_TICK_DELTA;

    if (this.raidTimeRemaining > 0) {
      this.raidTimeRemaining = Math.max(0, this.raidTimeRemaining - dt);
    }

    // 1. Process Player Inputs & Movement
    for (const player of this.players.values()) {
      if (!player.isAlive || player.extracted) continue;

      if (player.inputQueue.length > 0) {
        while (player.inputQueue.length > 0) {
          const input = player.inputQueue.shift();
          const inputDt = input.dt ? Math.min(input.dt, 0.1) : dt;
          updatePlayerMovement(player, input, inputDt, this.map);
          player.isFiring = !!input.isFiring;
          if (input.activeWeaponType) {
            player.activeWeaponType = input.activeWeaponType;
          }
          player.lastProcessedInputSeq = input.seq;

          // Process Player Weapon Fire Hitreg vs Scav Bots
          if (input.isFiring) {
            this._processPlayerShot(player);
          }
        }
      } else {
        const idleInput = {
          moveX: 0, moveY: 0,
          isSprinting: false,
          isCrouching: player.isCrouching,
          isAiming: player.isAiming,
          angle: player.angle
        };
        updatePlayerMovement(player, idleInput, dt, this.map);
      }

      // Check extraction zones
      const extractZone = this.map.checkExtraction(player.x, player.y);
      if (extractZone) {
        player.currentExtractZone = extractZone;
        player.extractTimer += dt;
        if (player.extractTimer >= EXTRACT_REQUIRED_TIME) {
          player.extracted = true;
          player.extractTimer = EXTRACT_REQUIRED_TIME;
        }
      } else {
        player.currentExtractZone = null;
        player.extractTimer = Math.max(0, player.extractTimer - dt * 2);
      }

      // Hardcore Bleeding debuff tick (-2 HP/sec)
      if (player.isBleeding && player.isAlive) {
        player.bleedTimer = (player.bleedTimer || 0) + dt;
        if (player.bleedTimer >= 1.0) {
          player.bleedTimer = 0;
          if (player.health.thorax > 10) {
            player.health.thorax = Math.max(1, player.health.thorax - 2);
          } else if (player.health.head > 10) {
            player.health.head = Math.max(1, player.health.head - 1);
          }
        }
      }
    }

    // 2. Authoritative PVE Scav Bot State Machine
    this._updateScavBots(dt);

    // 3. Authoritative Projectile Simulation & Player Hitreg
    this._updateProjectiles(dt);

    // 4. Authoritative Simulated Grenade Simulation
    this._updateGrenades(dt);

    // 5. Broadcast 20Hz Snapshot
    if (this.onSnapshotCallback) {
      const snapshot = this.getSnapshot();
      this.onSnapshotCallback(this.code, snapshot);
    }
  }

  /**
   * Player Bullet Hit Registration against Scav Bots & Bosses
   */
  _processPlayerShot(player) {
    const wepType = player.activeWeaponType || 'm4a1';
    const isMelee = (wepType === 'melee');
    const maxRange = isMelee ? 60 : 550;
    const angleThreshold = isMelee ? 0.6 : 0.12;

    let baseDamage = 42;
    if (wepType === 'ak74m') baseDamage = 49;
    else if (wepType === 'asval') baseDamage = 54;
    else if (wepType === 'vss') baseDamage = 64;
    else if (wepType === 'vector') baseDamage = 34;
    else if (wepType === 'mpx') baseDamage = 36;
    else if (wepType === 'saiga12') baseDamage = 82;
    else if (wepType === 'rpk16') baseDamage = 50;
    else if (wepType === 'goldentt') baseDamage = 46;
    else if (wepType === 'mp5') baseDamage = 34;
    else if (wepType === 'mosin') baseDamage = 98;
    else if (wepType === 'glock17') baseDamage = 32;
    else if (wepType === 'melee') baseDamage = 35;

    for (const bot of this.bots) {
      if (!bot.isAlive) continue;

      const toBotX = bot.x - player.x;
      const toBotY = bot.y - player.y;
      const dist = Math.hypot(toBotX, toBotY);

      if (dist < maxRange) {
        // Line of sight check (8px step precision)
        if (!this.map.hasLineOfSight(player.x, player.y, bot.x, bot.y)) continue;

        // Angle check within bullet cone / melee swing arc
        const angleToBot = Math.atan2(toBotY, toBotX);
        let angleDiff = Math.abs(angleToBot - player.angle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

        if (angleDiff < angleThreshold) { // Direct hit!
          const isHeadshot = (Math.random() < 0.35);

          if (bot.isBoss) {
            // Boss Killa / Reshala Class 5 armor damage mitigation
            if (isHeadshot) {
              const headDmg = Math.round(baseDamage * (wepType === 'mosin' || wepType === 'asval' ? 0.8 : 0.45));
              bot.health.head = Math.max(0, bot.health.head - headDmg);
            } else {
              const bodyDmg = Math.round(baseDamage * 0.58);
              bot.health.thorax = Math.max(0, bot.health.thorax - bodyDmg);
            }
          } else if (bot.isGuard) {
            // Guard Class 4 armor mitigation
            if (isHeadshot) {
              bot.health.head = Math.max(0, bot.health.head - Math.round(baseDamage * 0.75));
            } else {
              bot.health.thorax = Math.max(0, bot.health.thorax - Math.round(baseDamage * 0.72));
            }
          } else {
            if (isHeadshot) {
              bot.health.head = 0;
            } else {
              bot.health.thorax = Math.max(0, bot.health.thorax - baseDamage);
            }
          }

          // Check Bot Lethality
          if (bot.health.head <= 0 || bot.health.thorax <= 0) {
            this._killBotAndDropCorpse(bot);
            player.scavKills = (player.scavKills || 0) + 1;
          } else {
            // Bot takes damage -> If it has line of sight, enter ATTACK; otherwise face damage direction
            bot.angle = Math.atan2(player.y - bot.y, player.x - bot.x);
            if (this.map.hasLineOfSight(bot.x, bot.y, player.x, player.y)) {
              bot.targetPlayerId = player.id;
              bot.state = 'ATTACK';
              bot.acquireDelay = bot.isBoss ? 0.15 : 0.2;
              bot.attackCooldown = bot.isBoss ? 0.25 : 0.3;
            } else {
              bot.targetPlayerId = null;
              bot.state = 'PATROL';
            }
          }
          break; // Bullet absorbed
        }
      }
    }
  }

  /**
   * Evaluates surrounding terrain to find an obstacle tile breaking line of sight to the player
   */
  _findCoverPosition(bot, player) {
    const ts = this.map.tileSize;
    const botTX = Math.floor(bot.x / ts);
    const botTY = Math.floor(bot.y / ts);
    const searchRadius = 6; // ~192px tactical cover search

    let bestCover = null;
    let bestDist = 9999;

    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const tx = botTX + dx;
        const ty = botTY + dy;

        if (tx < 1 || tx >= this.map.width - 1 || ty < 1 || ty >= this.map.height - 1) continue;
        if (this.map.isSolid(tx, ty)) continue;

        // Cover tile must hug an adjacent solid obstacle
        const hasAdjacentWall = this.map.isSolid(tx + 1, ty) || this.map.isSolid(tx - 1, ty) ||
                                this.map.isSolid(tx, ty + 1) || this.map.isSolid(tx, ty - 1);
        if (!hasAdjacentWall) continue;

        const worldX = tx * ts + ts / 2;
        const worldY = ty * ts + ts / 2;

        // Cover tile MUST break line-of-sight to the player!
        if (this.map.hasLineOfSight(worldX, worldY, player.x, player.y)) continue;

        const distFromBot = Math.hypot(worldX - bot.x, worldY - bot.y);
        if (distFromBot < bestDist) {
          bestDist = distFromBot;
          bestCover = { x: worldX, y: worldY };
        }
      }
    }

    if (bestCover) return bestCover;

    // Fallback: retreat away from player into corridor
    const awayAngle = Math.atan2(bot.y - player.y, bot.x - player.x);
    return {
      x: bot.x + Math.cos(awayAngle) * 110,
      y: bot.y + Math.sin(awayAngle) * 110
    };
  }

  /**
   * Transforms deceased bot into an interactive lootable corpse tile
   */
  _killBotAndDropCorpse(bot) {
    bot.isAlive = false;
    bot.vx = 0;
    bot.vy = 0;

    const corpseId = `corpse_${bot.id}`;
    const corpseContainer = {
      id: corpseId,
      name: bot.isBoss ? `Dead ${bot.name}` : `Dead Scav (${bot.name})`,
      type: 'corpse_scav',
      x: bot.x,
      y: bot.y,
      gridW: bot.isBoss ? 4 : 3,
      gridH: bot.isBoss ? 4 : 3,
      items: bot.loot
    };

    this.containers.set(corpseId, corpseContainer);
    console.log(`[☠] ${bot.isBoss ? 'BOSS ' : 'Scav '}[${bot.name}] killed! Corpse dropped at (${Math.round(bot.x)}, ${Math.round(bot.y)})`);
  }

  /**
   * PVE Scav Bot AI Updates - Aggressive Tactical Combat Behavior
   * - Detects player within 12 tiles (384px) with direct Line-of-Sight -> enters ATTACK state.
   * - In ATTACK: Stops, faces player coordinates, after acquisition delay fires server-authoritative projectiles.
   * - Bosses: Charges players with high speed, throws simulated HE/Flash grenades with blast radius.
   * - Speech bubbles / visual barks displayed above bot heads.
   */
  _updateScavBots(dt) {
    const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive && !p.extracted);

    for (const bot of this.bots) {
      if (!bot.isAlive) continue;

      bot.voiceCooldown = Math.max(0, bot.voiceCooldown - dt);
      if (bot.speechTimer > 0) {
        bot.speechTimer -= dt;
        if (bot.speechTimer <= 0) bot.speechText = null;
      }

      // 1. Target Validation & Perception Check
      let targetPlayer = null;
      let targetDist = 9999;
      let targetHasLOS = false;

      // If already tracking a player, strictly test if current Line-of-Sight is still unobstructed
      if (bot.targetPlayerId) {
        const targeted = this.players.get(bot.targetPlayerId);
        if (targeted && targeted.isAlive && !targeted.extracted) {
          const d = Math.hypot(targeted.x - bot.x, targeted.y - bot.y);
          const maxTrackRange = bot.isBoss ? 550 : 480;
          const los = (d <= maxTrackRange) && this.map.hasLineOfSight(bot.x, bot.y, targeted.x, targeted.y);
          if (los) {
            targetPlayer = targeted;
            targetDist = d;
            targetHasLOS = true;
          } else {
            bot.targetPlayerId = null;
            bot.state = 'PATROL';
            bot.isFiring = false;
          }
        } else {
          bot.targetPlayerId = null;
          bot.state = 'PATROL';
          bot.isFiring = false;
        }
      }

      // If no current target, search alive players using 90-degree vision cone + strict LOS + acoustic alert
      if (!targetPlayer) {
        let heardPlayer = null;
        let heardDist = 9999;

        for (const p of alivePlayers) {
          const d = Math.hypot(p.x - bot.x, p.y - bot.y);
          if (d > 500) continue;

          // Strict Line-of-Sight test against all solid wall tiles
          const hasLOS = this.map.hasLineOfSight(bot.x, bot.y, p.x, p.y);

          // Vision cone check: 90-degree forward vision cone (+-45 deg = PI / 4) matching player rules
          const angleToP = Math.atan2(p.y - bot.y, p.x - bot.x);
          let angleDiff = Math.abs(angleToP - bot.angle);
          if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

          // Direct visibility: within forward 90-degree cone (up to 400px) OR close ambient awareness circle (75px)
          const visionRange = bot.isBoss ? 450 : 384;
          const canSee = hasLOS && ((d <= 75) || (angleDiff <= Math.PI / 4 && d <= visionRange));

          if (canSee) {
            if (d < targetDist) {
              targetDist = d;
              targetPlayer = p;
              targetHasLOS = true;
            }
          } else {
            // Hearing check (acoustic alert radius: sprint <= 240px, gunfire <= 520px)
            const canHear = (p.isSprinting && d < 240) || (p.isFiring && d < 520);
            if (canHear && d < heardDist) {
              heardDist = d;
              heardPlayer = p;
            }
          }
        }

        if (!targetPlayer && heardPlayer) {
          const soundAngle = Math.atan2(heardPlayer.y - bot.y, heardPlayer.x - bot.x);
          bot.angle = soundAngle;
          bot.isFiring = false;
          bot.state = 'PATROL';
        }
      }

      // 2. Combat State Machine: Strict LOS required to attack or fire
      if (targetPlayer && targetHasLOS) {
        bot.targetPlayerId = targetPlayer.id;

        if (bot.state !== 'ATTACK') {
          bot.state = 'ATTACK';
          bot.acquireDelay = bot.isBoss ? 0.25 : 0.6;
          bot.attackCooldown = bot.isBoss ? 0.35 : 0.6;
          bot.vx = 0;
          bot.vy = 0;
          bot.isFiring = false;

          // Trigger speech bark upon spotting
          if (!bot.speechText || bot.speechTimer <= 0) {
            bot.speechText = bot.isBoss ? "KILLA GET YOU!" : (Math.random() < 0.5 ? "VON ON SUKA!" : "CHIKI BRIKI!");
            bot.speechTimer = 2.5;
          }

          // Alert fireteam partner
          if (bot.leaderBotId) {
            const partner = this.bots.find(b => b.id === bot.leaderBotId);
            if (partner && partner.isAlive && partner.state !== 'ATTACK') {
              partner.state = 'ATTACK';
              partner.targetPlayerId = targetPlayer.id;
              partner.angle = Math.atan2(targetPlayer.y - partner.y, targetPlayer.x - partner.x);
            }
          }
        }

        // Aim towards player
        bot.angle = Math.atan2(targetPlayer.y - bot.y, targetPlayer.x - bot.x);

        // Boss Flank & Charge behavior: sprint toward player if distance > 170
        if (bot.isBoss && targetDist > 170) {
          const moveAngle = Math.atan2(targetPlayer.y - bot.y, targetPlayer.x - bot.x);
          bot.vx = Math.cos(moveAngle) * bot.runSpeed;
          bot.vy = Math.sin(moveAngle) * bot.runSpeed;
        } else {
          bot.vx = 0;
          bot.vy = 0;
        }

        // Boss Grenade Throw
        if (bot.isBoss) {
          bot.grenadeCooldown = Math.max(0, (bot.grenadeCooldown || 8.0) - dt);
          if (bot.grenadeCooldown <= 0 && targetDist >= 120 && targetDist <= 380) {
            bot.grenadeCooldown = 14 + Math.random() * 6;
            bot.speechText = "GRANATA!";
            bot.speechTimer = 2.5;

            this.grenades.push({
              id: `gren_${this.tickCount}_${Math.random().toString(36).substring(2, 6)}`,
              x: bot.x,
              y: bot.y,
              startX: bot.x,
              startY: bot.y,
              targetX: targetPlayer.x + (Math.random() * 30 - 15),
              targetY: targetPlayer.y + (Math.random() * 30 - 15),
              timer: 2.2,
              maxTimer: 2.2,
              radius: 125,
              damage: 135,
              hasExploded: false
            });
            console.log(`[💣] Boss Killa threw a grenade toward player ${targetPlayer.name}!`);
          }
        }

        if (bot.acquireDelay > 0) {
          bot.acquireDelay -= dt;
          bot.isFiring = false;
        } else {
          bot.attackCooldown -= dt;
          if (bot.attackCooldown <= 0) {
            if (this.map.hasLineOfSight(bot.x, bot.y, targetPlayer.x, targetPlayer.y)) {
              const bulletSpeed = bot.isBoss ? 780 : 620;
              const spread = (Math.random() * 2 - 1) * (bot.isBoss ? 0.025 : 0.045);
              const shotAngle = bot.angle + spread;
              const spawnX = bot.x + Math.cos(bot.angle) * 16;
              const spawnY = bot.y + Math.sin(bot.angle) * 16;

              const spawnTX = Math.floor(spawnX / this.map.tileSize);
              const spawnTY = Math.floor(spawnY / this.map.tileSize);

              if (!this.map.isSolid(spawnTX, spawnTY)) {
                this.projectiles.push({
                  id: `scav_p_${this.tickCount}_${Math.random().toString(36).substring(2, 6)}`,
                  ownerId: bot.id,
                  ownerName: bot.name,
                  x: spawnX,
                  y: spawnY,
                  vx: Math.cos(shotAngle) * bulletSpeed,
                  vy: Math.sin(shotAngle) * bulletSpeed,
                  distTraveled: 0,
                  maxDist: 520,
                  isScav: true
                });

                bot.isFiring = true;
                bot.attackCooldown = bot.isBoss ? (0.22 + Math.random() * 0.15) : (0.75 + Math.random() * 0.4);
              } else {
                bot.isFiring = false;
              }
            } else {
              bot.isFiring = false;
              bot.state = 'PATROL';
              bot.targetPlayerId = null;
            }
          } else {
            bot.isFiring = false;
          }
        }
      } else {
        // No line of sight or no target: Normal patrol
        bot.isFiring = false;
        bot.state = 'PATROL';
        bot.targetPlayerId = null;

        bot.patrolTimer -= dt;
        if (bot.patrolTimer <= 0) {
          bot.patrolTimer = 4 + Math.random() * 4;
          const angle = Math.random() * Math.PI * 2;
          const rad = Math.random() * bot.patrolCenter.radius * 0.7;
          bot.patrolTarget.x = bot.patrolCenter.x + Math.cos(angle) * rad;
          bot.patrolTarget.y = bot.patrolCenter.y + Math.sin(angle) * rad;
        }

        const toX = bot.patrolTarget.x - bot.x;
        const toY = bot.patrolTarget.y - bot.y;
        const dist = Math.hypot(toX, toY);

        if (dist > 15) {
          bot.angle = Math.atan2(toY, toX);
          bot.vx = Math.cos(bot.angle) * bot.speed;
          bot.vy = Math.sin(bot.angle) * bot.speed;
        } else {
          bot.vx = 0;
          bot.vy = 0;
        }
      }

      // Integrate bot movement with map collision resolution
      bot.x += bot.vx * dt;
      bot.y += bot.vy * dt;
      resolveMapCollisions(bot, this.map);
    }
  }

  /**
   * Authoritative Simulated Grenade Simulation
   */
  _updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.timer -= dt;

      // Arc interpolation toward target position
      const t = Math.min(1, 1 - (g.timer / g.maxTimer));
      const flightT = Math.min(1, t * 1.8);
      g.x = g.startX + (g.targetX - g.startX) * flightT;
      g.y = g.startY + (g.targetY - g.startY) * flightT;

      if (g.timer <= 0 && !g.hasExploded) {
        g.hasExploded = true;

        // Damage calculation against all alive players in blast radius
        for (const player of this.players.values()) {
          if (!player.isAlive || player.extracted) continue;
          const dist = Math.hypot(player.x - g.x, player.y - g.y);
          if (dist <= g.radius) {
            const hasWall = !this.map.hasLineOfSight(g.x, g.y, player.x, player.y);
            const distFalloff = 1 - (dist / g.radius);
            const rawDmg = Math.round(g.damage * distFalloff * (hasWall ? 0.35 : 1.0));

            // Distribute blast damage across limbs
            const limbs = ['head', 'thorax', 'stomach', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
            for (const limb of limbs) {
              const portion = (limb === 'head' || limb === 'thorax') ? 0.22 : 0.11;
              const limbDmg = Math.round(rawDmg * portion);
              player.health[limb] = Math.max(0, player.health[limb] - limbDmg);
            }

            if (player.health.head <= 0 || player.health.thorax <= 0) {
              player.isAlive = false;
              console.log(`[💥] Player '${player.name}' killed by Boss Grenade blast!`);
            }
          }
        }
      }

      // Remove 0.6s after explosion display
      if (g.timer <= -0.6) {
        this.grenades.splice(i, 1);
      }
    }
  }

  /**
   * Authoritative Projectile Simulation & Player Hit Detection
   */
  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const dx = proj.vx * dt;
      const dy = proj.vy * dt;
      const stepDist = Math.hypot(dx, dy);
      const subSteps = Math.max(1, Math.ceil(stepDist / 8));
      const subDx = dx / subSteps;
      const subDy = dy / subSteps;
      let destroyed = false;

      for (let s = 0; s < subSteps; s++) {
        proj.x += subDx;
        proj.y += subDy;
        proj.distTraveled += Math.hypot(subDx, subDy);

        // Map wall obstacle check
        const tx = Math.floor(proj.x / this.map.tileSize);
        const ty = Math.floor(proj.y / this.map.tileSize);
        if (this.map.isSolid(tx, ty)) {
          destroyed = true;
          break;
        }

        // Collision against alive, non-extracted players
        for (const player of this.players.values()) {
          if (!player.isAlive || player.extracted) continue;
          if (proj.ownerId === player.id) continue;

          const dist = Math.hypot(proj.x - player.x, proj.y - player.y);
          if (dist <= player.radius) {
            if (this.map.hasLineOfSight(proj.x, proj.y, player.x, player.y)) {
              this._damagePlayerFromScav(player, { name: proj.ownerName || 'Scav', x: proj.x, y: proj.y });
            }
            destroyed = true;
            break;
          }
        }

        if (destroyed || proj.distTraveled >= proj.maxDist) break;
      }

      if (destroyed || proj.distTraveled >= proj.maxDist) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  /**
   * Inflicts authoritative limb damage on player from Scav gunfire
   */
  _damagePlayerFromScav(player, scav) {
    if (scav && scav.x !== undefined && scav.y !== undefined) {
      if (!this.map.hasLineOfSight(scav.x, scav.y, player.x, player.y)) {
        return;
      }
    }

    const limbs = ['head', 'thorax', 'stomach', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
    const weights = [0.08, 0.40, 0.22, 0.10, 0.10, 0.05, 0.05];

    let r = Math.random();
    let hitLimb = 'thorax';
    for (let i = 0; i < weights.length; i++) {
      if (r < weights[i]) {
        hitLimb = limbs[i];
        break;
      }
      r -= weights[i];
    }

    const damage = Math.round(25 + Math.random() * 20);
    player.health[hitLimb] = Math.max(0, player.health[hitLimb] - damage);
    if (damage >= 22 && Math.random() < 0.45) {
      player.isBleeding = true;
    }

    if (player.health.head <= 0 || player.health.thorax <= 0) {
      player.isAlive = false;
      console.log(`[☠] Player '${player.name}' was killed by Scav [${scav.name}]!`);
    }
  }

  getSnapshot() {
    const playerList = [];
    for (const p of this.players.values()) {
      playerList.push({
        id: p.id,
        name: p.name,
        slot: p.slot,
        color: p.color,
        isHost: (p.id === this.hostSocketId),
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
        vx: Math.round(p.vx * 100) / 100,
        vy: Math.round(p.vy * 100) / 100,
        angle: Math.round(p.angle * 1000) / 1000,
        stamina: Math.round(p.stamina * 10) / 10,
        health: p.health,
        isBleeding: !!p.isBleeding,
        isSprinting: p.isSprinting,
        isCrouching: p.isCrouching,
        isAiming: p.isAiming,
        isFiring: p.isFiring,
        activeWeaponType: p.activeWeaponType || 'm4a1',
        isAlive: p.isAlive,
        extracted: p.extracted,
        extractProgress: p.extractTimer / EXTRACT_REQUIRED_TIME,
        extractZoneName: p.currentExtractZone ? p.currentExtractZone.name : null,
        scavKills: p.scavKills || 0,
        lastProcessedInputSeq: p.lastProcessedInputSeq
      });
    }

    const botList = [];
    for (const b of this.bots) {
      if (!b.isAlive) continue;
      botList.push({
        id: b.id,
        name: b.name,
        isBoss: !!b.isBoss,
        bossType: b.bossType || null,
        isGuard: !!b.isGuard,
        speechText: b.speechText || null,
        armorClass: b.armorClass || 2,
        weaponType: b.weapon?.id || 'shotgun',
        x: Math.round(b.x * 100) / 100,
        y: Math.round(b.y * 100) / 100,
        angle: Math.round(b.angle * 1000) / 1000,
        state: b.state,
        isFiring: b.isFiring,
        healthPct: Math.round(((b.health.head + b.health.thorax) / (b.isBoss ? 230 : 120)) * 100)
      });
    }

    return {
      tick: this.tickCount,
      serverTime: Date.now(),
      raidTimeRemaining: Math.floor(this.raidTimeRemaining),
      mapId: this.mapId,
      players: playerList,
      bots: botList,
      bullets: this.projectiles.map(p => ({
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        vx: Math.round(p.vx),
        vy: Math.round(p.vy),
        isScav: true
      })),
      grenades: this.grenades.map(g => ({
        id: g.id,
        x: Math.round(g.x * 10) / 10,
        y: Math.round(g.y * 10) / 10,
        radius: g.radius,
        timer: Math.max(0, Math.round(g.timer * 10) / 10),
        maxTimer: g.maxTimer,
        hasExploded: g.hasExploded
      })),
      containers: Array.from(this.containers.values())
    };
  }
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  getOrCreateRoom(code, hostSocketId, onSnapshot) {
    const formattedCode = (code || 'EFT1').toUpperCase().trim().substring(0, 6);
    let room = this.rooms.get(formattedCode);
    if (!room) {
      room = new GameRoom(formattedCode, hostSocketId);
      this.rooms.set(formattedCode, room);
      room.startTickLoop(onSnapshot);
    }
    return room;
  }

  joinRoom(socketId, code, playerName, onSnapshot) {
    this.leaveRoom(socketId);
    const room = this.getOrCreateRoom(code, socketId, onSnapshot);
    const player = room.addPlayer(socketId, playerName);
    if (player) {
      this.socketToRoom.set(socketId, room.code);
    }
    return { room, player };
  }

  leaveRoom(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (code) {
      this.socketToRoom.delete(socketId);
      const room = this.rooms.get(code);
      if (room) {
        room.removePlayer(socketId);
        if (room.players.size === 0) {
          room.stop();
          this.rooms.delete(code);
        }
      }
    }
  }

  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : null;
  }
}
