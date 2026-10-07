/**
 * EFT Tactical 2D - Hideout Trader Marketplace Engine
 * Full interactive trading system with Prapor, Therapist, and Peacekeeper.
 * Persists transactions in localStorage profileManager.
 */

import { profileManager } from './profile.js';
import { audioEngine } from './audio.js';
import { getRarityColor, WEAPON_REGISTRY } from '/shared/weapons.js';

export const TRADERS = {
  prapor: {
    id: 'prapor',
    name: 'PRAPOR',
    fullName: 'Pavel Yegorovich Romanenko',
    role: 'Russian Military Surplus & Arms Dealer',
    desc: 'Warrant officer in charge of internal depot supply. Supplies Kalashnikovs, Mosins, Russian ammunition, and rugged military equipment.',
    portraitColor: '#873600',
    avatar: '🇷🇺',
    buyCatalog: [
      {
        id: 'ammo_pst',
        name: '9x19mm PST GZH Ammo (50 rounds)',
        tag: '9x19 PST',
        sub: 'Surplus Pistol Ammo',
        w: 1, h: 1,
        color: '#95a5a6',
        rarity: 'common',
        price: 9000,
        type: 'ammo',
        count: 50,
        outOfStock: false
      },
      {
        id: 'bandage',
        name: 'Aseptic Bandage',
        tag: 'BANDAGE',
        sub: 'Stops Light Bleeds',
        w: 1, h: 1,
        color: '#2ecc71',
        rarity: 'common',
        price: 3500,
        type: 'med',
        count: 1,
        outOfStock: false
      },
      {
        id: 'mag_glock_17',
        name: 'Glock 17-rnd 9x19 Magazine',
        tag: 'MAG 9x19',
        sub: 'Surplus Magazine',
        w: 1, h: 1,
        color: '#95a5a6',
        rarity: 'common',
        price: 4000,
        type: 'magazine',
        ammo: 17, maxAmmo: 17,
        outOfStock: false
      },
      {
        id: 'ak74m',
        name: 'Kalashnikov AK-74M 5.45x39',
        tag: 'AK-74M',
        sub: '5.45x39 Assault Rifle',
        w: 5, h: 2,
        color: '#d35400',
        rarity: 'tactical',
        price: 48000,
        type: 'weapon',
        weaponType: 'ak74m',
        durability: 100, maxDurability: 100,
        outOfStock: true
      },
      {
        id: 'mosin',
        name: 'Mosin Nagant Sniper Rifle',
        tag: 'MOSIN',
        sub: '7.62x54R Bolt-Action',
        w: 6, h: 2,
        color: '#e67e22',
        rarity: 'tactical',
        price: 38000,
        type: 'weapon',
        weaponType: 'mosin',
        durability: 100, maxDurability: 100,
        outOfStock: true
      },
      {
        id: 'rpk16',
        name: 'RPK-16 Drum LMG',
        tag: 'RPK-16',
        sub: '5.45x39 95-Rnd Drum',
        w: 5, h: 2,
        color: '#f39c12',
        rarity: 'rare',
        price: 92000,
        type: 'weapon',
        weaponType: 'rpk16',
        durability: 100, maxDurability: 100,
        outOfStock: true
      },
      {
        id: 'goldentt',
        name: 'Golden TT-33 Tokarev',
        tag: 'GOLD-TT',
        sub: '7.62x25 Soviet Sidearm',
        w: 2, h: 1,
        color: '#f1c40f',
        rarity: 'gold',
        price: 65000,
        type: 'weapon',
        weaponType: 'goldentt',
        durability: 100, maxDurability: 100,
        outOfStock: true
      },
      {
        id: 'ammo_545_bt',
        name: '5.45x39 BT AP Ammo (60 rounds)',
        tag: '5.45 BT',
        sub: 'Armor-Piercing',
        w: 1, h: 1,
        color: '#e67e22',
        rarity: 'tactical',
        price: 14000,
        type: 'ammo',
        count: 60,
        outOfStock: true
      },
      {
        id: 'ammo_762_lps',
        name: '7.62x54R LPS Ammo (30 rounds)',
        tag: '7.62 LPS',
        sub: 'Sniper Match',
        w: 1, h: 1,
        color: '#d35400',
        rarity: 'tactical',
        price: 18000,
        type: 'ammo',
        count: 30,
        outOfStock: true
      }
    ]
  },

  therapist: {
    id: 'therapist',
    name: 'THERAPIST',
    fullName: 'Elvira Khabibullina',
    role: 'Medical Supplies & High-Tech Barter Broker',
    desc: 'Department head of central trauma. Due to Norvinsk supply blockades, medical depots are depleted. Only basic AI-2 kits and splints remain.',
    portraitColor: '#16a085',
    avatar: '🏥',
    buyCatalog: [
      {
        id: 'ai2',
        name: 'AI-2 Orange Medkit',
        tag: 'AI-2',
        sub: 'Emergency Injector (100 HP)',
        w: 1, h: 1,
        color: '#f39c12',
        rarity: 'common',
        price: 7500,
        type: 'med',
        durability: 100, maxDurability: 100,
        outOfStock: false
      },
      {
        id: 'splint',
        name: 'Immobilizing Splint',
        tag: 'SPLINT',
        sub: 'Fracture Fixer',
        w: 1, h: 1,
        color: '#bdc3c7',
        rarity: 'common',
        price: 4000,
        type: 'med',
        count: 1,
        outOfStock: false
      },
      {
        id: 'bandage',
        name: 'Aseptic Bandage',
        tag: 'BANDAGE',
        sub: 'Stops Light Bleeds',
        w: 1, h: 1,
        color: '#2ecc71',
        rarity: 'common',
        price: 3500,
        type: 'med',
        count: 1,
        outOfStock: false
      },
      {
        id: 'grizzly',
        name: 'Grizzly First Aid Kit (1800 HP)',
        tag: 'GRIZZLY',
        sub: 'Heavy Combat Medic Kit',
        w: 2, h: 2,
        color: '#c0392b',
        rarity: 'gold',
        price: 42000,
        type: 'med',
        durability: 1800, maxDurability: 1800,
        outOfStock: true
      },
      {
        id: 'goldenstar',
        name: 'Golden Star Balm (Painkiller)',
        tag: 'G-STAR',
        sub: '90s Sprint Buffer (10 Uses)',
        w: 1, h: 1,
        color: '#f1c40f',
        rarity: 'gold',
        price: 36000,
        type: 'med',
        count: 10,
        outOfStock: true
      },
      {
        id: 'morphine',
        name: 'Morphine Auto-Injector',
        tag: 'MORPH',
        sub: '90s Instant Pain Suppression',
        w: 1, h: 1,
        color: '#9b59b6',
        rarity: 'rare',
        price: 19000,
        type: 'med',
        count: 1,
        outOfStock: true
      },
      {
        id: 'salewa',
        name: 'Salewa First Aid Kit (400 HP)',
        tag: 'SALEWA',
        sub: 'Trauma & Bleed Repair',
        w: 2, h: 1,
        color: '#e74c3c',
        rarity: 'tactical',
        price: 26000,
        type: 'med',
        durability: 400, maxDurability: 400,
        outOfStock: true
      },
      {
        id: 'ifak',
        name: 'IFAK Individual Tactical Medkit',
        tag: 'IFAK',
        sub: 'Compact 300 HP Healer',
        w: 1, h: 1,
        color: '#e67e22',
        rarity: 'tactical',
        price: 18000,
        type: 'med',
        durability: 300, maxDurability: 300,
        outOfStock: true
      }
    ]
  },

  peacekeeper: {
    id: 'peacekeeper',
    name: 'PEACEKEEPER',
    fullName: 'Tadeusz Pilsudski',
    role: 'UN Logistics Officer & Western Armament Contractor',
    desc: 'UN Logistics Checkpoint. Due to strict United Nations embargo and depot raids, western firearm shipments are halted.',
    portraitColor: '#2980b9',
    avatar: '🇺🇳',
    buyCatalog: [
      {
        id: 'bandage',
        name: 'UN Emergency Bandage',
        tag: 'BANDAGE',
        sub: 'Sterile Field Bandage',
        w: 1, h: 1,
        color: '#2ecc71',
        rarity: 'common',
        price: 3500,
        type: 'med',
        count: 1,
        outOfStock: false
      },
      {
        id: 'ammo_919_surplus',
        name: '9x19mm FMJ Ammo (50 rounds)',
        tag: '9x19 FMJ',
        sub: 'UN Peacekeeper Surplus',
        w: 1, h: 1,
        color: '#95a5a6',
        rarity: 'common',
        price: 9000,
        type: 'ammo',
        count: 50,
        outOfStock: false
      },
      {
        id: 'm4a1',
        name: 'Colt M4A1 5.56x45 NATO',
        tag: 'M4A1',
        sub: '800 RPM Full-Auto Carbine',
        w: 5, h: 2,
        color: '#3498db',
        rarity: 'rare',
        price: 82000,
        type: 'weapon',
        weaponType: 'm4a1',
        durability: 100, maxDurability: 100,
        outOfStock: true
      },
      {
        id: 'vector',
        name: 'Kriss Vector .45 ACP',
        tag: 'VECTOR',
        sub: '1100 RPM CQB Shredder',
        w: 3, h: 2,
        color: '#9b59b6',
        rarity: 'rare',
        price: 76000,
        type: 'weapon',
        weaponType: 'vector',
        durability: 100, maxDurability: 100,
        outOfStock: true
      },
      {
        id: 'mpx',
        name: 'SIG MPX 9x19 SMG',
        tag: 'MPX',
        sub: '850 RPM Laser Beam',
        w: 3, h: 2,
        color: '#2ecc71',
        rarity: 'tactical',
        price: 52000,
        type: 'weapon',
        weaponType: 'mpx',
        durability: 100, maxDurability: 100,
        outOfStock: true
      },
      {
        id: 'asval',
        name: 'AS VAL Silenced 9x39',
        tag: 'AS VAL',
        sub: 'Integral Suppressor 900 RPM',
        w: 5, h: 2,
        color: '#9b59b6',
        rarity: 'rare',
        price: 88000,
        type: 'weapon',
        weaponType: 'asval',
        durability: 100, maxDurability: 100,
        outOfStock: true
      },
      {
        id: 'armor_korund',
        name: 'Korund-VM Class 5 Body Armor',
        tag: 'KORUND',
        sub: 'Heavy Class 5 Protection',
        w: 3, h: 3,
        color: '#f1c40f',
        rarity: 'gold',
        price: 115000,
        type: 'armor',
        armorClass: 5,
        durability: 45, maxDurability: 45,
        outOfStock: true
      },
      {
        id: 'armor_trooper',
        name: 'Trooper T4 Armored Carrier',
        tag: 'TROOPER',
        sub: 'High Mobility Class 4',
        w: 3, h: 3,
        color: '#9b59b6',
        rarity: 'rare',
        price: 64000,
        type: 'armor',
        armorClass: 4,
        durability: 85, maxDurability: 85,
        outOfStock: true
      },
      {
        id: 'ammo_556_m855a1',
        name: '5.56x45 M855A1 NATO AP (60 rounds)',
        tag: 'M855A1',
        sub: 'High-Velocity AP',
        w: 1, h: 1,
        color: '#3498db',
        rarity: 'rare',
        price: 22000,
        type: 'ammo',
        count: 60,
        outOfStock: true
      }
    ]
  }
};

export class TraderMarketEngine {
  constructor(modalElement) {
    this.modal = modalElement;
    this.activeTraderId = 'prapor';
    this.activeTab = 'BUY'; // 'BUY' | 'SELL'
    this.onProfileUpdated = null;
  }

  open(traderId = 'prapor') {
    this.activeTraderId = traderId;
    this.activeTab = 'BUY';
    this._render();
    this.modal.style.display = 'flex';
    audioEngine.ensureContext();
    audioEngine.playFireSelector();
  }

  close() {
    this.modal.style.display = 'none';
    if (this.onProfileUpdated) {
      this.onProfileUpdated();
    }
  }

  switchTrader(traderId) {
    if (!TRADERS[traderId]) return;
    this.activeTraderId = traderId;
    this._render();
    audioEngine.playFireSelector();
  }

  setTab(tab) {
    this.activeTab = tab;
    this._render();
    audioEngine.playFireSelector();
  }

  _calculateSellPrice(item) {
    if (!item) return 0;
    const name = (item.name || '').toLowerCase();
    const tag = (item.tag || '').toLowerCase();
    const type = (item.type || '').toLowerCase();

    let base = 5000;
    if (name.includes('bitcoin')) base = 450000;
    else if (name.includes('gpu') || name.includes('graphics card')) base = 320000;
    else if (name.includes('ledx')) base = 380000;
    else if (name.includes('keycard')) base = 250000;
    else if (name.includes('tetriz')) base = 120000;
    else if (name.includes('flash drive')) base = 75000;
    else if (name.includes('korund')) base = 85000;
    else if (name.includes('trooper')) base = 48000;
    else if (name.includes('maska')) base = 65000;
    else if (name.includes('m4a1')) base = 62000;
    else if (name.includes('as val') || name.includes('asval')) base = 66000;
    else if (name.includes('vss')) base = 60000;
    else if (name.includes('rpk')) base = 68000;
    else if (name.includes('vector')) base = 57000;
    else if (name.includes('mpx')) base = 39000;
    else if (name.includes('ak-74m') || name.includes('ak74m')) base = 36000;
    else if (name.includes('saiga')) base = 32000;
    else if (name.includes('mosin')) base = 28000;
    else if (name.includes('goldentt') || name.includes('golden tt')) base = 48000;
    else if (name.includes('mp5')) base = 28000;
    else if (name.includes('glock')) base = 12000;
    else if (name.includes('grizzly')) base = 31000;
    else if (name.includes('golden star') || name.includes('goldenstar')) base = 27000;
    else if (name.includes('morphine')) base = 14000;
    else if (name.includes('salewa')) base = 19000;
    else if (name.includes('ifak')) base = 13500;
    else if (name.includes('ai-2') || name.includes('ai2')) base = 5500;
    else if (name.includes('bandage')) base = 2500;
    else if (name.includes('splint')) base = 3000;
    else if (type === 'ammo' || tag.includes('ammo')) base = 11000;
    else if (type === 'valuable' || tag.includes('barter') || tag.includes('tech')) base = 50000;
    else base = Math.max(3000, (item.w || 1) * (item.h || 1) * 4500);

    // Trader specialization multipliers
    let multiplier = 1.0;
    if (this.activeTraderId === 'therapist') {
      if (type === 'med' || name.includes('bitcoin') || name.includes('gpu') || name.includes('ledx') || name.includes('tetriz') || name.includes('flash drive')) {
        multiplier = 1.25; // Therapist pays +25% premium on tech/barter/meds
      } else if (type === 'weapon') {
        multiplier = 0.70; // Discount on firearms
      }
    } else if (this.activeTraderId === 'peacekeeper') {
      if (name.includes('m4a1') || name.includes('vector') || name.includes('mpx') || name.includes('trooper') || name.includes('5.56')) {
        multiplier = 1.15; // Western gear premium
      }
    } else if (this.activeTraderId === 'prapor') {
      if (name.includes('ak') || name.includes('mosin') || name.includes('rpk') || name.includes('tt') || name.includes('5.45') || name.includes('7.62')) {
        multiplier = 1.10; // Soviet military surplus premium
      }
    }

    return Math.round(base * multiplier);
  }

  buyItem(catalogItem) {
    const prof = profileManager.profile;
    if (!prof) return;

    if (catalogItem.outOfStock) {
      alert(`DEPOT SHORTAGE: ${catalogItem.name} is currently out of stock due to the Norvinsk military embargo. You must find and extract this gear from a combat raid!`);
      audioEngine.playEmptyClick();
      return;
    }

    if (prof.roubles < catalogItem.price) {
      alert(`INSUFFICIENT FUNDS: You need ${catalogItem.price.toLocaleString()} ₽, but only have ${prof.roubles.toLocaleString()} ₽.`);
      audioEngine.playEmptyClick();
      return;
    }

    prof.roubles -= catalogItem.price;

    // Find next open vertical row in stash (10x30)
    const stash = prof.stashItems || [];
    const maxGy = stash.reduce((acc, s) => Math.max(acc, (s.gy || 0) + (s.h || 1)), 0);

    const newItem = {
      ...catalogItem,
      id: `${catalogItem.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      gridId: 'stash',
      gx: 0,
      gy: Math.min(28, maxGy)
    };

    stash.push(newItem);
    prof.stashItems = stash;
    profileManager.saveProfile();

    audioEngine.playCashRegister();
    this._render();
    if (this.onProfileUpdated) this.onProfileUpdated();
  }

  sellItem(item) {
    const prof = profileManager.profile;
    if (!prof) return;

    const price = this._calculateSellPrice(item);
    prof.roubles += price;

    // Remove from stash
    prof.stashItems = (prof.stashItems || []).filter(s => s.id !== item.id);
    profileManager.saveProfile();

    audioEngine.playCashRegister();
    this._render();
    if (this.onProfileUpdated) this.onProfileUpdated();
  }

  _render() {
    const prof = profileManager.profile || { roubles: 0, callsign: 'OPERATOR' };
    const curTrader = TRADERS[this.activeTraderId];

    this.modal.innerHTML = `
      <div class="trader-modal-box">
        <!-- Header -->
        <div class="trader-modal-header">
          <div class="trader-title-row">
            <span class="trader-avatar-badge" style="background: ${curTrader.portraitColor};">${curTrader.avatar}</span>
            <div>
              <div class="trader-main-title">${curTrader.name} &bull; ${curTrader.fullName.toUpperCase()}</div>
              <div class="trader-sub-title">${curTrader.role}</div>
            </div>
          </div>
          <div class="trader-balance-badge">
            ROUBLES: <span id="trader-balance-val">${prof.roubles.toLocaleString()} ₽</span>
          </div>
          <button class="btn-secondary" id="btn-close-traders" style="padding: 6px 14px;">RETURN TO HIDEOUT [ESC]</button>
        </div>

        <!-- Trader Selection Bar -->
        <div class="trader-nav-row">
          ${Object.values(TRADERS).map(t => `
            <div class="trader-tab-btn ${t.id === this.activeTraderId ? 'active' : ''}" data-trader="${t.id}">
              <span class="tab-emoji">${t.avatar}</span>
              <span class="tab-label">${t.name}</span>
            </div>
          `).join('')}
        </div>

        <!-- Mode Toggle (BUY vs SELL) -->
        <div class="trader-mode-bar">
          <div class="trader-mode-btn ${this.activeTab === 'BUY' ? 'active' : ''}" id="mode-tab-buy">
            🛒 BUY ITEMS FROM ${curTrader.name}
          </div>
          <div class="trader-mode-btn ${this.activeTab === 'SELL' ? 'active' : ''}" id="mode-tab-sell">
            💰 SELL STASH INVENTORY TO ${curTrader.name}
          </div>
        </div>

        <div class="trader-desc-banner">
          ${curTrader.desc}
        </div>

        <!-- Main Workspace Area -->
        <div class="trader-workspace-area">
          ${this.activeTab === 'BUY' ? `
            <div style="background: rgba(192, 57, 43, 0.15); border-left: 3px solid #e74c3c; color: #f39c12; margin-bottom: 12px; padding: 10px 14px; font-size: 11px; line-height: 1.5;">
              ⚠️ <strong>NORVINSK SUPPLY EMBARGO:</strong> Depot stockpiles are nearly exhausted and traders are almost empty! High-tier firearms, armor, and combat gear are out of stock. You must enter raids to loot and extract military equipment!
            </div>
            ${this._renderBuyGrid(curTrader)}
          ` : this._renderSellGrid(prof)}
        </div>
      </div>
    `;

    // Bind navigation events
    this.modal.querySelectorAll('.trader-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTrader(btn.dataset.trader);
      });
    });

    document.getElementById('mode-tab-buy')?.addEventListener('click', () => this.setTab('BUY'));
    document.getElementById('mode-tab-sell')?.addEventListener('click', () => this.setTab('SELL'));
    document.getElementById('btn-close-traders')?.addEventListener('click', () => this.close());

    // Bind action buttons
    this.modal.querySelectorAll('.btn-buy-item:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.item;
        const catalogItem = curTrader.buyCatalog.find(c => c.id === itemId);
        if (catalogItem) this.buyItem(catalogItem);
      });
    });

    this.modal.querySelectorAll('.btn-sell-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.item;
        const stashItem = (prof.stashItems || []).find(s => s.id === itemId);
        if (stashItem) this.sellItem(stashItem);
      });
    });
  }

  _renderBuyGrid(trader) {
    return `
      <div class="trader-items-grid">
        ${trader.buyCatalog.map(item => {
          const rarity = item.rarity || 'common';
          const rColor = getRarityColor(rarity);
          if (item.outOfStock) {
            return `
              <div class="trader-item-card rarity-${rarity} is-out-of-stock" style="border-left: 3px solid #7f8c8d; opacity: 0.52; filter: grayscale(0.4);">
                <div class="trader-item-top">
                  <span class="item-tag" style="background: #e74c3c;">OUT OF STOCK</span>
                  <span class="item-price-tag" style="color: #7f8c8d; text-decoration: line-through;">${item.price.toLocaleString()} ₽</span>
                </div>
                <div class="trader-item-name" style="color: #bdc3c7;">${item.name}</div>
                <div class="trader-item-sub" style="color: #e67e22;">[DEPOT SHORTAGE - RAID ONLY] &bull; ${item.w}x${item.h}</div>
                <button class="btn-buy-item" disabled style="opacity: 0.45; cursor: not-allowed; background: #2c3e50; border: 1px solid #444;" data-item="${item.id}">
                  DEPOT OUT OF STOCK
                </button>
              </div>
            `;
          }
          return `
            <div class="trader-item-card rarity-${rarity}" style="border-left: 3px solid ${rColor};">
              <div class="trader-item-top">
                <span class="item-tag" style="background: ${item.color || rColor};">${item.tag}</span>
                <span class="item-price-tag">${item.price.toLocaleString()} ₽</span>
              </div>
              <div class="trader-item-name">${item.name}</div>
              <div class="trader-item-sub">${item.sub || ''} &bull; ${item.w}x${item.h}</div>
              <button class="btn-buy-item" data-item="${item.id}">
                PURCHASE FOR ${item.price.toLocaleString()} ₽
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _renderSellGrid(profile) {
    const stash = profile.stashItems || [];
    if (stash.length === 0) {
      return `
        <div style="text-align: center; padding: 48px; color: var(--text-muted); font-size: 13px;">
          YOUR STASH IS CURRENTLY EMPTY.<br>EXTRACT FROM A RAID OR BUY SURPLUS TO SELL ITEMS HERE.
        </div>
      `;
    }

    return `
      <div class="trader-items-grid">
        ${stash.map(item => {
          const price = this._calculateSellPrice(item);
          const rarity = item.rarity || 'common';
          const rColor = getRarityColor(rarity);
          return `
            <div class="trader-item-card rarity-${rarity}" style="border-left: 3px solid ${rColor};">
              <div class="trader-item-top">
                <span class="item-tag" style="background: ${item.color || rColor};">${item.tag || 'ITEM'}</span>
                <span class="item-price-tag" style="color: #2ecc71;">+${price.toLocaleString()} ₽</span>
              </div>
              <div class="trader-item-name">${item.name}</div>
              <div class="trader-item-sub">${item.sub || ''} &bull; ${item.w}x${item.h}</div>
              <button class="btn-sell-item" data-item="${item.id}">
                SELL TO TRADER FOR ${price.toLocaleString()} ₽
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}
