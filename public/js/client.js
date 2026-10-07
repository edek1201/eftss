/**
 * EFT Tactical 2D - Master Client Engine & Game Loop
 * Refactored & Fully Optimized with:
 * - Conditional Render Pausing (Halts world redraws & raycasting when in menus)
 * - True Dynamic Camera centering with viewport culling on realistic 60x60, 80x80, 100x100 maps
 * - Living PVE Scav Bots (LOS alerts, voice barking, combat firing, corpse looting)
 * - Complete Operator Account Initialization & Hideout Stash Hub
 * - Working Fire Selector (SEMI click-release vs FULL-AUTO cyclic rate)
 */

import { TacticalMap } from '/shared/map.js';
import { updatePlayerMovement, lerp, angleLerp, PHYSICS_CONFIG } from '/shared/physics.js';
import { InputController } from './input.js';
import { TacticalRenderer } from './renderer.js';
import { NetworkClient } from './network.js';
import { GridInventory } from './inventory.js';
import { audioEngine } from './audio.js';
import { profileManager } from './profile.js';
import { TraderMarketEngine } from './traders.js';
import { WEAPON_REGISTRY, isWeaponItem, getWeaponConfig, isMagazineItem, isAmmoItem, isCompatibleMagazine, isCompatibleAmmo } from '/shared/weapons.js';

const INTERPOLATION_DELAY_MS = 50;

class GameClient {
  constructor() {
    this.canvas = document.getElementById('mainCanvas');
    this.renderer = new TacticalRenderer(this.canvas);
    this.input = new InputController(this.canvas);
    this.network = new NetworkClient();
    this.inventory = new GridInventory(document.getElementById('inventory-overlay'));
    this.traderMarket = new TraderMarketEngine(document.getElementById('traders-screen'));
    this.traderMarket.onProfileUpdated = () => this._openHideoutHub();

    this.inventory.onEquipmentChanged = () => {
      this._initWeaponsFromProfile();
    };

    this.currentMapId = 'factory';
    this.map = new TacticalMap(this.currentMapId);
    this.renderer.setMap(this.map);

    // Profile & Session State
    this.profile = null;

    // Local Player State
    this.localPlayer = {
      id: null,
      name: 'USEC_Operator',
      slot: 0,
      color: '#2ecc71',
      isHost: false,
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: PHYSICS_CONFIG.PLAYER_RADIUS,
      stamina: PHYSICS_CONFIG.MAX_STAMINA,
      isSprinting: false,
      isCrouching: false,
      isAiming: false,
      isFiring: false,
      tacticalDevice: 'OFF',
      extractProgress: 0,
      extractZoneName: null,
      extracted: false,
      isAlive: true,
      activeWeaponType: 'none',
      painkillerTimer: 0,
      health: {
        head: 35, thorax: 85, stomach: 70, leftArm: 60, rightArm: 60, leftLeg: 65, rightLeg: 65
      }
    };

    // Authentic Arsenal & Quick Meds (Zero free gear: loaded strictly from player profile)
    this.activeWeaponSlot = 1;
    this.weapons = {
      1: null,
      2: null
    };
    this.medInventory = {
      bandage: 0,
      medkit: 0,
      painkiller: 0
    };

    // Reusable buffers to eliminate GC allocations in 60 FPS loop
    this._squadListBuffer = [];
    this._scavListBuffer = [];
    this.botAudioRange = 700;

    this.bullets = [];
    this.grenades = [];
    this.grenadeThrowCooldownUntil = 0;
    this.currentSpread = 0.012;
    this.spreadBloom = 0;
    this.lastFootstepTime = 0;

    this.inputSeq = 0;
    this.pendingInputs = [];

    this.remotePlayers = new Map();
    this.scavBots = new Map(); // id -> bot
    this.containers = [];
    this.nearbyContainer = null;
    this.acousticRings = [];

    // Timing & Render Loop
    this.lastFrameTime = performance.now();
    this.raidTimeRemaining = 600;
    this.raidScavKills = 0;
    this.isInRaid = false;
    this.isHost = false;
    this.lastExtractBeepSecond = -1;
    this.animFrameId = null;

    this.dom = {
      initModal: document.getElementById('init-operator-modal'),
      authLoginForm: document.getElementById('auth-login-form'),
      authRegisterForm: document.getElementById('auth-register-form'),
      authLoginTab: document.getElementById('auth-login-tab'),
      authRegisterTab: document.getElementById('auth-register-tab'),
      authNotice: document.getElementById('auth-notice'),
      inputLoginUsername: document.getElementById('input-login-username'),
      inputLoginPassword: document.getElementById('input-login-password'),
      inputRegisterUsername: document.getElementById('input-register-username'),
      inputRegisterPassword: document.getElementById('input-register-password'),
      inputRegisterCallsign: document.getElementById('input-register-callsign'),
      selectRegisterFaction: document.getElementById('select-register-faction'),
      hideoutScreen: document.getElementById('hideout-screen'),
      hudOverlay: document.getElementById('hud-overlay'),
      operatorTag: document.getElementById('hideout-operator-tag'),
      factionBadge: document.getElementById('hideout-faction-badge'),
      roublesDisplay: document.getElementById('hideout-roubles-val'),
      accountSyncStatus: document.getElementById('account-sync-status'),
      statsSurv: document.getElementById('hideout-stats-surv'),
      statsRaids: document.getElementById('hideout-stats-raids'),
      statsKd: document.getElementById('hideout-stats-kd'),
      inputRoomCode: document.getElementById('input-room-code'),
      btnGenRoomCode: document.getElementById('btn-gen-room-code'),
      btnHostRoom: document.getElementById('btn-host-room'),
      btnJoinRoom: document.getElementById('btn-join-room'),
      btnOpenStash: document.getElementById('btn-open-stash'),
      btnOpenStashAlt: document.getElementById('btn-open-stash-alt'),
      btnSwitchAccount: document.getElementById('btn-switch-account'),
      lobbyRosterList: document.getElementById('lobby-roster-list'),
      lobbyPrimaryName: document.getElementById('lobby-primary-name'),
      lobbySecondaryName: document.getElementById('lobby-secondary-name'),
      btnDeploySquad: document.getElementById('btn-deploy-squad'),
      mapCards: {
        factory: document.getElementById('card-map-factory'),
        warehouse: document.getElementById('card-map-warehouse'),
        bunker: document.getElementById('card-map-bunker')
      },
      raidTimer: document.getElementById('hud-raid-timer'),
      roomCodeBadge: document.getElementById('hud-room-code'),
      staminaFill: document.getElementById('stamina-fill'),
      staminaVal: document.getElementById('stamina-val'),
      badgeStand: document.getElementById('badge-stand'),
      badgeSprint: document.getElementById('badge-sprint'),
      badgeCrouch: document.getElementById('badge-crouch'),
      badgeAds: document.getElementById('badge-ads'),
      badgeFiremode: document.getElementById('badge-firemode'),
      badgeTactical: document.getElementById('badge-tactical'),
      slotWep1: document.getElementById('slot-wep-1'),
      slotWep2: document.getElementById('slot-wep-2'),
      slot1Name: document.getElementById('slot-1-name'),
      slot2Name: document.getElementById('slot-2-name'),
      slot4Cnt: document.getElementById('slot-4-cnt'),
      slot5Cnt: document.getElementById('slot-5-cnt'),
      hudWepName: document.getElementById('hud-weapon-name'),
      hudAmmoCur: document.getElementById('hud-ammo-cur'),
      hudAmmoMax: document.getElementById('hud-ammo-max'),
      hudAmmoType: document.getElementById('hud-ammo-type'),
      controlsModal: document.getElementById('controls-help-modal'),
      btnHideBinds: document.getElementById('btn-hide-binds'),
      btnShowBinds: document.getElementById('btn-show-binds'),
      squadMemberList: document.getElementById('squad-member-list'),
      extractBanner: document.getElementById('extract-banner'),
      extractZoneName: document.getElementById('extract-zone-name'),
      extractBarFill: document.getElementById('extract-bar-fill'),
      inventoryOverlay: document.getElementById('inventory-overlay'),
      deathModal: document.getElementById('death-modal'),
      btnDeathOk: document.getElementById('btn-death-ok'),
      summaryModal: document.getElementById('extract-summary-modal'),
      summaryExtractZone: document.getElementById('summary-extract-zone'),
      summaryStatXp: document.getElementById('summary-stat-xp'),
      summaryStatKills: document.getElementById('summary-stat-kills'),
      summaryStatValue: document.getElementById('summary-stat-value'),
      summaryLootList: document.getElementById('summary-loot-list'),
      btnTransferLoot: document.getElementById('btn-transfer-loot'),
      btnReturnHideoutDirect: document.getElementById('btn-return-hideout-direct')
    };

    profileManager.onSyncState = (status, error) => {
      this.dom.accountSyncStatus.textContent = status;
      this.dom.accountSyncStatus.title = error;
      this.dom.accountSyncStatus.classList.toggle('syncing', status === 'SYNCING PROFILE...');
      this.dom.accountSyncStatus.classList.toggle('error', status === 'PROFILE SYNC FAILED');
    };

    this._initAccountSession();
    this._setupUIEvents();
    this._setupNetworkEvents();
  }

  /**
   * STEP 1-3: ACCOUNT INITIALIZATION & AUTO-LOGIN FLOW
   */
  async _initAccountSession() {
    try {
      const authenticated = await profileManager.restoreAccountSession();
      if (authenticated) {
        this.profile = profileManager.profile;
        this._openHideoutHub();
        return;
      }
      this.profile = null;
      this._showAuthScreen();
    } catch (err) {
      console.error('[EFT] Account session restore failed:', err);
      this._showAuthScreen(err.message);
    }
  }

  _showAuthScreen(message = '') {
    this.dom.initModal.style.display = 'flex';
    this.dom.hideoutScreen.style.display = 'none';
    this._setAuthMode('login');
    this._showAuthNotice(message);
  }

  _setAuthMode(mode) {
    const isRegister = mode === 'register';
    this.dom.authLoginForm.hidden = isRegister;
    this.dom.authRegisterForm.hidden = !isRegister;
    this.dom.authLoginTab.classList.toggle('active', !isRegister);
    this.dom.authRegisterTab.classList.toggle('active', isRegister);
    this.dom.authNotice.textContent = '';
    this.dom.authNotice.classList.remove('error');
  }

  _showAuthNotice(message, isError = true) {
    this.dom.authNotice.textContent = message;
    this.dom.authNotice.classList.toggle('error', isError && !!message);
  }

  _openHideoutHub() {
    this.dom.initModal.style.display = 'none';
    this.dom.hideoutScreen.style.display = 'flex';
    this.dom.hudOverlay.style.display = 'none';
    if (this.dom.summaryModal) this.dom.summaryModal.style.display = 'none';
    if (this.dom.deathModal) this.dom.deathModal.style.display = 'none';
    this.isInRaid = false;

    // Disable canvas pointer events while in lobby — prevents canvas from
    // intercepting clicks that should reach the HTML lobby buttons.
    this.canvas.style.pointerEvents = 'none';

    // Halt canvas redraw loop while in hideout
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    // Populate Hideout Hub Stats & Rubles
    const p = this.profile;
    if (!p) return; // Guard: profile must exist before populating UI
    this.localPlayer.name = p.callsign;
    this.dom.operatorTag.textContent = `${p.callsign} [${p.faction || 'USEC'}]`;
    this.dom.roublesDisplay.textContent = `${p.roubles.toLocaleString()} ₽`;
    this.dom.statsSurv.textContent = p.stats.survived;
    this.dom.statsRaids.textContent = p.stats.raids;

    const survRate = p.stats.raids > 0 ? Math.round((p.stats.survived / p.stats.raids) * 100) : 0;
    this.dom.statsKd.textContent = `${survRate}% SR`;

    // Load active loadout into inventory
    this.inventory.loadFromProfile(p);
    if (this.dom.factionBadge) {
      this.dom.factionBadge.textContent = p.faction || 'USEC';
    }
    this._initWeaponsFromProfile();
  }

  _initWeaponsFromProfile() {
    if (!this.profile) return;

    // Detect equipped primary weapon (strictly from loadout, no fallback free gear!)
    const primaryItem = this.inventory.items.find(it => it.gridId === 'primaryWeapon');
    const primCfg = getWeaponConfig(primaryItem);

    if (primCfg) {
      const primKey = Object.keys(WEAPON_REGISTRY).find(k => WEAPON_REGISTRY[k] === primCfg) || primCfg.name.toLowerCase();
      const currentAmmo = (primaryItem.ammoCur !== undefined) ? primaryItem.ammoCur : primCfg.magSize;
      const maxAmmo = (primaryItem.ammoMax !== undefined) ? primaryItem.ammoMax : primCfg.magSize;
      this.weapons[1] = {
        type: primKey,
        config: primCfg,
        ammoCur: currentAmmo,
        ammoMax: maxAmmo
      };
      if (this.dom.lobbyPrimaryName) this.dom.lobbyPrimaryName.textContent = primCfg.name;
      if (this.dom.slot1Name) this.dom.slot1Name.textContent = primKey.toUpperCase();
    } else {
      this.weapons[1] = null;
      if (this.dom.lobbyPrimaryName) this.dom.lobbyPrimaryName.textContent = 'EMPTY (UNARMED)';
      if (this.dom.slot1Name) this.dom.slot1Name.textContent = 'EMPTY';
    }

    // Detect equipped secondary weapon (strictly from loadout, no fallback free gear!)
    const secondaryItem = this.inventory.items.find(it => it.gridId === 'secondaryWeapon');
    const secCfg = getWeaponConfig(secondaryItem);

    if (secCfg) {
      const secKey = Object.keys(WEAPON_REGISTRY).find(k => WEAPON_REGISTRY[k] === secCfg) || secCfg.name.toLowerCase();
      const currentAmmo = (secondaryItem.ammoCur !== undefined) ? secondaryItem.ammoCur : secCfg.magSize;
      const maxAmmo = (secondaryItem.ammoMax !== undefined) ? secondaryItem.ammoMax : secCfg.magSize;
      this.weapons[2] = {
        type: secKey,
        config: secCfg,
        ammoCur: currentAmmo,
        ammoMax: maxAmmo
      };
      if (this.dom.lobbySecondaryName) this.dom.lobbySecondaryName.textContent = secCfg.name;
      if (this.dom.slot2Name) this.dom.slot2Name.textContent = secKey.toUpperCase();
    } else {
      this.weapons[2] = null;
      if (this.dom.lobbySecondaryName) this.dom.lobbySecondaryName.textContent = 'EMPTY (NONE)';
      if (this.dom.slot2Name) this.dom.slot2Name.textContent = 'EMPTY';
    }

    // Count meds strictly from equipped slots (rig, pockets, backpack, alpha)
    this.medInventory.bandage = 0;
    this.medInventory.medkit = 0;
    this.medInventory.painkiller = 0;
    for (const it of this.inventory.items) {
      if (it.gridId === 'rig' || it.gridId === 'pockets' || it.gridId === 'backpack' || it.gridId === 'alpha') {
        const idLower = (it.id || '').toLowerCase();
        const nameLower = (it.name || '').toLowerCase();
        if (idLower.includes('bandage') || nameLower.includes('bandage')) {
          this.medInventory.bandage++;
        } else if (idLower.includes('medkit') || idLower.includes('salewa') || idLower.includes('ifak') || idLower.includes('ai2') || idLower.includes('grizzly') || nameLower.includes('medkit') || nameLower.includes('salewa') || nameLower.includes('ifak') || nameLower.includes('ai-2') || nameLower.includes('grizzly')) {
          this.medInventory.medkit++;
        } else if (idLower.includes('golden') || idLower.includes('morphine') || nameLower.includes('golden star') || nameLower.includes('morphine') || nameLower.includes('painkiller')) {
          this.medInventory.painkiller++;
        }
      }
    }
    if (this.dom.slot4Cnt) this.dom.slot4Cnt.textContent = `x${this.medInventory.bandage}`;
    if (this.dom.slot5Cnt) this.dom.slot5Cnt.textContent = `x${this.medInventory.medkit}`;
    const slot6El = document.getElementById('slot-6-cnt');
    if (slot6El) slot6El.textContent = `x${this.medInventory.painkiller}`;

    const active = this.getActiveWeapon();
    this.localPlayer.activeWeaponType = active.type;
    this.input.cyclicRateMs = active.config.cyclicRateMs;
    this._updateWeaponHUD();
  }

  getActiveWeapon() {
    const wep = this.weapons[this.activeWeaponSlot];
    if (wep) return wep;
    return {
      type: 'none',
      config: WEAPON_REGISTRY.melee,
      ammoCur: 0,
      ammoMax: 0
    };
  }

  _syncActiveWeaponAmmoToInventory() {
    const weapon = this.getActiveWeapon();
    const gridId = this.activeWeaponSlot === 1 ? 'primaryWeapon' : 'secondaryWeapon';
    const item = this.inventory.items.find(it => it.gridId === gridId && getWeaponConfig(it) === weapon.config);
    if (!item) return;
    item.ammoCur = weapon.ammoCur;
    item.ammoMax = weapon.ammoMax;
  }

  _switchWeaponSlot(slot) {
    if (slot !== 1 && slot !== 2) return;
    if (this.activeWeaponSlot === slot) return;

    this.activeWeaponSlot = slot;
    audioEngine.playWeaponSwitch();

    const wep = this.getActiveWeapon();
    this.localPlayer.activeWeaponType = wep.type;
    this.input.cyclicRateMs = wep.config.cyclicRateMs;

    if (!wep.config.fireModes.includes('AUTO') && this.input.fireMode === 'AUTO') {
      this.input.fireMode = 'SEMI';
    }

    this.dom.slotWep1?.classList.toggle('active', slot === 1);
    this.dom.slotWep2?.classList.toggle('active', slot === 2);

    this._updateWeaponHUD();
  }

  _updateWeaponHUD() {
    const wep = this.getActiveWeapon();
    if (!wep) return;
    this.input.hasWeapon = wep.type !== 'none';
    if (this.dom.hudWepName) this.dom.hudWepName.textContent = wep.type === 'none' ? 'UNARMED' : wep.type.toUpperCase();
    if (this.dom.hudAmmoCur) this.dom.hudAmmoCur.textContent = (wep.type === 'melee' || wep.type === 'none') ? '-' : wep.ammoCur;
    if (this.dom.hudAmmoMax) this.dom.hudAmmoMax.textContent = (wep.type === 'melee' || wep.type === 'none') ? '-' : wep.ammoMax;
    if (this.dom.hudAmmoType) this.dom.hudAmmoType.textContent = wep.type === 'none' ? 'NO WEAPON' : (wep.type === 'melee' ? 'MELEE' : wep.config.ammoType);
    if (this.dom.badgeFiremode) {
      if (wep.type === 'melee' || wep.type === 'none') {
        this.dom.badgeFiremode.textContent = wep.type === 'none' ? '[UNARMED]' : '[MELEE]';
        this.dom.badgeFiremode.classList.remove('highlight');
      } else {
        this.dom.badgeFiremode.textContent = (this.input.fireMode === 'SEMI') ? '[SEMI] (B)' : '[AUTO] (B)';
        this.dom.badgeFiremode.classList.toggle('highlight', this.input.fireMode === 'AUTO');
      }
    }
  }

  _showTacticalAlert(msg, isUrgent = false) {
    let el = document.getElementById('tactical-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tactical-banner';
      el.style.cssText = 'display: none; position: absolute; top: 18%; left: 50%; transform: translateX(-50%); background: rgba(15, 20, 28, 0.94); border: 1px solid #d4a359; box-shadow: 0 4px 20px rgba(0,0,0,0.85); color: #fff; padding: 8px 24px; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; z-index: 80; pointer-events: none; border-radius: 2px;';
      const overlay = document.getElementById('hud-overlay') || document.body;
      overlay.appendChild(el);
    }
    el.textContent = msg;
    el.style.borderColor = isUrgent ? '#e74c3c' : '#d4a359';
    el.style.color = isUrgent ? '#e74c3c' : '#fff';
    el.style.display = 'block';
    if (this._alertTimeout) clearTimeout(this._alertTimeout);
    this._alertTimeout = setTimeout(() => {
      el.style.display = 'none';
    }, 2800);
  }

  _throwGrenade() {
    if (!this.isInRaid || !this.localPlayer.isAlive || !this.network.isConnected ||
        this.inventory.overlay.classList.contains('active') ||
        performance.now() < this.grenadeThrowCooldownUntil) return;

    const carriedGrids = new Set(['rig', 'pockets', 'backpack', 'alpha']);
    const grenadeIndex = this.inventory.items.findIndex(item =>
      item.type === 'grenade' && item.grenadeType && carriedGrids.has(item.gridId)
    );
    if (grenadeIndex === -1) {
      audioEngine.playEmptyClick();
      this._showTacticalAlert('NO GRENADE CARRIED');
      return;
    }

    const grenade = this.inventory.items[grenadeIndex];
    this.network.send('throwGrenade', {
      grenadeKey: grenade.itemKey || grenade.weaponType || grenade.id,
      angle: this.localPlayer.angle
    });
    this.grenadeThrowCooldownUntil = performance.now() + 1000;
    this.inventory.items.splice(grenadeIndex, 1);
    this.inventory._renderItemsOnly();
    this._initWeaponsFromProfile();
    this._showTacticalAlert(`GRENADE THROWN: ${grenade.name.toUpperCase()}`);
  }

  _useMedicalItem(type) {
    if (!this.isInRaid || !this.localPlayer.isAlive) return;

    if (type === 'painkiller') {
      const count = this.medInventory.painkiller || 0;
      if (count <= 0) {
        audioEngine.playEmptyClick();
        return;
      }
      this.medInventory.painkiller--;
      this.localPlayer.painkillerTimer = 90; // 90s speed penalty suppression
      audioEngine.playPainkiller();
      this._showTacticalAlert('PAINKILLER APPLIED: 90s INJURY SPRINT BUFFER');

      // Deduct one instance or reduce count from physical inventory
      const pkIdx = this.inventory.items.findIndex(it => {
        const idLower = (it.id || '').toLowerCase();
        const nameLower = (it.name || '').toLowerCase();
        return idLower.includes('golden') || idLower.includes('morphine') || nameLower.includes('golden star') || nameLower.includes('morphine') || nameLower.includes('painkiller');
      });
      if (pkIdx !== -1) {
        const pkItem = this.inventory.items[pkIdx];
        if (pkItem.count && pkItem.count > 1) {
          pkItem.count--;
        } else {
          this.inventory.items.splice(pkIdx, 1);
        }
      }

      const slot6El = document.getElementById('slot-6-cnt');
      if (slot6El) slot6El.textContent = `x${this.medInventory.painkiller}`;
      return;
    }

    const count = this.medInventory[type] || 0;
    if (count <= 0) {
      audioEngine.playEmptyClick();
      return;
    }

    const hp = this.localPlayer.health || { head: 35, thorax: 85, stomach: 70, leftArm: 60, rightArm: 60, leftLeg: 65, rightLeg: 65 };
    const maxHp = { head: 35, thorax: 85, stomach: 70, leftArm: 60, rightArm: 60, leftLeg: 65, rightLeg: 65 };

    let worstLimb = null;
    let worstDeficit = 0;
    for (const [limb, max] of Object.entries(maxHp)) {
      const cur = hp[limb] || 0;
      const deficit = max - cur;
      if (deficit > worstDeficit) {
        worstDeficit = deficit;
        worstLimb = limb;
      }
    }

    if (!worstLimb || worstDeficit <= 0) {
      if (this.localPlayer.isBleeding && type === 'bandage') {
        this.localPlayer.isBleeding = false;
        this.medInventory[type]--;
        audioEngine.playMedUse(type);
        this._showTacticalAlert('BANDAGE APPLIED: BLEEDING STOPPED');
      }
      return;
    }

    this.medInventory[type]--;
    const healAmount = (type === 'bandage') ? 25 : 60;
    hp[worstLimb] = Math.min(maxHp[worstLimb], (hp[worstLimb] || 0) + healAmount);
    this.localPlayer.health = hp;
    this.localPlayer.isBleeding = false; // Bandage/Medkit cures bleed!

    // Deduct one instance from physical inventory items
    const medIdx = this.inventory.items.findIndex(it => {
      const idLower = (it.id || '').toLowerCase();
      const nameLower = (it.name || '').toLowerCase();
      if (type === 'bandage') return idLower.includes('bandage') || nameLower.includes('bandage');
      if (type === 'medkit') return idLower.includes('medkit') || idLower.includes('salewa') || idLower.includes('ifak') || idLower.includes('ai2') || idLower.includes('grizzly') || nameLower.includes('medkit') || nameLower.includes('salewa') || nameLower.includes('ifak') || nameLower.includes('ai-2') || nameLower.includes('grizzly');
      return false;
    });
    if (medIdx !== -1) {
      this.inventory.items.splice(medIdx, 1);
    }

    audioEngine.playMedUse(type);
    this._showTacticalAlert(type === 'bandage' ? 'BANDAGE APPLIED: BLEEDING STOPPED' : 'FIRST AID APPLIED (+60 HP)');
    this._updateHealthDollUI(hp);

    if (this.dom.slot4Cnt) this.dom.slot4Cnt.textContent = `x${this.medInventory.bandage}`;
    if (this.dom.slot5Cnt) this.dom.slot5Cnt.textContent = `x${this.medInventory.medkit}`;
    const slot6El = document.getElementById('slot-6-cnt');
    if (slot6El) slot6El.textContent = `x${this.medInventory.painkiller}`;
  }

  _toggleKeybindsDisplay(forceHide = null) {
    const modal = this.dom.controlsModal;
    const showPill = this.dom.btnShowBinds;
    if (!modal) return;

    let isHidden;
    if (forceHide !== null) {
      isHidden = forceHide;
    } else {
      isHidden = !modal.classList.contains('hidden');
    }

    if (isHidden) {
      modal.classList.add('hidden');
      if (showPill) showPill.style.display = 'block';
      localStorage.setItem('eft_hide_binds', '1');
    } else {
      modal.classList.remove('hidden');
      if (showPill) showPill.style.display = 'none';
      localStorage.removeItem('eft_hide_binds');
    }
  }

  _generateRandomRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (this.dom.inputRoomCode) {
      this.dom.inputRoomCode.value = code;
    }
    audioEngine.playFireSelector();
  }

  _setupUIEvents() {
    this.dom.authLoginTab?.addEventListener('click', () => this._setAuthMode('login'));
    this.dom.authRegisterTab?.addEventListener('click', () => this._setAuthMode('register'));

    this.dom.authLoginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = this.dom.authLoginForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      this._showAuthNotice('CONTACTING BATTLESTATE SERVER...', false);
      try {
        audioEngine.ensureContext();
        this.profile = await profileManager.loginAccount(
          this.dom.inputLoginUsername.value.trim(),
          this.dom.inputLoginPassword.value
        );
        this.dom.inputLoginPassword.value = '';
        this._openHideoutHub();
      } catch (error) {
        this._showAuthNotice(error.message);
      } finally {
        submit.disabled = false;
      }
    });

    this.dom.authRegisterForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = this.dom.authRegisterForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      this._showAuthNotice('CREATING PMC ACCOUNT...', false);
      try {
        audioEngine.ensureContext();
        this.profile = await profileManager.registerAccount(
          this.dom.inputRegisterUsername.value.trim(),
          this.dom.inputRegisterPassword.value,
          this.dom.inputRegisterCallsign.value.trim(),
          this.dom.selectRegisterFaction.value
        );
        this.dom.inputRegisterPassword.value = '';
        this._openHideoutHub();
      } catch (error) {
        this._showAuthNotice(error.message);
      } finally {
        submit.disabled = false;
      }
    });

    this.dom.inputRoomCode?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.dom.btnJoinRoom?.click();
      }
    });

    // Switch Account / Logout
    this.dom.btnSwitchAccount?.addEventListener('click', async () => {
      audioEngine.ensureContext();
      this.dom.btnSwitchAccount.disabled = true;
      try {
        await profileManager.logout();
        this.profile = null;
        this._showAuthScreen();
      } catch (error) {
        this._showAuthScreen(error.message);
      } finally {
        this.dom.btnSwitchAccount.disabled = false;
      }
    });

    // Open Stash & Character Management (Out of raid)
    const openStashHandler = () => {
      audioEngine.ensureContext();
      this.inventory.openOutOfRaidStashView();
    };
    this.dom.btnOpenStash?.addEventListener('click', openStashHandler);
    this.dom.btnOpenStashAlt?.addEventListener('click', openStashHandler);

    // Host & Join Room
    this.dom.btnHostRoom.addEventListener('click', () => {
      audioEngine.ensureContext();
      this._connectAndJoin(true);
    });
    this.dom.btnJoinRoom.addEventListener('click', () => {
      audioEngine.ensureContext();
      this._connectAndJoin(false);
    });

    // Map Card Selection
    for (const [mapId, cardEl] of Object.entries(this.dom.mapCards)) {
      cardEl.addEventListener('click', () => {
        audioEngine.ensureContext();
        if (!this.isHost && this.network.isConnected) {
          alert('Only the Squad Host can change the raid map location.');
          return;
        }
        this._selectMap(mapId);
      });
    }

    // Deploy Squad button
    this.dom.btnDeploySquad.addEventListener('click', () => {
      audioEngine.ensureContext();
      if (!this.isHost) {
        alert('Waiting for Squad Host to deploy the squad.');
        return;
      }
      this.dom.btnDeploySquad.disabled = true;
      this.dom.btnDeploySquad.textContent = 'DEPLOYING SQUAD...';
      this.network.deploySquad();
    });

    // Tab key toggles gear
    this.input.onToggleInventory = () => {
      if (!this.isInRaid) return;
      if (this.inventory.overlay.classList.contains('active')) {
        this.inventory.close();
      } else {
        this.inventory.openGearView();
      }
    };

    this.input.onCloseMenu = () => {
      this.inventory.close();
    };

    // [F] Loot Container Proximity Interaction
    this.input.onInteract = () => {
      if (!this.isInRaid) return;
      if (this.nearbyContainer) {
        if (this.inventory.overlay.classList.contains('active')) {
          this.inventory.close();
        } else {
          this.inventory.openContainerSearch(this.nearbyContainer);
          this.network.send('lootNoise', { containerId: this.nearbyContainer.id });
        }
      }
    };

    // Fire Mode Toggle [B]
    this.input.onFireModeChange = (mode) => {
      this.dom.badgeFiremode.textContent = (mode === 'SEMI') ? '[SEMI] (B)' : '[FULL-AUTO] (B)';
      this.dom.badgeFiremode.classList.toggle('highlight', mode === 'AUTO');
    };

    // Random Room Code Generator
    this.dom.btnGenRoomCode?.addEventListener('click', () => {
      this._generateRandomRoomCode();
    });

    // Alt Stash Open Button
    this.dom.btnOpenStashAlt?.addEventListener('click', () => {
      this.inventory.openOutOfRaidStashView();
    });

    // Hide/Show Controls Binds Helper
    this.dom.btnHideBinds?.addEventListener('click', () => {
      this._toggleKeybindsDisplay(true);
    });

    this.dom.btnShowBinds?.addEventListener('click', () => {
      this._toggleKeybindsDisplay(false);
    });

    // Quickbar Slot Click Handlers
    this.dom.slotWep1?.addEventListener('click', () => this._switchWeaponSlot(1));
    this.dom.slotWep2?.addEventListener('click', () => this._switchWeaponSlot(2));
    document.getElementById('slot-med-4')?.addEventListener('click', () => this._useMedicalItem('bandage'));
    document.getElementById('slot-med-5')?.addEventListener('click', () => this._useMedicalItem('medkit'));
    document.getElementById('slot-med-6')?.addEventListener('click', () => this._useMedicalItem('painkiller'));

    // Open Traders Market from hideout top bar
    document.getElementById('btn-open-traders')?.addEventListener('click', () => {
      audioEngine.ensureContext();
      this.traderMarket.open('prapor');
    });

    // Input Controller Arsenal & Medical Callbacks
    this.input.onSelectWeapon = (slot) => {
      this._switchWeaponSlot(slot);
    };

    this.input.onUseMed = (type) => {
      this._useMedicalItem(type);
    };
    this.input.onThrowGrenade = () => {
      this._throwGrenade();
    };

    this.input.onToggleBinds = () => {
      this._toggleKeybindsDisplay();
    };

    this.input.onReload = (isFast) => {
      if (!this.isInRaid) return;
      const wep = this.getActiveWeapon();
      if (!wep || wep.type === 'melee') return;

      const gridSlot = (this.activeWeaponSlot === 1) ? 'primaryWeapon' : 'secondaryWeapon';
      const equippedWepItem = this.inventory.items.find(it => it.gridId === gridSlot);

      // Case 1: Internal magazine weapon (e.g. Mosin Nagant) reloaded with loose rounds
      if (wep.config.internalMag) {
        if (wep.ammoCur >= wep.ammoMax) {
          this._showTacticalAlert(`${wep.config.name.toUpperCase()} MAGAZINE IS FULL`);
          return;
        }

        // Search Tactical Rig and Pockets for loose compatible ammo
        const ammoItem = this.inventory.items.find(it => 
          (it.gridId === 'rig' || it.gridId === 'pockets') &&
          isAmmoItem(it) && isCompatibleAmmo(wep, it) && (it.count || 0) > 0
        );

        if (!ammoItem) {
          audioEngine.playEmptyClick();
          this._showTacticalAlert('NO 7.62x54R ROUNDS IN RIG OR POCKETS!', true);
          return;
        }

        const needed = wep.ammoMax - wep.ammoCur;
        const roundsToLoad = Math.min(needed, ammoItem.count || 1);
        ammoItem.count -= roundsToLoad;
        ammoItem.sub = `${ammoItem.count} ROUNDS`;
        if (ammoItem.count <= 0) {
          const idx = this.inventory.items.indexOf(ammoItem);
          if (idx !== -1) this.inventory.items.splice(idx, 1);
        }

        wep.ammoCur += roundsToLoad;
        if (equippedWepItem) equippedWepItem.ammoCur = wep.ammoCur;

        audioEngine.playReload(isFast);
        this._updateWeaponHUD();
        this._showTacticalAlert(`RELOADED ${wep.config.name.split(' ')[0]} (${wep.ammoCur}/${wep.ammoMax})`);
        this.inventory._saveStashStateToProfile();
        return;
      }

      // Case 2: Detachable Magazine firearm (M4A1, AK-74M, MP5, Vector, Glock, etc.)
      // Tarkov Equipment Rule: Can ONLY reload from Tactical Rig ('rig') or Pockets ('pockets')!
      const compatibleMags = this.inventory.items.filter(it => 
        (it.gridId === 'rig' || it.gridId === 'pockets') &&
        isMagazineItem(it) && isCompatibleMagazine(wep, it)
      );

      // Find magazine with bullets
      const usableMags = compatibleMags.filter(m => (m.ammo || m.currentAmmo || 0) > 0);

      if (usableMags.length === 0) {
        audioEngine.playEmptyClick();
        if (compatibleMags.length > 0) {
          this._showTacticalAlert('MAGAZINE IN RIG IS EMPTY! REPACK AMMO IN [TAB]', true);
        } else {
          // Check if player has a spare mag in backpack
          const bpMag = this.inventory.items.find(it => it.gridId === 'backpack' && isMagazineItem(it) && isCompatibleMagazine(wep, it));
          if (bpMag) {
            this._showTacticalAlert('NO MAG IN RIG! MOVE SPARE MAG FROM BACKPACK TO RIG [TAB]', true);
          } else {
            this._showTacticalAlert('NO COMPATIBLE MAGAZINE IN RIG OR POCKETS!', true);
          }
        }
        return;
      }

      // Select magazine with the highest round count
      usableMags.sort((a, b) => (b.ammo || b.currentAmmo || 0) - (a.ammo || a.currentAmmo || 0));
      const newMag = usableMags[0];

      const oldAmmo = wep.ammoCur;
      const newAmmo = newMag.ammo ?? newMag.currentAmmo ?? wep.ammoMax;

      // Swap ammo in the magazine item and weapon
      wep.ammoCur = newAmmo;
      wep.ammoMax = newMag.maxAmmo ?? wep.config.magSize;
      if (equippedWepItem) {
        equippedWepItem.ammoCur = wep.ammoCur;
        equippedWepItem.ammoMax = wep.ammoMax;
      }

      // The magazine in rig/pockets now holds the previously chambered/ejected rounds!
      newMag.ammo = oldAmmo;
      newMag.currentAmmo = oldAmmo;
      newMag.sub = `${oldAmmo} / ${newMag.maxAmmo || wep.config.magSize}`;

      audioEngine.playReload(isFast);
      this._updateWeaponHUD();
      this._showTacticalAlert(`MAG SWAP: ${newMag.name.split(' ')[0]} (${wep.ammoCur}/${wep.ammoMax})`);
      this.inventory._saveStashStateToProfile();
    };

    // Stash Closed callback (re-sync loadout and restore hideout screen)
    this.inventory.onStashClosed = () => {
      this._initWeaponsFromProfile();
      if (!this.isInRaid) {
        this.dom.hideoutScreen.style.display = 'flex';
      }
    };

    // Container item transfer sync
    this.inventory.onContainerTransfer = (containerId, itemId, action, targetItem) => {
      this.network.send('transferContainerItem', { containerId, itemId, action, targetItem });
    };
    this.inventory.onDropItem = (item, sourceContainerId) => {
      if (!this.isInRaid || !this.network.isConnected) return false;
      this.network.send('dropItem', {
        itemId: item.id,
        itemKey: item.weaponType || item.itemKey || item.id,
        sourceContainerId,
        itemState: item
      });
      return true;
    };

    // Death modal acknowledgement
    this.dom.btnDeathOk?.addEventListener('click', () => {
      this.dom.deathModal.style.display = 'none';
      this._openHideoutHub();
    });

    // Survived Raid Summary buttons
    this.dom.btnTransferLoot?.addEventListener('click', () => {
      this._transferExtractedLootToStash();
      if (this.dom.summaryModal) this.dom.summaryModal.style.display = 'none';
      this._openHideoutHub();
    });

    this.dom.btnReturnHideoutDirect?.addEventListener('click', () => {
      if (this.dom.summaryModal) this.dom.summaryModal.style.display = 'none';
      this._openHideoutHub();
    });
  }

  _selectMap(mapId) {
    this.currentMapId = mapId;
    this.map = new TacticalMap(mapId);
    this.renderer.setMap(this.map);

    for (const [mid, cardEl] of Object.entries(this.dom.mapCards)) {
      cardEl.classList.toggle('selected', mid === mapId);
    }
    audioEngine.playFireSelector();

    if (this.network.isConnected && this.isHost) {
      this.network.selectMap(mapId);
    }
  }

  async _connectAndJoin(isHostAction) {
    const roomCode = this.dom.inputRoomCode.value.trim().toUpperCase() || 'EFT1';
    const playerName = this.profile?.callsign || 'USEC_Operator';

    try {
      if (!this.network.isConnected) {
        await this.network.connect();
      }
      this.network.joinRoom(roomCode, playerName);
    } catch (err) {
      alert('Failed to connect to tactical server. Please ensure server is running.');
    }
  }

  _setupNetworkEvents() {
    this.network.onJoinedLobby = (data) => {
      this.localPlayer.id = data.playerId;
      this.isHost = data.isHost;
      this.localPlayer.isHost = data.isHost;
      this._updateLobbyRoster(data.room);
    };

    this.network.onLobbyUpdate = (lobbyState) => {
      this._updateLobbyRoster(lobbyState);
    };

    // SYNCHRONIZED RAID DEPLOYMENT (Transitions into 60FPS Game Loop)
    this.network.onRaidStarted = (data) => {
      console.log('[*] Squad Deployed into:', data.mapName);

      this.currentMapId = data.mapId;
      this.map = new TacticalMap(data.mapId);
      this.renderer.setMap(this.map);
      this.containers = data.containers || this.map.containers;

      this.dom.roomCodeBadge.textContent = `${data.mapName.toUpperCase()} [${data.roomCode}]`;
      this.dom.hideoutScreen.style.display = 'none';
      this.dom.hudOverlay.style.display = 'flex';

      // Re-enable canvas input now that we are in-raid (was disabled in lobby)
      this.canvas.style.pointerEvents = 'auto';

      this.localPlayer.isAlive = true;
      this.localPlayer._extractionSaved = false;
      this.localPlayer._deathProcessed = false;
      this.raidScavKills = 0;
      if (this.dom.summaryModal) this.dom.summaryModal.style.display = 'none';
      if (this.dom.deathModal) this.dom.deathModal.style.display = 'none';

      // Load active PMC loadout
      this.inventory.loadFromProfile(this.profile);
      this._initWeaponsFromProfile();

      // Apply keybind helper preference
      if (localStorage.getItem('eft_hide_binds') === '1') {
        this._toggleKeybindsDisplay(true);
      }

      // Snap player + camera to the map spawn immediately so the first frames
      // are not rendered at the default (100,100) while fog-of-war covers the screen.
      const spawn = this.map.getSpawnPoint(this.localPlayer.slot || 0);
      if (spawn) {
        this.localPlayer.x = spawn.x;
        this.localPlayer.y = spawn.y;
        this.localPlayer.angle = spawn.angle || 0;
      }
      this.renderer.camera.x = this.localPlayer.x;
      this.renderer.camera.y = this.localPlayer.y;
      this.renderer.camera.targetX = this.localPlayer.x;
      this.renderer.camera.targetY = this.localPlayer.y;

      this.isInRaid = true;
      this.lastFrameTime = performance.now();

      // Launch 60 FPS RequestAnimationFrame Loop
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.animFrameId = requestAnimationFrame((t) => this.loop(t));
    };

    this.network.onContainerUpdated = (container) => {
      if (!container) return;
      const idx = this.containers.findIndex(c => c.id === container.id);
      if (idx !== -1) this.containers[idx] = container;
      if (this.inventory.activeContainer?.id === container.id) {
        this.inventory.activeContainer = container;
        this.inventory._renderItemsOnly();
      }
    };

    this.network.onContainerRemoved = (data) => {
      if (!data?.id) return;
      this.containers = this.containers.filter(c => c.id !== data.id);
      if (this.inventory.activeContainer?.id === data.id) {
        this.inventory.activeContainer.items = [];
        this.inventory._renderItemsOnly();
      }
    };

    this.network.onSnapshot = (snapshot) => {
      this._handleServerSnapshot(snapshot);
    };

    this.network.onDisconnect = () => {
      this.isInRaid = false;
      this._openHideoutHub();
    };
  }

  _updateLobbyRoster(room) {
    if (!room) return;

    this.currentMapId = room.mapId;
    for (const [mid, cardEl] of Object.entries(this.dom.mapCards)) {
      cardEl.classList.toggle('selected', mid === room.mapId);
    }

    this.dom.lobbyRosterList.innerHTML = '';
    for (const member of room.squad) {
      const item = document.createElement('div');
      item.className = 'roster-item';
      item.style.borderLeftColor = member.color;

      const isSelf = member.id === this.localPlayer.id;
      item.innerHTML = `
        <span style="color: ${member.color}; font-weight: 700;">
          ${member.name} ${isSelf ? '(YOU)' : ''}
        </span>
        ${member.isHost ? '<span class="badge-host">HOST</span>' : '<span style="color:#788597; font-size:10px;">READY</span>'}
      `;
      this.dom.lobbyRosterList.appendChild(item);
    }

    const amIHost = (this.localPlayer.id === room.hostId);
    this.isHost = amIHost;
    this.dom.btnDeploySquad.disabled = !amIHost;
    this.dom.btnDeploySquad.textContent = amIHost
      ? 'DEPLOY SQUAD INTO RAID'
      : 'WAITING FOR SQUAD HOST TO DEPLOY...';
  }

  _handleServerSnapshot(snapshot) {
    this.raidTimeRemaining = snapshot.raidTimeRemaining;
    const now = performance.now();

    // 1. Synchronize Players
    const activePlayerIds = new Set();
    for (const p of snapshot.players) {
      activePlayerIds.add(p.id);

      if (p.id === this.localPlayer.id) {
        if (typeof p.scavKills === 'number') {
          this.raidScavKills = p.scavKills;
        }

        // SERVER RECONCILIATION
        this.localPlayer.extractProgress = p.extractProgress;
        this.localPlayer.extractZoneName = p.extractZoneName;
        this.localPlayer.extracted = p.extracted;
        this.localPlayer.isAlive = p.isAlive;

        // Health Doll update & Screen Blood Flash
        if (p.health) {
          const oldHp = (this.localPlayer.health.head + this.localPlayer.health.thorax + this.localPlayer.health.stomach + this.localPlayer.health.leftArm + this.localPlayer.health.rightArm + this.localPlayer.health.leftLeg + this.localPlayer.health.rightLeg);
          const newHp = (p.health.head + p.health.thorax + p.health.stomach + p.health.leftArm + p.health.rightArm + p.health.leftLeg + p.health.rightLeg);
          if (newHp < oldHp) {
            this.renderer.triggerBloodFlash();
          }
          this.localPlayer.health = p.health;
          if (typeof p.isBleeding === 'boolean') {
            if (p.isBleeding && !this.localPlayer.isBleeding) {
              this._showTacticalAlert('HEAVY BLEED DETECTED! USE BANDAGE [4]', true);
            }
            this.localPlayer.isBleeding = p.isBleeding;
          }
          this._updateHealthDollUI(p.health);
        }

        // Death Check (Permanent loss)
        if (!p.isAlive && !this.localPlayer._deathProcessed) {
          this.localPlayer._deathProcessed = true;
          this._handleLocalPlayerDeath();
        }

        // Safe Extraction Check
        if (p.extracted && !this.localPlayer._extractionSaved) {
          this.localPlayer._extractionSaved = true;
          this._handleRaidExtraction(p);
        }

        this.pendingInputs = this.pendingInputs.filter(inp => inp.seq > p.lastProcessedInputSeq);
        const camDx = p.x - this.renderer.camera.x;
        const camDy = p.y - this.renderer.camera.y;
        if ((camDx * camDx + camDy * camDy) > 160000) {
          this.renderer.camera.x = p.x;
          this.renderer.camera.y = p.y;
          this.renderer.camera.targetX = p.x;
          this.renderer.camera.targetY = p.y;
        }
        this.localPlayer.x = p.x;
        this.localPlayer.y = p.y;
        this.localPlayer.vx = p.vx;
        this.localPlayer.vy = p.vy;
        this.localPlayer.stamina = p.stamina;

        for (const input of this.pendingInputs) {
          updatePlayerMovement(this.localPlayer, input, input.dt, this.map);
        }
      } else {
        // Remote Squad Member Lerp
        let remote = this.remotePlayers.get(p.id);
        if (!remote) {
          remote = {
            id: p.id, name: p.name, slot: p.slot, color: p.color,
            x: p.x, y: p.y, angle: p.angle, radius: PHYSICS_CONFIG.PLAYER_RADIUS,
            isAiming: p.isAiming, isCrouching: p.isCrouching, isSprinting: p.isSprinting,
            isFiring: p.isFiring, tacticalDevice: 'LASER', extractProgress: p.extractProgress,
            activeWeaponType: p.activeWeaponType || 'none',
            buffer: []
          };
          this.remotePlayers.set(p.id, remote);
        }

        remote.name = p.name;
        remote.slot = p.slot;
        remote.color = p.color;
        remote.isAiming = p.isAiming;
        remote.isCrouching = p.isCrouching;
        remote.isSprinting = p.isSprinting;
        remote.isFiring = p.isFiring;
        remote.activeWeaponType = p.activeWeaponType || 'none';
        remote.extractProgress = p.extractProgress;

        remote.buffer.push({ time: now, x: p.x, y: p.y, angle: p.angle });
        if (remote.buffer.length > 20) remote.buffer.shift();
      }
    }

    for (const [id] of this.remotePlayers.entries()) {
      if (!activePlayerIds.has(id)) this.remotePlayers.delete(id);
    }

    // 2. Synchronize Living PVE Scav Bots & Corpse Containers
    if (snapshot.bots) {
      const activeBotIds = new Set();
      for (const b of snapshot.bots) {
        activeBotIds.add(b.id);
        let bot = this.scavBots.get(b.id);
        if (!bot) {
          bot = { ...b, lastStepAt: now, lastX: b.x, lastY: b.y };
          this.scavBots.set(b.id, bot);
        } else {
          const distanceToPlayer = Math.hypot(b.x - this.localPlayer.x, b.y - this.localPlayer.y);

          // Play voiceline bark if state transitioned to ALERT
          if (b.state === 'ALERT' && bot.state !== 'ALERT') {
            audioEngine.playScavBark();
          }

          if (b.isFiring && !bot.isFiring && distanceToPlayer < this.botAudioRange) {
            const weaponDef = WEAPON_REGISTRY[b.weaponType];
            const soundType = weaponDef?.soundType || 'ak74m';
            const volume = Math.max(0.06, 1 - distanceToPlayer / this.botAudioRange);
            audioEngine.playGunshot(soundType, false, volume);
          }

          const movedDistance = Math.hypot(b.x - bot.lastX, b.y - bot.lastY);
          if (movedDistance > 1.5 && now - bot.lastStepAt > 320 && distanceToPlayer < 360) {
            const volume = Math.max(0.08, 1 - distanceToPlayer / 420);
            audioEngine.playFootstep(b.isSprinting ? 'SPRINT' : 'STAND', volume);
            bot.lastStepAt = now;
          }

          bot.x = b.x;
          bot.y = b.y;
          bot.lastX = b.x;
          bot.lastY = b.y;
          bot.hp = b.hp;
          bot.healthPct = b.healthPct;
          bot.angle = b.angle;
          bot.state = b.state;
          bot.isFiring = b.isFiring;
          bot.isSprinting = b.isSprinting;
          bot.weaponType = b.weaponType;
          bot.isBoss = b.isBoss;
          bot.bossType = b.bossType;
          bot.isGuard = b.isGuard;
          bot.speechText = b.speechText;
          bot.speechTimer = b.speechTimer;
        }
      }
      for (const id of this.scavBots.keys()) {
        if (!activeBotIds.has(id)) this.scavBots.delete(id);
      }
    }

    for (const hit of snapshot.botHits || []) {
      this.renderer.emitBloodParticles(hit.x, hit.y);
    }

    if (snapshot.grenades) {
      for (const oldG of this.grenades) {
        if (!snapshot.grenades.find(g => g.id === oldG.id)) {
          const dist = Math.hypot(this.localPlayer.x - oldG.x, this.localPlayer.y - oldG.y);
          if (dist < 450) {
            audioEngine.playGrenadeExplosion();
            this.renderer.addRecoilShake(16.0);
            if (dist < (oldG.blastRadius || 120)) {
              this.renderer.triggerBloodFlash();
            }
          }
        }
      }
      this.grenades = snapshot.grenades;
    }

    if (snapshot.containers) {
      this.containers = snapshot.containers;
    }

    if (snapshot.bullets && snapshot.bullets.length > 0) {
      const localBullets = this.bullets.filter(b => !b.isScav);
      this.bullets = [...localBullets, ...snapshot.bullets];
    }

    this._updateSquadListUI(snapshot.players);
  }

  _handleLocalPlayerDeath() {
    this.isInRaid = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    // Wipe equipped items from persistent save (Secure Alpha container survives)
    const alphaItems = this.inventory.items.filter(it => it.gridId === 'alpha');
    profileManager.handleRaidDeath(alphaItems);

    // Show death modal
    if (this.dom.hudOverlay) this.dom.hudOverlay.style.display = 'none';
    if (this.dom.deathModal) this.dom.deathModal.style.display = 'flex';
  }

  _calculateItemValue(item) {
    if (!item) return 0;
    const name = (item.name || '').toLowerCase();
    const tag = (item.tag || '').toLowerCase();
    const type = (item.type || '').toLowerCase();

    if (name.includes('bitcoin')) return 450000;
    if (name.includes('gpu') || name.includes('graphics card')) return 320000;
    if (name.includes('korund')) return 110000;
    if (name.includes('m4a1')) return 85000;
    if (name.includes('ak-74m') || name.includes('ak74m')) return 45000;
    if (name.includes('mp5')) return 38000;
    if (name.includes('mosin')) return 32000;
    if (name.includes('salewa')) return 28000;
    if (name.includes('ifak')) return 22000;
    if (name.includes('morphine')) return 18000;
    if (name.includes('glock')) return 16000;
    if (name.includes('bt ammo') || name.includes('m855a1') || name.includes('5.56x45') || name.includes('5.45x39')) return 15000;
    if (name.includes('stanag') || tag.includes('mag')) return 6000;
    if (name.includes('roubles') || tag.includes('cash')) return 25000;
    if (type === 'med' || tag.includes('med') || tag.includes('bleed')) return 5000;
    if (type === 'valuable' || tag.includes('barter')) return 35000;
    return Math.max(3000, (item.w || 1) * (item.h || 1) * 6000);
  }

  _handleRaidExtraction(playerState) {
    this.isInRaid = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    audioEngine.playExtractSuccess();

    // Persist carried inventory in profile
    profileManager.handleRaidSurvived(this.inventory.items);

    const kills = this.raidScavKills || playerState.scavKills || 0;
    if (this.profile) {
      if (!this.profile.stats) this.profile.stats = { raids: 0, survived: 0, kills: 0, deaths: 0 };
      this.profile.stats.kills = (this.profile.stats.kills || 0) + kills;
      profileManager.saveProfile();
    }

    const carriedItems = this.inventory.items || [];
    let totalLootVal = 0;
    for (const it of carriedItems) {
      totalLootVal += this._calculateItemValue(it);
    }

    const xp = 1500 + (kills * 400) + (carriedItems.length * 50);

    // Update modal UI
    if (this.dom.summaryExtractZone) {
      this.dom.summaryExtractZone.textContent = playerState.extractZoneName
        ? `EXTRACTED VIA ${playerState.extractZoneName.toUpperCase()}`
        : 'EXTRACTED (SURVIVED RAID)';
    }
    if (this.dom.summaryStatXp) {
      this.dom.summaryStatXp.textContent = `+${xp.toLocaleString()} XP`;
    }
    if (this.dom.summaryStatKills) {
      this.dom.summaryStatKills.textContent = `${kills} KILLS`;
    }
    if (this.dom.summaryStatValue) {
      this.dom.summaryStatValue.textContent = `${totalLootVal.toLocaleString()} ₽`;
    }

    if (this.dom.summaryLootList) {
      this.dom.summaryLootList.innerHTML = '';
      if (carriedItems.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.style.cssText = 'color: #7b8a99; font-size: 11px; padding: 8px;';
        emptyEl.textContent = 'No gear or loot was brought out.';
        this.dom.summaryLootList.appendChild(emptyEl);
      } else {
        for (const it of carriedItems) {
          const val = this._calculateItemValue(it);
          const itemEl = document.createElement('div');
          itemEl.className = 'summary-loot-item';
          itemEl.style.borderLeft = `3px solid ${it.color || '#2ecc71'}`;
          itemEl.innerHTML = `
            <div class="item-title">${it.name}</div>
            <div class="item-meta">${it.tag || it.type?.toUpperCase() || 'ITEM'} &bull; ${val.toLocaleString()} ₽</div>
          `;
          this.dom.summaryLootList.appendChild(itemEl);
        }
      }
    }

    if (this.dom.hudOverlay) this.dom.hudOverlay.style.display = 'none';
    if (this.dom.summaryModal) this.dom.summaryModal.style.display = 'flex';
  }

  _transferExtractedLootToStash() {
    if (!this.profile) return;
    if (!this.profile.stashItems) this.profile.stashItems = [];

    // Transfer items from backpack and rig into stash
    const toTransfer = this.inventory.items.filter(it => it.gridId === 'backpack' || it.gridId === 'rig');
    const kept = this.inventory.items.filter(it => it.gridId !== 'backpack' && it.gridId !== 'rig');

    const stashCols = 10;
    const stashRows = 30;

    for (const item of toTransfer) {
      let placed = false;
      const w = item.w || 1;
      const h = item.h || 1;

      for (let r = 0; r <= stashRows - h; r++) {
        for (let c = 0; c <= stashCols - w; c++) {
          let overlap = false;
          for (const s of this.profile.stashItems) {
            const sw = s.w || 1;
            const sh = s.h || 1;
            const overlapX = (c < s.gx + sw) && (c + w > s.gx);
            const overlapY = (r < s.gy + sh) && (r + h > s.gy);
            if (overlapX && overlapY) {
              overlap = true;
              break;
            }
          }
          if (!overlap) {
            item.gridId = 'stash';
            item.gx = c;
            item.gy = r;
            this.profile.stashItems.push({ ...item });
            placed = true;
            break;
          }
        }
        if (placed) break;
      }

      if (!placed) {
        // Fallback: place below lowest existing item if row available
        const maxGy = this.profile.stashItems.reduce((acc, s) => Math.max(acc, (s.gy || 0) + (s.h || 1)), 0);
        item.gridId = 'stash';
        item.gx = 0;
        item.gy = Math.min(29, maxGy);
        this.profile.stashItems.push({ ...item });
      }
    }

    // Update profile loadout with remaining items
    profileManager.handleRaidSurvived(kept);
    this.inventory.items = kept;
    audioEngine.playContainerSearch();
  }

  _interpolateRemotePlayers(now) {
    const renderTime = now - INTERPOLATION_DELAY_MS;

    for (const remote of this.remotePlayers.values()) {
      const buffer = remote.buffer;
      if (buffer.length === 0) continue;

      if (renderTime <= buffer[0].time) {
        remote.x = buffer[0].x; remote.y = buffer[0].y; remote.angle = buffer[0].angle;
      } else if (renderTime >= buffer[buffer.length - 1].time) {
        const latest = buffer[buffer.length - 1];
        remote.x = latest.x; remote.y = latest.y; remote.angle = latest.angle;
      } else {
        for (let i = 0; i < buffer.length - 1; i++) {
          const s0 = buffer[i];
          const s1 = buffer[i + 1];
          if (renderTime >= s0.time && renderTime <= s1.time) {
            const timeDiff = s1.time - s0.time;
            const t = (timeDiff > 0) ? (renderTime - s0.time) / timeDiff : 0;
            remote.x = lerp(s0.x, s1.x, t);
            remote.y = lerp(s0.y, s1.y, t);
            remote.angle = angleLerp(s0.angle, s1.angle, t);
            break;
          }
        }
      }
    }
  }

  /**
   * 60 FPS MAIN RENDER LOOP (MANDATE 1: CONDITIONAL RENDER PAUSING)
   */
  loop(currentTime) {
    if (!this.isInRaid) return; // CONDITIONAL PAUSE: Stop world rendering when out of raid

    const dt = Math.min((currentTime - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = currentTime;

    const isInvOpen = this.inventory.overlay.classList.contains('active');
    if (isInvOpen) {
      // Freeze background world raycasting & entity physics when inventory or stash is open
      this._updateHUD();
      this.animFrameId = requestAnimationFrame((t) => this.loop(t));
      return;
    }

    // 1. INPUT SAMPLING & FIRE DYNAMICS
    const viewW = this.canvas.width;
    const viewH = this.canvas.height;

    // Accurate mouse world calculation accounting for camera offset & zoom
    const mouseX_world = this.renderer.camera.x + (this.input.mouseX - viewW / 2) / this.renderer.zoom;
    const mouseY_world = this.renderer.camera.y + (this.input.mouseY - viewH / 2) / this.renderer.zoom;

    const inputState = this.input.getInputState(viewW / 2, viewH / 2);
    // World space aim angle
    const aimWorldAngle = Math.atan2(mouseY_world - this.localPlayer.y, mouseX_world - this.localPlayer.x);
    inputState.angle = aimWorldAngle;
    this.localPlayer.angle = aimWorldAngle;
    this.localPlayer.isAiming = inputState.isAiming;
    this.localPlayer.tacticalDevice = inputState.tacticalDevice;

    const activeWep = this.getActiveWeapon();
    const shouldFire = this.input.shouldFireWeapon(currentTime, isInvOpen);
    let shotAngle = null;

    if (activeWep.type === 'none') {
      this.localPlayer.isFiring = false;
    } else if (shouldFire) {
      if (activeWep.type === 'melee') {
        this.localPlayer.isFiring = true;
        audioEngine.playMeleeSwing();
        this.acousticRings.push({
          x: this.localPlayer.x, y: this.localPlayer.y,
          currentRadius: 8, maxRadius: 40, alpha: 0.45
        });
      } else if (activeWep.ammoCur <= 0) {
        audioEngine.playEmptyClick();
        this.localPlayer.isFiring = false;
      } else {
        this.localPlayer.isFiring = true;
        activeWep.ammoCur--;
        this._syncActiveWeaponAmmoToInventory();
        this._updateWeaponHUD();

        const isAuto = (this.input.fireMode === 'AUTO');
        audioEngine.playGunshot(activeWep.config.soundType, isAuto);
        this.renderer.addRecoilShake(activeWep.config.recoil);

        const movementSpeed = Math.hypot(this.localPlayer.vx || 0, this.localPlayer.vy || 0);
        const stanceSpread = this.localPlayer.isCrouching ? 0.012 : 0.035;
        const movementSpread = Math.min(0.075, movementSpeed / 280 * (this.localPlayer.isSprinting ? 0.10 : 0.07));
        const aimMultiplier = inputState.isAiming ? 0.55 : 1;
        this.spreadBloom = Math.min(0.18, this.spreadBloom + activeWep.config.bloom);
        const shotSpread = (activeWep.config.spread + stanceSpread + movementSpread + this.spreadBloom) * aimMultiplier;
        shotAngle = this.localPlayer.angle + (Math.random() * 2 - 1) * shotSpread;
        const bulletSpeed = activeWep.config.bulletSpeed;

        this.bullets.push({
          x: this.localPlayer.x + Math.cos(this.localPlayer.angle) * 36,
          y: this.localPlayer.y + Math.sin(this.localPlayer.angle) * 36,
          vx: Math.cos(shotAngle) * bulletSpeed,
          vy: Math.sin(shotAngle) * bulletSpeed,
          distTraveled: 0,
          maxDist: 520,
          weaponType: activeWep.type
        });

        const acousticMax = (activeWep.config.soundType === 'mosin') ? 260 : 170;
        this.acousticRings.push({
          x: this.localPlayer.x, y: this.localPlayer.y,
          currentRadius: 18, maxRadius: acousticMax, alpha: 0.85
        });
      }
    } else {
      this.localPlayer.isFiring = false;
    }

    const isMovingForAccuracy = Math.hypot(this.localPlayer.vx || 0, this.localPlayer.vy || 0) > 12;
    this.spreadBloom = Math.max(0, this.spreadBloom - (isMovingForAccuracy ? 0.10 : (inputState.isAiming ? 0.32 : 0.22)) * dt);

    // 2. BULLET INTEGRATION (ANTI-WALL TUNNELING WITH 8PX SUB-STEPPING)
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const totalDx = b.vx * dt;
      const totalDy = b.vy * dt;
      const totalDist = Math.hypot(totalDx, totalDy);
      const subSteps = Math.max(1, Math.ceil(totalDist / 8));
      const dSubX = totalDx / subSteps;
      const dSubY = totalDy / subSteps;
      const dSubDist = totalDist / subSteps;
      let hitWall = false;

      for (let s = 0; s < subSteps; s++) {
        b.x += dSubX;
        b.y += dSubY;
        b.distTraveled += dSubDist;
        const tx = Math.floor(b.x / this.map.tileSize);
        const ty = Math.floor(b.y / this.map.tileSize);
        if (this.map.isSolid(tx, ty)) {
          hitWall = true;
          break;
        }
        if (b.distTraveled >= b.maxDist) {
          break;
        }
      }

      if (hitWall || b.distTraveled >= b.maxDist) {
        this.bullets.splice(i, 1);
      }
    }

    // 3. CLIENT MOVEMENT PREDICTION
    this.inputSeq++;
    const inputPayload = {
      seq: this.inputSeq,
      dt: dt,
      moveX: inputState.moveX,
      moveY: inputState.moveY,
      angle: inputState.angle,
      isSprinting: inputState.isSprinting,
      isCrouching: inputState.isCrouching,
      isAiming: inputState.isAiming,
      isFiring: this.localPlayer.isFiring,
      shotAngle,
      activeWeaponType: activeWep.type,
      fireMode: inputState.fireMode,
      tacticalDevice: inputState.tacticalDevice
    };

    updatePlayerMovement(this.localPlayer, inputPayload, dt, this.map);
    this.pendingInputs.push(inputPayload);
    this.network.sendInput(inputPayload);

    // 4. FOOTSTEPS
    const isMoving = (inputState.moveX !== 0 || inputState.moveY !== 0);
    if (isMoving) {
      let stepInterval = 340;
      let stance = 'STAND';
      if (this.localPlayer.isSprinting) { stepInterval = 230; stance = 'SPRINT'; }
      else if (this.localPlayer.isCrouching) { stepInterval = 490; stance = 'CROUCH'; }

      if (currentTime - this.lastFootstepTime >= stepInterval) {
        audioEngine.playFootstep(stance);
        this.lastFootstepTime = currentTime;
        if (stance === 'SPRINT') {
          this.acousticRings.push({ x: this.localPlayer.x, y: this.localPlayer.y, currentRadius: 10, maxRadius: 75, alpha: 0.6 });
        }
      }
    }

    // 5. PROXIMITY CHECK (Containers & Dead Scav Corpses)
    this.nearbyContainer = null;
    let nearestContainerDistance = Infinity;
    for (const c of this.containers) {
      const dist = Math.hypot(this.localPlayer.x - c.x, this.localPlayer.y - c.y);
      if (dist < 56 && dist < nearestContainerDistance) {
        this.nearbyContainer = c;
        nearestContainerDistance = dist;
      }
    }

    // 6. EXTRACTION RADIO BEEP
    if (this.localPlayer.extractProgress > 0) {
      const curSec = Math.floor(this.localPlayer.extractProgress * 7);
      if (curSec !== this.lastExtractBeepSecond) {
        audioEngine.playExtractBeep();
        this.lastExtractBeepSecond = curSec;
      }
    }

    for (let i = this.acousticRings.length - 1; i >= 0; i--) {
      const ring = this.acousticRings[i];
      ring.currentRadius += 100 * dt;
      ring.alpha -= 0.85 * dt;
      if (ring.alpha <= 0 || ring.currentRadius >= ring.maxRadius) this.acousticRings.splice(i, 1);
    }

    // 7. LERP & CAMERA TRACKING (ADS DYNAMIC LOOK-AHEAD)
    this._interpolateRemotePlayers(currentTime);

    let targetCamX = this.localPlayer.x;
    let targetCamY = this.localPlayer.y;

    if (inputState.isAiming) {
      // RMB held down: shift camera target toward cursor position by 45%
      targetCamX = this.localPlayer.x + (mouseX_world - this.localPlayer.x) * 0.45;
      targetCamY = this.localPlayer.y + (mouseY_world - this.localPlayer.y) * 0.45;
    }

    this.renderer.updateCamera(targetCamX, targetCamY, inputState.isAiming);

    // 8. HIGH-PERFORMANCE CULLED RENDERING PASS (Zero-allocation entity pass)
    this._squadListBuffer.length = 0;
    for (const remote of this.remotePlayers.values()) {
      this._squadListBuffer.push(remote);
    }

    this._scavListBuffer.length = 0;
    for (const bot of this.scavBots.values()) {
      this._scavListBuffer.push(bot);
    }

    this.renderer.render(
      this.localPlayer,
      this._squadListBuffer,
      this._scavListBuffer,
      this.containers,
      this.bullets,
      this.acousticRings,
      this.nearbyContainer,
      this.grenades
    );

    // 9. HUD UPDATE
    this._updateHUD();

    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  _updateHUD() {
    const mins = Math.floor(this.raidTimeRemaining / 60);
    const secs = Math.floor(this.raidTimeRemaining % 60);
    this.dom.raidTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.dom.raidTimer.classList.toggle('urgent', this.raidTimeRemaining < 60);

    const stamPercent = Math.max(0, Math.min(100, Math.round(this.localPlayer.stamina)));
    this.dom.staminaFill.style.width = `${stamPercent}%`;
    this.dom.staminaVal.textContent = `${stamPercent}%`;

    this.dom.badgeSprint.classList.toggle('active', this.localPlayer.isSprinting);
    this.dom.badgeCrouch.classList.toggle('active', this.localPlayer.isCrouching);
    this.dom.badgeAds.classList.toggle('active', this.localPlayer.isAiming);
    this.dom.badgeStand.classList.toggle('active', !this.localPlayer.isSprinting && !this.localPlayer.isCrouching);

    this.dom.badgeFiremode.textContent = (this.input.fireMode === 'SEMI') ? '[SEMI] (B)' : '[FULL-AUTO] (B)';
    this.dom.badgeTactical.textContent = this.getActiveWeapon().type === 'none'
      ? 'NO DEVICE'
      : `${this.localPlayer.tacticalDevice} (T)`;
    this._updateWeaponHUD();

    if (this.localPlayer.extractProgress > 0) {
      this.dom.extractBanner.classList.add('active');
      this.dom.extractZoneName.textContent = `EXTRACTING: ${this.localPlayer.extractZoneName || 'EXTRACTION ZONE'}`;
      this.dom.extractBarFill.style.width = `${Math.min(100, this.localPlayer.extractProgress * 100)}%`;
    } else {
      this.dom.extractBanner.classList.remove('active');
    }

    if (this.localPlayer.extracted) {
      this.dom.extractBanner.classList.add('active');
      this.dom.extractZoneName.textContent = 'EXTRACTED (SURVIVED RAID)';
      this.dom.extractBarFill.style.width = '100%';
    }
  }

  _updateHealthDollUI(h) {
    const total = h.head + h.thorax + h.stomach + h.leftArm + h.rightArm + h.leftLeg + h.rightLeg;
    document.getElementById('hud-total-hp').textContent = `${total} / 440`;

    const zones = [
      { id: 'zone-head', hp: h.head, max: 35 },
      { id: 'zone-thorax', hp: h.thorax, max: 85 },
      { id: 'zone-stomach', hp: h.stomach, max: 70 },
      { id: 'zone-larm', hp: h.leftArm, max: 60 },
      { id: 'zone-rarm', hp: h.rightArm, max: 60 },
      { id: 'zone-lleg', hp: h.leftLeg, max: 65 },
      { id: 'zone-rleg', hp: h.rightLeg, max: 65 }
    ];

    for (const z of zones) {
      const el = document.getElementById(z.id);
      if (!el) continue;
      const pct = z.hp / z.max;
      if (pct <= 0) {
        el.style.backgroundColor = '#1a1111';
        el.style.color = '#7f8c8d';
        el.style.borderColor = '#c0392b';
      } else if (pct < 0.4) {
        el.style.backgroundColor = '#381616';
        el.style.color = '#e74c3c';
        el.style.borderColor = '#e74c3c';
      } else if (pct < 0.75) {
        el.style.backgroundColor = '#3a2812';
        el.style.color = '#f39c12';
        el.style.borderColor = '#f39c12';
      } else {
        el.style.backgroundColor = '#142a1a';
        el.style.color = '#2ecc71';
        el.style.borderColor = '#1e4526';
      }
    }

    const bleedEl = document.getElementById('hud-bleed-status');
    if (this.localPlayer.isBleeding) {
      if (!bleedEl) {
        const b = document.createElement('div');
        b.id = 'hud-bleed-status';
        b.style.cssText = 'color: #e74c3c; font-size: 10px; font-weight: 700; margin-top: 4px; text-shadow: 0 0 6px rgba(231,76,60,0.8);';
        b.textContent = '🩸 HEAVY BLEEDING (-2 HP/s)';
        document.getElementById('hud-health-doll')?.appendChild(b);
      } else {
        bleedEl.style.display = 'block';
      }
    } else if (bleedEl) {
      bleedEl.style.display = 'none';
    }
  }

  _updateSquadListUI(players) {
    if (!players || !this.dom.squadMemberList) return;
    const sig = players.map(p => `${p.id}:${p.name}:${p.color}`).join('|');
    if (this._lastSquadSig === sig) return;
    this._lastSquadSig = sig;

    this.dom.squadMemberList.innerHTML = '';
    for (const p of players) {
      const row = document.createElement('div');
      row.className = 'squad-member';

      const dot = document.createElement('div');
      dot.className = 'squad-slot-dot';
      dot.style.backgroundColor = p.color;

      const name = document.createElement('span');
      name.textContent = `${p.name} ${p.id === this.localPlayer.id ? '(YOU)' : ''}`;

      row.appendChild(dot);
      row.appendChild(name);
      this.dom.squadMemberList.appendChild(row);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameClient();
});
