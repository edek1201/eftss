/**
 * EFT Tactical 2D - Ultra-High Performance Tetris Grid Inventory Engine
 * Optimized Architecture: Zero real-time DOM cell destruction/recreation.
 * Pre-constructs static cell matrices once and performs lightweight dirty-state item updates.
 */

import { audioEngine } from './audio.js';
import { profileManager } from './profile.js';
import { isWeaponItem, getRarityColor, WEAPON_REGISTRY, ITEM_CATALOG, getWeaponConfig, isMagazineItem, isAmmoItem, isCompatibleMagazine, isCompatibleAmmo, isCompatibleAttachment } from '/shared/weapons.js';

export class GridInventory {
  constructor(overlayElement) {
    this.overlay = overlayElement;

    // Grid Specifications (Primary Weapon expanded to 7x2, Secondary to 3x2)
    this.gearGrids = {
      primaryWeapon: { id: 'primaryWeapon', name: 'PRIMARY WEAPON', cols: 7, rows: 2, cellPx: 44 },
      secondaryWeapon: { id: 'secondaryWeapon', name: 'SIDEARM', cols: 3, rows: 2, cellPx: 44 },
      rig: { id: 'rig', name: 'TACTICAL RIG', cols: 4, rows: 2, cellPx: 44 },
      pockets: { id: 'pockets', name: 'POCKETS', cols: 4, rows: 1, cellPx: 44 },
      alpha: { id: 'alpha', name: 'ALPHA SECURE (2x2)', cols: 2, rows: 2, cellPx: 44 },
      backpack: { id: 'backpack', name: 'SCAV BACKPACK (4x5)', cols: 4, rows: 5, cellPx: 44 }
    };

    this.stashGrid = { id: 'stash', name: 'MAIN STASH (10x30)', cols: 10, rows: 30, cellPx: 38 };

    this.activeContainer = null;
    this.containerGrid = null;
    this.items = [];

    // Drag / Move state
    this.heldItem = null;
    this.heldOriginal = null;
    this.hoverTarget = null;
    this.ghostEl = null;
    this.lastItemPress = null;

    // High performance Drag-and-Drop caching state (Zero Lag / Zero DOM Reflow)
    this.cachedGridBounds = [];
    this.gridCellMatrices = {};
    this.activeHighlightedCells = [];
    this.activeGridDefs = [];
    this.mouseClientX = 0;
    this.mouseClientY = 0;
    this.dragRafId = null;

    this.viewMode = 'GEAR'; // 'GEAR' | 'CONTAINER_LOOT' | 'OUT_OF_RAID_STASH'
    this.onContainerTransfer = null;
    this.onDropItem = null;
    this.onStashClosed = null;
    this.onEquipmentChanged = null;
    this.magazineUnloadTimer = null;
    this.magazineUnloadState = null;
    this.magazineLoadTimer = null;
    this.magazineLoadState = null;

    this._createDOMSkeleton();
    this._bindEvents();
  }

  loadFromProfile(profile) {
    if (!profile) return;
    this.items = [];

    // Use optional chaining throughout — an old/corrupt localStorage profile
    // that lacks a 'loadout' field must NOT crash the constructor.
    const lo = profile.loadout || {};

    if (lo.primary) {
      this.items.push({ ...lo.primary, gridId: 'primaryWeapon' });
    }
    if (lo.secondary) {
      this.items.push({ ...lo.secondary, gridId: 'secondaryWeapon' });
    }
    if (Array.isArray(lo.rig)) {
      for (const it of lo.rig) this.items.push({ ...it, gridId: 'rig' });
    }
    if (Array.isArray(lo.pockets)) {
      for (const it of lo.pockets) this.items.push({ ...it, gridId: 'pockets' });
    }
    if (Array.isArray(lo.alpha)) {
      for (const it of lo.alpha) this.items.push({ ...it, gridId: 'alpha' });
    }
    if (Array.isArray(lo.backpack)) {
      for (const it of lo.backpack) this.items.push({ ...it, gridId: 'backpack' });
    }
  }

  _createDOMSkeleton() {
    this.overlay.innerHTML = `
      <div class="inventory-modal" id="inv-modal-container"></div>
      <div id="inv-drag-ghost" class="inv-drag-ghost" style="display: none;"></div>
    `;
    this.ghostEl = document.getElementById('inv-drag-ghost');
  }

  openGearView() {
    this._cancelMagazineUnload(false);
    this._cancelMagazineLoad(false);
    this.viewMode = 'GEAR';
    this.activeContainer = null;
    this.containerGrid = null;
    this._buildGearDOM();
    this.overlay.classList.add('active');
  }

  openContainerSearch(container) {
    this._cancelMagazineUnload(false);
    this._cancelMagazineLoad(false);
    this.viewMode = 'CONTAINER_LOOT';
    this.activeContainer = container;
    this.containerGrid = {
      id: `container_${container.id}`,
      name: `${container.name.toUpperCase()} (${container.gridW}x${container.gridH})`,
      cols: container.gridW || 3,
      rows: container.gridH || 2,
      cellPx: 44
    };

    // Filter out old container items and add current container items
    this.items = this.items.filter(it => !it.gridId.startsWith('container_'));
    for (const cItem of container.items) {
      this.items.push({ ...cItem, gridId: this.containerGrid.id });
    }

    this._buildContainerDOM();
    this.overlay.classList.add('active');
    audioEngine.playContainerSearch();
  }

  openOutOfRaidStashView() {
    this._cancelMagazineUnload(false);
    this._cancelMagazineLoad(false);
    this.viewMode = 'OUT_OF_RAID_STASH';
    this.activeContainer = null;
    this.containerGrid = null;

    const profile = profileManager.profile;
    this.loadFromProfile(profile);
    if (profile && profile.stashItems) {
      for (const sItem of profile.stashItems) {
        this.items.push({ ...sItem, gridId: 'stash' });
      }
    }

    this._buildStashDOM();
    this.overlay.classList.add('active');
  }

  close() {
    this._cancelMagazineUnload(false);
    this._cancelMagazineLoad(false);
    if (this.heldItem) this._cancelHold();
    this.overlay.classList.remove('active');
    const wasStashMode = (this.viewMode === 'OUT_OF_RAID_STASH');
    this.activeContainer = null;
    this.containerGrid = null;

    if (wasStashMode) {
      this._saveStashStateToProfile();
      if (this.onStashClosed) this.onStashClosed();
    }

    if (this.onEquipmentChanged) {
      this.onEquipmentChanged();
    }
  }

  _buildGearDOM() {
    const modal = document.getElementById('inv-modal-container');
    modal.innerHTML = `
      <div class="inventory-header">
        <div class="inventory-title">TACTICAL GEAR INSPECTION (TETRIS MATRIX)</div>
        <div class="inventory-sub">DOUBLE-CLICK WEAPONS TO EQUIP / UNEQUIP &bull; [R] ROTATE &bull; [TAB] CLOSE</div>
      </div>
      <div class="inventory-body">
        <div class="inv-col">
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.primaryWeapon.name} (7x2)</div>
            <div class="tetris-grid" id="grid-primaryWeapon"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.secondaryWeapon.name} (3x2)</div>
            <div class="tetris-grid" id="grid-secondaryWeapon"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.rig.name} (4x2)</div>
            <div class="tetris-grid" id="grid-rig"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.pockets.name} (4x1)</div>
            <div class="tetris-grid" id="grid-pockets"></div>
          </div>
        </div>
        <div class="inv-col">
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.backpack.name} (4x5)</div>
            <div class="tetris-grid" id="grid-backpack"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.alpha.name} (2x2)</div>
            <div class="tetris-grid" id="grid-alpha"></div>
          </div>
        </div>
      </div>
      <div class="inventory-footer">
        <div class="inv-status" id="inv-status-msg">CLICK ITEM TO MOVE &bull; PRESS [R] TO ROTATE &bull; PRESS [G] OR DRAG A WEAPON OUTSIDE TO DROP IT</div>
      </div>
    `;

    this._renderStaticGridsAndItems([
      this.gearGrids.primaryWeapon,
      this.gearGrids.secondaryWeapon,
      this.gearGrids.rig,
      this.gearGrids.pockets,
      this.gearGrids.backpack,
      this.gearGrids.alpha
    ]);
  }

  _buildContainerDOM() {
    const modal = document.getElementById('inv-modal-container');
    const cGrid = this.containerGrid;

    modal.innerHTML = `
      <div class="inventory-header">
        <div class="inventory-title">LOOTING: ${this.activeContainer.name.toUpperCase()}</div>
        <div class="inventory-sub">SHIFT-CLICK OR DRAG TO TAKE &bull; [ESC] / [F] CLOSE</div>
      </div>
      <div class="inventory-body">
        <div class="inv-col">
          <div class="grid-section">
            <div class="grid-header" style="color: #2ecc71;">CONTAINER CONTENTS (${cGrid.cols}x${cGrid.rows})</div>
            <div class="tetris-grid" id="grid-${cGrid.id}" style="border-color: #2ecc71;"></div>
          </div>
        </div>
        <div class="inv-col">
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.rig.name} (4x2)</div>
            <div class="tetris-grid" id="grid-rig"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.backpack.name} (4x5)</div>
            <div class="tetris-grid" id="grid-backpack"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.alpha.name} (2x2)</div>
            <div class="tetris-grid" id="grid-alpha"></div>
          </div>
        </div>
      </div>
      <div class="inventory-footer">
        <div class="inv-status" id="inv-status-msg">SHIFT-CLICK TO QUICK-LOOT ITEMS INTO BACKPACK</div>
      </div>
    `;

    this._renderStaticGridsAndItems([
      cGrid,
      this.gearGrids.rig,
      this.gearGrids.backpack,
      this.gearGrids.alpha
    ]);
  }

  _buildStashDOM() {
    const modal = document.getElementById('inv-modal-container');
    const prof = profileManager.profile;

    modal.innerHTML = `
      <div class="inventory-header">
        <div>
          <div class="inventory-title">HIDEOUT &bull; STASH & LOADOUT MANAGEMENT</div>
          <div class="inventory-sub">${prof.callsign} &bull; ROUBLES: ${prof.roubles.toLocaleString()} ₽ &bull; SURVIVED: ${prof.stats.survived}/${prof.stats.raids}</div>
        </div>
        <button class="btn-secondary" id="btn-close-stash-view" style="padding: 6px 14px;">RETURN TO HIDEOUT</button>
      </div>
      <div class="inventory-body" style="grid-template-columns: 360px 1fr;">
        <div class="inv-col">
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.primaryWeapon.name} (7x2)</div>
            <div class="tetris-grid" id="grid-primaryWeapon"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.secondaryWeapon.name} (3x2)</div>
            <div class="tetris-grid" id="grid-secondaryWeapon"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.rig.name} (4x2)</div>
            <div class="tetris-grid" id="grid-rig"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.backpack.name} (4x5)</div>
            <div class="tetris-grid" id="grid-backpack"></div>
          </div>
          <div class="grid-section">
            <div class="grid-header">${this.gearGrids.alpha.name} (2x2 SECURE)</div>
            <div class="tetris-grid" id="grid-alpha"></div>
          </div>
        </div>
        <div class="inv-col" style="max-height: 560px; overflow-y: auto; padding-right: 8px;">
          <div class="grid-section">
            <div class="grid-header" style="color: var(--accent-gold); display: flex; justify-content: space-between; align-items: center;">
              ${this.stashGrid.name}
              <button class="btn-secondary" id="btn-sort-stash" style="padding: 4px 10px;">SORT</button>
            </div>
            <div class="tetris-grid" id="grid-stash" style="border-color: #d4a359;"></div>
          </div>
        </div>
      </div>
      <div class="inventory-footer">
        <div class="inv-status" id="inv-status-msg">ITEMS IN STASH AND SECURE ALPHA BOX ARE SAFE FROM DEATH</div>
      </div>
    `;

    document.getElementById('btn-close-stash-view')?.addEventListener('click', () => {
      this.close();
    });
    document.getElementById('btn-sort-stash')?.addEventListener('click', () => {
      this._sortStashItems();
    });

    this._renderStaticGridsAndItems([
      this.gearGrids.primaryWeapon,
      this.gearGrids.secondaryWeapon,
      this.gearGrids.rig,
      this.gearGrids.backpack,
      this.gearGrids.alpha,
      this.stashGrid
    ]);
  }

  _renderStaticGridsAndItems(gridDefs) {
    this.activeGridDefs = gridDefs;
    this.gridCellMatrices = {};

    for (const g of gridDefs) {
      const el = document.getElementById(`grid-${g.id}`);
      if (!el) continue;

      el.style.gridTemplateColumns = `repeat(${g.cols}, ${g.cellPx}px)`;
      el.style.gridTemplateRows = `repeat(${g.rows}, ${g.cellPx}px)`;
      el.style.width = `${g.cols * g.cellPx}px`;
      el.style.height = `${g.rows * g.cellPx}px`;
      el.innerHTML = '';

      // Static background cells (built once per view open)
      const matrix = [];
      const frag = document.createDocumentFragment();
      for (let r = 0; r < g.rows; r++) {
        const rowCells = [];
        for (let c = 0; c < g.cols; c++) {
          const cell = document.createElement('div');
          cell.className = 'grid-cell';
          cell.style.width = `${g.cellPx}px`;
          cell.style.height = `${g.cellPx}px`;
          cell.dataset.grid = g.id;
          cell.dataset.gx = c;
          cell.dataset.gy = r;
          frag.appendChild(cell);
          rowCells.push(cell);
        }
        matrix.push(rowCells);
      }
      this.gridCellMatrices[g.id] = matrix;
      el.appendChild(frag);
    }

    this._renderItemsOnly();
  }

  _renderItemsOnly() {
    // Remove existing item DOM nodes
    const existing = this.overlay.querySelectorAll('.tetris-item');
    existing.forEach(e => e.remove());

    for (const item of this.items) {
      if (this.heldItem && this.heldItem.id === item.id) continue;

      const gridEl = document.getElementById(`grid-${item.gridId}`);
      if (!gridEl) continue;

      const g = this._getGridDef(item.gridId);
      if (!g) continue;

      const cellPx = g.cellPx;
      const weaponConfig = getWeaponConfig(item);
      const el = document.createElement('div');
      const rarity = item.rarity || 'common';
      const isCompact = item.w === 1 && item.h === 1;
      const isNarrow = item.w === 1;
      const itemKind = isWeaponItem(item) ? 'item-kind-weapon'
        : isMagazineItem(item) ? 'item-kind-magazine'
          : isAmmoItem(item) ? 'item-kind-ammo' : 'item-kind-gear';
      const compactMagazineClass = isCompact && isMagazineItem(item) ? ' compact-magazine' : '';
      el.className = `tetris-item ${itemKind} rarity-${rarity}${isNarrow ? ' narrow-item' : ''}${isCompact ? ' compact-item' : ''}${compactMagazineClass}`;
      el.id = `item-${item.id}`;
      el.style.width = `${item.w * cellPx - 2}px`;
      el.style.height = `${item.h * cellPx - 2}px`;
      el.style.left = `${item.gx * cellPx + 1}px`;
      el.style.top = `${item.gy * cellPx + 1}px`;
      el.style.borderColor = getRarityColor(rarity) || item.color;
      const readableDetails = [
        item.name,
        item.sub,
        item.caliber && `Caliber: ${item.caliber}`,
        weaponConfig && `Rate of fire: ${weaponConfig.rpm} RPM`,
        weaponConfig && `Fire modes: ${weaponConfig.fireModes.join(', ')}`,
        item.ammoTypeKey && `Loaded ammunition: ${ITEM_CATALOG[item.ammoTypeKey]?.name || item.ammoTypeKey}`,
        item.damageMultiplier && `Damage: ${Math.round(item.damageMultiplier * 100)}%`,
        item.armorPenetration !== undefined && `Armor penetration: ${Math.round(item.armorPenetration * 100)}%`,
        item.type === 'weapon_mod' && `Attachment slot: ${item.modSlot}`,
        item.attachments?.length && `Attachments: ${item.attachments.map(key => ITEM_CATALOG[key]?.name || key).join(', ')}`,
        'Double-click weapon to equip/unequip; drag attachment onto a weapon.'
      ].filter(Boolean);
      el.title = readableDetails.join('\n');

      // Durability bar
      let durHtml = '';
      if (item.durability !== undefined && item.maxDurability !== undefined) {
        const pct = Math.max(0, Math.min(100, Math.round((item.durability / item.maxDurability) * 100)));
        const durColor = pct > 60 ? '#2ecc71' : (pct > 30 ? '#f1c40f' : '#e74c3c');
        durHtml = `<div class="item-durability-bar"><div class="item-durability-fill" style="width: ${pct}%; background-color: ${durColor};"></div></div>`;
      }

      // Ammo / Count badge
      let ammoHtml = '';
      if (isMagazineItem(item)) {
        const curA = item.ammo ?? item.currentAmmo ?? 0;
        const maxA = item.maxAmmo || 30;
        ammoHtml = `<div class="item-ammo-badge">${curA}/${maxA}</div>`;
      } else if (weaponConfig && Number.isFinite(item.ammoCur)) {
        ammoHtml = `<div class="item-ammo-badge">${item.ammoCur}/${item.ammoMax || weaponConfig.magSize}</div>`;
      } else if (item.ammo !== undefined || item.currentAmmo !== undefined || item.count !== undefined) {
        const cnt = item.currentAmmo ?? item.ammo ?? item.count;
        ammoHtml = `<div class="item-ammo-badge">${cnt}</div>`;
      }
      const attachmentsHtml = (item.attachments || []).map((attachmentKey, index) => {
        const attachmentName = ITEM_CATALOG[attachmentKey]?.name || attachmentKey.replaceAll('_', ' ');
        return `<button class="item-attachment" type="button" data-attachment-index="${index}" title="${attachmentName} — click to remove">${attachmentName}</button>`;
      }).join('');
      const magazine = item.insertedMagazine;
      const magazineHtml = weaponConfig && !weaponConfig.internalMag && weaponConfig.defaultMag && magazine !== null
        ? `<button class="item-magazine" type="button" title="Remove the loaded magazine and keep its remaining rounds">REMOVE MAG (${magazine?.ammo ?? magazine?.currentAmmo ?? item.ammoCur ?? weaponConfig.magSize})</button>`
        : '';
      const magazineAmmo = item.ammo ?? item.currentAmmo ?? 0;
      const unloadState = this.magazineUnloadState?.magazine === item ? this.magazineUnloadState : null;
      const unloadHtml = isMagazineItem(item) && magazineAmmo > 0
        ? `<button class="item-unload-mag${unloadState ? ' is-unloading' : ''}" type="button" title="${unloadState ? 'Cancel unloading' : 'Unload one round every 0.5 seconds'}">${unloadState ? `STOP ${unloadState.roundsRemoved}/${unloadState.roundsToUnload}` : 'UNLOAD'}</button>`
        : '';
      el.innerHTML = isCompact ? `
        <div class="item-topline">${ammoHtml}</div>
        <div class="item-name compact">${item.name}</div>
        ${attachmentsHtml}
        ${unloadHtml}
        ${magazineHtml}
        ${durHtml}
      ` : `
        <div class="item-topline">
          <div class="item-tag" style="background-color: ${item.color}">${item.tag}</div>
          ${ammoHtml}
        </div>
        <div class="item-name">${item.name}</div>
        <div class="item-sub">${item.sub || ''}</div>
        ${attachmentsHtml}
        ${unloadHtml}
        ${magazineHtml}
        ${durHtml}
      `;

      el.addEventListener('click', (e) => {
        const attachmentButton = e.target.closest('.item-attachment');
        if (attachmentButton) {
          e.stopPropagation();
          e.preventDefault();
          this._removeAttachment(item, Number(attachmentButton.dataset.attachmentIndex));
          return;
        }
        if (e.target.closest('.item-magazine')) {
          e.stopPropagation();
          e.preventDefault();
          this._removeMagazine(item);
          return;
        }
        if (e.target.closest('.item-unload-mag')) {
          e.stopPropagation();
          e.preventDefault();
          if (this.magazineUnloadState?.magazine === item) this._cancelMagazineUnload();
          else this._startMagazineUnload(item);
          return;
        }
        if (e.altKey) {
          e.stopPropagation();
          e.preventDefault();
          this._quickEquipItem(item);
        } else if (e.shiftKey || e.ctrlKey) {
          e.stopPropagation();
          e.preventDefault();
          this._fastTransferItem(item);
        }
      });

      el.addEventListener('mousedown', (e) => {
        if (e.target.closest('.item-attachment, .item-magazine, .item-unload-mag')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (!e.altKey && !e.shiftKey && !e.ctrlKey) {
          e.stopPropagation();
          const now = Date.now();
          const lastPress = this.lastItemPress;
          if (isWeaponItem(item) && lastPress && lastPress.id === item.id &&
              now - lastPress.time <= 350 &&
              Math.hypot(e.clientX - lastPress.x, e.clientY - lastPress.y) <= 8) {
            this.lastItemPress = null;
            if (this.heldItem) this._cancelHold();
            this._toggleWeaponEquipment(item);
            return;
          }
          this.lastItemPress = { id: item.id, time: now, x: e.clientX, y: e.clientY };
          this._pickUpItem(item, e);
        }
      });

      gridEl.appendChild(el);
    }
  }

  _getGridDef(gridId) {
    if (this.gearGrids[gridId]) return this.gearGrids[gridId];
    if (gridId === 'stash') return this.stashGrid;
    if (this.containerGrid && this.containerGrid.id === gridId) return this.containerGrid;
    return null;
  }

  _pickUpItem(item, mouseEvent) {
    if (this.heldItem) return;

    this._cancelMagazineUnload(false);
    this._cancelMagazineLoad(false);
    this.heldItem = item;
    this.heldOriginal = {
      gridId: item.gridId,
      gx: item.gx,
      gy: item.gy,
      w: item.w,
      h: item.h
    };

    // Cache all active grid element bounding rects ONCE on mousedown
    this.cachedGridBounds = [];
    if (this.activeGridDefs) {
      for (const g of this.activeGridDefs) {
        const el = document.getElementById(`grid-${g.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          this.cachedGridBounds.push({
            id: g.id,
            def: g,
            el,
            rect,
            cols: g.cols,
            rows: g.rows,
            cellPx: g.cellPx,
            cells: this.gridCellMatrices[g.id]
          });
        }
      }
    }

    this.overlay.classList.add('is-dragging-item');
    audioEngine.playItemMove();
    this._updateGhostDisplay(item.gridId);
    this.ghostEl.style.display = 'block';

    this.mouseClientX = mouseEvent.clientX;
    this.mouseClientY = mouseEvent.clientY;
    this._positionGhost(mouseEvent.clientX, mouseEvent.clientY);

    this._renderItemsOnly();
    const dropHint = this.viewMode !== 'OUT_OF_RAID_STASH'
      ? ' &bull; [G] OR DRAG OUTSIDE TO DROP'
      : '';
    this._setStatus(`HOLDING: ${item.name} (${item.w}x${item.h}) &bull; [R] ROTATE &bull; CLICK TO PLACE${dropHint}`);
  }

  _updateGhostDisplay(targetGridId = null) {
    if (!this.heldItem) return;
    const item = this.heldItem;
    const g = targetGridId ? this._getGridDef(targetGridId) : this._getGridDef(item.gridId);
    const cellPx = g ? g.cellPx : 44;

    this.ghostEl.style.width = `${item.w * cellPx - 2}px`;
    this.ghostEl.style.height = `${item.h * cellPx - 2}px`;
    this.ghostEl.style.borderColor = item.color;
    this.ghostEl.innerHTML = `
      <div class="item-tag" style="background-color: ${item.color}">${item.tag}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-dim">${item.w}x${item.h} [R Rotate]</div>
    `;
  }

  /**
   * Pure CSS Hardware Translation (GPU accelerated, zero DOM reflow)
   */
  _positionGhost(clientX, clientY) {
    if (!this.ghostEl) return;
    this.ghostEl.style.transform = `translate3d(${clientX + 10}px, ${clientY + 10}px, 0)`;
  }

  /**
   * Throttled Drag Processing Loop matched to display refresh rate via requestAnimationFrame
   */
  _processDragFrame() {
    this.dragRafId = null;
    if (!this.heldItem) return;

    // 1. Hardware-accelerated ghost positioning
    this._positionGhost(this.mouseClientX, this.mouseClientY);

    // 2. O(1) Mathematical collision check against cached grid bounds
    const mx = this.mouseClientX;
    const my = this.mouseClientY;
    let found = null;

    for (let i = 0; i < this.cachedGridBounds.length; i++) {
      const gb = this.cachedGridBounds[i];
      const r = gb.rect;
      if (mx >= r.left && mx < r.right && my >= r.top && my < r.bottom) {
        let gx = Math.floor((mx - r.left) / gb.cellPx);
        let gy = Math.floor((my - r.top) / gb.cellPx);
        gx = Math.max(0, Math.min(gb.cols - 1, gx));
        gy = Math.max(0, Math.min(gb.rows - 1, gy));
        found = { gridId: gb.id, gx, gy, bounds: gb };
        break;
      }
    }

    // 3. Highlight updates ONLY when hover target cell or grid changes
    if (!found) {
      if (this.hoverTarget) {
        this.hoverTarget = null;
        this._clearAllHighlights();
      }
    } else {
      if (!this.hoverTarget ||
          this.hoverTarget.gridId !== found.gridId ||
          this.hoverTarget.gx !== found.gx ||
          this.hoverTarget.gy !== found.gy) {
        this.hoverTarget = found;
        this._updateGhostDisplay(found.gridId);
        this._updateGridHighlightsFast(found);
      }
    }
  }

  rotateHeldItem() {
    if (!this.heldItem) return;

    const temp = this.heldItem.w;
    this.heldItem.w = this.heldItem.h;
    this.heldItem.h = temp;

    audioEngine.playItemMove();
    this._updateGhostDisplay(this.hoverTarget ? this.hoverTarget.gridId : this.heldItem.gridId);
    this._setStatus(`ROTATED: ${this.heldItem.name} now (${this.heldItem.w}x${this.heldItem.h})`);

    if (this.hoverTarget) {
      this._updateGridHighlightsFast(this.hoverTarget);
    }
  }

  canPlace(gridId, item, gx, gy, w, h) {
    const g = this._getGridDef(gridId);
    if (!g) return false;

    // Strict slot typing: weapon slots only accept weapons
    if (gridId === 'primaryWeapon' || gridId === 'secondaryWeapon') {
      if (!isWeaponItem(item)) return false;
    }

    if (gx < 0 || gy < 0 || gx + w > g.cols || gy + h > g.rows) {
      return false;
    }

    for (const other of this.items) {
      if (other.id === item.id) continue;
      if (other.gridId !== gridId) continue;

      const overlapX = (gx < other.gx + other.w) && (gx + w > other.gx);
      const overlapY = (gy < other.gy + other.h) && (gy + h > other.gy);

      if (overlapX && overlapY) return false;
    }
    return true;
  }

  _placeHeldItem(gridId, gx, gy) {
    if (!this.heldItem) return;

    const item = this.heldItem;
    const oldGridId = this.heldOriginal.gridId;
    const targetItem = this.items.find(it =>
      it.gridId === gridId && it.id !== item.id &&
      gx >= it.gx && gx < it.gx + it.w &&
      gy >= it.gy && gy < it.gy + it.h
    );
    const targetWeaponConfig = getWeaponConfig(targetItem);

    if (targetItem && isMagazineItem(item) && targetWeaponConfig && !targetWeaponConfig.internalMag) {
      if (!isCompatibleMagazine(targetItem, item)) {
        this._cancelHold();
        this._setStatus(`${item.name} IS NOT COMPATIBLE WITH ${targetItem.name}`);
        return;
      }

      if (!this.swapWeaponMagazine(targetItem, item)) {
        this._cancelHold();
        this._setStatus('UNABLE TO INSTALL MAGAZINE; CHECK INVENTORY SPACE');
        return;
      }

      this.overlay.classList.remove('is-dragging-item');
      this.heldItem = null;
      this.heldOriginal = null;
      this.hoverTarget = null;
      this.ghostEl.style.display = 'none';
      this.ghostEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
      this._clearAllHighlights();
      this._renderItemsOnly();
      this._setStatus(`INSTALLED ${item.name} IN ${targetItem.name}`);
      if (targetItem.gridId === 'primaryWeapon' || targetItem.gridId === 'secondaryWeapon') {
        if (this.onEquipmentChanged) this.onEquipmentChanged();
      }
      return;
    }

    // Dedicated Handler: Dynamic In-Raid Primary/Secondary Weapon Equipping
    if (gridId === 'primaryWeapon' || gridId === 'secondaryWeapon') {
      if (!isWeaponItem(item)) {
        this._cancelHold();
        this._setStatus(`CANNOT EQUIP: ${item.name} IS NOT A WEAPON`);
        return;
      }

      // Auto-orient horizontally for weapon slots
      if (item.h > item.w) {
        const temp = item.w;
        item.w = item.h;
        item.h = temp;
      }

      const g = this._getGridDef(gridId);
      if (item.w > g.cols || item.h > g.rows) {
        this._cancelHold();
        this._setStatus(`${item.name} DOES NOT FIT IN ${g.name}`);
        return;
      }

      // Check if slot is already occupied
      const existingWeapon = this.items.find(it => it.gridId === gridId && it.id !== item.id);
      if (existingWeapon) {
        // Swap existing weapon into original position
        existingWeapon.gridId = oldGridId;
        existingWeapon.gx = this.heldOriginal.gx;
        existingWeapon.gy = this.heldOriginal.gy;

        if (oldGridId.startsWith('container_') && this.onContainerTransfer && this.activeContainer) {
          this.onContainerTransfer(this.activeContainer.id, existingWeapon.id, 'put', existingWeapon);
        }
      }

      item.gridId = gridId;
      item.gx = 0;
      item.gy = 0;

      if (oldGridId.startsWith('container_') && this.onContainerTransfer && this.activeContainer) {
        this.onContainerTransfer(this.activeContainer.id, item.id, 'take', null);
      }

      this.overlay.classList.remove('is-dragging-item');
      this.heldItem = null;
      this.heldOriginal = null;
      this.hoverTarget = null;
      this.ghostEl.style.display = 'none';
      this.ghostEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
      this._clearAllHighlights();
      audioEngine.playItemMove();
      this._renderItemsOnly();
      this._setStatus(`EQUIPPED ${item.name} TO ${g.name}`);

      if (this.onEquipmentChanged) {
        this.onEquipmentChanged();
      }
      return;
    }

    // Magazine Repacking & Direct Rifle Loading (Ammo -> Magazine / Mosin)
    if (targetItem && item.type === 'weapon_mod' && isWeaponItem(targetItem)) {
      if (!isCompatibleAttachment(targetItem, item)) {
        this._setStatus(`${item.name} DOES NOT FIT ${targetItem.name}`);
        this._cancelHold();
        return;
      }
      const attachments = targetItem.attachments || [];
      const occupiedSlot = attachments.find(key => {
        const attachedMod = ITEM_CATALOG[key];
        return attachedMod?.modSlot === item.modSlot;
      });
      if (occupiedSlot) {
        this._setStatus(`REMOVE OR REPLACE THE EXISTING ${item.modSlot.toUpperCase()} FIRST`);
        this._cancelHold();
        return;
      }

      targetItem.attachments = [...attachments, item.itemKey || item.id];
      const itemIndex = this.items.indexOf(item);
      if (itemIndex !== -1) this.items.splice(itemIndex, 1);
      if (oldGridId.startsWith('container_') && this.onContainerTransfer && this.activeContainer) {
        this.onContainerTransfer(this.activeContainer.id, item.id, 'take', null);
      }
      this.overlay.classList.remove('is-dragging-item');
      this.heldItem = null;
      this.heldOriginal = null;
      this.hoverTarget = null;
      this.ghostEl.style.display = 'none';
      this.ghostEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
      this._clearAllHighlights();
      this._renderItemsOnly();
      this._setStatus(`INSTALLED ${item.name} ON ${targetItem.name}`);
      if (this.onEquipmentChanged) this.onEquipmentChanged();
      return;
    }

    if (targetItem && isAmmoItem(item) && (isMagazineItem(targetItem) || targetWeaponConfig?.internalMag)) {
      if (isCompatibleAmmo(targetItem, item)) {
        const curAmmo = targetWeaponConfig?.internalMag
          ? (targetItem.ammoCur ?? targetItem.ammo ?? targetItem.currentAmmo ?? 0)
          : (targetItem.ammo ?? targetItem.currentAmmo ?? 0);
        const maxAmmo = targetItem.maxAmmo || targetWeaponConfig?.magSize || 30;
        const space = maxAmmo - curAmmo;
        if (space <= 0) {
          this._setStatus(`${targetItem.name} IS ALREADY FULL (${maxAmmo}/${maxAmmo})`);
          this._cancelHold();
          return;
        }
        const ammoKey = item.itemKey || item.id;
        if (curAmmo > 0 && targetItem.loadedAmmoKey && targetItem.loadedAmmoKey !== ammoKey) {
          this._setStatus(`EMPTY ${targetItem.name} BEFORE MIXING AMMUNITION TYPES`);
          this._cancelHold();
          return;
        }

        const avail = item.count ?? item.ammo ?? 30;
        const isTubeFed = Boolean(targetWeaponConfig?.internalMag && targetWeaponConfig.category === 'shotgun');
        const loadCount = Math.min(space, avail, isTubeFed ? 1 : space);
        if (loadCount <= 0) {
          this._cancelHold();
          this._setStatus(`NO ROUNDS LEFT IN ${item.name}`);
          return;
        }

        if (isMagazineItem(targetItem) && this.viewMode !== 'OUT_OF_RAID_STASH') {
          if (!this._moveAmmoStackToPlayerInventory(item, oldGridId)) {
            this._cancelHold();
            this._setStatus('NO INVENTORY SPACE TO KEEP THE REMAINING AMMO');
            return;
          }
          this.overlay.classList.remove('is-dragging-item');
          this.heldItem = null;
          this.heldOriginal = null;
          this.hoverTarget = null;
          this.ghostEl.style.display = 'none';
          this.ghostEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
          this._clearAllHighlights();
          this._startMagazineLoad(targetItem, item, ammoKey, loadCount);
          return;
        }

        targetItem.ammo = curAmmo + loadCount;
        targetItem.currentAmmo = targetItem.ammo;
        targetItem.loadedAmmoKey = ammoKey;
        if (targetWeaponConfig?.internalMag) {
          targetItem.ammoCur = targetItem.ammo;
          targetItem.ammoTypeKey = ammoKey;
        }
        targetItem.sub = `${targetItem.ammo} / ${maxAmmo}`;

        item.count = avail - loadCount;
        item.sub = `${item.count} ROUNDS`;

        if (item.count <= 0) {
          const idx = this.items.indexOf(item);
          if (idx !== -1) this.items.splice(idx, 1);
        } else {
          // Snap back remaining ammo pack to original position
          item.gridId = this.heldOriginal.gridId;
          item.gx = this.heldOriginal.gx;
          item.gy = this.heldOriginal.gy;
        }

        this.overlay.classList.remove('is-dragging-item');
        this.heldItem = null;
        this.heldOriginal = null;
        this.hoverTarget = null;
        this.ghostEl.style.display = 'none';
        this.ghostEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
        this._clearAllHighlights();
        if (isMagazineItem(targetItem)) audioEngine.playMagazineRoundLoad();
        else audioEngine.playReload(false);
        this._renderItemsOnly();
        this._saveStashStateToProfile();
        this._setStatus(`LOADED ${loadCount} ${targetWeaponConfig?.category === 'shotgun' ? 'SHELL' : 'ROUND'}${loadCount === 1 ? '' : 'S'} INTO ${targetItem.name} (${targetItem.ammo}/${maxAmmo})`);
        return;
      } else {
        this._setStatus(`INCOMPATIBLE CALIBER: Cannot load ${item.name} into ${targetItem.name}`);
        this._cancelHold();
        return;
      }
    }

    // Standard Grid Placement
    let placeW = item.w;
    let placeH = item.h;
    let valid = this.canPlace(gridId, item, gx, gy, placeW, placeH);

    // Auto-fit rotated check
    if (!valid && item.w !== item.h) {
      if (this.canPlace(gridId, item, gx, gy, item.h, item.w)) {
        const temp = item.w;
        item.w = item.h;
        item.h = temp;
        placeW = item.w;
        placeH = item.h;
        valid = true;
      }
    }

    if (valid) {
      item.gridId = gridId;
      item.gx = gx;
      item.gy = gy;

      if (oldGridId.startsWith('container_') && !gridId.startsWith('container_')) {
        if (this.onContainerTransfer && this.activeContainer) {
          this.onContainerTransfer(this.activeContainer.id, item.id, 'take', null);
        }
      } else if (!oldGridId.startsWith('container_') && gridId.startsWith('container_')) {
        if (this.onContainerTransfer && this.activeContainer) {
          this.onContainerTransfer(this.activeContainer.id, item.id, 'put', item);
        }
      }

      this.overlay.classList.remove('is-dragging-item');
      this.heldItem = null;
      this.heldOriginal = null;
      this.hoverTarget = null;
      this.ghostEl.style.display = 'none';
      this.ghostEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
      this._clearAllHighlights();
      audioEngine.playItemMove();
      this._renderItemsOnly();
      this._setStatus(`PLACED ${item.name}`);

      if (oldGridId === 'primaryWeapon' || oldGridId === 'secondaryWeapon') {
        if (this.onEquipmentChanged) this.onEquipmentChanged();
      }
    } else {
      this._cancelHold();
      this._setStatus(`INVALID POSITION: ${item.name} SNAPPED BACK`);
    }
  }

  _cancelHold() {
    if (!this.heldItem) return;

    this.heldItem.gridId = this.heldOriginal.gridId;
    this.heldItem.gx = this.heldOriginal.gx;
    this.heldItem.gy = this.heldOriginal.gy;
    this.heldItem.w = this.heldOriginal.w;
    this.heldItem.h = this.heldOriginal.h;

    this.overlay.classList.remove('is-dragging-item');
    this.heldItem = null;
    this.heldOriginal = null;
    this.hoverTarget = null;
    this.ghostEl.style.display = 'none';
    this.ghostEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
    this._clearAllHighlights();
    this._renderItemsOnly();
    this._setStatus(`ACTION CANCELLED: ITEM RETURNED`);
  }

  _removeAttachment(weapon, attachmentIndex) {
    const attachments = weapon.attachments || [];
    const [attachmentKey] = attachments.splice(attachmentIndex, 1);
    const definition = attachmentKey && (this.items.find(item => (item.itemKey || item.id) === attachmentKey) || null);
    if (!attachmentKey) return;
    const catalogItem = definition || this._getAttachmentDefinition(attachmentKey);
    if (!catalogItem) return;

    const grids = weapon.gridId === 'primaryWeapon' || weapon.gridId === 'secondaryWeapon'
      ? ['rig', 'backpack', 'pockets', 'alpha']
      : [weapon.gridId, 'backpack', 'rig', 'pockets', 'alpha'];
    for (const gridId of grids) {
      const grid = this._getGridDef(gridId);
      if (!grid) continue;
      const item = {
        ...catalogItem,
        id: `${attachmentKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemKey: attachmentKey,
        gridId,
        gx: 0,
        gy: 0
      };
      let placed = false;
      for (let gy = 0; gy <= grid.rows - item.h && !placed; gy++) {
        for (let gx = 0; gx <= grid.cols - item.w; gx++) {
          if (this.canPlace(gridId, item, gx, gy, item.w, item.h)) {
            item.gx = gx;
            item.gy = gy;
            this.items.push(item);
            placed = true;
            break;
          }
        }
      }
      if (placed) {
        weapon.attachments = attachments;
        this._renderItemsOnly();
        this._setStatus(`REMOVED ${catalogItem.name} FROM ${weapon.name}`);
        if (this.onEquipmentChanged) this.onEquipmentChanged();
        return;
      }
    }

    attachments.splice(attachmentIndex, 0, attachmentKey);
    this._setStatus('NO INVENTORY SPACE TO REMOVE ATTACHMENT');
  }

  _getAttachmentDefinition(key) {
    return ITEM_CATALOG[key] || null;
  }

  _ammoStorageGrids() {
    const gridIds = ['rig', 'backpack', 'pockets', 'alpha'];
    if (this.viewMode === 'OUT_OF_RAID_STASH') gridIds.push('stash');
    return gridIds;
  }

  _findAmmoStackDestination(ammoKey, ammoDefinition) {
    const maxCount = ammoDefinition.maxCount || ammoDefinition.count || 60;
    for (const item of this.items) {
      if (!isAmmoItem(item) || (item.itemKey || item.id) !== ammoKey) continue;
      const count = item.count ?? item.ammo ?? 0;
      if (count < maxCount) return { item, maxCount };
    }

    for (const gridId of this._ammoStorageGrids()) {
      const grid = this._getGridDef(gridId);
      if (!grid) continue;
      const placementProbe = { ...ammoDefinition, id: `ammo_unload_probe_${gridId}` };
      for (let gy = 0; gy <= grid.rows - ammoDefinition.h; gy++) {
        for (let gx = 0; gx <= grid.cols - ammoDefinition.w; gx++) {
          if (this.canPlace(gridId, placementProbe, gx, gy, ammoDefinition.w, ammoDefinition.h)) {
            return { gridId, gx, gy, maxCount };
          }
        }
      }
    }
    return null;
  }

  _storeOneAmmoRound(ammoKey, ammoDefinition) {
    const destination = this._findAmmoStackDestination(ammoKey, ammoDefinition);
    if (!destination) return false;

    if (destination.item) {
      destination.item.count = (destination.item.count ?? destination.item.ammo ?? 0) + 1;
      destination.item.sub = `${destination.item.count} ROUNDS`;
    } else {
      this.items.push({
        ...ammoDefinition,
        id: `${ammoKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemKey: ammoKey,
        count: 1,
        sub: '1 ROUND',
        gridId: destination.gridId,
        gx: destination.gx,
        gy: destination.gy
      });
    }
    return true;
  }

  _getMagazineAmmoKey(magazine) {
    if (magazine.loadedAmmoKey && ITEM_CATALOG[magazine.loadedAmmoKey]) return magazine.loadedAmmoKey;
    const magazineKey = magazine.itemKey || magazine.id;
    const compatibleWeapon = Object.values(WEAPON_REGISTRY).find(config =>
      config.compatibleMags?.includes(magazineKey)
    );
    return compatibleWeapon?.defaultAmmoKey || compatibleWeapon?.compatibleAmmo?.[0] || null;
  }

  _moveAmmoStackToPlayerInventory(ammoItem, oldGridId) {
    if (!oldGridId.startsWith('container_')) return true;

    for (const gridId of this._ammoStorageGrids()) {
      if (gridId === 'stash') continue;
      const grid = this._getGridDef(gridId);
      if (!grid) continue;
      const placementProbe = { ...ammoItem, id: `${ammoItem.id}_load_transfer` };
      for (let gy = 0; gy <= grid.rows - ammoItem.h; gy++) {
        for (let gx = 0; gx <= grid.cols - ammoItem.w; gx++) {
          if (!this.canPlace(gridId, placementProbe, gx, gy, ammoItem.w, ammoItem.h)) continue;
          ammoItem.gridId = gridId;
          ammoItem.gx = gx;
          ammoItem.gy = gy;
          if (this.onContainerTransfer && this.activeContainer) {
            this.onContainerTransfer(this.activeContainer.id, ammoItem.id, 'take', null);
          }
          return true;
        }
      }
    }
    return false;
  }

  _startMagazineLoad(magazine, ammoItem, ammoKey, roundsToLoad) {
    this._cancelMagazineUnload(false);
    this._cancelMagazineLoad(false);
    this.magazineLoadState = {
      magazine,
      ammoItem,
      ammoKey,
      roundsToLoad,
      roundsLoaded: 0
    };
    this._renderItemsOnly();
    this._setStatus(`LOADING ${magazine.name}: ONE ROUND EVERY 0.5 SECONDS; PICK UP AMMO TO STOP`);
    this.magazineLoadTimer = window.setTimeout(() => this._loadMagazineRound(), 500);
  }

  _cancelMagazineLoad(render = true) {
    if (!this.magazineLoadState) return;
    window.clearTimeout(this.magazineLoadTimer);
    const { magazine, roundsLoaded } = this.magazineLoadState;
    this.magazineLoadTimer = null;
    this.magazineLoadState = null;
    if (render) {
      this._renderItemsOnly();
      this._setStatus(`MAGAZINE LOADING STOPPED: ${roundsLoaded} ROUND${roundsLoaded === 1 ? '' : 'S'} LOADED`);
    }
  }

  _loadMagazineRound() {
    const state = this.magazineLoadState;
    if (!state || !this.items.includes(state.magazine) || !this.items.includes(state.ammoItem)) {
      this._cancelMagazineLoad();
      return;
    }

    const magazine = state.magazine;
    const ammoItem = state.ammoItem;
    const ammoCount = ammoItem.count ?? ammoItem.ammo ?? 0;
    const magazineAmmo = magazine.ammo ?? magazine.currentAmmo ?? 0;
    const maxAmmo = magazine.maxAmmo || 30;
    if (ammoCount <= 0 || magazineAmmo >= maxAmmo ||
        (magazineAmmo > 0 && magazine.loadedAmmoKey && magazine.loadedAmmoKey !== state.ammoKey)) {
      this._cancelMagazineLoad();
      return;
    }

    magazine.ammo = magazineAmmo + 1;
    magazine.currentAmmo = magazine.ammo;
    magazine.loadedAmmoKey = state.ammoKey;
    magazine.sub = `${magazine.ammo} / ${maxAmmo} Rounds`;
    ammoItem.count = ammoCount - 1;
    ammoItem.sub = `${ammoItem.count} ROUNDS`;
    state.roundsLoaded += 1;
    if (ammoItem.count <= 0) this.items.splice(this.items.indexOf(ammoItem), 1);

    audioEngine.playMagazineRoundLoad();
    this._saveStashStateToProfile();
    if (state.roundsLoaded >= state.roundsToLoad || !this.items.includes(ammoItem)) {
      this.magazineLoadTimer = null;
      this.magazineLoadState = null;
      this._renderItemsOnly();
      this._setStatus(`LOADED ${state.roundsLoaded} ROUND${state.roundsLoaded === 1 ? '' : 'S'} INTO ${magazine.name} (${magazine.ammo}/${maxAmmo})`);
      return;
    }

    this._renderItemsOnly();
    this._setStatus(`LOADING ${magazine.name}: ${state.roundsLoaded}/${state.roundsToLoad} ROUNDS`);
    this.magazineLoadTimer = window.setTimeout(() => this._loadMagazineRound(), 500);
  }

  _startMagazineUnload(magazine) {
    this._cancelMagazineLoad(false);
    const ammoCount = magazine.ammo ?? magazine.currentAmmo ?? 0;
    const ammoKey = this._getMagazineAmmoKey(magazine);
    const ammoDefinition = ITEM_CATALOG[ammoKey];
    if (ammoCount <= 0 || !ammoKey || !ammoDefinition || !isAmmoItem(ammoDefinition)) {
      this._setStatus(`CANNOT IDENTIFY AMMUNITION IN ${magazine.name}`);
      return;
    }
    if (!this._findAmmoStackDestination(ammoKey, ammoDefinition)) {
      this._setStatus('NO INVENTORY SPACE FOR REMOVED ROUNDS');
      return;
    }

    if (this.viewMode === 'OUT_OF_RAID_STASH') {
      magazine.ammo = magazine.ammo ?? magazine.currentAmmo ?? 0;
      let roundsRemoved = 0;
      while ((magazine.ammo ?? magazine.currentAmmo ?? 0) > 0 &&
             this._storeOneAmmoRound(ammoKey, ammoDefinition)) {
        magazine.ammo -= 1;
        magazine.currentAmmo = magazine.ammo;
        roundsRemoved += 1;
      }
      magazine.sub = `${magazine.ammo} / ${magazine.maxAmmo || 30} Rounds`;
      this._saveStashStateToProfile();
      this._renderItemsOnly();
      this._setStatus(magazine.ammo > 0
        ? `NO INVENTORY SPACE; UNLOADED ${roundsRemoved} ROUNDS, ${magazine.ammo} REMAIN`
        : `UNLOADED ${roundsRemoved} ROUNDS FROM ${magazine.name}`);
      return;
    }

    this.magazineUnloadState = {
      magazine,
      ammoKey,
      roundsToUnload: ammoCount,
      roundsRemoved: 0
    };
    this._renderItemsOnly();
    this._setStatus(`UNLOADING ${magazine.name}: ONE ROUND EVERY 0.5 SECONDS`);
    this.magazineUnloadTimer = window.setTimeout(() => this._unloadMagazineRound(), 500);
  }

  _cancelMagazineUnload(render = true) {
    if (!this.magazineUnloadState) return;
    window.clearTimeout(this.magazineUnloadTimer);
    const { magazine, roundsRemoved } = this.magazineUnloadState;
    this.magazineUnloadTimer = null;
    this.magazineUnloadState = null;
    if (render) {
      this._renderItemsOnly();
      this._setStatus(`UNLOADING STOPPED: ${roundsRemoved} ROUND${roundsRemoved === 1 ? '' : 'S'} REMOVED`);
    }
  }

  _unloadMagazineRound() {
    const state = this.magazineUnloadState;
    if (!state || !this.items.includes(state.magazine)) {
      this._cancelMagazineUnload();
      return;
    }

    const ammoDefinition = ITEM_CATALOG[state.ammoKey];
    if (!ammoDefinition || !this._storeOneAmmoRound(state.ammoKey, ammoDefinition)) {
      this._cancelMagazineUnload(false);
      this._renderItemsOnly();
      this._setStatus('NO INVENTORY SPACE FOR REMOVED ROUNDS; REMAINING ROUNDS STAY IN THE MAGAZINE');
      return;
    }

    const magazine = state.magazine;
    magazine.ammo = Math.max(0, (magazine.ammo ?? magazine.currentAmmo ?? 0) - 1);
    magazine.currentAmmo = magazine.ammo;
    magazine.sub = `${magazine.ammo} / ${magazine.maxAmmo || 30} Rounds`;
    state.roundsRemoved += 1;
    this._saveStashStateToProfile();

    if (magazine.ammo === 0 || state.roundsRemoved >= state.roundsToUnload) {
      this.magazineUnloadTimer = null;
      this.magazineUnloadState = null;
      this._renderItemsOnly();
      this._setStatus(`UNLOADED ${state.roundsRemoved} ROUND${state.roundsRemoved === 1 ? '' : 'S'} FROM ${magazine.name}`);
      return;
    }

    this._renderItemsOnly();
    this._setStatus(`UNLOADING ${magazine.name}: ${state.roundsRemoved}/${state.roundsToUnload} ROUNDS`);
    this.magazineUnloadTimer = window.setTimeout(() => this._unloadMagazineRound(), 500);
  }

  _removeMagazine(weapon) {
    const weaponConfig = getWeaponConfig(weapon);
    if (!weaponConfig || weaponConfig.internalMag || !weaponConfig.defaultMag || weapon.insertedMagazine === null) return;

    const sourceMagazine = weapon.insertedMagazine || {
      ...ITEM_CATALOG[weaponConfig.defaultMag],
      itemKey: weaponConfig.defaultMag,
      ammo: weapon.ammoCur ?? weaponConfig.magSize,
      currentAmmo: weapon.ammoCur ?? weaponConfig.magSize,
      maxAmmo: weapon.ammoMax || weaponConfig.magSize,
      loadedAmmoKey: weapon.ammoTypeKey || weaponConfig.defaultAmmoKey || weaponConfig.compatibleAmmo?.[0]
    };
    const magazineKey = sourceMagazine.itemKey || sourceMagazine.id || weaponConfig.defaultMag;
    const catalogMagazine = ITEM_CATALOG[magazineKey] || ITEM_CATALOG[weaponConfig.defaultMag];
    if (!catalogMagazine || !isMagazineItem(catalogMagazine)) {
      this._setStatus(`CANNOT IDENTIFY MAGAZINE IN ${weapon.name}`);
      return;
    }

    const gridIds = this.viewMode === 'OUT_OF_RAID_STASH'
      ? ['rig', 'backpack', 'pockets', 'alpha', 'stash']
      : ['rig', 'backpack', 'pockets', 'alpha'];
    const magazine = {
      ...catalogMagazine,
      ...sourceMagazine,
      id: `${magazineKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      itemKey: magazineKey
    };

    for (const gridId of gridIds) {
      const grid = this._getGridDef(gridId);
      if (!grid) continue;
      for (let gy = 0; gy <= grid.rows - magazine.h; gy++) {
        for (let gx = 0; gx <= grid.cols - magazine.w; gx++) {
          if (!this.canPlace(gridId, magazine, gx, gy, magazine.w, magazine.h)) continue;
          magazine.gridId = gridId;
          magazine.gx = gx;
          magazine.gy = gy;
          this.items.push(magazine);
          weapon.insertedMagazine = null;
          weapon.ammoCur = 0;
          weapon.ammoMax = magazine.maxAmmo || weaponConfig.magSize;
          weapon.ammoTypeKey = null;
          this._renderItemsOnly();
          this._setStatus(`REMOVED MAGAZINE FROM ${weapon.name}`);
          if (this.onEquipmentChanged) this.onEquipmentChanged();
          return;
        }
      }
    }

    this._setStatus('NO INVENTORY SPACE TO REMOVE MAGAZINE');
  }

  swapWeaponMagazine(weapon, replacement, isFast = false) {
    const replacementIndex = this.items.indexOf(replacement);
    const weaponConfig = getWeaponConfig(weapon);
    if (replacementIndex < 0 || !weaponConfig || !isCompatibleMagazine(weapon, replacement)) return false;

    const replacementGridId = replacement.gridId;
    const oldMagazine = weapon.insertedMagazine;
    if (oldMagazine) {
      const oldMagazineKey = oldMagazine.itemKey || oldMagazine.id || weaponConfig.defaultMag;
      const catalogMagazine = ITEM_CATALOG[oldMagazineKey] || ITEM_CATALOG[weaponConfig.defaultMag];
      if (!catalogMagazine || !isMagazineItem(catalogMagazine)) return false;
      const ejectedMagazine = {
        ...catalogMagazine,
        ...oldMagazine,
        id: oldMagazine.id || `${oldMagazineKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemKey: oldMagazineKey
      };
      this.items.splice(replacementIndex, 1);

      const gridIds = [
        ...(replacementGridId.startsWith('container_') ? [] : [replacementGridId]),
        'rig', 'backpack', 'pockets', 'alpha'
      ];
      if (this.viewMode === 'OUT_OF_RAID_STASH') gridIds.push('stash');
      let ejectedPosition = null;
      for (const gridId of [...new Set(gridIds)]) {
        const grid = this._getGridDef(gridId);
        if (!grid) continue;
        for (let gy = 0; gy <= grid.rows - ejectedMagazine.h && !ejectedPosition; gy++) {
          for (let gx = 0; gx <= grid.cols - ejectedMagazine.w; gx++) {
            if (this.canPlace(gridId, ejectedMagazine, gx, gy, ejectedMagazine.w, ejectedMagazine.h)) {
              ejectedPosition = { gridId, gx, gy };
              break;
            }
          }
        }
        if (ejectedPosition) break;
      }

      if (!ejectedPosition) {
        this.items.splice(replacementIndex, 0, replacement);
        this._setStatus('NO INVENTORY SPACE TO STORE THE EJECTED MAGAZINE');
        return false;
      }

      Object.assign(ejectedMagazine, ejectedPosition);
      this.items.push(ejectedMagazine);
    } else {
      this.items.splice(replacementIndex, 1);
    }

    const magazineKey = replacement.itemKey || replacement.id;
    weapon.insertedMagazine = {
      ...replacement,
      id: `${magazineKey}_installed_${weapon.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      itemKey: magazineKey
    };
    weapon.ammoCur = replacement.ammo ?? replacement.currentAmmo ?? 0;
    weapon.ammoMax = replacement.maxAmmo || weaponConfig.magSize;
    weapon.ammoTypeKey = replacement.loadedAmmoKey || weaponConfig.defaultAmmoKey || weaponConfig.compatibleAmmo?.[0] || null;
    weapon.insertedMagazine.loadedAmmoKey = weapon.ammoTypeKey;
    weapon.insertedMagazine.ammo = weapon.ammoCur;
    weapon.insertedMagazine.currentAmmo = weapon.ammoCur;
    weapon.insertedMagazine.maxAmmo = weapon.ammoMax;
    if (replacementGridId.startsWith('container_') && this.onContainerTransfer && this.activeContainer) {
      this.onContainerTransfer(this.activeContainer.id, replacement.id, 'take', null);
    }
    audioEngine.playMagazineInsert(isFast);
    this._renderItemsOnly();
    this._saveStashStateToProfile();
    return true;
  }

  _dropHeldItem() {
    const item = this.heldItem;
    if (!item || this.viewMode === 'OUT_OF_RAID_STASH' || !this.onDropItem) return false;

    const originalGridId = this.heldOriginal.gridId;
    const itemIndex = this.items.indexOf(item);
    if (itemIndex === -1) return false;

    const sourceContainerId = originalGridId.startsWith('container_') ? this.activeContainer?.id : null;
    if (!this.onDropItem(item, sourceContainerId)) return false;

    this.items.splice(itemIndex, 1);

    if (this.dragRafId) {
      cancelAnimationFrame(this.dragRafId);
      this.dragRafId = null;
    }
    this.overlay.classList.remove('is-dragging-item');
    this.heldItem = null;
    this.heldOriginal = null;
    this.hoverTarget = null;
    this.ghostEl.style.display = 'none';
    this.ghostEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
    this._clearAllHighlights();
    this._renderItemsOnly();

    audioEngine.playItemMove();
    this._setStatus(`DROPPED ${item.name} ON THE FLOOR`);
    this.close();
    return true;
  }

  /**
   * Alt + Left Click: Quick-Equip directly into loadout slots
   */
  _quickEquipItem(item) {
    if (isWeaponItem(item)) {
      this._toggleWeaponEquipment(item);
      return;
    }

    // Non-weapon equipment: try rig, pockets, backpack, alpha
    const targetGrids = ['rig', 'pockets', 'backpack', 'alpha'];
    for (const tgtId of targetGrids) {
      if (tgtId === item.gridId) continue;
      const g = this._getGridDef(tgtId);
      if (!g) continue;

      for (let r = 0; r <= g.rows - item.h; r++) {
        for (let c = 0; c <= g.cols - item.w; c++) {
          if (this.canPlace(tgtId, item, c, r, item.w, item.h)) {
            this._applyTransfer(item, tgtId, c, r, g.name);
            return;
          }
        }
      }
    }
  }

  _toggleWeaponEquipment(item) {
    const weaponSlots = ['primaryWeapon', 'secondaryWeapon'];
    const equippedGrid = weaponSlots.find(id => item.gridId === id);
    if (equippedGrid) {
      const destinations = this.viewMode === 'OUT_OF_RAID_STASH'
        ? ['stash']
        : ['backpack', 'rig', 'pockets', 'alpha'];
      const orientations = item.w === item.h
        ? [[item.w, item.h]]
        : [[item.w, item.h], [item.h, item.w]];
      for (const gridId of destinations) {
        const grid = this._getGridDef(gridId);
        if (!grid || !document.getElementById(`grid-${gridId}`)) continue;
        for (const [width, height] of orientations) {
          for (let y = 0; y <= grid.rows - height; y++) {
            for (let x = 0; x <= grid.cols - width; x++) {
              if (this.canPlace(gridId, item, x, y, width, height)) {
                item.w = width;
                item.h = height;
                this._applyTransfer(item, gridId, x, y, grid.name);
                return;
              }
            }
          }
        }
      }
      this._setStatus(`NO SPACE TO UNEQUIP ${item.name}`);
      return;
    }

    const width = item.h > item.w ? item.h : item.w;
    const height = item.h > item.w ? item.w : item.h;
    for (const gridId of weaponSlots) {
      const grid = this._getGridDef(gridId);
      if (!grid || !document.getElementById(`grid-${gridId}`)) continue;
      if (this.items.some(other => other.gridId === gridId && other.id !== item.id)) continue;
      if (width > grid.cols || height > grid.rows) continue;
      item.w = width;
      item.h = height;
      this._applyTransfer(item, gridId, 0, 0, grid.name);
      return;
    }
    this._setStatus(`NO EMPTY WEAPON SLOT FOR ${item.name}`);
  }

  _sortStashItems() {
    const originalItems = this.items;
    const stashItems = originalItems.filter(item => item.gridId === 'stash');
    const originalPositions = new Map(stashItems.map(item => [item.id, { gx: item.gx, gy: item.gy }]));
    this.items = originalItems.filter(item => item.gridId !== 'stash');

    const sortedItems = [...stashItems].sort((a, b) =>
      (b.w * b.h) - (a.w * a.h) || b.h - a.h || a.name.localeCompare(b.name)
    );

    for (const item of sortedItems) {
      let placed = false;
      for (let y = 0; y <= this.stashGrid.rows - item.h && !placed; y++) {
        for (let x = 0; x <= this.stashGrid.cols - item.w; x++) {
          if (this.canPlace('stash', item, x, y, item.w, item.h)) {
            item.gx = x;
            item.gy = y;
            this.items.push(item);
            placed = true;
            break;
          }
        }
      }
      if (!placed) {
        for (const stashItem of stashItems) {
          const position = originalPositions.get(stashItem.id);
          stashItem.gx = position.gx;
          stashItem.gy = position.gy;
        }
        this.items = originalItems;
        this._setStatus('STASH SORT CANCELLED: ITEMS DO NOT FIT');
        return;
      }
    }

    this._renderItemsOnly();
    this._saveStashStateToProfile();
    this._setStatus('STASH SORTED BY ITEM SIZE');
  }

  _fastTransferItem(item) {
    let targetGrids = [];
    if (item.gridId.startsWith('container_')) {
      targetGrids = ['backpack', 'rig', 'pockets', 'alpha'];
    } else if (item.gridId === 'stash') {
      targetGrids = ['primaryWeapon', 'secondaryWeapon', 'backpack', 'rig', 'pockets', 'alpha'];
    } else {
      targetGrids = this.activeContainer ? [this.containerGrid.id] : ['stash'];
    }

    for (const tgtId of targetGrids) {
      const g = this._getGridDef(tgtId);
      if (!g) continue;

      if ((tgtId === 'primaryWeapon' || tgtId === 'secondaryWeapon') && !isWeaponItem(item)) {
        continue;
      }

      // 1. Try normal orientation
      for (let r = 0; r <= g.rows - item.h; r++) {
        for (let c = 0; c <= g.cols - item.w; c++) {
          if (this.canPlace(tgtId, item, c, r, item.w, item.h)) {
            this._applyTransfer(item, tgtId, c, r, g.name);
            return;
          }
        }
      }

      // 2. Try rotated orientation if normal didn't fit
      if (item.w !== item.h) {
        for (let r = 0; r <= g.rows - item.w; r++) {
          for (let c = 0; c <= g.cols - item.h; c++) {
            if (this.canPlace(tgtId, item, c, r, item.h, item.w)) {
              const temp = item.w;
              item.w = item.h;
              item.h = temp;
              this._applyTransfer(item, tgtId, c, r, g.name);
              return;
            }
          }
        }
      }
    }
    this._setStatus(`NO SPACE AVAILABLE FOR ${item.name}`);
  }

  _applyTransfer(item, tgtId, c, r, gridName) {
    const oldGridId = item.gridId;
    item.gridId = tgtId;
    item.gx = c;
    item.gy = r;

    if (oldGridId.startsWith('container_') && !tgtId.startsWith('container_')) {
      if (this.onContainerTransfer && this.activeContainer) {
        this.onContainerTransfer(this.activeContainer.id, item.id, 'take', null);
      }
    } else if (!oldGridId.startsWith('container_') && tgtId.startsWith('container_')) {
      if (this.onContainerTransfer && this.activeContainer) {
        this.onContainerTransfer(this.activeContainer.id, item.id, 'put', item);
      }
    }

    audioEngine.playItemMove();
    this._renderItemsOnly();
    this._setStatus(`TRANSFERRED ${item.name} to ${gridName}`);

    if (oldGridId === 'primaryWeapon' || oldGridId === 'secondaryWeapon' ||
        tgtId === 'primaryWeapon' || tgtId === 'secondaryWeapon') {
      if (this.onEquipmentChanged) {
        this.onEquipmentChanged();
      }
    }
  }

  _clearAllHighlights() {
    for (let i = 0; i < this.activeHighlightedCells.length; i++) {
      this.activeHighlightedCells[i].classList.remove('valid-hover', 'invalid-hover');
    }
    this.activeHighlightedCells = [];
  }

  _updateGridHighlightsFast(target) {
    this._clearAllHighlights();
    if (!this.heldItem || !target) return;

    const { gridId, gx, gy, bounds } = target;
    const item = this.heldItem;

    let testW = item.w;
    let testH = item.h;
    let isValid = this.canPlace(gridId, item, gx, gy, testW, testH);

    // Auto-fit rotated check for primary/secondary weapon slots
    if (!isValid && (gridId === 'primaryWeapon' || gridId === 'secondaryWeapon')) {
      if (this.canPlace(gridId, item, gx, gy, item.h, item.w)) {
        testW = item.h;
        testH = item.w;
        isValid = true;
      }
    }

    const cls = isValid ? 'valid-hover' : 'invalid-hover';
    const matrix = bounds.cells;

    if (matrix) {
      for (let dy = 0; dy < testH; dy++) {
        const ry = gy + dy;
        if (ry < 0 || ry >= bounds.rows) continue;
        for (let dx = 0; dx < testW; dx++) {
          const cx = gx + dx;
          if (cx < 0 || cx >= bounds.cols) continue;
          const cell = matrix[ry] && matrix[ry][cx];
          if (cell) {
            cell.classList.add(cls);
            this.activeHighlightedCells.push(cell);
          }
        }
      }
    }
  }

  _setStatus(msg) {
    const el = document.getElementById('inv-status-msg');
    if (el) el.textContent = msg;
  }

  _saveStashStateToProfile() {
    const stash = [];
    const rig = [];
    const backpack = [];
    const alpha = [];
    const pockets = [];
    let primary = null;
    let secondary = null;

    for (const item of this.items) {
      if (item.gridId === 'stash') stash.push(item);
      else if (item.gridId === 'primaryWeapon') primary = item;
      else if (item.gridId === 'secondaryWeapon') secondary = item;
      else if (item.gridId === 'rig') rig.push(item);
      else if (item.gridId === 'backpack') backpack.push(item);
      else if (item.gridId === 'alpha') alpha.push(item);
      else if (item.gridId === 'pockets') pockets.push(item);
    }

    if (profileManager.profile) {
      if (this.viewMode === 'OUT_OF_RAID_STASH') profileManager.profile.stashItems = stash;
      profileManager.profile.loadout = { primary, secondary, rig, backpack, alpha, pockets };
      profileManager.saveProfile();
    }
  }

  _bindEvents() {
    window.addEventListener('mousemove', (e) => {
      if (this.heldItem) {
        if (this.lastItemPress &&
            Math.hypot(e.clientX - this.lastItemPress.x, e.clientY - this.lastItemPress.y) > 8) {
          this.lastItemPress = null;
        }
        this.mouseClientX = e.clientX;
        this.mouseClientY = e.clientY;
        if (!this.dragRafId) {
          this.dragRafId = requestAnimationFrame(() => this._processDragFrame());
        }
      }
    });

    const handleDrop = (e) => {
      if (!this.heldItem) return;
      if (this.dragRafId) {
        cancelAnimationFrame(this.dragRafId);
        this.dragRafId = null;
      }
      const modal = document.getElementById('inv-modal-container');
      const rect = modal?.getBoundingClientRect();
      const outsideInventory = rect && (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      );
      if (outsideInventory && this.viewMode !== 'OUT_OF_RAID_STASH') {
        if (!this._dropHeldItem()) this._cancelHold();
        return;
      }
      if (this.hoverTarget) {
        this._placeHeldItem(this.hoverTarget.gridId, this.hoverTarget.gx, this.hoverTarget.gy);
      } else {
        // Cursor dropped outside valid grid boundary -> snap back immediately!
        this._cancelHold();
      }
    };

    window.addEventListener('mouseup', (e) => {
      if (this.heldItem) {
        handleDrop(e);
      }
    });

    this.overlay.addEventListener('mousedown', (e) => {
      if (this.heldItem) {
        handleDrop(e);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && this.heldItem) {
        e.preventDefault();
        e.stopPropagation();
        this.rotateHeldItem();
      } else if (e.code === 'KeyG' && this.overlay.classList.contains('active') &&
                 this.heldItem && this.viewMode !== 'OUT_OF_RAID_STASH') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this._dropHeldItem();
      }
    });
  }
}
