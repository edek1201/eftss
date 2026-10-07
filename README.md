# Escape from Tarkov 2D (Browser CQB Extraction Shooter)

A browser-based, top-down tactical extraction shooter heavily inspired by *Escape from Tarkov* (PVE Co-op focus for 1-4 players). Built with **pure Vanilla JavaScript (ES6+ Modules), HTML5 Canvas 2D, and an authoritative Node.js backend operating at 30 Hz**.

Zero build steps, zero external front-end dependencies, zero external audio assets. Everything synthesized natively in-engine.

---

## Technical Architecture & Implemented Systems

```text
EFT/
├── package.json              # Project configuration (ES6 Modules enabled)
├── README.md                 # Architecture, controls & deployment guide
├── server.js                 # Authoritative server, WebSocket transport & account API
├── shared/
│   ├── physics.js            # Circle-vs-AABB sliding physics, stamina, vector math
│   └── map.js                # Factory, Customs, Reserve, Streets of Tarkov + Loot Sites
├── server/
│   ├── account-store.js      # Password hashing and persistent PMC accounts
│   └── game-engine.js        # 30Hz simulation, scav AI, container loot & transfer sync
└── public/
    ├── index.html            # Pre-raid lobby, stash management, tactical HUD, dual-canvas DOM
    ├── css/
    │   └── style.css         # Dark tactical theme, Tetris inventory grid & container styling
    └── js/
        ├── client.js         # Client game loop, physical bullet tracers, recoil & prediction
        ├── audio.js          # Procedural Web Audio API engine (zero external audio files)
        ├── profile.js        # Account login, server profile sync & 10x30 stash manager
        ├── inventory.js      # Unified Tetris inventory & split-grid container looting
        ├── input.js          # SEMI vs FULL-AUTO fire controller with cyclic rate & audio
        ├── renderer.js       # Procedural operator, containers, tracers, recoil & HUD prompts
        └── network.js        # Universal WebSocket client adapter
```

---

## 1. Procedural Web Audio API Sound Engine (`public/js/audio.js`)
Zero external `.mp3` or `.wav` files required. 100% procedurally synthesized via native `AudioContext`:
- **Gunshots**: White noise buffer burst through a bandpass filter with rapid exponential decay + sub-bass kick oscillator (distinguishes single-shot crack vs. rapid full-auto punch).
- **Mechanical Fire Selector [B]**: High-frequency sawtooth wave sweep simulating a physical steel fire selector latch.
- **Tactical Reload [R]**: 2-stage mechanical audio: magazine unseat click, followed by a firm magazine insertion snap.
- **Procedural Footsteps**: Pitch-modulated low-pass noise bursts triggered at realistic movement cadences (distinct volume/pitch for sprint, walk, and crouch).
- **Container Rummaging [F]**: Modulated multi-burst zipper and metallic latch friction sounds.
- **Tactical Radio & Extraction**: Confirmation beeps during the 7-second countdown and a two-tone confirmation chime upon successful extraction.
- **Browser Autoplay Compliance**: Unlocks automatically on the player's first interaction.

---

## 2. In-Raid Interactive Loot Containers (`shared/map.js`, `server.js`, `public/js/inventory.js`)
Map tiles are populated with interactive loot entities across all 4 maps:
- **Container Types**:
  - **Green Military Crates** (6x3 weapon cases): Full-size weapons, ammo, armor, and valuables; items keep their real inventory dimensions.
  - **Dead Scav Bodies** ($3\times 3$ grid): Barter valuables (Graphics Card GPU, Physical Bitcoin, Military Cable, Golden Rooster) and bandages.
  - **Wooden Ammo Boxes** ($2\times 2$ grid): 5.45x39 BT, 5.56x45 M855, 9x19 Pst gzh ammunition.
  - **SMU Medical Bags** ($2\times 2$ grid): Salewa First Aid (400 HP), IFAK, Morphine injectors, and splints.
- **Proximity HUD Interaction**: When standing within 1.75 tiles of a container, the canvas displays a `[F] SEARCH` prompt.
- **Hardcore Search Risk**: Rummaging produces noise that nearby Scavs investigate. Most caches are empty; weapons, medicine, armor, valuables, and grenades are scarce, with premium gear exceptionally rare.
- **Expanded Routes**: Each map has nine fixed loot sites distributed across its major areas, with different crate, ammo, and medical-cache layouts.
- **Expanded Arsenal**: AKM, SCAR-H, MDR, MP7, P90, UMP45, SV-98, and M1911 join the existing weapons, with compatible magazines and ammunition.
- **Throwable Grenades**: Rare F-1, RGD-5, and M67 fragmentation grenades can be thrown with `[3]`. Their blast can kill at close range; walls reduce blast damage.
- **Streets of Tarkov**: A 140x140 urban district with apartment blocks, a clinic, a central boulevard, nine loot sites, scav patrol areas, and three extraction routes.
- **Trader Barter Contracts**: Exchange recovered chainlets for a grenade, workshop goods and intelligence for a trauma kit, or military electronics for battle rifle ammunition.
- **Discard Any Item**: Hold any carried item and press `[G]` or drag it outside the inventory to leave it on the ground for anyone to loot. Stash items cannot be dropped.
- **Split Container Looting Grid**:
  - Pressing `[F]` opens a split interface: Container contents on the left, player rig and backpack on the right.
  - Drag and drop or **Shift-click** to instantly transfer loot between container and gear.
  - Real-time synchronization over WebSocket ensures teammates see items taken or placed collaboratively.

---

## 3. Accounts, Persistent Profiles & Main Menu Stash (`server/account-store.js`, `public/js/profile.js`)
- **Account access**: Create an account with a unique username, password, PMC callsign, and USEC/BEAR faction, then sign in from another browser or device.
- **Protected game sessions**: The game WebSocket accepts connections only from a signed-in account session.
- **Credential handling**: Passwords are stored as salted `scrypt` hashes, never plaintext. Login sessions use HTTP-only, same-site cookies; repeated login attempts are rate limited.
- **Server-side persistence**: Account profiles, rubles ($500,000\text{ \u20BD}$ starting balance), stash/loadout, and raid statistics are saved to `data/accounts.json`. `localStorage` is only a local cache.
- **Deployment requirement**: Keep `data/accounts.json` on persistent storage and back it up. Set `EFT_ACCOUNTS_FILE` to use a different file path. Production deployments must serve the game over HTTPS so session cookies are marked Secure.
- **Out-of-Raid Character Management**:
  - Accessible via the **`[CHARACTER STASH & LOADOUT (10x30)]`** button in the pre-raid menu.
  - Features a scrollable **10 columns x 30 rows main stash** ($300$ slots).
  - Move weapons, armor, rigs, backpacks, and medical supplies between stash and raid loadout.
- **Death & Extraction Penalties**:
  - **Death**: All non-secure equipped items (weapons, rig, backpack, pockets) are wiped from the profile save.
  - **Alpha Secure Container (2x2)**: Items stored in the Alpha box are protected and never lost on death.
  - **Extraction**: Safely extracting transfers all carried gear and extracted loot into the persistent profile.

---

## 4. Working Fire Selector Engine & Recoil Dynamics (`public/js/input.js`, `public/js/client.js`)
- **Weapon Handling & Accuracy**:
  - Shot direction is used by server hit registration, so visual spread and actual hits agree.
  - Sprinting and moving increase spread; crouching and aiming reduce it. Firing builds bloom, which recovers faster while stationary and aiming.
- **SEMI Mode**:
  - Left Click fires exactly 1 round.
  - Holding Left Click does not continuously fire; requires releasing and re-clicking.
  - Single shots avoid full-auto bloom but still inherit stance and movement penalties.
- **FULL-AUTO Mode**:
  - Holding Left Click fires continuously at the weapon's cyclic rate of fire ($600\text{ RPM} \approx 105\text{ms}$ interval).
  - Sustained firing progressively accumulates spread bloom (up to $0.18\text{ rad} \approx 10^\circ$) and triggers screen recoil camera shake.
- **Scav Combat**:
  - Scavs take several centre-mass hits, while heavier guards and bosses have stronger armor.
  - Their aim takes time to settle and they fire less often; regular Scavs are less accurate than elite enemies.
  - Confirmed hits display a brief hit marker and synthesized audio cue; lethal hits use a distinct marker. Hit targets visibly flinch.
- **HUD Synchronization**:
  - Pressing `[B]` toggles mode with mechanical audio feedback.
  - HUD displays active mode: `[SEMI] (B)` vs. highlighted `[FULL-AUTO] (B)`.
- **Physical Bullet Tracers**:
  - Each shot spawns a physical projectile with velocity ($950\text{ px/s}$), line tracer rendering, and obstacle collision detection.

---

## Tactical Keybind Matrix

| Keybind | Tactical Action | Notes |
| :--- | :--- | :--- |
| `W, A, S, D` | Locomotion | Continuous 2D vector movement with procedural footstep audio |
| `Shift (Hold)` | Sprint | $280\text{ px/s}$; faster footsteps; drains stamina; creates acoustic footprint |
| `C` | Toggle Crouch | $80\text{ px/s}$; muffled footsteps; suppresses acoustic footprint |
| `Mouse Move` | 360° Free Aim | Directional pointer, shoulders, arms, weapon barrel, and laser track cursor |
| `Right Click (Hold)` | Aim Down Sights (ADS) | Tightens FOV cone, expands view distance, renders ADS reticle |
| `Left Click` | Fire Weapon | Single shot in SEMI; continuous burst in AUTO with screen recoil |
| `B` | Fire Selector Toggle | Switches between **[SEMI]** and **[FULL-AUTO]** with mechanical audio click |
| `R` | Tactical Reload / Rotate | Reloads weapon; in inventory, **rotates held item** |
| `Double-Tap R` | Emergency Fast Reload | Rapid drop-mag reload |
| `F` | Interact / Loot / Extract | Searches nearby containers (crates, corpses, bags); initiates extraction |
| `3` | Throw Grenade | Throws a carried fragmentation grenade toward your aim |
| `G` | Discard Held Item | In the raid inventory, drop any held item onto the floor |
| `Shift + Click` | Fast Loot Transfer | Quickly moves item between container and player inventory |
| `Tab` | Toggle Gear Matrix | Opens the in-raid Tetris inventory |
| `Escape` | Close Menus / Cancel | Closes inventory, loot screen, or cancels held items |

---

## How to Test

1. Ensure the authoritative server is running:
   ```bash
   node server.js
   ```
2. Navigate to:
   ```
   http://localhost:3000
   ```
3. Create an account or sign in at the personnel terminal. The same credentials work on other devices served by this game server.
4. Test **Character Stash & Loadout**:
   - Click **`[CHARACTER STASH & LOADOUT (10x30)]`** in the lobby to inspect your persistent storage and move items between stash and loadout.
5. Test **Fire Selector & Web Audio**:
   - Deploy into a raid.
   - Press **`[B]`** to toggle between `[SEMI]` and `[FULL-AUTO]`.
   - Test Left Click: in SEMI, holding the mouse fires only one shot; in AUTO, it fires continuously with screen shake recoil.
6. Test **Interactive Looting**:
   - Approach any container (Green Weapon Crate, Scav Corpse, Ammo Box, Med Bag).
   - See the `[F] SEARCH CONTAINER` prompt appear.
   - Press **`[F]`** to rummage through the container and Shift-click or drag loot into your backpack/rig.
7. Test **Extraction & Persistence**:
   - Walk into an extraction zone (e.g. *Gate 3* or *Cellars*) and hold position for 7.0 seconds.
   - Hear the radio beeps and extraction chime. All carried loot is saved to your persistent profile!
