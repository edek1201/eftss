/**
 * EFT Tactical 2D - Authoritative Physics & Collision Engine
 * Shared between Server (Authoritative 20Hz) and Client (Prediction & Lerp)
 */

export const PHYSICS_CONFIG = {
  PLAYER_RADIUS: 14,          // 14px circle hitbox
  TILE_SIZE: 32,              // 32x32px tiles
  WALK_SPEED: 175,            // px/sec normal tactical walk
  SPRINT_SPEED: 280,          // px/sec sprint
  CROUCH_SPEED: 80,           // px/sec crouch / slow walk
  ACCELERATION: 1500,         // px/sec^2
  DECELERATION: 1800,         // px/sec^2 friction when releasing keys
  MAX_STAMINA: 100,
  STAMINA_DRAIN_SPRINT: 24,   // stamina / sec
  STAMINA_RECHARGE_IDLE: 16,  // stamina / sec standing still
  STAMINA_RECHARGE_WALK: 8,   // stamina / sec while walking
  STAMINA_MIN_TO_SPRINT: 8,   // minimum stamina to initiate sprint
  FOV_NORMAL: Math.PI / 2,    // 90 degrees
  FOV_ADS: Math.PI / 4,       // 45 degrees
  VIEW_DIST_NORMAL: 380,      // pixels visibility distance
  VIEW_DIST_ADS: 494          // +30% visibility distance on ADS
};

/**
 * Resolves Circle vs Axis-Aligned Bounding Box (AABB) with sliding.
 * Pushes the circle out of the tile and removes velocity along the contact normal.
 */
export function resolveCircleVsTile(circle, tileX, tileY, tileSize) {
  const minX = tileX * tileSize;
  const maxX = minX + tileSize;
  const minY = tileY * tileSize;
  const maxY = minY + tileSize;

  // Find closest point on AABB to circle center
  const clampedX = Math.max(minX, Math.min(circle.x, maxX));
  const clampedY = Math.max(minY, Math.min(circle.y, maxY));

  let dx = circle.x - clampedX;
  let dy = circle.y - clampedY;
  const distSq = dx * dx + dy * dy;
  const r = circle.radius;

  if (distSq < r * r) {
    let dist = Math.sqrt(distSq);
    let normalX = 0;
    let normalY = 0;
    let penetration = 0;

    if (dist > 0.0001) {
      normalX = dx / dist;
      normalY = dy / dist;
      penetration = r - dist;
    } else {
      // Circle center is precisely inside the tile (fallback to push outward along nearest edge)
      const centerTileX = minX + tileSize / 2;
      const centerTileY = minY + tileSize / 2;
      const ox = circle.x - centerTileX;
      const oy = circle.y - centerTileY;
      if (Math.abs(ox) > Math.abs(oy)) {
        normalX = ox >= 0 ? 1 : -1;
        normalY = 0;
        penetration = r;
      } else {
        normalX = 0;
        normalY = oy >= 0 ? 1 : -1;
        penetration = r;
      }
    }

    // Push out circle
    circle.x += normalX * penetration;
    circle.y += normalY * penetration;

    // Eliminate velocity component directed into the wall (wall sliding)
    const dot = circle.vx * normalX + circle.vy * normalY;
    if (dot < 0) {
      circle.vx -= dot * normalX;
      circle.vy -= dot * normalY;
    }

    return true;
  }
  return false;
}

/**
 * Resolves player circle collisions with all solid tiles in spatial range.
 * Iterates twice for robust corner sliding.
 */
export function resolveMapCollisions(player, map) {
  const r = player.radius || PHYSICS_CONFIG.PLAYER_RADIUS;
  const ts = map.tileSize || PHYSICS_CONFIG.TILE_SIZE;

  const minTX = Math.max(0, Math.floor((player.x - r - 2) / ts));
  const maxTX = Math.min(map.width - 1, Math.floor((player.x + r + 2) / ts));
  const minTY = Math.max(0, Math.floor((player.y - r - 2) / ts));
  const maxTY = Math.min(map.height - 1, Math.floor((player.y + r + 2) / ts));

  // 2-pass relaxation to prevent sticking on tile corners
  for (let pass = 0; pass < 2; pass++) {
    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (map.isSolid(tx, ty)) {
          resolveCircleVsTile(player, tx, ty, ts);
        }
      }
    }
  }

  // Map world boundary clamp
  const worldW = map.width * ts;
  const worldH = map.height * ts;
  if (player.x < r) { player.x = r; player.vx = Math.max(0, player.vx); }
  if (player.x > worldW - r) { player.x = worldW - r; player.vx = Math.min(0, player.vx); }
  if (player.y < r) { player.y = r; player.vy = Math.max(0, player.vy); }
  if (player.y > worldH - r) { player.y = worldH - r; player.vy = Math.min(0, player.vy); }
}

/**
 * Updates a player entity for duration dt (seconds) given an input payload.
 * Authoritative on server, predicted on client.
 */
export function updatePlayerMovement(player, input, dt, map) {
  // Input vector normalization
  let ix = input.moveX || 0;
  let iy = input.moveY || 0;
  const len = Math.hypot(ix, iy);
  if (len > 0) {
    ix /= len;
    iy /= len;
  }

  // Manage Crouch vs Sprint states
  const isCrouching = !!input.isCrouching;
  let isSprinting = false;

  // Painkiller duration update
  if (player.painkillerTimer && player.painkillerTimer > 0) {
    player.painkillerTimer = Math.max(0, player.painkillerTimer - dt);
  }

  // Check fractured or blacked leg penalties
  const hasLegInjury = player.health && ((player.health.leftLeg || 0) <= 0 || (player.health.rightLeg || 0) <= 0);
  const onPainkillers = (player.painkillerTimer && player.painkillerTimer > 0);

  if (input.isSprinting && !isCrouching && len > 0 && player.stamina >= PHYSICS_CONFIG.STAMINA_MIN_TO_SPRINT) {
    if (!hasLegInjury || onPainkillers) {
      isSprinting = true;
    }
  }

  // Target speed selection
  let targetSpeed = PHYSICS_CONFIG.WALK_SPEED;
  if (isSprinting) {
    targetSpeed = PHYSICS_CONFIG.SPRINT_SPEED;
  } else if (isCrouching) {
    targetSpeed = PHYSICS_CONFIG.CROUCH_SPEED;
  }

  // Apply leg injury penalty if not on active painkillers
  if (hasLegInjury && !onPainkillers) {
    targetSpeed *= 0.55;
  }

  // Target velocity vector
  const targetVx = ix * targetSpeed;
  const targetVy = iy * targetSpeed;

  // Smooth acceleration / friction
  const accelRate = (len > 0) ? PHYSICS_CONFIG.ACCELERATION : PHYSICS_CONFIG.DECELERATION;
  const diffVx = targetVx - player.vx;
  const diffVy = targetVy - player.vy;
  const diffLen = Math.hypot(diffVx, diffVy);

  if (diffLen > 0) {
    const step = accelRate * dt;
    if (diffLen <= step) {
      player.vx = targetVx;
      player.vy = targetVy;
    } else {
      player.vx += (diffVx / diffLen) * step;
      player.vy += (diffVy / diffLen) * step;
    }
  }

  // Stamina update
  if (isSprinting && len > 0) {
    player.stamina = Math.max(0, player.stamina - PHYSICS_CONFIG.STAMINA_DRAIN_SPRINT * dt);
    if (player.stamina === 0) {
      isSprinting = false;
    }
  } else {
    const rechargeRate = (len > 0)
      ? PHYSICS_CONFIG.STAMINA_RECHARGE_WALK
      : PHYSICS_CONFIG.STAMINA_RECHARGE_IDLE;
    player.stamina = Math.min(PHYSICS_CONFIG.MAX_STAMINA, player.stamina + rechargeRate * dt);
  }

  // Integrate position
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Collision handling with wall sliding
  if (map) {
    resolveMapCollisions(player, map);
  }

  // Rotation tracking
  if (typeof input.angle === 'number' && !isNaN(input.angle)) {
    player.angle = input.angle;
  }

  player.isSprinting = isSprinting;
  player.isCrouching = isCrouching;
  player.isAiming = !!input.isAiming;
}

/**
 * Standard scalar linear interpolation.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Angular interpolation handling wrapping across +/- PI.
 */
export function angleLerp(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}
