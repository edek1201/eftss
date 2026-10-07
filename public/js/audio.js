/**
 * EFT Tactical 2D - Procedural Audio Engine (Web Audio API)
 * Zero external audio files. 100% synthesized on-the-fly.
 * Features:
 * - Autoplay policy unlock on first user gesture
 * - Gunshots: White noise buffer burst + bandpass punch + sub-bass kick
 * - Fire selector click: Crisp mechanical latch toggle
 * - Tactical reload: 2-stage magazine unseat + slap + charging handle snap
 * - Footsteps: Pitch-modulated low-pass noise bursts (walk, sprint, crouch)
 * - Container rummaging: Multi-burst zipper / metallic latch sounds
 * - Procedural Scav Voiceline Barks: Aggressive synthesized vocal frequency sweeps
 * - Extraction countdown radio beeps & mission success confirmation
 */

class TacticalAudioEngine {
  constructor() {
    this.ctx = null;
    this.isUnlocked = false;
    this.noiseBuffer = null;
    this.lastFootstepTime = 0;

    this._bindUnlockListeners();
  }

  _bindUnlockListeners() {
    const unlock = () => {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('mousedown', unlock);
    };

    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('mousedown', unlock, { once: true });
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.isUnlocked = true;
      this._generateNoiseBuffer();
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  _generateNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return !!this.ctx;
  }

  playGunshot(soundType = 'm4a1', isFullAuto = false, volumeScale = 1) {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Supersonic sharp transient crack at onset
    const crackOsc = this.ctx.createOscillator();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(3400, now);
    crackOsc.frequency.exponentialRampToValueAtTime(700, now + 0.018);

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.65 * volumeScale, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    crackOsc.connect(crackGain);
    crackGain.connect(this.ctx.destination);
    crackOsc.start(now);
    crackOsc.stop(now + 0.018);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';

    let freq = 1200;
    let q = 1.8;
    let decay = isFullAuto ? 0.08 : 0.16;
    let subStart = 140;
    let gainVal = 0.75;

    if (soundType === 'asval' || soundType === 'vss' || soundType === 'suppressed') {
      freq = 420;
      q = 3.5;
      decay = 0.06;
      subStart = 70;
      gainVal = 0.35;
    } else if (soundType === 'saiga12' || soundType === 'shotgun') {
      freq = 550;
      q = 0.8;
      decay = 0.38;
      subStart = 240;
      gainVal = 1.05;
    } else if (soundType === 'vector' || soundType === 'mpx') {
      freq = 1900;
      q = 2.4;
      decay = 0.055;
      subStart = 100;
      gainVal = 0.62;
    } else if (soundType === 'rpk16') {
      freq = 700;
      q = 1.2;
      decay = 0.16;
      subStart = 200;
      gainVal = 0.95;
    } else if (soundType === 'goldentt') {
      freq = 1450;
      q = 2.0;
      decay = 0.14;
      subStart = 150;
      gainVal = 0.8;
    } else if (soundType === 'ak74m') {
      freq = 750;
      q = 1.3;
      decay = isFullAuto ? 0.11 : 0.22;
      subStart = 180;
      gainVal = 0.85;
    } else if (soundType === 'mp5') {
      freq = 1750;
      q = 2.2;
      decay = 0.07;
      subStart = 110;
      gainVal = 0.65;
    } else if (soundType === 'mosin') {
      freq = 600;
      q = 0.9;
      decay = 0.48;
      subStart = 220;
      gainVal = 1.0;
    } else if (soundType === 'pistol') {
      freq = 1600;
      q = 2.5;
      decay = 0.12;
      subStart = 130;
      gainVal = 0.6;
    }

    noiseFilter.frequency.setValueAtTime(freq, now);
    noiseFilter.Q.setValueAtTime(q, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(gainVal * volumeScale, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + decay);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + decay);

    // Sub-kick impact
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(subStart, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + Math.min(0.12, decay));

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(gainVal * 0.9 * volumeScale, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.12, decay));

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    subOsc.start(now);
    subOsc.stop(now + Math.min(0.12, decay));
  }

  playEmptyClick() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  playWeaponSwitch() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(650, now + 0.04);
    osc.frequency.setValueAtTime(420, now + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playMedUse(type = 'bandage') {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(type === 'bandage' ? 2400 : 1200, now);
    filter.Q.setValueAtTime(2.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.28);
  }

  playFireSelector() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.025);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  playReload(isFast = false) {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    const unseatOsc = this.ctx.createOscillator();
    unseatOsc.type = 'square';
    unseatOsc.frequency.setValueAtTime(750, now);
    unseatOsc.frequency.exponentialRampToValueAtTime(280, now + 0.04);

    const unseatGain = this.ctx.createGain();
    unseatGain.gain.setValueAtTime(0.2, now);
    unseatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    unseatOsc.connect(unseatGain);
    unseatGain.connect(this.ctx.destination);

    unseatOsc.start(now);
    unseatOsc.stop(now + 0.04);

    const slapDelay = isFast ? 0.15 : 0.28;
    const insertTime = now + slapDelay;

    const slapOsc = this.ctx.createOscillator();
    slapOsc.type = 'triangle';
    slapOsc.frequency.setValueAtTime(1100, insertTime);
    slapOsc.frequency.exponentialRampToValueAtTime(180, insertTime + 0.06);

    const slapGain = this.ctx.createGain();
    slapGain.gain.setValueAtTime(0.35, insertTime);
    slapGain.gain.exponentialRampToValueAtTime(0.001, insertTime + 0.06);

    slapOsc.connect(slapGain);
    slapGain.connect(this.ctx.destination);

    slapOsc.start(insertTime);
    slapOsc.stop(insertTime + 0.06);
  }

  playFootstep(stance = 'STAND', volumeScale = 1) {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    let filterFreq = 140;
    let volume = 0.22;
    let duration = 0.06;
    let popStart = 85;

    if (stance === 'SPRINT') {
      filterFreq = 240;
      volume = 0.35;
      duration = 0.075;
      popStart = 110;
    } else if (stance === 'CROUCH') {
      filterFreq = 80;
      volume = 0.08;
      duration = 0.045;
      popStart = 60;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * volumeScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + duration);

    // Punchy low-end heel/boot thud
    const popOsc = this.ctx.createOscillator();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(popStart, now);
    popOsc.frequency.exponentialRampToValueAtTime(32, now + duration);

    const popGain = this.ctx.createGain();
    popGain.gain.setValueAtTime(volume * 0.7 * volumeScale, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    popOsc.connect(popGain);
    popGain.connect(this.ctx.destination);

    popOsc.start(now);
    popOsc.stop(now + duration);
  }

  playContainerSearch() {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const burstTime = now + i * 0.06;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800 + i * 400, burstTime);
      filter.Q.setValueAtTime(4.0, burstTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, burstTime);
      gain.gain.exponentialRampToValueAtTime(0.001, burstTime + 0.045);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(burstTime);
      noise.stop(burstTime + 0.045);
    }
  }

  playItemMove() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.03);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  /**
   * Procedural Scav Russian Voiceline / Aggressive Bark upon spotting players
   */
  playScavBark() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    // Dual-tone formant vocal sweep (simulating aggressive throat shout)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(320, now);
    osc1.frequency.linearRampToValueAtTime(440, now + 0.08);
    osc1.frequency.linearRampToValueAtTime(260, now + 0.22);

    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(900, now);
    filter1.Q.setValueAtTime(3.0, now);

    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.25);
  }

  playExtractBeep() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  playExtractSuccess() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    [523.25, 659.25].forEach((freq, idx) => {
      const toneTime = now + idx * 0.12;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, toneTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, toneTime);
      gain.gain.exponentialRampToValueAtTime(0.001, toneTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(toneTime);
      osc.stop(toneTime + 0.18);
    });
  }

  playMeleeSwing() {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    filter.Q.setValueAtTime(2.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.15);
  }

  /**
   * High-Explosive Grenade Detonation (Sub-bass rumble + concussive crack + ringing tinnitus)
   */
  playGrenadeExplosion() {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // 1. Initial supersonic explosion crack
    const crackOsc = this.ctx.createOscillator();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(450, now);
    crackOsc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.9, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    crackOsc.connect(crackGain);
    crackGain.connect(this.ctx.destination);
    crackOsc.start(now);
    crackOsc.stop(now + 0.12);

    // 2. Heavy concussive sub-bass boom
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.85);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.95);

    // 3. Dirt & shrapnel debris rumble (low-pass filtered white noise)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(450, now);
    noiseFilter.frequency.linearRampToValueAtTime(80, now + 1.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 1.3);

    // 4. Subtle concussive tinnitus ringing
    const ringOsc = this.ctx.createOscillator();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(3200, now + 0.05);

    const ringGain = this.ctx.createGain();
    ringGain.gain.setValueAtTime(0.001, now);
    ringGain.gain.linearRampToValueAtTime(0.12, now + 0.08);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    ringOsc.connect(ringGain);
    ringGain.connect(this.ctx.destination);
    ringOsc.start(now + 0.05);
    ringOsc.stop(now + 1.8);
  }

  playSuppressedGunshot() {
    this.playGunshot('asval', false);
  }

  playShotgun() {
    this.playGunshot('saiga12', false);
  }

  /**
   * Hideout Trader Marketplace Cash Register Chime
   */
  playCashRegister() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    // Dual bell tones (1567Hz and 2093Hz)
    [1567.98, 2093.00].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.35);
    });

    // Mechanical latch click
    const clickOsc = this.ctx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(420, now + 0.02);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.15, now + 0.02);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    clickOsc.start(now + 0.02);
    clickOsc.stop(now + 0.07);
  }

  /**
   * Painkiller ingestion (Golden Star / Morphine)
   */
  playPainkiller() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    // Metal tin twist / syringe injection sound
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }
}

export const audioEngine = new TacticalAudioEngine();
