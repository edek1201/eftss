/**
 * EFT Tactical 2D - Ultra-High Performance Viewport-Culled Rendering Engine
 * Features:
 * - Dynamic Camera strictly centered on local player with smooth tracking
 * - Offscreen Tile & Entity Culling: Only draws tiles and objects inside camera viewport
 * - Procedural Operators (PMC with FAST helmet & armor, Scavs with civilian jackets & beanies)
 * - Dead Scav corpse tiles with loot markers
 * - Physical bullet tracers, recoil screen shake, and proximity HUD prompts
 */

import { TILE_TYPES } from '/shared/map.js';
import { PHYSICS_CONFIG } from '/shared/physics.js';

export class TacticalRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    this.camera = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      lerpFactor: 0.14,
      shakeX: 0,
      shakeY: 0
    };

    this.map = null;
    this.tileSize = 32;
    this.zoom = 1.5;

    this.fogCanvas = document.createElement('canvas');
    this.fogCtx = this.fogCanvas.getContext('2d');
    this.bloodFlashAlpha = 0;

    // Dual-Buffer Architecture: Pre-render static terrain once on raid/map start
    this.staticMapCanvas = document.createElement('canvas');
    this.staticMapCtx = this.staticMapCanvas.getContext('2d');
    this.staticWallSegments = [];
    this.staticWallCorners = [];

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.fogCanvas) {
      this.fogCanvas.width = window.innerWidth;
      this.fogCanvas.height = window.innerHeight;
    }
  }

  setMap(map) {
    this.map = map;
    this.tileSize = map.tileSize;
    this._preRenderStaticMap();
    this._precomputeStaticObstacles();
  }

  _preRenderStaticMap() {
    if (!this.map) return;
    const ts = this.tileSize;
    const w = this.map.width * ts;
    const h = this.map.height * ts;

    this.staticMapCanvas.width = w;
    this.staticMapCanvas.height = h;
    const sCtx = this.staticMapCtx;

    // Fast pre-render of all tiles once onto offscreen canvas
    for (let ty = 0; ty < this.map.height; ty++) {
      for (let tx = 0; tx < this.map.width; tx++) {
        const x = tx * ts;
        const y = ty * ts;
        const type = this.map.getTile(tx, ty);

        switch (type) {
          case TILE_TYPES.FLOOR_CONCRETE: {
            sCtx.fillStyle = ((tx + ty) % 2 === 0) ? '#161b22' : '#13171d';
            sCtx.fillRect(x, y, ts, ts);
            sCtx.strokeStyle = '#1b212a';
            sCtx.lineWidth = 0.8;
            sCtx.strokeRect(x, y, ts, ts);
            break;
          }
          case TILE_TYPES.FLOOR_OFFICE: {
            sCtx.fillStyle = ((tx + ty) % 2 === 0) ? '#212730' : '#262d38';
            sCtx.fillRect(x, y, ts, ts);
            sCtx.strokeStyle = '#303947';
            sCtx.lineWidth = 0.8;
            sCtx.strokeRect(x, y, ts, ts);
            break;
          }
          case TILE_TYPES.METAL_GRATE: {
            sCtx.fillStyle = '#0f1217';
            sCtx.fillRect(x, y, ts, ts);
            sCtx.strokeStyle = '#273142';
            sCtx.lineWidth = 1;
            sCtx.strokeRect(x, y, ts, ts);
            sCtx.beginPath();
            sCtx.moveTo(x, y); sCtx.lineTo(x + ts, y + ts);
            sCtx.moveTo(x + ts, y); sCtx.lineTo(x, y + ts);
            sCtx.stroke();
            break;
          }
          case TILE_TYPES.WALL_SOLID: {
            sCtx.fillStyle = '#1e242d';
            sCtx.fillRect(x, y, ts, ts);
            sCtx.strokeStyle = '#0b0d11';
            sCtx.lineWidth = 1.2;
            sCtx.strokeRect(x, y, ts, ts);
            sCtx.fillStyle = '#2a3340';
            sCtx.fillRect(x + 2, y + 2, ts - 4, 3);
            break;
          }
          case TILE_TYPES.WALL_CONTAINER: {
            sCtx.fillStyle = '#2c3e50';
            sCtx.fillRect(x, y, ts, ts);
            sCtx.strokeStyle = '#1a252f';
            sCtx.lineWidth = 1;
            sCtx.strokeRect(x, y, ts, ts);
            sCtx.strokeStyle = '#34495e';
            for (let i = 4; i < ts; i += 6) {
              sCtx.beginPath();
              sCtx.moveTo(x + i, y + 2); sCtx.lineTo(x + i, y + ts - 2);
              sCtx.stroke();
            }
            break;
          }
          case TILE_TYPES.COVER_CRATE: {
            sCtx.fillStyle = '#795548';
            sCtx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            sCtx.strokeStyle = '#4e342e';
            sCtx.lineWidth = 1;
            sCtx.strokeRect(x + 2, y + 2, ts - 4, ts - 4);
            sCtx.beginPath();
            sCtx.moveTo(x + 2, y + 2); sCtx.lineTo(x + ts - 2, y + ts - 2);
            sCtx.moveTo(x + ts - 2, y + 2); sCtx.lineTo(x + 2, y + ts - 2);
            sCtx.stroke();
            break;
          }
          case TILE_TYPES.DOOR_FRAME: {
            sCtx.fillStyle = '#14181f';
            sCtx.fillRect(x, y, ts, ts);
            sCtx.strokeStyle = '#d4a359';
            sCtx.lineWidth = 1.5;
            sCtx.strokeRect(x + 3, y + 3, ts - 6, ts - 6);
            break;
          }
          case TILE_TYPES.FORKLIFT_PROP: {
            sCtx.fillStyle = '#f39c12';
            sCtx.fillRect(x + 4, y + 6, ts - 8, ts - 12);
            sCtx.fillStyle = '#2c3e50';
            sCtx.fillRect(x + ts - 6, y + 8, 4, ts - 16);
            break;
          }
          case TILE_TYPES.RAILROAD_TRACK: {
            sCtx.fillStyle = '#11151c';
            sCtx.fillRect(x, y, ts, ts);
            sCtx.fillStyle = '#5d4037';
            sCtx.fillRect(x, y + 6, ts, 4);
            sCtx.fillRect(x, y + ts - 10, ts, 4);
            sCtx.fillStyle = '#7f8c8d';
            sCtx.fillRect(x + 6, y, 3, ts);
            sCtx.fillRect(x + ts - 9, y, 3, ts);
            break;
          }
          default: {
            sCtx.fillStyle = '#12161d';
            sCtx.fillRect(x, y, ts, ts);
          }
        }
      }
    }
  }

  _precomputeStaticObstacles() {
    if (!this.map) return;
    this.staticWallSegments = [];
    this.staticWallCorners = [];

    const ts = this.tileSize;
    const addSeg = (x1, y1, x2, y2) => {
      this.staticWallSegments.push({ ax: x1, ay: y1, bx: x2, by: y2 });
      this.staticWallCorners.push({ x: x1, y: y1 });
      this.staticWallCorners.push({ x: x2, y: y2 });
    };

    for (let ty = 0; ty < this.map.height; ty++) {
      for (let tx = 0; tx < this.map.width; tx++) {
        if (!this.map.isSolid(tx, ty)) continue;

        const x = tx * ts;
        const y = ty * ts;

        if (!this.map.isSolid(tx, ty - 1)) addSeg(x, y, x + ts, y);
        if (!this.map.isSolid(tx + 1, ty)) addSeg(x + ts, y, x + ts, y + ts);
        if (!this.map.isSolid(tx, ty + 1)) addSeg(x + ts, y + ts, x, y + ts);
        if (!this.map.isSolid(tx - 1, ty)) addSeg(x, y + ts, x, y);
      }
    }
  }

  addRecoilShake(amount = 4.0) {
    this.camera.shakeX += (Math.random() * 2 - 1) * amount;
    this.camera.shakeY += (Math.random() * 2 - 1) * amount;
  }

  triggerBloodFlash() {
    this.bloodFlashAlpha = 0.75;
  }

  updateCamera(targetX, targetY, isAiming = false) {
    this.camera.targetX = targetX;
    this.camera.targetY = targetY;

    // Smooth ADS camera look-ahead lerp (0.10 factor during RMB hold, 0.14 otherwise)
    const factor = isAiming ? 0.10 : 0.14;
    this.camera.x += (this.camera.targetX - this.camera.x) * factor;
    this.camera.y += (this.camera.targetY - this.camera.y) * factor;

    this.camera.shakeX *= 0.82;
    this.camera.shakeY *= 0.82;
  }

  /**
   * Main Render Pass with Viewport Culling
   */
  render(localPlayer, squadPlayers, bots = [], containers = [], bullets = [], acousticRings = [], promptContainer = null, grenades = []) {
    const ctx = this.ctx;
    const viewW = this.canvas.width;
    const viewH = this.canvas.height;

    // Fast clear
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, viewW, viewH);

    if (!this.map) return;

    ctx.save();
    ctx.translate(Math.round(viewW / 2 + this.camera.shakeX), Math.round(viewH / 2 + this.camera.shakeY));
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

    // 1. DUAL-BUFFER STATIC MAP BLIT (Offscreen canvas pre-rendered once on raid start)
    const ts = this.tileSize;
    const halfW = (viewW / this.zoom) / 2 + ts * 2;
    const halfH = (viewH / this.zoom) / 2 + ts * 2;

    if (this.staticMapCanvas && this.staticMapCanvas.width > 0) {
      ctx.drawImage(this.staticMapCanvas, 0, 0);
    } else {
      const minTX = Math.max(0, Math.floor((this.camera.x - halfW) / ts));
      const maxTX = Math.min(this.map.width - 1, Math.ceil((this.camera.x + halfW) / ts));
      const minTY = Math.max(0, Math.floor((this.camera.y - halfH) / ts));
      const maxTY = Math.min(this.map.height - 1, Math.ceil((this.camera.y + halfH) / ts));

      this._renderCulledTiles(ctx, minTX, maxTX, minTY, maxTY);
    }

    // 2. EXTRACTION ZONES
    for (const zone of this.map.extractZones) {
      const zx = zone.tileX * ts;
      const zy = zone.tileY * ts;
      const zw = zone.tileW * ts;
      const zh = zone.tileH * ts;

      // Culling check
      if (zx + zw > this.camera.x - halfW && zx < this.camera.x + halfW &&
          zy + zh > this.camera.y - halfH && zy < this.camera.y + halfH) {
        ctx.fillStyle = zone.color;
        ctx.fillRect(zx, zy, zw, zh);

        ctx.strokeStyle = zone.border;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(zx, zy, zw, zh);
        ctx.setLineDash([]);

        ctx.fillStyle = zone.border;
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(zone.name.toUpperCase(), zx + zw / 2, zy + zh / 2);
      }
    }

    // 3. CONTAINERS & CORPSES (Culled & Wall Occluded)
    for (const c of containers) {
      if (Math.abs(c.x - this.camera.x) < halfW && Math.abs(c.y - this.camera.y) < halfH) {
        if (this._isPointInVision(localPlayer, c.x, c.y)) {
          this._renderContainerEntity(ctx, c);
        }
      }
    }

    // 4. LIVING PVE SCAV BOTS (Strictly occluded by walls & FOV!)
    for (const bot of bots) {
      if (Math.abs(bot.x - this.camera.x) < halfW && Math.abs(bot.y - this.camera.y) < halfH) {
        if (this._isPointInVision(localPlayer, bot.x, bot.y)) {
          this.renderScavBot(ctx, bot);
        }
      }
    }

    // 5. REMOTE SQUAD MEMBERS
    for (const remote of squadPlayers) {
      if (remote.id !== localPlayer?.id) {
        if (Math.abs(remote.x - this.camera.x) < halfW && Math.abs(remote.y - this.camera.y) < halfH) {
          if (this._isPointInVision(localPlayer, remote.x, remote.y)) {
            this.renderProceduralOperator(ctx, remote, false);
          } else {
            this._renderSquadRadioBeacon(ctx, remote);
          }
        }
      }
    }

    // 6. LOCAL PLAYER (Always Rendered)
    if (localPlayer) {
      this.renderProceduralOperator(ctx, localPlayer, true);
    }

    // 7. DYNAMIC FIELD OF VIEW (FOV) & FOG OF WAR OCCLUSION MASK
    if (localPlayer) {
      const fovPoints = this._buildVisibilityPolygon(localPlayer);
      const ambientRadius = 60; // Clean circular ambient radius (60px) around player

      const fogCtx = this.fogCtx;
      fogCtx.clearRect(0, 0, viewW, viewH);
      fogCtx.fillStyle = '#06080c';
      fogCtx.fillRect(0, 0, viewW, viewH);

      fogCtx.save();
      fogCtx.translate(Math.round(viewW / 2 + this.camera.shakeX), Math.round(viewH / 2 + this.camera.shakeY));
      fogCtx.scale(this.zoom, this.zoom);
      fogCtx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

      fogCtx.globalCompositeOperation = 'destination-out';

      // A. Clean circular ambient awareness radius (60px) around operator torso
      fogCtx.beginPath();
      fogCtx.arc(localPlayer.x, localPlayer.y, ambientRadius, 0, Math.PI * 2);
      fogCtx.fill();

      // B. Forward FOV cone polygon (90 deg hipfire, 45 deg ADS)
      if (fovPoints.length > 0) {
        fogCtx.beginPath();
        fogCtx.moveTo(localPlayer.x, localPlayer.y);
        for (let i = 0; i < fovPoints.length; i++) {
          fogCtx.lineTo(fovPoints[i].x, fovPoints[i].y);
        }
        fogCtx.lineTo(localPlayer.x, localPlayer.y);
        fogCtx.closePath();
        fogCtx.fill();
      }

      fogCtx.restore();

      // Blit darkness over world in screen coordinates
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.fogCanvas, 0, 0);
      ctx.restore();
    }

    // 8. BULLET TRACERS (Visible through darkness)
    for (const b of bullets) {
      ctx.save();
      ctx.strokeStyle = b.isScav ? 'rgba(255, 60, 40, 0.95)' : 'rgba(255, 230, 140, 0.95)';
      ctx.lineWidth = b.isScav ? 2.5 : 2;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.04, b.y - b.vy * 0.04);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.fillStyle = b.isScav ? '#ff3b30' : '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. ACOUSTIC RINGS
    for (const ring of acousticRings) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.currentRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(212, 163, 89, ${ring.alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // 10. ACTIVE GRENADES & BLAST DANGER ZONES
    for (const g of grenades) {
      if (Math.abs(g.x - this.camera.x) < halfW && Math.abs(g.y - this.camera.y) < halfH) {
        this._renderGrenadeEntity(ctx, g);
      }
    }

    ctx.restore(); // Camera transform restored

    // 10. PROXIMITY INTERACTION PROMPT
    if (promptContainer) {
      this._renderInteractionPrompt(ctx, viewW, viewH, promptContainer);
    }

    this._renderTacticalVignette(ctx, viewW, viewH, localPlayer?.isAiming);
  }

  /**
   * ROBUST 2D RAYCAST VISIBILITY POLYGON ALGORITHM:
   * - Casts rays to all wall/box corners plus (angle ± 0.0001 rad).
   * - Collects all valid ray intersection points.
   * - Strictly sorts all intersection points in clockwise ascending order by relative angle.
   * - Restricts polygon within forward cone (90° hipfire, 45° ADS with +35% ray length).
   */
  _buildVisibilityPolygon(player) {
    if (!player || !this.map) return [];
    const px = player.x;
    const py = player.y;
    const aimAngle = player.angle || 0;
    const isAiming = !!player.isAiming;

    // FOV parameters: 90 deg hipfire, 45 deg ADS
    const fovDeg = isAiming ? 45 : 90;
    const fovRad = (fovDeg * Math.PI) / 180;
    const halfFov = fovRad / 2;
    const viewDist = isAiming ? 675 : 500; // 35% longer range during ADS

    const coneStart = aimAngle - halfFov;
    const coneEnd = aimAngle + halfFov;

    const ts = this.tileSize;
    const checkRadius = viewDist + 48;
    const minTX = Math.max(0, Math.floor((px - checkRadius) / ts));
    const maxTX = Math.min(this.map.width - 1, Math.ceil((px + checkRadius) / ts));
    const minTY = Math.max(0, Math.floor((py - checkRadius) / ts));
    const maxTY = Math.min(this.map.height - 1, Math.ceil((py + checkRadius) / ts));

    // 1. Collect wall boundary segments & corners
    const segments = [];
    const corners = [];

    const addSegment = (x1, y1, x2, y2) => {
      segments.push({ ax: x1, ay: y1, bx: x2, by: y2 });
      corners.push({ x: x1, y: y1 });
      corners.push({ x: x2, y: y2 });
    };

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (!this.map.isSolid(tx, ty)) continue;

        const x = tx * ts;
        const y = ty * ts;

        if (!this.map.isSolid(tx, ty - 1)) addSegment(x, y, x + ts, y);
        if (!this.map.isSolid(tx + 1, ty)) addSegment(x + ts, y, x + ts, y + ts);
        if (!this.map.isSolid(tx, ty + 1)) addSegment(x + ts, y + ts, x, y + ts);
        if (!this.map.isSolid(tx - 1, ty)) addSegment(x, y + ts, x, y);
      }
    }

    // Helper: Angle difference normalized to [0, 2*PI) from coneStart
    const getRelAngle = (theta, ref) => {
      let diff = (theta - ref) % (Math.PI * 2);
      if (diff < 0) diff += Math.PI * 2;
      return diff;
    };

    // 2. Candidate ray angles strictly inside forward cone
    const testAngles = [];

    // Left and right edges of forward cone
    testAngles.push(coneStart);
    testAngles.push(coneEnd);

    // Uniform subdivisions along cone arc
    const arcSubdivs = 36;
    for (let i = 1; i < arcSubdivs; i++) {
      testAngles.push(coneStart + (i / arcSubdivs) * fovRad);
    }

    // Corner rays: corner angle ± 0.0001 rad
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      const theta = Math.atan2(c.y - py, c.x - px);
      const diffToAim = Math.abs(Math.atan2(Math.sin(theta - aimAngle), Math.cos(theta - aimAngle)));
      if (diffToAim <= halfFov + 0.05) {
        testAngles.push(theta - 0.0001, theta, theta + 0.0001);
      }
    }

    // 3. Cast rays and find closest intersection points
    const points = [];

    for (let i = 0; i < testAngles.length; i++) {
      const alpha = testAngles[i];
      const relA = getRelAngle(alpha, coneStart);
      if (relA > fovRad + 0.0002) continue; // Restrict strictly to forward cone

      const cosA = Math.cos(alpha);
      const sinA = Math.sin(alpha);

      let closestT = viewDist;

      for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        const dx = seg.bx - seg.ax;
        const dy = seg.by - seg.ay;

        const det = cosA * dy - sinA * dx;
        if (Math.abs(det) < 1e-7) continue;

        const qx = seg.ax - px;
        const qy = seg.ay - py;

        const t = (qx * dy - qy * dx) / det;
        const u = (qx * sinA - qy * cosA) / det;

        if (t >= 0 && t < closestT && u >= 0 && u <= 1) {
          closestT = t;
        }
      }

      points.push({
        x: px + cosA * closestT,
        y: py + sinA * closestT,
        relAngle: relA
      });
    }

    // 4. STRICTLY sort all intersection points in clockwise ascending order by relative angle
    points.sort((a, b) => a.relAngle - b.relAngle);

    return points;
  }

  _isPointInVision(player, targetX, targetY) {
    if (!player || !this.map) return true;
    const dist = Math.hypot(targetX - player.x, targetY - player.y);

    // Clean ambient torso circle (60px) is always visible
    if (dist <= 60) return true;

    const maxRange = player.isAiming ? 675 : 500;
    if (dist > maxRange) return false;

    // Strict solid wall occlusion
    if (!this.map.hasLineOfSight(player.x, player.y, targetX, targetY)) {
      return false;
    }

    // Forward vision cone check (45° ADS vs 90° hipfire)
    const aimAngle = player.angle || 0;
    const angleTo = Math.atan2(targetY - player.y, targetX - player.x);
    const diff = Math.abs(Math.atan2(Math.sin(angleTo - aimAngle), Math.cos(angleTo - aimAngle)));
    const maxFov = player.isAiming ? (22.5 * Math.PI / 180) : (45 * Math.PI / 180);
    return diff <= maxFov;
  }

  _renderSquadRadioBeacon(ctx, remote) {
    ctx.save();
    ctx.translate(remote.x, remote.y);
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = remote.color || '#2ecc71';
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.font = 'bold 9px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(remote.name, 0, -8);
    ctx.restore();
  }

  _renderCulledTiles(ctx, minTX, maxTX, minTY, maxTY) {
    const ts = this.tileSize;

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        const x = tx * ts;
        const y = ty * ts;
        const type = this.map.getTile(tx, ty);

        switch (type) {
          case TILE_TYPES.FLOOR_CONCRETE: {
            ctx.fillStyle = ((tx + ty) % 2 === 0) ? '#161b22' : '#13171d';
            ctx.fillRect(x, y, ts, ts);
            ctx.strokeStyle = '#1b212a';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(x, y, ts, ts);
            break;
          }

          case TILE_TYPES.FLOOR_OFFICE: {
            ctx.fillStyle = ((tx + ty) % 2 === 0) ? '#212730' : '#262d38';
            ctx.fillRect(x, y, ts, ts);
            ctx.strokeStyle = '#303947';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(x, y, ts, ts);
            break;
          }

          case TILE_TYPES.METAL_GRATE: {
            ctx.fillStyle = '#0f1217';
            ctx.fillRect(x, y, ts, ts);
            ctx.strokeStyle = '#25303d';
            ctx.lineWidth = 1;
            for (let i = 0; i < ts; i += 8) {
              ctx.beginPath();
              ctx.moveTo(x + i, y);
              ctx.lineTo(x, y + i);
              ctx.stroke();
            }
            break;
          }

          case TILE_TYPES.RAILROAD_TRACK: {
            ctx.fillStyle = '#22201d';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#4a3f35';
            ctx.fillRect(x + 2, y + 10, ts - 4, 12);
            ctx.strokeStyle = '#8a9ba8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y + 12);
            ctx.lineTo(x + ts, y + 12);
            ctx.moveTo(x, y + 20);
            ctx.lineTo(x + ts, y + 20);
            ctx.stroke();
            break;
          }

          case TILE_TYPES.WALL_SOLID: {
            ctx.fillStyle = '#1c2026';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#282e37';
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            ctx.strokeStyle = '#353e4b';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, ts, ts);
            break;
          }

          case TILE_TYPES.WALL_CONTAINER: {
            ctx.fillStyle = '#7a382c';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#8f4435';
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            ctx.strokeStyle = '#5c271e';
            ctx.lineWidth = 1.5;
            for (let rx = 6; rx < ts; rx += 8) {
              ctx.beginPath();
              ctx.moveTo(x + rx, y + 2);
              ctx.lineTo(x + rx, y + ts - 2);
              ctx.stroke();
            }
            break;
          }

          case TILE_TYPES.COVER_CRATE: {
            ctx.fillStyle = '#483829';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#5a4634';
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            ctx.strokeStyle = '#3a2d21';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 4);
            ctx.lineTo(x + ts - 4, y + ts - 4);
            ctx.moveTo(x + ts - 4, y + 4);
            ctx.lineTo(x + 4, y + ts - 4);
            ctx.stroke();
            break;
          }

          case TILE_TYPES.FORKLIFT_PROP: {
            ctx.fillStyle = '#e67e22';
            ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
            ctx.fillStyle = '#111';
            ctx.fillRect(x + 2, y + 2, 6, 8);
            ctx.fillRect(x + ts - 8, y + 2, 6, 8);
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + ts - 4, y + 8);
            ctx.lineTo(x + ts + 6, y + 8);
            ctx.moveTo(x + ts - 4, y + 24);
            ctx.lineTo(x + ts + 6, y + 24);
            ctx.stroke();
            break;
          }

          case TILE_TYPES.BLAST_DOOR: {
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(x + 3, y + 3, ts - 6, ts - 6);
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 4);
            ctx.lineTo(x + ts - 4, y + ts - 4);
            ctx.stroke();
            break;
          }

          case TILE_TYPES.DOOR_FRAME: {
            ctx.fillStyle = '#252c38';
            ctx.fillRect(x, y, ts, ts);
            ctx.strokeStyle = '#d4a359';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 4, y + 4, ts - 8, ts - 8);
            break;
          }
        }
      }
    }
  }

  _renderContainerEntity(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y);

    if (c.type === 'crate_military') {
      ctx.fillStyle = '#253528';
      ctx.fillRect(-18, -12, 36, 24);
      ctx.fillStyle = '#324736';
      ctx.fillRect(-16, -10, 32, 20);
      ctx.fillStyle = '#172219';
      ctx.fillRect(-18, -12, 4, 4);
      ctx.fillRect(14, -12, 4, 4);
      ctx.fillRect(-18, 8, 4, 4);
      ctx.fillRect(14, 8, 4, 4);

      ctx.fillStyle = '#d4a359';
      ctx.font = 'bold 8px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WEAPON', 0, 3);
    } else if (c.type === 'corpse_scav') {
      // Blood stain
      ctx.fillStyle = 'rgba(120, 20, 20, 0.45)';
      ctx.beginPath();
      ctx.ellipse(-2, 4, 16, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Slumped Scav body
      ctx.fillStyle = '#d35400'; // Scav orange jacket
      ctx.beginPath();
      ctx.ellipse(-2, 0, 13, 8, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Scav beanie
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath();
      ctx.arc(8, 2, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Loot marker indicator
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 8px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LOOT', 0, -11);
    } else if (c.type === 'ammo_box') {
      ctx.fillStyle = '#4e3b2b';
      ctx.fillRect(-12, -9, 24, 18);
      ctx.fillStyle = '#654e38';
      ctx.fillRect(-10, -7, 20, 14);
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 7px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 2);
    } else if (c.type === 'med_bag') {
      ctx.fillStyle = '#7f6a55';
      ctx.fillRect(-12, -10, 24, 20);
      ctx.fillStyle = '#9e846b';
      ctx.fillRect(-10, -8, 20, 16);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-2, -5, 4, 10);
      ctx.fillRect(-5, -2, 10, 4);
    }

    ctx.restore();
  }

  /**
   * PVE Scav Bot Visual Rendering (Scavs, Elite Guards, Boss Killa & Voiceline Bubbles)
   */
  renderScavBot(ctx, bot) {
    ctx.save();
    ctx.translate(bot.x, bot.y);
    ctx.rotate(bot.angle);

    // Drop shadow
    ctx.beginPath();
    ctx.ellipse(-2, 2, 17, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    if (bot.isBoss) {
      // ===== BOSS KILLA (HEAVY CLASS 5 KORUND + ADIDAS STRIPES) =====
      // Black Adidas Tracksuit Torso with White Stripes on Shoulders
      ctx.beginPath();
      ctx.ellipse(-3, 0, 12, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#111417';
      ctx.fill();
      ctx.strokeStyle = '#050708';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // White Adidas 3-stripes on shoulders
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      [-13, -11, -9].forEach(yOffset => {
        ctx.beginPath(); ctx.moveTo(-6, yOffset); ctx.lineTo(6, yOffset); ctx.stroke();
      });
      [9, 11, 13].forEach(yOffset => {
        ctx.beginPath(); ctx.moveTo(-6, yOffset); ctx.lineTo(6, yOffset); ctx.stroke();
      });

      // Heavy Korund Class 5 Armored Plate Carrier
      ctx.beginPath();
      ctx.roundRect(-8, -9, 15, 18, [3]);
      ctx.fillStyle = '#222822';
      ctx.fill();
      ctx.strokeStyle = '#323c32';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Molle pouches & groin flap
      ctx.fillStyle = '#171c17';
      ctx.fillRect(-7, -4, 12, 8);
      ctx.fillRect(5, -6, 4, 12);

      // Arms (Heavy black sleeves holding weapon)
      ctx.fillStyle = '#111417';
      ctx.beginPath();
      ctx.moveTo(-3, -13); ctx.lineTo(16, -5); ctx.lineTo(14, -2); ctx.lineTo(-3, -9);
      ctx.closePath(); ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-3, 13); ctx.lineTo(13, 4); ctx.lineTo(11, 1); ctx.lineTo(-3, 9);
      ctx.closePath(); ctx.fill();

      // Heavy RPK-16 with 95-round drum mag
      ctx.fillStyle = '#1a1f26';
      ctx.fillRect(2, -2, 18, 4);
      // Large circular drum magazine
      ctx.beginPath();
      ctx.arc(12, 5, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#11151a';
      ctx.fill();
      ctx.strokeStyle = '#2c3540';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Long heavy barrel & brake
      ctx.fillStyle = '#28313d';
      ctx.fillRect(20, -1.5, 16, 3);
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(36, -2.5, 4, 5);

      // Muzzle flash when firing
      if (bot.isFiring) {
        ctx.save();
        ctx.translate(40, 0);
        ctx.fillStyle = 'rgba(255, 165, 0, 0.95)';
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(2, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ICONIC MASKA-1SCH HELMET (Rounded sphere + 3 white vertical stripes + visor slit)
      ctx.beginPath();
      ctx.arc(-2, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#2b3137';
      ctx.fill();
      ctx.strokeStyle = '#181b1f';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 3 White Vertical Racing Stripes down the helmet
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-9, -2); ctx.lineTo(6, -2);
      ctx.moveTo(-10, 0); ctx.lineTo(7, 0);
      ctx.moveTo(-9, 2); ctx.lineTo(6, 2);
      ctx.stroke();

      // Metal Face Shield Visor Box & Horizontal Eye Slit
      ctx.fillStyle = '#1b1f23';
      ctx.fillRect(2, -4, 4, 8);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(2, -4, 4, 8);
      ctx.fillStyle = '#0a0c0e';
      ctx.fillRect(3, -2.5, 2, 5); // Vision slit
    } else if (bot.isGuard) {
      // ===== ELITE RESHALA/KILLA GUARD =====
      // Tactical Multicam uniform
      ctx.beginPath();
      ctx.ellipse(-3, 0, 11, 15, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#2f3b31';
      ctx.fill();
      ctx.strokeStyle = '#1b231d';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Trooper T4 Plate Carrier
      ctx.beginPath();
      ctx.roundRect(-7, -8, 13, 16, [2]);
      ctx.fillStyle = '#425244';
      ctx.fill();
      ctx.strokeStyle = '#273129';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arms holding assault rifle
      ctx.fillStyle = '#2f3b31';
      ctx.beginPath();
      ctx.moveTo(-3, -12); ctx.lineTo(14, -4); ctx.lineTo(12, -1); ctx.lineTo(-3, -8);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-3, 12); ctx.lineTo(11, 3); ctx.lineTo(9, 1); ctx.lineTo(-3, 8);
      ctx.closePath(); ctx.fill();

      // Tactical AK-74M rifle
      ctx.fillStyle = '#1a1d22';
      ctx.fillRect(2, -1.5, 22, 3);
      ctx.fillStyle = '#d35400';
      ctx.fillRect(8, 1.5, 5, 4);

      if (bot.isFiring) {
        ctx.save();
        ctx.translate(28, 0);
        ctx.fillStyle = 'rgba(255, 170, 0, 0.9)';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Altyn / FAST Tactical Helmet
      ctx.beginPath();
      ctx.arc(-2, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#222722';
      ctx.fill();
      ctx.strokeStyle = '#111411';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // ===== REGULAR SCAV =====
      // Ragged civilian coat / jacket
      ctx.beginPath();
      ctx.ellipse(-3, 0, 10, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#d35400'; // Scav orange jacket
      ctx.fill();
      ctx.strokeStyle = '#873600';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Worn Scav vest
      ctx.beginPath();
      ctx.roundRect(-6, -7, 11, 14, [2]);
      ctx.fillStyle = '#4a3b32';
      ctx.fill();

      // Arms holding rifle
      ctx.fillStyle = '#d35400';
      ctx.beginPath();
      ctx.moveTo(-3, -11); ctx.lineTo(16, -4); ctx.lineTo(14, -1); ctx.lineTo(-3, -8);
      ctx.closePath(); ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-3, 11); ctx.lineTo(11, 3); ctx.lineTo(9, 1); ctx.lineTo(-3, 8);
      ctx.closePath(); ctx.fill();

      // Wooden stock SKS / Shotgun
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(4, -1, 14, 3);
      ctx.fillStyle = '#1a1d22';
      ctx.fillRect(18, -1, 14, 2);

      // Muzzle flash when Scav fires
      if (bot.isFiring) {
        ctx.save();
        ctx.translate(32, 0);
        ctx.fillStyle = 'rgba(255, 170, 0, 0.9)';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Beanie Cap
      ctx.beginPath();
      ctx.arc(-2, 0, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2c3e50';
      ctx.fill();
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(-2, -7.5, 3.5, 15);
    }

    // Alert indicator cone (if in ATTACK or COMBAT)
    if (bot.state === 'ATTACK' || bot.state === 'COMBAT') {
      ctx.strokeStyle = bot.isBoss ? 'rgba(241, 196, 15, 0.45)' : 'rgba(231, 76, 60, 0.35)';
      ctx.lineWidth = bot.isBoss ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(35, 0);
      ctx.lineTo(140, -25);
      ctx.moveTo(35, 0);
      ctx.lineTo(140, 25);
      ctx.stroke();
    }

    ctx.restore();

    // Overhead Nameplate & Boss Health Bar
    ctx.save();
    ctx.translate(bot.x, bot.y - (bot.isBoss ? 28 : 20));

    if (bot.isBoss) {
      // Boss Health Bar (870 HP)
      const barW = 54;
      const barH = 5;
      const curHp = Math.max(0, bot.hp || 870);
      const hpPct = Math.min(1, curHp / 870);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(-barW / 2 - 1, -barH - 1, barW + 2, barH + 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-barW / 2, -barH, barW, barH);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(-barW / 2, -barH, barW * hpPct, barH);
      ctx.strokeStyle = '#d4a359';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barW / 2 - 1, -barH - 1, barW + 2, barH + 2);

      // Boss Label
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(`KILLA [BOSS] ${Math.round(curHp)}/870`, 1, -8);
      ctx.fillStyle = '#f1c40f';
      ctx.fillText(`KILLA [BOSS] ${Math.round(curHp)}/870`, 0, -9);
    } else if (bot.isGuard) {
      const curHp = Math.max(0, bot.hp || 250);
      ctx.font = 'bold 9px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(`GUARD [ELITE] ${Math.round(curHp)} HP`, 1, 1);
      ctx.fillStyle = '#9b59b6';
      ctx.fillText(`GUARD [ELITE] ${Math.round(curHp)} HP`, 0, 0);
    } else {
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(`${bot.name} [SCAV]`, 1, 1);
      ctx.fillStyle = (bot.state === 'ATTACK' || bot.state === 'COMBAT') ? '#e74c3c' : (bot.state === 'ALERT' ? '#f1c40f' : '#e67e22');
      ctx.fillText(`${bot.name} [SCAV]`, 0, 0);
    }

    // Overhead Speech Bubble (Voiceline Barks: "VON ON SUKA!", "CHIKI BRIKI!", "GRANATA!")
    if (bot.speechText) {
      const text = bot.speechText;
      ctx.font = 'bold 10px Consolas, monospace';
      const textWidth = ctx.measureText(text).width;
      const bubbleW = textWidth + 14;
      const bubbleH = 18;
      const bubbleY = bot.isBoss ? -34 : -24;

      ctx.save();
      ctx.translate(0, bubbleY);

      // Bubble background
      ctx.beginPath();
      ctx.roundRect(-bubbleW / 2, -bubbleH, bubbleW, bubbleH, [4]);
      ctx.fillStyle = 'rgba(15, 20, 26, 0.95)';
      ctx.fill();
      ctx.strokeStyle = (text.includes('GRANATA') || bot.isBoss) ? '#e74c3c' : '#f39c12';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Bubble tail pointer
      ctx.beginPath();
      ctx.moveTo(-3, 0); ctx.lineTo(0, 4); ctx.lineTo(3, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(15, 20, 26, 0.95)';
      ctx.fill();
      ctx.stroke();

      // Bubble text
      ctx.fillStyle = text.includes('GRANATA') ? '#ff4757' : '#f1c40f';
      ctx.textAlign = 'center';
      ctx.fillText(text, 0, -5);
      ctx.restore();
    }

    ctx.restore();
  }

  renderProceduralOperator(ctx, player, isLocal) {
    const px = player.x;
    const py = player.y;
    const angle = player.angle || 0;
    const squadColor = player.color || '#2ecc71';
    const isFiring = !!player.isFiring;

    ctx.save();
    ctx.translate(px, py);

    const device = player.tacticalDevice || (isLocal ? 'LASER' : 'OFF');

    if (device === 'LASER') {
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(34, -2);
      ctx.lineTo(380, -2);
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(380, -2, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3838';
      ctx.fill();
      ctx.restore();
    } else if (device === 'FLASHLIGHT') {
      ctx.save();
      ctx.rotate(angle);
      const grad = ctx.createRadialGradient(28, 0, 5, 220, 0, 240);
      grad.addColorStop(0, 'rgba(255, 255, 235, 0.55)');
      grad.addColorStop(0.8, 'rgba(255, 255, 230, 0.15)');
      grad.addColorStop(1, 'rgba(255, 255, 230, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(28, 0);
      ctx.arc(28, 0, 240, -0.32, 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.rotate(angle);

    ctx.beginPath();
    ctx.ellipse(-2, 2, 17, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    const uniformColor = player.isCrouching ? '#222822' : '#2d382e';
    const vestColor = '#1b221c';

    // Shoulders
    ctx.beginPath();
    ctx.ellipse(-3, 0, 10, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = uniformColor;
    ctx.fill();
    ctx.strokeStyle = '#151a16';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Plate carrier
    ctx.beginPath();
    ctx.roundRect(-7, -8, 12, 16, [3]);
    ctx.fillStyle = vestColor;
    ctx.fill();
    ctx.strokeStyle = '#101411';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Molle
    ctx.strokeStyle = '#29332a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -6); ctx.lineTo(3, -6);
    ctx.moveTo(-5, 0); ctx.lineTo(3, 0);
    ctx.moveTo(-5, 6); ctx.lineTo(3, 6);
    ctx.stroke();

    // Team Armband
    ctx.fillStyle = squadColor;
    ctx.fillRect(-6, -15, 4, 3);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-6, -15, 4, 3);

    // Arms
    ctx.fillStyle = uniformColor;
    ctx.beginPath();
    ctx.moveTo(-3, -12); ctx.lineTo(10, -11); ctx.lineTo(18, -4); ctx.lineTo(15, -1); ctx.lineTo(7, -8); ctx.lineTo(-3, -9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#151a16';
    ctx.stroke();

    ctx.fillStyle = '#1c1f24';
    ctx.beginPath();
    ctx.arc(17, -4, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = uniformColor;
    ctx.beginPath();
    ctx.moveTo(-3, 12); ctx.lineTo(8, 11); ctx.lineTo(13, 4); ctx.lineTo(10, 2); ctx.lineTo(6, 8); ctx.lineTo(-3, 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#151a16';
    ctx.stroke();

    ctx.fillStyle = '#1c1f24';
    ctx.beginPath();
    ctx.arc(12, 4, 3, 0, Math.PI * 2);
    ctx.fill();

    // RENDER ACTIVE WEAPON (M4A1, AK-74M, MP5, Mosin, Glock-17, Melee Hatchet)
    const wep = player.activeWeaponType || 'melee';
    let muzzleOffset = 38;
    let isFirearm = true;

    if (wep === 'melee') {
      isFirearm = false;
      // Tactical Hatchet in hands
      ctx.fillStyle = '#4a3728'; // Wooden/polymer shaft
      ctx.fillRect(10, -3, 14, 2.5);
      // Steel axe blade
      ctx.fillStyle = '#95a5a6';
      ctx.beginPath();
      ctx.moveTo(22, -8);
      ctx.lineTo(26, -3);
      ctx.lineTo(26, 3);
      ctx.lineTo(20, -1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (isFiring) {
        // Melee slash sweep visual
        ctx.strokeStyle = 'rgba(236, 240, 241, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(16, 0, 18, -Math.PI / 4, Math.PI / 4);
        ctx.stroke();
      }
    } else if (wep === 'glock17') {
      muzzleOffset = 22;
      // Compact Glock-17 Handgun
      ctx.fillStyle = '#14171a';
      ctx.fillRect(6, -1.5, 14, 3);
      ctx.fillStyle = '#222830';
      ctx.fillRect(8, -2, 10, 4);
    } else if (wep === 'ak74m') {
      muzzleOffset = 42;
      // Kalashnikov AK-74M Assault Rifle
      ctx.fillStyle = '#1b1f24';
      ctx.fillRect(2, -1.5, 8, 3);
      ctx.fillStyle = '#3d2516'; // Plum/wood handguard
      ctx.fillRect(10, -2, 10, 4);
      // Curved 5.45x39 Orange/Black Magazine
      ctx.fillStyle = '#d35400';
      ctx.beginPath();
      ctx.moveTo(9, 2); ctx.lineTo(13, 2); ctx.lineTo(15, 8); ctx.lineTo(11, 8);
      ctx.closePath();
      ctx.fill();
      // Gas tube & barrel
      ctx.fillStyle = '#242a33';
      ctx.fillRect(20, -2, 12, 4);
      ctx.fillStyle = '#121518';
      ctx.fillRect(32, -1, 6, 2);
      ctx.fillStyle = '#3a4450';
      ctx.fillRect(38, -2, 4, 4); // Distinct muzzle brake
    } else if (wep === 'mp5') {
      muzzleOffset = 28;
      // HK MP5 9x19 Submachine Gun
      ctx.fillStyle = '#181c22';
      ctx.fillRect(3, -2, 10, 4);
      // Curved 9mm stick mag
      ctx.fillStyle = '#29323d';
      ctx.beginPath();
      ctx.moveTo(10, 2); ctx.lineTo(12, 2); ctx.lineTo(13, 8); ctx.lineTo(11, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#121518';
      ctx.fillRect(13, -1.5, 11, 3);
      ctx.fillStyle = '#3d4754';
      ctx.fillRect(24, -2, 3, 4); // Front sight protective ring
    } else if (wep === 'goldentt') {
      muzzleOffset = 23;
      // Soviet Golden Tokarev TT-33 Pistol
      ctx.fillStyle = '#f1c40f'; // Bright gold slide
      ctx.fillRect(6, -1.5, 14, 3);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(8, -2, 11, 4);
      ctx.fillStyle = '#111417'; // Star grip panel
      ctx.fillRect(6, 1, 4, 3);
    } else if (wep === 'asval') {
      muzzleOffset = 42;
      // AS VAL 9x39 Silenced Assault Rifle
      ctx.fillStyle = '#16191d'; // Receiver
      ctx.fillRect(2, -2, 14, 4);
      // 9x39 Straight Polymer Mag
      ctx.fillStyle = '#222830';
      ctx.fillRect(10, 2, 4, 7);
      // Integrated Heavy Suppressor
      ctx.fillStyle = '#1c2126';
      ctx.fillRect(16, -3, 24, 6);
      ctx.strokeStyle = '#0e1013';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(16, -3, 24, 6);
      ctx.fillStyle = '#3a4450';
      ctx.fillRect(38, -2, 3, 4);
    } else if (wep === 'vss') {
      muzzleOffset = 44;
      // VSS Vintorez 9x39 Sniper Rifle (Wood skeleton stock + PSO-1 Optic)
      ctx.fillStyle = '#5c391f'; // Wooden skeleton sniper stock
      ctx.fillRect(1, -2, 10, 4);
      ctx.fillStyle = '#16191d';
      ctx.fillRect(10, -2, 8, 4);
      // PSO-1 Optical Scope
      ctx.fillStyle = '#2c3539';
      ctx.fillRect(10, -6, 10, 3);
      // Integrated Suppressor
      ctx.fillStyle = '#1c2126';
      ctx.fillRect(18, -3, 24, 6);
      ctx.strokeStyle = '#0e1013';
      ctx.strokeRect(18, -3, 24, 6);
    } else if (wep === 'vector') {
      muzzleOffset = 26;
      // Kriss Vector .45 ACP / 9mm CQB
      ctx.fillStyle = '#16191e';
      ctx.fillRect(3, -2.5, 14, 5);
      // Downward angled magwell & stick mag
      ctx.fillStyle = '#252d36';
      ctx.beginPath();
      ctx.moveTo(9, 2); ctx.lineTo(12, 2); ctx.lineTo(10, 9); ctx.lineTo(7, 9);
      ctx.closePath(); ctx.fill();
      // Short barrel shroud & vertical foregrip
      ctx.fillStyle = '#2f3844';
      ctx.fillRect(15, -2, 9, 4);
      ctx.fillStyle = '#111417';
      ctx.fillRect(14, 2, 3, 5);
    } else if (wep === 'mpx') {
      muzzleOffset = 30;
      // SIG MPX 9x19 CQB SMG
      ctx.fillStyle = '#181c22';
      ctx.fillRect(3, -2, 12, 4);
      // Translucent curved mag
      ctx.fillStyle = '#34495e';
      ctx.fillRect(10, 2, 3.5, 7);
      // MLOK handguard & birdcage muzzle
      ctx.fillStyle = '#28313d';
      ctx.fillRect(15, -2, 12, 4);
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(27, -2.5, 3, 5);
    } else if (wep === 'saiga12') {
      muzzleOffset = 40;
      // Saiga-12 12-Gauge Tactical Box-Fed Shotgun
      ctx.fillStyle = '#1a1d22';
      ctx.fillRect(2, -2, 14, 4);
      // Thick 12GA Box Magazine
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(9, 2, 6, 8);
      // Heavy Shotgun Barrel
      ctx.fillStyle = '#222830';
      ctx.fillRect(16, -2.5, 20, 5);
      ctx.fillStyle = '#111317';
      ctx.fillRect(36, -3, 4, 6); // Wide shotgun muzzle
    } else if (wep === 'rpk16') {
      muzzleOffset = 44;
      // RPK-16 5.45x39 Drum Magazine LMG
      ctx.fillStyle = '#1a1f26';
      ctx.fillRect(2, -2, 16, 4);
      // Large 95-Round Drum Magazine
      ctx.beginPath();
      ctx.arc(12, 5, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#12161c';
      ctx.fill();
      ctx.strokeStyle = '#2c3540';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Heavy fluted barrel & folded bipod
      ctx.fillStyle = '#28313d';
      ctx.fillRect(18, -1.5, 20, 3);
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(38, -2.5, 5, 5);
      ctx.fillStyle = '#718096';
      ctx.fillRect(32, 2, 6, 2);
    } else if (wep === 'mosin') {
      muzzleOffset = 46;
      // Mosin-Nagant 7.62x54R Bolt-Action Sniper Rifle
      ctx.fillStyle = '#5c391f'; // Long wooden stock
      ctx.fillRect(2, -2, 24, 4);
      ctx.fillStyle = '#16191c'; // Receiver & chamber
      ctx.fillRect(8, -2.5, 8, 5);
      ctx.fillStyle = '#bdc3c7'; // Silver turned-down bolt handle
      ctx.fillRect(9, -5, 2, 4);
      // Long steel barrel
      ctx.fillStyle = '#181b1e';
      ctx.fillRect(26, -1, 16, 2);
      ctx.fillStyle = '#3d4652';
      ctx.fillRect(42, -1.5, 3, 3); // Hooded front sight
    } else {
      // Colt M4A1 5.56x45 NATO Carbine
      muzzleOffset = 38;
      ctx.fillStyle = '#1a1d22';
      ctx.fillRect(2, -1, 6, 3);
      ctx.fillStyle = '#22272e';
      ctx.fillRect(8, -2, 10, 4);
      ctx.fillStyle = '#181b20';
      ctx.beginPath();
      ctx.moveTo(11, 2); ctx.lineTo(15, 2); ctx.lineTo(16, 7); ctx.lineTo(12, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2d333b';
      ctx.fillRect(18, -2.5, 11, 5);
      ctx.fillStyle = '#14171a';
      ctx.fillRect(29, -1, 7, 2);
      ctx.fillStyle = '#38424f';
      ctx.fillRect(35, -1.5, 3, 3);
    }

    // Muzzle flash on shot (firearms only)
    if (isFiring && isFirearm && muzzleOffset > 0) {
      ctx.save();
      ctx.translate(muzzleOffset, 0);
      ctx.fillStyle = 'rgba(255, 165, 2, 0.9)';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(14, -6); ctx.lineTo(8, -1); ctx.lineTo(18, 0); ctx.lineTo(8, 1); ctx.lineTo(14, 6); ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(2, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // FAST Helmet
    ctx.beginPath();
    ctx.arc(-2, 0, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = player.isCrouching ? '#2c362d' : '#3d4a3e';
    ctx.fill();
    ctx.strokeStyle = '#1e241f';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Wilcox NVG mount
    ctx.fillStyle = '#111417';
    ctx.fillRect(3.5, -2.5, 2.5, 5);

    if (player.isAiming) {
      ctx.strokeStyle = 'rgba(212, 163, 89, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(45, 0); ctx.lineTo(120, 0);
      ctx.stroke();
    }

    ctx.restore();

    // Overhead Callsign
    ctx.save();
    ctx.translate(px, py - 22);
    ctx.font = 'bold 11px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillText(player.name, 1, 1);
    ctx.fillStyle = squadColor;
    ctx.fillText(player.name, 0, 0);

    if (player.extractProgress && player.extractProgress > 0) {
      const barW = 34;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(-barW / 2, -14, barW, 4);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(-barW / 2, -14, barW * player.extractProgress, 4);
    }

    ctx.restore();
  }

  _renderInteractionPrompt(ctx, viewW, viewH, container) {
    const boxW = 280;
    const boxH = 42;
    const bx = viewW / 2 - boxW / 2;
    const by = viewH / 2 + 70;

    ctx.save();
    ctx.fillStyle = 'rgba(12, 16, 22, 0.9)';
    ctx.strokeStyle = '#d4a359';
    ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = '#d4a359';
    ctx.fillRect(bx, by, 4, boxH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`[F] SEARCH ${container.name.toUpperCase()}`, bx + 16, by + 18);

    ctx.fillStyle = '#788597';
    ctx.font = '10px Consolas, monospace';
    ctx.fillText(`CONTAINER: ${container.type.replace('_', ' ').toUpperCase()}`, bx + 16, by + 32);
    ctx.restore();
  }

  _renderTacticalVignette(ctx, w, h, isAiming) {
    const grad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * (isAiming ? 0.25 : 0.45),
      w / 2, h / 2, Math.max(w, h) * 0.75
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, isAiming ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Screen blood flash when player takes damage
    if (this.bloodFlashAlpha > 0.01) {
      ctx.fillStyle = `rgba(180, 20, 20, ${this.bloodFlashAlpha.toFixed(2)})`;
      ctx.fillRect(0, 0, w, h);
      this.bloodFlashAlpha *= 0.88; // Smooth fade out
    }
  }

  _renderGrenadeEntity(ctx, g) {
    ctx.save();

    // 1. Danger Blast Radius Warning Zone (Pulsing Red Area + Warning Dashes)
    const blastRad = g.blastRadius || 120;
    const pulseAlpha = 0.14 + 0.10 * Math.sin(Date.now() / 80);
    ctx.beginPath();
    ctx.arc(g.x, g.y, blastRad, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(231, 76, 60, ${pulseAlpha.toFixed(2)})`;
    ctx.fill();

    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Grenade Entity Sprite
    ctx.save();
    ctx.translate(g.x, g.y);

    // Drop shadow
    ctx.beginPath();
    ctx.ellipse(2, 3, 5, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // Olive Drab Frag Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.5, 3.5, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#344933';
    ctx.fill();
    ctx.strokeStyle = '#1b261a';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Silver Fuse Cap & Safety Spoon
    ctx.fillStyle = '#bdc3c7';
    ctx.fillRect(-1.5, -5.5, 3, 2.5);
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-1.5, -5.5, 3, 2.5);

    ctx.restore();

    // 3. Danger Countdown Timer
    ctx.fillStyle = '#ff4757';
    ctx.font = 'bold 9px Consolas, monospace';
    ctx.textAlign = 'center';
    const fuseSec = Math.max(0, g.fuseTime || 0).toFixed(1);
    ctx.fillText(`⚠️ ${fuseSec}s [GRENADE]`, g.x, g.y - 10);

    ctx.restore();
  }
}
