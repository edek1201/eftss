/**
 * EFT Tactical 2D - Operator Account & Persistent Session Engine
 * Strictly keyed under 'tarkov2d_profile' in browser localStorage.
 * Supports:
 * - Operator Initialization on first launch
 * - Auto-login on subsequent visits directly into Hideout Hub
 * - Switch Account / Logout flow
 * - 100% operational out-of-raid 10x30 Stash and PMC Loadout customization
 * - Permanent gear loss on death vs. gear retention on extraction
 */

const STORAGE_KEY = 'tarkov2d_profile';

export class ProfileManager {
  constructor() {
    this.profile = null;
    this.loadProfile();
  }

  hasProfile() {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  /**
   * Migrate a profile from any older schema version to the current one.
   * This is strictly additive — it never removes data the user has.
   */
  _migrateProfile(p) {
    if (!p) return p;

    // Ensure top-level numeric / string fields exist
    if (typeof p.roubles !== 'number') p.roubles = 500000;
    if (typeof p.level !== 'number') p.level = 1;
    if (!p.faction) p.faction = 'USEC';

    // Ensure stats object
    if (!p.stats || typeof p.stats !== 'object') {
      p.stats = { raids: 0, survived: 0, kills: 0, deaths: 0 };
    } else {
      p.stats.raids = p.stats.raids || 0;
      p.stats.survived = p.stats.survived || 0;
      p.stats.kills = p.stats.kills || 0;
      p.stats.deaths = p.stats.deaths || 0;
    }

    // Ensure loadout object — the most common breakage point for old profiles
    if (!p.loadout || typeof p.loadout !== 'object') {
      p.loadout = {
        primary: null,
        secondary: null,
        rig: [],
        pockets: [],
        alpha: [],
        backpack: []
      };
    } else {
      // Patch individual sub-arrays that might be missing
      if (!Array.isArray(p.loadout.rig)) p.loadout.rig = [];
      if (!Array.isArray(p.loadout.pockets)) p.loadout.pockets = [];
      if (!Array.isArray(p.loadout.alpha)) p.loadout.alpha = [];
      if (!Array.isArray(p.loadout.backpack)) p.loadout.backpack = [];
    }

    // Ensure stashItems
    if (!Array.isArray(p.stashItems)) p.stashItems = [];

    return p;
  }

  loadProfile() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        let parsed = JSON.parse(raw);
        parsed = this._migrateProfile(parsed);
        this.profile = parsed;
        // Write migrated version back so next load is already clean
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        return this.profile;
      } catch (e) {
        console.warn('Corrupt profile detected — resetting:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    this.profile = null;
    return null;
  }

  initProfile(callsign = 'USEC_Operator', faction = 'USEC') {
    const cleanName = callsign.trim().substring(0, 16) || 'USEC_Operator';

    this.profile = {
      callsign: cleanName,
      faction: faction,
      level: 1,
      roubles: 500000,
      stats: {
        raids: 0,
        survived: 0,
        kills: 0,
        deaths: 0
      },
      // In-Raid PMC Equipment Loadout
      loadout: {
        primary: {
          id: 'loadout_m4a1',
          name: 'Colt M4A1 5.56x45',
          weaponType: 'm4a1',
          type: 'weapon',
          w: 5, h: 2,
          gridId: 'primaryWeapon',
          gx: 0, gy: 0,
          color: '#d4a359',
          tag: 'PRIMARY',
          sub: '5.56x45 NATO',
          ammoCur: 30,
          ammoMax: 30
        },
        secondary: {
          id: 'loadout_glock17',
          name: 'Glock 17 9x19',
          weaponType: 'glock17',
          type: 'weapon',
          w: 1, h: 2,
          gridId: 'secondaryWeapon',
          gx: 0, gy: 0,
          color: '#95a5a6',
          tag: 'SIDEARM',
          sub: '9x19mm Pistol',
          ammoCur: 17,
          ammoMax: 17
        },
        rig: [
          {
            id: 'rig_mag_1',
            itemKey: 'mag_stanag_30',
            name: 'STANAG 30-rnd 5.56x45',
            type: 'magazine',
            caliber: '5.56x45mm NATO',
            ammo: 30,
            maxAmmo: 30,
            w: 1, h: 2,
            gridId: 'rig',
            gx: 0, gy: 0,
            color: '#d4a359',
            tag: 'MAG 5.56',
            sub: '30 / 30'
          },
          {
            id: 'rig_mag_2',
            itemKey: 'mag_stanag_30',
            name: 'STANAG 30-rnd 5.56x45',
            type: 'magazine',
            caliber: '5.56x45mm NATO',
            ammo: 30,
            maxAmmo: 30,
            w: 1, h: 2,
            gridId: 'rig',
            gx: 1, gy: 0,
            color: '#d4a359',
            tag: 'MAG 5.56',
            sub: '30 / 30'
          },
          {
            id: 'rig_glock_mag',
            itemKey: 'mag_glock_17',
            name: 'Glock 17-rnd 9x19',
            type: 'magazine',
            caliber: '9x19mm',
            ammo: 17,
            maxAmmo: 17,
            w: 1, h: 1,
            gridId: 'rig',
            gx: 2, gy: 0,
            color: '#95a5a6',
            tag: 'MAG 9x19',
            sub: '17 / 17'
          },
          {
            id: 'rig_ai2',
            name: 'AI-2 MEDKIT',
            type: 'med',
            w: 1, h: 2,
            gridId: 'rig',
            gx: 3, gy: 0,
            color: '#e67e22',
            tag: 'MED',
            sub: '100 / 100'
          }
        ],
        pockets: [
          {
            id: 'pocket_bandage',
            name: 'ESMARCH BANDAGE',
            type: 'med',
            w: 1, h: 1,
            gridId: 'pockets',
            gx: 0, gy: 0,
            color: '#2ecc71',
            tag: 'BLEED',
            sub: '2 / 2'
          },
          {
            id: 'pocket_splint',
            name: 'IMMOBILIZING SPLINT',
            type: 'med',
            w: 1, h: 1,
            gridId: 'pockets',
            gx: 1, gy: 0,
            color: '#9b59b6',
            tag: 'FRACTURE',
            sub: '1 / 1'
          }
        ],
        alpha: [
          {
            id: 'alpha_goldenstar',
            name: 'GOLDEN STAR BALM',
            type: 'med',
            w: 1, h: 1,
            gridId: 'alpha',
            gx: 0, gy: 0,
            color: '#f1c40f',
            tag: 'PAIN',
            sub: '10 uses'
          },
          {
            id: 'alpha_salewa',
            name: 'SALEWA FIRST AID',
            type: 'med',
            w: 2, h: 1,
            gridId: 'alpha',
            gx: 0, gy: 1,
            color: '#e74c3c',
            tag: 'HEAL',
            sub: '400 / 400'
          }
        ],
        backpack: [
          {
            id: 'bp_m855',
            itemKey: 'ammo_m855a1',
            name: '5.56x45 M855A1 AP',
            type: 'ammo',
            caliber: '5.56x45mm NATO',
            count: 60,
            maxCount: 60,
            w: 1, h: 1,
            gridId: 'backpack',
            gx: 0, gy: 0,
            color: '#f1c40f',
            tag: 'AMMO 5.56',
            sub: '60 ROUNDS'
          }
        ]
      },
      // Out-of-Raid 10x30 Persistent Main Stash
      stashItems: [
        {
          id: 'stash_ak74m',
          name: 'Kalashnikov AK-74M',
          weaponType: 'ak74m',
          type: 'weapon',
          w: 2, h: 4,
          gridId: 'stash',
          gx: 0, gy: 0,
          color: '#e67e22',
          tag: 'WEAPON',
          sub: '5.45x39mm'
        },
        {
          id: 'stash_mp5',
          name: 'HK MP5 9x19',
          weaponType: 'mp5',
          type: 'weapon',
          w: 2, h: 3,
          gridId: 'stash',
          gx: 2, gy: 0,
          color: '#3498db',
          tag: 'SMG',
          sub: '9x19mm'
        },
        {
          id: 'stash_mosin',
          name: 'Mosin Nagant 7.62x54R',
          weaponType: 'mosin',
          type: 'weapon',
          w: 1, h: 6,
          gridId: 'stash',
          gx: 4, gy: 0,
          color: '#8e44ad',
          tag: 'SNIPER',
          sub: '7.62x54R Bolt'
        },
        {
          id: 'stash_mag_ak',
          itemKey: 'mag_ak74_30',
          name: '6L23 30-rnd 5.45x39',
          type: 'magazine',
          caliber: '5.45x39mm',
          ammo: 30,
          maxAmmo: 30,
          w: 1, h: 2,
          gridId: 'stash',
          gx: 5, gy: 0,
          color: '#e67e22',
          tag: 'MAG 5.45',
          sub: '30 / 30'
        },
        {
          id: 'stash_mag_mp5',
          itemKey: 'mag_mp5_30',
          name: 'MP5 30-rnd 9x19',
          type: 'magazine',
          caliber: '9x19mm',
          ammo: 30,
          maxAmmo: 30,
          w: 1, h: 2,
          gridId: 'stash',
          gx: 5, gy: 2,
          color: '#3498db',
          tag: 'MAG 9x19',
          sub: '30 / 30'
        },
        {
          id: 'stash_korund',
          name: 'Korund-VM Armor T5',
          type: 'armor',
          w: 2, h: 3,
          gridId: 'stash',
          gx: 6, gy: 0,
          color: '#2c3e50',
          tag: 'ARMOR T5',
          sub: '45 / 45'
        },
        {
          id: 'stash_salewa',
          name: 'SALEWA FIRST AID',
          type: 'med',
          w: 2, h: 2,
          gridId: 'stash',
          gx: 8, gy: 0,
          color: '#e74c3c',
          tag: 'MEDKIT',
          sub: '400 / 400'
        },
        {
          id: 'stash_bt_ammo',
          itemKey: 'ammo_bt',
          name: '5.45x39 BT AP (60)',
          type: 'ammo',
          caliber: '5.45x39mm',
          count: 60,
          maxCount: 60,
          w: 1, h: 1,
          gridId: 'stash',
          gx: 0, gy: 5,
          color: '#f39c12',
          tag: 'AMMO 5.45',
          sub: '60 AP Rounds'
        },
        {
          id: 'stash_lps_ammo',
          itemKey: 'ammo_lps',
          name: '7.62x54R LPS GZH (20)',
          type: 'ammo',
          caliber: '7.62x54R',
          count: 20,
          maxCount: 20,
          w: 1, h: 1,
          gridId: 'stash',
          gx: 1, gy: 5,
          color: '#8e44ad',
          tag: 'AMMO 7.62',
          sub: '20 Sniper Rounds'
        },
        {
          id: 'stash_gpu',
          name: 'GRAPHICS CARD (GPU)',
          type: 'valuable',
          w: 1, h: 2,
          gridId: 'stash',
          gx: 2, gy: 5,
          color: '#00d2d3',
          tag: 'BARTER',
          sub: 'Rare Tech'
        },
        {
          id: 'stash_bitcoin',
          name: 'PHYSICAL BITCOIN',
          type: 'valuable',
          w: 1, h: 1,
          gridId: 'stash',
          gx: 3, gy: 5,
          color: '#f1c40f',
          tag: 'CURRENCY',
          sub: '0.2 BTC'
        },
        {
          id: 'stash_morphine',
          name: 'MORPHINE INJECTOR',
          type: 'med',
          w: 1, h: 1,
          gridId: 'stash',
          gx: 4, gy: 5,
          color: '#1abc9c',
          tag: 'PAINKILLER',
          sub: 'Fast Action'
        }
      ]
    };

    this.saveProfile();
    return this.profile;
  }

  saveProfile() {
    if (!this.profile) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch (e) {
      console.error('Failed to save profile to localStorage:', e);
    }
  }

  logout() {
    localStorage.removeItem(STORAGE_KEY);
    this.profile = null;
  }

  handleRaidSurvived(carriedItems) {
    if (!this.profile) return;
    this.profile.stats.raids++;
    this.profile.stats.survived++;

    const rig = [];
    const backpack = [];
    const alpha = [];
    const pockets = [];
    let primary = null;
    let secondary = null;

    for (const item of carriedItems) {
      if (item.gridId === 'primaryWeapon') primary = item;
      else if (item.gridId === 'secondaryWeapon') secondary = item;
      else if (item.gridId === 'rig') rig.push(item);
      else if (item.gridId === 'backpack') backpack.push(item);
      else if (item.gridId === 'alpha') alpha.push(item);
      else if (item.gridId === 'pockets') pockets.push(item);
    }

    this.profile.loadout = { primary, secondary, rig, backpack, alpha, pockets };
    this.saveProfile();
  }

  handleRaidDeath(alphaItems) {
    if (!this.profile) return;
    this.profile.stats.raids++;
    this.profile.stats.deaths++;

    // Wipe all non-secure equipped items on death
    this.profile.loadout = {
      primary: null,
      secondary: null,
      rig: [],
      backpack: [],
      pockets: [],
      alpha: alphaItems || [] // Secure Alpha box is never lost on death
    };

    this.saveProfile();
  }
}

export const profileManager = new ProfileManager();
