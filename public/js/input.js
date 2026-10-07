/**
 * EFT Tactical 2D - Browser-Safe Input & Fire Control Controller
 * Features:
 * - Strict SEMI vs FULL-AUTO state machine with cyclic rate timer and semi click-release enforcement
 * - Mechanical fire selector [B] audio feedback
 * - Double-tap 'R' fast reload detection & audio
 * - Proximity interaction [F] capture
 * - Context menu and default browser keybind suppression
 */

import { audioEngine } from './audio.js';

export class InputController {
  constructor(canvas) {
    this.canvas = canvas;

    this.keys = {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false,
      ShiftLeft: false,
      ShiftRight: false
    };

    this.isCrouching = false;
    this.isAiming = false;       // RMB ADS
    this.isMouseDown = false;    // LMB held
    this.semiShotFired = false;  // Lock for semi-auto single shot until release
    this.fireMode = 'SEMI';      // 'SEMI' | 'AUTO'
    this.cyclicRateMs = 105;     // ~570-600 RPM for M4A1
    this.lastShotTime = 0;

    this.tacticalDevice = 'LASER'; // 'LASER' | 'FLASHLIGHT' | 'OFF'
    this.hasWeapon = false;

    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;

    // Reload detection
    this.lastRPressTime = 0;

    // Callbacks
    this.onToggleInventory = null;
    this.onInteract = null;
    this.onSelectWeapon = null;
    this.onUseMed = null;
    this.onCloseMenu = null;
    this.onFireModeChange = null;
    this.onToggleBinds = null;
    this.onReload = null;

    this._bindEvents();
  }

  _bindEvents() {
    const isInputTarget = (target) => {
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    window.addEventListener('keydown', (e) => {
      // If user is focused on an input/form field, let them type freely! Do NOT preventDefault or capture WASD.
      if (isInputTarget(e.target)) {
        return;
      }

      const preventedKeys = [
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'ShiftLeft', 'ShiftRight',
        'KeyC', 'KeyR', 'KeyF', 'KeyB', 'KeyT', 'KeyH',
        'Tab', 'Digit1', 'Digit2', 'Digit4', 'Digit5', 'Digit6',
        'Escape'
      ];

      if (preventedKeys.includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
        this.keys[e.code] = true;
      }

      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.keys.ShiftLeft = true;
      }

      // C: Toggle Crouch
      if (e.code === 'KeyC' && !e.repeat) {
        this.isCrouching = !this.isCrouching;
      }

      // H: Toggle Controls Helper Display
      if (e.code === 'KeyH' && !e.repeat) {
        if (this.onToggleBinds) this.onToggleBinds();
      }

      // B: Working Fire Selector Switch (SEMI vs FULL-AUTO)
      if (e.code === 'KeyB' && !e.repeat) {
        this.fireMode = (this.fireMode === 'SEMI') ? 'AUTO' : 'SEMI';
        audioEngine.playFireSelector();
        if (this.onFireModeChange) {
          this.onFireModeChange(this.fireMode);
        }
      }

      // R: Tactical Reload & Double-Tap R Fast Reload
      if (e.code === 'KeyR' && !e.repeat) {
        const now = performance.now();
        const isFast = (now - this.lastRPressTime < 280);
        if (isFast) {
          audioEngine.playReload(true);
        } else {
          audioEngine.playReload(false);
        }
        this.lastRPressTime = now;
        if (this.onReload) {
          this.onReload(isFast);
        }
      }

      // T: Toggle Tactical Device
      if (e.code === 'KeyT' && !e.repeat && this.hasWeapon) {
        if (this.tacticalDevice === 'LASER') this.tacticalDevice = 'FLASHLIGHT';
        else if (this.tacticalDevice === 'FLASHLIGHT') this.tacticalDevice = 'OFF';
        else this.tacticalDevice = 'LASER';
        audioEngine.playFireSelector();
      }

      // Tab: Toggle Inventory
      if (e.code === 'Tab' && !e.repeat) {
        if (this.onToggleInventory) this.onToggleInventory();
      }

      // F: Interact with Containers / Extraction
      if (e.code === 'KeyF' && !e.repeat) {
        if (this.onInteract) this.onInteract();
      }

      if (e.code === 'Digit1' && this.onSelectWeapon) this.onSelectWeapon(1);
      if (e.code === 'Digit2' && this.onSelectWeapon) this.onSelectWeapon(2);
      if (e.code === 'Digit4' && this.onUseMed) this.onUseMed('bandage');
      if (e.code === 'Digit5' && this.onUseMed) this.onUseMed('medkit');
      if (e.code === 'Digit6' && this.onUseMed) this.onUseMed('painkiller');
      if (e.code === 'Escape' && this.onCloseMenu) this.onCloseMenu();
    });

    window.addEventListener('keyup', (e) => {
      if (isInputTarget(e.target)) {
        return;
      }
      if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
        this.keys[e.code] = false;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.keys.ShiftLeft = false;
        this.keys.ShiftRight = false;
      }
    });

    window.addEventListener('focusin', (e) => {
      if (isInputTarget(e.target)) {
        for (const k in this.keys) this.keys[k] = false;
        this.isMouseDown = false;
        this.semiShotFired = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      // Do not trigger weapon firing when clicking on UI buttons, text inputs, or modal overlays
      if (
        isInputTarget(e.target) ||
        e.target.closest('button') ||
        e.target.closest('.overlay-screen') ||
        e.target.closest('#inventory-overlay')
      ) {
        return;
      }

      if (e.button === 0) {
        this.isMouseDown = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.isAiming = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
        this.semiShotFired = false; // Reset semi lock on release
      } else if (e.button === 2) {
        if (!isInputTarget(e.target)) {
          e.preventDefault();
        }
        this.isAiming = false;
      }
    });

    window.addEventListener('contextmenu', (e) => {
      // Allow context menu in text inputs for copying/pasting
      if (isInputTarget(e.target)) {
        return;
      }
      e.preventDefault();
    });

    window.addEventListener('blur', () => {
      for (const k in this.keys) this.keys[k] = false;
      this.isMouseDown = false;
      this.semiShotFired = false;
      this.isAiming = false;
    });
  }

  /**
   * Tests whether a shot should fire right now based on SEMI vs AUTO dynamics.
   * SEMI: Exactly 1 shot per click.
   * AUTO: Continuous cyclic firing every cyclicRateMs.
   */
  shouldFireWeapon(currentTime, isBlocked = false) {
    if (isBlocked || !this.isMouseDown) return false;

    if (this.fireMode === 'SEMI') {
      if (!this.semiShotFired) {
        this.semiShotFired = true;
        this.lastShotTime = currentTime;
        return true;
      }
      return false;
    } else {
      // FULL AUTO: cyclic rate checking
      if (currentTime - this.lastShotTime >= this.cyclicRateMs) {
        this.lastShotTime = currentTime;
        return true;
      }
      return false;
    }
  }

  getInputState(playerScreenX, playerScreenY) {
    let moveX = 0;
    let moveY = 0;

    if (this.keys.KeyW) moveY -= 1;
    if (this.keys.KeyS) moveY += 1;
    if (this.keys.KeyA) moveX -= 1;
    if (this.keys.KeyD) moveX += 1;

    const dx = this.mouseX - playerScreenX;
    const dy = this.mouseY - playerScreenY;
    const angle = Math.atan2(dy, dx);

    const isSprinting = (this.keys.ShiftLeft || this.keys.ShiftRight) && !this.isAiming;

    return {
      moveX,
      moveY,
      angle,
      isSprinting,
      isCrouching: this.isCrouching,
      isAiming: this.isAiming,
      fireMode: this.fireMode,
      tacticalDevice: this.hasWeapon ? this.tacticalDevice : 'OFF'
    };
  }
}
