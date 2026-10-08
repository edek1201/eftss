/**
 * EFT Tactical 2D - Realistic Scale Maps & Scav Patrol Zones
 * Factory, Customs, Reserve, and Streets of Tarkov map layouts.
 */

export const TILE_TYPES = {
  FLOOR_CONCRETE: 0,
  WALL_SOLID: 1,
  WALL_CONTAINER: 2,
  COVER_CRATE: 3,
  DOOR_FRAME: 4,
  METAL_GRATE: 5,
  FLOOR_OFFICE: 6,
  FORKLIFT_PROP: 7,
  BLAST_DOOR: 8,
  RAILROAD_TRACK: 9,
  ROAD_ASPHALT: 10
};

export const MAP_CONFIGS = {
  factory: {
    id: "factory",
    name: "Factory (Chemical Plant)",
    width: 80,
    height: 80,
    tileSize: 32, // 2560 x 2560 px
    cqbTag: "HARDCORE CQB (80x80)",
    scavCount: 14,
    description: "Multi-level chemical manufacturing facility: 3-story office wing, reactor hall, catacombs, chemical tanks, and multiple extracts."
  },
  warehouse: {
    id: "warehouse",
    name: "Customs (Logistics Terminal)",
    width: 120,
    height: 120,
    tileSize: 32, // 3840 x 3840 px
    cqbTag: "EXPANSIVE INDUSTRIAL (120x120)",
    scavCount: 18,
    description: "Massive industrial freight station: railway loading tracks, multi-story dorms, construction choke point, and warehouses."
  },
  bunker: {
    id: "bunker",
    name: "Reserve (Command Bunker)",
    width: 100,
    height: 100,
    tileSize: 32, // 3200 x 3200 px
    cqbTag: "DEEP SUBTERRANEAN (100x100)",
    scavCount: 16,
    description: "Subterranean military bunker complex: blast doors, turbine halls, server vaults, D-2 tunnel, and hermetic door extract."
  },
  streets: {
    id: "streets",
    name: "Streets of Tarkov (Residential District)",
    width: 140,
    height: 140,
    tileSize: 32,
    cqbTag: "URBAN COMBAT (140x140)",
    scavCount: 20,
    description: "Dense Norvinsk city blocks, apartment courtyards, a medical clinic, a central boulevard, and dangerous urban extracts."
  }
};

export class TacticalMap {
  constructor(mapId = "factory") {
    this.mapId = MAP_CONFIGS[mapId] ? mapId : "factory";
    const cfg = MAP_CONFIGS[this.mapId];

    this.id = cfg.id;
    this.name = cfg.name;
    this.width = cfg.width;
    this.height = cfg.height;
    this.tileSize = cfg.tileSize;
    this.cqbTag = cfg.cqbTag;
    this.scavCount = cfg.scavCount;
    this.description = cfg.description;

    this.grid = new Uint8Array(this.width * this.height);
    this.extractZones = [];
    this.spawnPoints = [];
    this.containers = [];
    this.scavSpawnZones = [];

    this._generateMapData();
  }

  _generateMapData() {
    if (this.mapId === "factory") {
      this._buildFactory80();
    } else if (this.mapId === "warehouse") {
      this._buildWarehouse120();
    } else if (this.mapId === "bunker") {
      this._buildBunker100();
    } else if (this.mapId === "streets") {
      this._buildStreets140();
    }
  }

  _setTile(x, y, type) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y * this.width + x] = type;
    }
  }

  _fillBox(x1, y1, w, h, type) {
    for (let y = y1; y < y1 + h; y++) {
      for (let x = x1; x < x1 + w; x++) {
        this._setTile(x, y, type);
      }
    }
  }

  _drawHWall(x1, y, w, type = TILE_TYPES.WALL_SOLID) {
    for (let x = x1; x < x1 + w; x++) this._setTile(x, y, type);
  }

  _drawVWall(x, y1, h, type = TILE_TYPES.WALL_SOLID) {
    for (let y = y1; y < y1 + h; y++) this._setTile(x, y, type);
  }

  /**
   * FACTORY 60x60 (1920 x 1920 px)
   * Large authentic chemical plant with distinct zones:
   * - 3-Story Administrative Office Wing (North)
   * - Central Processing Silo & Catwalk Hall (Center)
   * - Underground Tunnel Network (West & South)
   * - Pumping Station & Shipping Container Yard (East)
   */
  /**
   * FACTORY 80x80 (2560 x 2560 px)
   * Authentic multi-level chemical complex with extensive tactical CQB zones:
   * - 3-Story Executive & Administrative Office Wing (North)
   * - Central Chemical Reactor & High Catwalk Silo (Center)
   * - West Shipping Container Yard & Forklift Bay
   * - East Pumping & Chemical Synthesis Station
   * - South Subterranean Drainage Tunnel Network
   */
  _buildFactory80() {
    this.grid.fill(TILE_TYPES.FLOOR_CONCRETE);

    // Outer Perimeter Solid Concrete Walls (80x80)
    this._drawHWall(0, 0, 80);
    this._drawHWall(0, 79, 80);
    this._drawVWall(0, 0, 80);
    this._drawVWall(79, 0, 80);

    // 1. NORTH 3-STORY OFFICE COMPLEX (x: 2 to 77, y: 2 to 18)
    this._fillBox(2, 2, 76, 16, TILE_TYPES.FLOOR_OFFICE);
    this._drawHWall(2, 18, 76, TILE_TYPES.WALL_SOLID);
    // Vertical office dividers with tactical doorways
    for (let ox = 14; ox <= 66; ox += 13) {
      this._drawVWall(ox, 2, 16, TILE_TYPES.WALL_SOLID);
      this._setTile(ox, 8, TILE_TYPES.DOOR_FRAME);
      this._setTile(ox, 14, TILE_TYPES.DOOR_FRAME);
    }
    // Main hallway breeches into factory floor
    this._setTile(8, 18, TILE_TYPES.DOOR_FRAME);
    this._setTile(28, 18, TILE_TYPES.DOOR_FRAME);
    this._setTile(48, 18, TILE_TYPES.DOOR_FRAME);
    this._setTile(68, 18, TILE_TYPES.DOOR_FRAME);

    // 2. CENTRAL CHEMICAL REACTOR HALL & CATWALKS (x: 24 to 56, y: 26 to 54)
    this._fillBox(24, 26, 32, 28, TILE_TYPES.METAL_GRATE);
    this._drawHWall(24, 26, 32, TILE_TYPES.WALL_SOLID);
    this._drawHWall(24, 54, 32, TILE_TYPES.WALL_SOLID);
    this._drawVWall(24, 26, 29, TILE_TYPES.WALL_SOLID);
    this._drawVWall(55, 26, 29, TILE_TYPES.WALL_SOLID);

    // Reactor Hall Entrances
    this._setTile(24, 40, TILE_TYPES.DOOR_FRAME);
    this._setTile(55, 40, TILE_TYPES.DOOR_FRAME);
    this._setTile(40, 26, TILE_TYPES.DOOR_FRAME);
    this._setTile(40, 54, TILE_TYPES.DOOR_FRAME);

    // Chemical Reaction Vats & Concrete Pillars inside Silo
    this._fillBox(30, 32, 4, 4, TILE_TYPES.WALL_SOLID);
    this._fillBox(46, 32, 4, 4, TILE_TYPES.WALL_SOLID);
    this._fillBox(30, 44, 4, 4, TILE_TYPES.WALL_SOLID);
    this._fillBox(46, 44, 4, 4, TILE_TYPES.WALL_SOLID);

    // 3. WEST SHIPPING CONTAINER DEPOT (x: 4 to 20, y: 24 to 58)
    this._fillBox(5, 24, 10, 4, TILE_TYPES.WALL_CONTAINER);
    this._fillBox(5, 34, 10, 4, TILE_TYPES.WALL_CONTAINER);
    this._fillBox(5, 44, 10, 4, TILE_TYPES.WALL_CONTAINER);
    this._fillBox(5, 54, 10, 4, TILE_TYPES.WALL_CONTAINER);
    this._setTile(18, 30, TILE_TYPES.FORKLIFT_PROP);
    this._setTile(18, 50, TILE_TYPES.FORKLIFT_PROP);

    // 4. EAST PUMPING & CHEMICAL SYNTHESIS (x: 60 to 76, y: 24 to 58)
    this._drawHWall(60, 24, 17, TILE_TYPES.WALL_SOLID);
    this._drawHWall(60, 58, 17, TILE_TYPES.WALL_SOLID);
    this._drawVWall(60, 24, 35, TILE_TYPES.WALL_SOLID);
    this._setTile(60, 38, TILE_TYPES.DOOR_FRAME);
    this._fillBox(65, 30, 6, 4, TILE_TYPES.COVER_CRATE);
    this._fillBox(65, 46, 6, 4, TILE_TYPES.COVER_CRATE);
    this._setTile(62, 52, TILE_TYPES.FORKLIFT_PROP);

    // 5. SOUTH SUBTERRANEAN DRAINAGE TUNNELS (x: 8 to 72, y: 64 to 76)
    this._drawHWall(8, 64, 64, TILE_TYPES.WALL_SOLID);
    this._drawVWall(8, 64, 12, TILE_TYPES.WALL_SOLID);
    this._drawVWall(72, 64, 12, TILE_TYPES.WALL_SOLID);
    this._setTile(20, 64, TILE_TYPES.DOOR_FRAME);
    this._setTile(40, 64, TILE_TYPES.DOOR_FRAME);
    this._setTile(60, 64, TILE_TYPES.DOOR_FRAME);
    this._fillBox(14, 68, 52, 2, TILE_TYPES.METAL_GRATE);

    // Extractions
    this.extractZones = [
      {
        id: "gate_3",
        name: "Gate 3 (Cellar Bunker)",
        tileX: 72, tileY: 72, tileW: 6, tileH: 6,
        color: "rgba(46, 204, 113, 0.35)", border: "#2ecc71"
      },
      {
        id: "gate_0",
        name: "Gate 0 (Keycard Exit)",
        tileX: 72, tileY: 2, tileW: 6, tileH: 6,
        color: "rgba(241, 196, 15, 0.35)", border: "#f1c40f"
      },
      {
        id: "cellars",
        name: "Cellars Drainage Pipe",
        tileX: 2, tileY: 72, tileW: 6, tileH: 6,
        color: "rgba(52, 152, 219, 0.35)", border: "#3498db"
      }
    ];

    // PMC Spawn Points (NW Corridor)
    this.spawnPoints = [
      { x: 6 * 32 + 16, y: 22 * 32 + 16, angle: 0 },
      { x: 7 * 32 + 16, y: 22 * 32 + 16, angle: 0 },
      { x: 6 * 32 + 16, y: 23 * 32 + 16, angle: 0 },
      { x: 7 * 32 + 16, y: 23 * 32 + 16, angle: 0 }
    ];

    // In-Raid Containers (6 strategic locations)
    this.containers = [
      {
        id: "fact_office_safe",
        type: "crate_military",
        name: "3rd Floor Office Weapon Case",
        x: 42 * 32 + 16, y: 6 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "fact_silo_dead_scav",
        type: "corpse_scav",
        name: "Deceased Chemical Worker",
        x: 40 * 32 + 16, y: 40 * 32 + 16,
        gridW: 3, gridH: 3
      },
      {
        id: "fact_west_ammo",
        type: "ammo_box",
        name: "West Container Yard Ammo Pallet",
        x: 10 * 32 + 16, y: 38 * 32 + 16,
        gridW: 2, gridH: 2
      },
      {
        id: "fact_pump_med",
        type: "med_bag",
        name: "Pumping Complex Trauma Bag",
        x: 68 * 32 + 16, y: 38 * 32 + 16,
        gridW: 2, gridH: 2
      },
      {
        id: "fact_tunnel_crate",
        type: "crate_military",
        name: "Drainage Tunnel Contraband Stash",
        x: 40 * 32 + 16, y: 70 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "fact_gate3_crate",
        type: "crate_military",
        name: "Gate 3 Heavy Supply Chest",
        x: 74 * 32 + 16, y: 74 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "fact_office_med_cache",
        type: "med_bag",
        name: "West Office First-Aid Cabinet",
        x: 8 * 32 + 16, y: 10 * 32 + 16,
        gridW: 3, gridH: 3
      },
      {
        id: "fact_reactor_cache",
        type: "crate_military",
        name: "Reactor Maintenance Locker",
        x: 37 * 32 + 16, y: 38 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "fact_pump_ammo_cache",
        type: "ammo_box",
        name: "Pumping Station Ammo Box",
        x: 72 * 32 + 16, y: 34 * 32 + 16,
        gridW: 3, gridH: 3
      }
    ];

    // Scav Bot Patrol Spawn Waypoints (12 Scavs across all sectors)
    this.scavSpawnZones = [
      { x: 20 * 32, y: 10 * 32, zone: "Office West Wing", radius: 140 },
      { x: 60 * 32, y: 10 * 32, zone: "Office Executive Suites", radius: 140 },
      { x: 40 * 32, y: 34 * 32, zone: "Chemical Reactor Vats", radius: 160 },
      { x: 40 * 32, y: 46 * 32, zone: "Reactor Hall Floor", radius: 160 },
      { x: 10 * 32, y: 30 * 32, zone: "West Container Depot North", radius: 160 },
      { x: 10 * 32, y: 48 * 32, zone: "West Container Depot South", radius: 160 },
      { x: 68 * 32, y: 32 * 32, zone: "East Pumping Synthesis Bay", radius: 160 },
      { x: 68 * 32, y: 50 * 32, zone: "East Generator Tanks", radius: 160 },
      { x: 25 * 32, y: 68 * 32, zone: "Subterranean Drainage West", radius: 150 },
      { x: 55 * 32, y: 68 * 32, zone: "Subterranean Drainage East", radius: 150 },
      { x: 70 * 32, y: 68 * 32, zone: "Gate 3 Bunker Approach", radius: 140 },
      { x: 30 * 32, y: 22 * 32, zone: "Factory Main Catwalk Staging", radius: 150 }
    ];
  }

  /**
   * CUSTOMS / WAREHOUSE 120x120 (3840 x 3840 px)
   * Expansive industrial district with long sightlines and tactical choke points:
   * - Long Rail Yard Line traversing east-west
   * - 4 Main Freight Warehouses (Storage & Logistics)
   * - 3-Story North Dormitory Complex
   * - Central Construction Chokepoint & Crane
   * - Customs Crossroads Checkpoint & ZB-1011 Bunker
   */
  _buildWarehouse120() {
    this.grid.fill(TILE_TYPES.FLOOR_CONCRETE);

    // Outer Perimeter Solid Barriers (120x120)
    this._drawHWall(0, 0, 120);
    this._drawHWall(0, 119, 120);
    this._drawVWall(0, 0, 120);
    this._drawVWall(119, 0, 120);

    // Railway Line across y: 84 to 88
    this._fillBox(2, 84, 116, 5, TILE_TYPES.RAILROAD_TRACK);

    // North 3-Story Dorms (x: 48 to 72, y: 6 to 26)
    this._fillBox(48, 6, 24, 20, TILE_TYPES.FLOOR_OFFICE);
    this._drawHWall(48, 6, 24, TILE_TYPES.WALL_SOLID);
    this._drawHWall(48, 26, 24, TILE_TYPES.WALL_SOLID);
    this._drawVWall(48, 6, 21, TILE_TYPES.WALL_SOLID);
    this._drawVWall(71, 6, 21, TILE_TYPES.WALL_SOLID);
    for (let dy = 11; dy <= 21; dy += 5) {
      this._drawHWall(48, dy, 24, TILE_TYPES.WALL_SOLID);
      this._setTile(54, dy, TILE_TYPES.DOOR_FRAME);
      this._setTile(66, dy, TILE_TYPES.DOOR_FRAME);
    }
    this._setTile(60, 26, TILE_TYPES.DOOR_FRAME);

    // Warehouse 1 (NW: x: 10 to 44, y: 10 to 36)
    this._fillBox(10, 10, 34, 26, TILE_TYPES.FLOOR_CONCRETE);
    this._drawHWall(10, 10, 34, TILE_TYPES.WALL_SOLID);
    this._drawHWall(10, 36, 34, TILE_TYPES.WALL_SOLID);
    this._drawVWall(10, 10, 27, TILE_TYPES.WALL_SOLID);
    this._drawVWall(44, 10, 27, TILE_TYPES.WALL_SOLID);
    this._setTile(27, 36, TILE_TYPES.DOOR_FRAME);
    this._setTile(44, 22, TILE_TYPES.DOOR_FRAME);
    // Industrial racks inside Warehouse 1
    for (let r = 16; r <= 30; r += 5) {
      this._fillBox(16, r, 22, 2, TILE_TYPES.COVER_CRATE);
    }

    // Warehouse 2 (NE: x: 76 to 110, y: 10 to 36)
    this._drawHWall(76, 10, 34, TILE_TYPES.WALL_SOLID);
    this._drawHWall(76, 36, 34, TILE_TYPES.WALL_SOLID);
    this._drawVWall(76, 10, 27, TILE_TYPES.WALL_SOLID);
    this._drawVWall(110, 10, 27, TILE_TYPES.WALL_SOLID);
    this._setTile(93, 36, TILE_TYPES.DOOR_FRAME);
    this._setTile(76, 22, TILE_TYPES.DOOR_FRAME);
    this._fillBox(80, 14, 26, 18, TILE_TYPES.FLOOR_OFFICE);

    // Central Construction Chokepoint & Crane (x: 48 to 72, y: 36 to 78)
    this._fillBox(50, 40, 8, 12, TILE_TYPES.WALL_CONTAINER);
    this._fillBox(62, 40, 8, 12, TILE_TYPES.WALL_CONTAINER);
    this._fillBox(50, 60, 8, 12, TILE_TYPES.WALL_CONTAINER);
    this._fillBox(62, 60, 8, 12, TILE_TYPES.WALL_CONTAINER);
    this._setTile(60, 50, TILE_TYPES.FORKLIFT_PROP);
    this._fillBox(56, 54, 8, 4, TILE_TYPES.COVER_CRATE);

    // Warehouse 3 (SW: x: 10 to 44, y: 48 to 76)
    this._drawHWall(10, 48, 34, TILE_TYPES.WALL_SOLID);
    this._drawHWall(10, 76, 34, TILE_TYPES.WALL_SOLID);
    this._drawVWall(10, 48, 29, TILE_TYPES.WALL_SOLID);
    this._drawVWall(44, 48, 29, TILE_TYPES.WALL_SOLID);
    this._setTile(27, 48, TILE_TYPES.DOOR_FRAME);
    this._setTile(27, 76, TILE_TYPES.DOOR_FRAME);

    // Warehouse 4 (SE: x: 76 to 110, y: 48 to 76)
    this._drawHWall(76, 48, 34, TILE_TYPES.WALL_SOLID);
    this._drawHWall(76, 76, 34, TILE_TYPES.WALL_SOLID);
    this._drawVWall(76, 48, 29, TILE_TYPES.WALL_SOLID);
    this._drawVWall(110, 48, 29, TILE_TYPES.WALL_SOLID);
    this._setTile(93, 48, TILE_TYPES.DOOR_FRAME);
    this._setTile(93, 76, TILE_TYPES.DOOR_FRAME);

    // Extractions
    this.extractZones = [
      {
        id: "zb_1011",
        name: "ZB-1011 Bunker",
        tileX: 108, tileY: 108, tileW: 8, tileH: 8,
        color: "rgba(46, 204, 113, 0.35)", border: "#2ecc71"
      },
      {
        id: "crossroads",
        name: "Crossroads Extract",
        tileX: 2, tileY: 2, tileW: 8, tileH: 8,
        color: "rgba(241, 196, 15, 0.35)", border: "#f1c40f"
      },
      {
        id: "trailer_park",
        name: "Trailer Park Logistics",
        tileX: 2, tileY: 108, tileW: 8, tileH: 8,
        color: "rgba(52, 152, 219, 0.35)", border: "#3498db"
      }
    ];

    this.spawnPoints = [
      { x: 8 * 32 + 16, y: 96 * 32 + 16, angle: 0 },
      { x: 9 * 32 + 16, y: 96 * 32 + 16, angle: 0 },
      { x: 8 * 32 + 16, y: 97 * 32 + 16, angle: 0 },
      { x: 9 * 32 + 16, y: 97 * 32 + 16, angle: 0 }
    ];

    this.containers = [
      {
        id: "cust_dorms_weapon",
        type: "crate_military",
        name: "3-Story Dorms Marked Weapon Crate",
        x: 60 * 32 + 16, y: 18 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "cust_wh4_military",
        type: "crate_military",
        name: "Warehouse 4 Weapon Stash",
        x: 93 * 32 + 16, y: 62 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "cust_rail_corpse",
        type: "corpse_scav",
        name: "Dead Railway Sniper",
        x: 60 * 32 + 16, y: 86 * 32 + 16,
        gridW: 3, gridH: 3
      },
      {
        id: "cust_admin_safe",
        type: "crate_military",
        name: "Admin Office Logistics Safe",
        x: 93 * 32 + 16, y: 22 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "cust_wh1_ammo",
        type: "ammo_box",
        name: "Freight Ammo Pallet",
        x: 27 * 32 + 16, y: 24 * 32 + 16,
        gridW: 2, gridH: 2
      },
      {
        id: "cust_crossroads_med",
        type: "med_bag",
        name: "Guard Post Medical Bag",
        x: 8 * 32 + 16, y: 8 * 32 + 16,
        gridW: 2, gridH: 2
      },
      {
        id: "cust_wh2_tool_cache",
        type: "crate_military",
        name: "Warehouse 2 Tool Crate",
        x: 90 * 32 + 16, y: 30 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "cust_rail_supply_cache",
        type: "ammo_box",
        name: "Railway Signalman's Supply Box",
        x: 72 * 32 + 16, y: 96 * 32 + 16,
        gridW: 3, gridH: 3
      },
      {
        id: "cust_wh3_med_cache",
        type: "med_bag",
        name: "Warehouse 3 Trauma Kit",
        x: 36 * 32 + 16, y: 62 * 32 + 16,
        gridW: 3, gridH: 3
      }
    ];

    // Scav Bot Patrol Spawn Waypoints (16 Scavs)
    this.scavSpawnZones = [
      { x: 60 * 32, y: 16 * 32, zone: "3-Story Dorms Complex", radius: 180 },
      { x: 26 * 32, y: 24 * 32, zone: "Warehouse 1 Storage Bay", radius: 180 },
      { x: 36 * 32, y: 36 * 32, zone: "Warehouse 1 Loading Yard", radius: 180 },
      { x: 92 * 32, y: 24 * 32, zone: "Admin Office Annex", radius: 180 },
      { x: 100 * 32, y: 36 * 32, zone: "Warehouse 2 Freight Yard", radius: 180 },
      { x: 60 * 32, y: 46 * 32, zone: "Construction Zone North", radius: 200 },
      { x: 60 * 32, y: 66 * 32, zone: "Construction Zone South", radius: 200 },
      { x: 26 * 32, y: 62 * 32, zone: "Warehouse 3 Floor", radius: 180 },
      { x: 92 * 32, y: 62 * 32, zone: "Warehouse 4 Bay", radius: 180 },
      { x: 24 * 32, y: 86 * 32, zone: "West Railway Tracks", radius: 220 },
      { x: 60 * 32, y: 86 * 32, zone: "Central Railway Crossing", radius: 220 },
      { x: 96 * 32, y: 86 * 32, zone: "East Railway Platform", radius: 220 },
      { x: 104 * 32, y: 102 * 32, zone: "ZB-1011 Perimeter", radius: 180 },
      { x: 16 * 32, y: 102 * 32, zone: "Trailer Park Approach", radius: 180 },
      { x: 16 * 32, y: 16 * 32, zone: "Crossroads Outpost", radius: 180 },
      { x: 60 * 32, y: 104 * 32, zone: "Southern Perimeter Trench", radius: 180 }
    ];
  }

  /**
   * RESERVE BUNKER 100x100 (3200 x 3200 px)
   * Deep subterranean military complex with blast doors and heavy cover:
   * - Subterranean Central Command Complex
   * - Turbine Generator Hall (NW)
   * - Classified Server & Tech Vault (NE)
   * - Medical Triage Bay (SW)
   * - D-2 Subterranean Extraction Corridor (SE)
   */
  _buildBunker100() {
    this.grid.fill(TILE_TYPES.WALL_SOLID);

    // Central Command Hub (x: 34 to 66, y: 34 to 66)
    this._fillBox(34, 34, 32, 32, TILE_TYPES.FLOOR_CONCRETE);

    // Command room consoles & tactical tables
    this._fillBox(40, 40, 8, 4, TILE_TYPES.COVER_CRATE);
    this._fillBox(52, 40, 8, 4, TILE_TYPES.COVER_CRATE);
    this._fillBox(40, 56, 8, 4, TILE_TYPES.COVER_CRATE);
    this._fillBox(52, 56, 8, 4, TILE_TYPES.COVER_CRATE);

    // Main Corridors (Width 6)
    this._fillBox(47, 8, 6, 26, TILE_TYPES.FLOOR_CONCRETE); // North
    this._fillBox(47, 66, 6, 26, TILE_TYPES.FLOOR_CONCRETE); // South
    this._fillBox(8, 47, 26, 6, TILE_TYPES.FLOOR_CONCRETE); // West
    this._fillBox(66, 47, 26, 6, TILE_TYPES.FLOOR_CONCRETE); // East

    // Outer Ring Corridor (Width 6)
    this._fillBox(10, 10, 80, 6, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(10, 84, 80, 6, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(10, 10, 6, 80, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(84, 10, 6, 80, TILE_TYPES.FLOOR_CONCRETE);

    // Metal Grate Water Drainage Channels
    this._fillBox(49, 10, 2, 80, TILE_TYPES.METAL_GRATE);
    this._fillBox(10, 49, 80, 2, TILE_TYPES.METAL_GRATE);

    // Hermetic Blast Doors on Corridors
    this._setTile(47, 33, TILE_TYPES.BLAST_DOOR);
    this._setTile(52, 33, TILE_TYPES.BLAST_DOOR);
    this._setTile(47, 66, TILE_TYPES.BLAST_DOOR);
    this._setTile(52, 66, TILE_TYPES.BLAST_DOOR);
    this._setTile(33, 47, TILE_TYPES.BLAST_DOOR);
    this._setTile(33, 52, TILE_TYPES.BLAST_DOOR);
    this._setTile(66, 47, TILE_TYPES.BLAST_DOOR);
    this._setTile(66, 52, TILE_TYPES.BLAST_DOOR);

    // Turbine Generator Hall (NW: x: 18 to 32, y: 18 to 32)
    this._fillBox(18, 18, 14, 14, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(22, 22, 6, 6, TILE_TYPES.COVER_CRATE);

    // Classified Server Vault (NE: x: 68 to 82, y: 18 to 32)
    this._fillBox(68, 18, 14, 14, TILE_TYPES.FLOOR_OFFICE);
    this._fillBox(72, 22, 6, 6, TILE_TYPES.COVER_CRATE);

    // Medical Triage Bay (SW: x: 18 to 32, y: 68 to 82)
    this._fillBox(18, 68, 14, 14, TILE_TYPES.FLOOR_OFFICE);
    this._fillBox(22, 72, 6, 6, TILE_TYPES.COVER_CRATE);

    // D-2 Subterranean Approach (SE: x: 68 to 82, y: 68 to 82)
    this._fillBox(68, 68, 14, 14, TILE_TYPES.METAL_GRATE);

    // Connect the four service rooms to the command hub, then link the side
    // rooms back to the outer ring so no loot wing is a sealed dead end.
    this._fillBox(32, 30, 2, 6, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(66, 28, 2, 8, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(32, 64, 4, 5, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(64, 64, 6, 5, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(16, 24, 3, 3, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(82, 24, 3, 3, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(24, 82, 3, 3, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(82, 72, 3, 3, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(72, 82, 3, 3, TILE_TYPES.FLOOR_CONCRETE);
    this._fillBox(72, 48, 13, 4, TILE_TYPES.FLOOR_CONCRETE);

    this._setTile(33, 33, TILE_TYPES.DOOR_FRAME);
    this._setTile(66, 33, TILE_TYPES.DOOR_FRAME);
    this._setTile(33, 66, TILE_TYPES.DOOR_FRAME);
    this._setTile(66, 66, TILE_TYPES.DOOR_FRAME);
    this._setTile(17, 25, TILE_TYPES.DOOR_FRAME);
    this._setTile(83, 25, TILE_TYPES.DOOR_FRAME);
    this._setTile(25, 83, TILE_TYPES.DOOR_FRAME);
    this._setTile(83, 73, TILE_TYPES.DOOR_FRAME);
    this._setTile(73, 83, TILE_TYPES.DOOR_FRAME);
    this._setTile(83, 50, TILE_TYPES.DOOR_FRAME);

    this.extractZones = [
      {
        id: "d2_extract",
        name: "D-2 Subterranean Exit",
        tileX: 84, tileY: 84, tileW: 8, tileH: 8,
        color: "rgba(46, 204, 113, 0.35)", border: "#2ecc71"
      },
      {
        id: "hermetic_door",
        name: "Hermetic Blast Door (Bunker)",
        tileX: 10, tileY: 10, tileW: 8, tileH: 8,
        color: "rgba(241, 196, 15, 0.35)", border: "#f1c40f"
      },
      {
        id: "ventilation",
        name: "Ventilation Shaft Extract",
        tileX: 10, tileY: 84, tileW: 8, tileH: 8,
        color: "rgba(52, 152, 219, 0.35)", border: "#3498db"
      }
    ];

    this.spawnPoints = [
      { x: 50 * 32 + 16, y: 12 * 32 + 16, angle: Math.PI / 2 },
      { x: 51 * 32 + 16, y: 12 * 32 + 16, angle: Math.PI / 2 },
      { x: 50 * 32 + 16, y: 13 * 32 + 16, angle: Math.PI / 2 },
      { x: 51 * 32 + 16, y: 13 * 32 + 16, angle: Math.PI / 2 }
    ];

    this.containers = [
      {
        id: "bnk_turbine_crate",
        type: "crate_military",
        name: "Turbine Room Military Stash",
        x: 29 * 32 + 16, y: 25 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "bnk_server_tech",
        type: "crate_military",
        name: "Server Vault Intel Case",
        x: 79 * 32 + 16, y: 25 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "bnk_command_corpse",
        type: "corpse_scav",
        name: "Command Center Raider",
        x: 50 * 32 + 16, y: 50 * 32 + 16,
        gridW: 3, gridH: 3
      },
      {
        id: "bnk_d2_ammo",
        type: "ammo_box",
        name: "D-2 Corridor Ammo Box",
        x: 75 * 32 + 16, y: 75 * 32 + 16,
        gridW: 2, gridH: 2
      },
      {
        id: "bnk_medical_station",
        type: "med_bag",
        name: "Bunker Hospital Kit",
        x: 29 * 32 + 16, y: 70 * 32 + 16,
        gridW: 2, gridH: 2
      },
      {
        id: "bnk_hermetic_crate",
        type: "crate_military",
        name: "Hermetic Door Weapons Case",
        x: 14 * 32 + 16, y: 14 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "bnk_command_cache",
        type: "crate_military",
        name: "Command Centre Emergency Cache",
        x: 56 * 32 + 16, y: 50 * 32 + 16,
        gridW: 6, gridH: 3
      },
      {
        id: "bnk_triage_cache",
        type: "med_bag",
        name: "Triage Ward Medical Cabinet",
        x: 28 * 32 + 16, y: 78 * 32 + 16,
        gridW: 3, gridH: 3
      },
      {
        id: "bnk_d2_supply_cache",
        type: "ammo_box",
        name: "D-2 Security Supply Box",
        x: 78 * 32 + 16, y: 76 * 32 + 16,
        gridW: 3, gridH: 3
      }
    ];

    this.scavSpawnZones = [
      { x: 25 * 32, y: 25 * 32, zone: "Turbine Room", radius: 150 },
      { x: 75 * 32, y: 25 * 32, zone: "Server Vault", radius: 150 },
      { x: 50 * 32, y: 20 * 32, zone: "North Tunnel Corridor", radius: 150 },
      { x: 44 * 32, y: 44 * 32, zone: "Command Center West", radius: 160 },
      { x: 56 * 32, y: 44 * 32, zone: "Command Center East", radius: 160 },
      { x: 50 * 32, y: 56 * 32, zone: "Command Center South", radius: 160 },
      { x: 20 * 32, y: 50 * 32, zone: "West Drainage Tunnel", radius: 150 },
      { x: 80 * 32, y: 50 * 32, zone: "East Drainage Tunnel", radius: 150 },
      { x: 50 * 32, y: 80 * 32, zone: "South Main Tunnel", radius: 150 },
      { x: 75 * 32, y: 75 * 32, zone: "D-2 Approach Bay", radius: 160 },
      { x: 25 * 32, y: 75 * 32, zone: "Medical Triage Wing", radius: 160 },
      { x: 14 * 32, y: 14 * 32, zone: "Hermetic Door Control", radius: 160 },
      { x: 14 * 32, y: 84 * 32, zone: "Ventilation Shaft Base", radius: 160 },
      { x: 84 * 32, y: 84 * 32, zone: "D-2 Blast Gate", radius: 160 }
    ];
  }

  _buildStreets140() {
    this.grid.fill(TILE_TYPES.FLOOR_CONCRETE);
    this._drawHWall(0, 0, this.width);
    this._drawHWall(0, this.height - 1, this.width);
    this._drawVWall(0, 0, this.height);
    this._drawVWall(this.width - 1, 0, this.height);

    const building = (x, y, w, h, doors, floor = TILE_TYPES.FLOOR_OFFICE) => {
      this._fillBox(x + 1, y + 1, w - 2, h - 2, floor);
      this._drawHWall(x, y, w);
      this._drawHWall(x, y + h - 1, w);
      this._drawVWall(x, y, h);
      this._drawVWall(x + w - 1, y, h);
      for (const [doorX, doorY] of doors) this._setTile(doorX, doorY, TILE_TYPES.DOOR_FRAME);
    };

    // Broad avenues divide the district into blocks; narrower openings give
    // each building multiple entries and keep the main routes connected.
    this._fillBox(48, 1, 6, 138, TILE_TYPES.ROAD_ASPHALT);
    this._fillBox(94, 1, 6, 138, TILE_TYPES.ROAD_ASPHALT);
    this._fillBox(1, 48, 138, 6, TILE_TYPES.ROAD_ASPHALT);
    this._fillBox(1, 94, 138, 6, TILE_TYPES.ROAD_ASPHALT);
    this._fillBox(1, 69, 138, 5, TILE_TYPES.ROAD_ASPHALT);
    this._fillBox(69, 1, 5, 138, TILE_TYPES.ROAD_ASPHALT);

    building(8, 8, 34, 32, [[24, 8], [41, 24], [24, 39]], TILE_TYPES.FLOOR_OFFICE);
    building(58, 8, 29, 32, [[72, 8], [58, 24], [86, 24], [72, 39]]);
    building(104, 8, 28, 32, [[118, 8], [104, 24], [131, 24], [118, 39]], TILE_TYPES.FLOOR_OFFICE);
    building(8, 59, 34, 29, [[24, 59], [41, 73], [24, 87]]);
    building(58, 59, 29, 29, [[72, 59], [58, 73], [86, 73], [72, 87]], TILE_TYPES.FLOOR_OFFICE);
    building(104, 59, 28, 29, [[118, 59], [104, 73], [131, 73], [118, 87]]);
    building(8, 104, 34, 28, [[24, 104], [41, 118], [24, 131]], TILE_TYPES.FLOOR_OFFICE);
    building(58, 104, 29, 28, [[72, 104], [58, 118], [86, 118], [72, 131]]);
    building(104, 104, 28, 28, [[118, 104], [104, 118], [131, 118]], TILE_TYPES.FLOOR_OFFICE);

    // Interior walls turn larger city buildings into searchable rooms.
    for (const y of [20, 30, 70, 78, 115, 123]) {
      this._drawHWall(10, y, 30);
      this._setTile(24, y, TILE_TYPES.DOOR_FRAME);
      this._drawHWall(106, y, 24);
      this._setTile(118, y, TILE_TYPES.DOOR_FRAME);
    }
    for (const x of [20, 30, 66, 79, 111, 123]) {
      this._drawVWall(x, 10, 28);
      this._setTile(x, 24, TILE_TYPES.DOOR_FRAME);
      this._drawVWall(x, 106, 24);
      this._setTile(x, 118, TILE_TYPES.DOOR_FRAME);
    }

    // Street barricades and abandoned vehicles provide cover without sealing
    // the boulevard or the cross-street approaches.
    for (const [x, y] of [[18, 54], [80, 44], [108, 90], [40, 98], [88, 75], [55, 90], [101, 51]]) {
      this._fillBox(x, y, 2, 2, TILE_TYPES.COVER_CRATE);
    }
    this._setTile(66, 62, TILE_TYPES.FORKLIFT_PROP);
    this._setTile(80, 80, TILE_TYPES.FORKLIFT_PROP);

    this.extractZones = [
      { id: "pinewood_extract", name: "Pinewood Service Road", tileX: 2, tileY: 2, tileW: 8, tileH: 8, color: "rgba(46, 204, 113, 0.35)", border: "#2ecc71" },
      { id: "river_extract", name: "River Embankment", tileX: 130, tileY: 2, tileW: 8, tileH: 8, color: "rgba(52, 152, 219, 0.35)", border: "#3498db" },
      { id: "checkpoint_extract", name: "Collapsed Checkpoint", tileX: 130, tileY: 130, tileW: 8, tileH: 8, color: "rgba(241, 196, 15, 0.35)", border: "#f1c40f" }
    ];

    this.spawnPoints = [
      { x: 16 * 32 + 16, y: 66 * 32 + 16, angle: 0 },
      { x: 17 * 32 + 16, y: 66 * 32 + 16, angle: 0 },
      { x: 16 * 32 + 16, y: 67 * 32 + 16, angle: 0 },
      { x: 17 * 32 + 16, y: 67 * 32 + 16, angle: 0 }
    ];

    this.containers = [
      { id: "street_pinewood_cache", type: "crate_military", name: "Pinewood Loading Bay Case", x: 27 * 32 + 16, y: 14 * 32 + 16, gridW: 6, gridH: 3 },
      { id: "street_apartment_corpse", type: "corpse_scav", name: "Apartment Courtyard Scav", x: 71 * 32 + 16, y: 28 * 32 + 16, gridW: 3, gridH: 3 },
      { id: "street_clinic_med", type: "med_bag", name: "City Clinic Trauma Bag", x: 116 * 32 + 16, y: 18 * 32 + 16, gridW: 3, gridH: 3 },
      { id: "street_market_ammo", type: "ammo_box", name: "Klimov Street Ammo Cache", x: 26 * 32 + 16, y: 77 * 32 + 16, gridW: 3, gridH: 3 },
      { id: "street_theater_case", type: "crate_military", name: "Theatre Service Weapon Case", x: 72 * 32 + 16, y: 67 * 32 + 16, gridW: 6, gridH: 3 },
      { id: "street_construction_corpse", type: "corpse_scav", name: "Construction Raider", x: 118 * 32 + 16, y: 80 * 32 + 16, gridW: 3, gridH: 3 },
      { id: "street_garage_case", type: "crate_military", name: "Underground Garage Stash", x: 28 * 32 + 16, y: 111 * 32 + 16, gridW: 6, gridH: 3 },
      { id: "street_bank_tech", type: "crate_military", name: "Financial District Tech Case", x: 70 * 32 + 16, y: 111 * 32 + 16, gridW: 6, gridH: 3 },
      { id: "street_checkpoint_med", type: "med_bag", name: "Checkpoint First Aid Kit", x: 117 * 32 + 16, y: 119 * 32 + 16, gridW: 3, gridH: 3 }
    ];

    this.scavSpawnZones = [
      { x: 28 * 32, y: 25 * 32, zone: "Pinewood Apartments", radius: 180 },
      { x: 72 * 32, y: 18 * 32, zone: "Residential Courtyard", radius: 180 },
      { x: 118 * 32, y: 25 * 32, zone: "City Clinic", radius: 180 },
      { x: 20 * 32, y: 68 * 32, zone: "Klimov Street", radius: 200 },
      { x: 72 * 32, y: 68 * 32, zone: "Theatre Boulevard", radius: 220 },
      { x: 118 * 32, y: 68 * 32, zone: "Financial District", radius: 200 },
      { x: 26 * 32, y: 118 * 32, zone: "Underground Garage", radius: 180 },
      { x: 73 * 32, y: 118 * 32, zone: "Business Quarter", radius: 200 },
      { x: 118 * 32, y: 118 * 32, zone: "Checkpoint Approach", radius: 180 },
      { x: 54 * 32, y: 52 * 32, zone: "Western Crossroads", radius: 180 },
      { x: 97 * 32, y: 97 * 32, zone: "Southern Crossroads", radius: 180 }
    ];
  }

  getTile(tx, ty) {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) {
      return TILE_TYPES.WALL_SOLID;
    }
    return this.grid[ty * this.width + tx];
  }

  isSolid(tx, ty) {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) {
      return true;
    }
    const type = this.grid[ty * this.width + tx];
    return (
      type === TILE_TYPES.WALL_SOLID ||
      type === TILE_TYPES.WALL_CONTAINER ||
      type === TILE_TYPES.COVER_CRATE ||
      type === TILE_TYPES.FORKLIFT_PROP
    );
  }

  getSpawnPoint(index = 0) {
    const sp = this.spawnPoints[index % this.spawnPoints.length];
    return { ...sp };
  }

  checkExtraction(x, y) {
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(y / this.tileSize);
    for (const zone of this.extractZones) {
      if (
        tx >= zone.tileX &&
        tx < zone.tileX + zone.tileW &&
        ty >= zone.tileY &&
        ty < zone.tileY + zone.tileH
      ) {
        return zone;
      }
    }
    return null;
  }

  /**
   * Line of sight raycast between two points. Returns true if unobstructed by solid tiles.
   * Strict Amanatides & Woo Fast Voxel / Grid Traversal:
   * Traverses EVERY single grid cell that the ray segment intersects.
   * If a single solid obstacle or wall tile intersects the ray, Line of Sight is BLOCKED.
   */
  hasLineOfSight(x1, y1, x2, y2) {
    if (typeof x1 !== 'number' || typeof y1 !== 'number' || typeof x2 !== 'number' || typeof y2 !== 'number') return false;
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return false;

    const ts = this.tileSize;
    const startTx = Math.floor(x1 / ts);
    const startTy = Math.floor(y1 / ts);
    const endTx = Math.floor(x2 / ts);
    const endTy = Math.floor(y2 / ts);

    // If starting point or ending point is inside a solid wall, LOS is completely blocked
    if (this.isSolid(startTx, startTy)) return false;
    if (this.isSolid(endTx, endTy)) return false;
    if (startTx === endTx && startTy === endTy) return true;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
    const stepY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);

    let tMaxX = Infinity;
    let tDeltaX = Infinity;
    if (stepX !== 0) {
      const nextTileEdgeX = stepX > 0 ? (startTx + 1) * ts : startTx * ts;
      tMaxX = (nextTileEdgeX - x1) / dx;
      tDeltaX = (stepX * ts) / dx;
    }

    let tMaxY = Infinity;
    let tDeltaY = Infinity;
    if (stepY !== 0) {
      const nextTileEdgeY = stepY > 0 ? (startTy + 1) * ts : startTy * ts;
      tMaxY = (nextTileEdgeY - y1) / dy;
      tDeltaY = (stepY * ts) / dy;
    }

    let currTx = startTx;
    let currTy = startTy;

    // Safety limit against infinite loops
    const maxSteps = (Math.abs(endTx - startTx) + Math.abs(endTy - startTy) + 2) * 2;
    let stepsTaken = 0;

    while ((currTx !== endTx || currTy !== endTy) && stepsTaken++ < maxSteps) {
      if (tMaxX < tMaxY) {
        currTx += stepX;
        tMaxX += tDeltaX;
      } else {
        currTy += stepY;
        tMaxY += tDeltaY;
      }

      if (this.isSolid(currTx, currTy)) {
        return false;
      }
    }

    return true;
  }
}
