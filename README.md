# DINO OVERDRIVE

Standalone arcade remix of Chromium's offline Dino. This is a new game implementation using the official Chromium dinosaur, cactus, and bird sprite artwork. It does not patch chrome://dino or Chrome itself.

## Play

- Space / Up / W or tap: jump, with one extra jump in the air
- Down / S or hold the duck button: duck; in the air, fall faster
- P / Escape: pause; switching tabs also pauses
- M: toggle sound (off by default)
- Collect eight coins to charge six seconds of invincible, coin-attracting, double-score fever
- Best score and sound / reduced-motion preferences are saved only in localStorage

Static HTML/CSS/ES modules with locally vendored Three.js r180 for the playable scenes, no external fonts, network score submission, analytics, real ad delivery, purchases, or application accounts.

## Run locally

Serve dist with any static HTTP server. For example: `python3 -m http.server 4173 --directory dist`.

## Deploy with pnpm, Vite+, and cf

The complete game is in `dist/`, including its images, Three.js modules, and licenses. Deployment uses the official **cf CLI**, pinned to `1.0.0-beta.12`, the latest npm release verified on 2026-10-07. `cf` is currently in open beta.

`cloudflare.config.ts` defines an assets-only Worker. The Cloudflare Vite plugin 2.0 beta copies `dist/` as Vite's public directory into Cloudflare Build Output. All game assets remain unchanged. There is no Worker entrypoint, server bundle, backend, runtime binding, database, or runtime secret. The project does not install or invoke Wrangler.

The build-only dependencies and their exact versions are recorded in `package.json` and `pnpm-lock.yaml`. The project pins **pnpm 10.11.1** (matching Cloudflare's documented default) and **Vite+ 1.0.0**. Vite+ supplies the project-local `vp` CLI; no global Vite+ installation is required. Its matching Vite core alias and Vitest override are kept together in `pnpm-workspace.yaml`. Use Node.js **22.18+ within 22.x, 24.11+ within 24.x, or 26+**. Cloudflare's default Node.js 24 build image is suitable.

### GitHub integration settings

Connect `AkaakuHub/dopa-dino` through Cloudflare's own GitHub integration: **Workers & Pages → Create application → Import a repository**. For an existing Worker, use **Settings → Builds → Connect**.

- Worker/project name: `dopa-dino`
- Production branch: `main`
- Root directory: repository root (leave blank or `/`, depending on the dashboard field)
- Build command: `pnpm run build`
- Deploy command: `pnpm run deploy`
- Optional build variable: `CF_SEND_TELEMETRY=false`

Cloudflare installs the dependencies from the committed pnpm lockfile. The build command runs `vp build`; the Cloudflare Vite plugin emits `.cloudflare/output/v0/`. The deploy command runs `cf deploy --prebuilt --mode production`, deploying the exact output of the preceding build. The production mode must match the Vite build. Replace the dashboard's default deploy command with the command above.

Pushes to the configured branch trigger Cloudflare Builds. No GitHub Actions workflow is used. The GitHub connection and Cloudflare build credentials belong in the Cloudflare dashboard; never commit tokens or login files. Dashboard authorization and an actual deployment are separate from local build validation.

### Local validation

Run `pnpm install --frozen-lockfile`, then `pnpm run build`, then `pnpm run check`. The check invokes `cf deploy --prebuilt --mode production --dry-run`; it validates the assets-only deployment without authentication, API calls, or an upload. Generated `.cloudflare/` output is ignored by Git.

With a global `vp` CLI, use `vp install --frozen-lockfile`, `vp build`, and `vp run check`. Use `vp run deploy` only when ready to publish. `vp run check` runs this project's deployment dry-run script; the built-in `vp check` is a different lint/format/type-check command.

Do not use `cf init` to regenerate this configured project. Its generic static-site autoconfiguration may choose different build tooling.

### Custom domain: dopa-dino.akaaku.net

After deploying, verify that `akaaku.net` is an active zone in the selected Cloudflare account and inspect existing DNS records and Worker routes for `dopa-dino.akaaku.net`. Resolve any existing use deliberately before replacing it.

Open **dopa-dino → Settings → Domains & Routes → Add → Custom Domain** and enter `dopa-dino.akaaku.net`. Cloudflare manages the DNS record and TLS certificate. An existing CNAME at this hostname prevents adding the Custom Domain; do not delete unrelated DNS records. Verify domain activation and HTTPS afterward.

Domains and fetch triggers are intentionally omitted from `cloudflare.config.ts`, with `workersDev` and `previewUrls` disabled. The domain is managed in the dashboard. The first deployment has no public endpoint until that Custom Domain is added. The game has no built-in sign-in gate, so the configured domain is public unless access protection is configured separately.

Official references, checked 2026-10-07: [cf installation](https://developers.cloudflare.com/cf/get-started/), [cf project builds](https://developers.cloudflare.com/cf/projects/), [programmatic configuration](https://developers.cloudflare.com/cf/projects/cloudflare-config/), [cf CI](https://developers.cloudflare.com/cf/ci/), [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [Workers Builds tool versions](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/), [Vite+ project-local CLI](https://viteplus.dev/guide/local-cli), [Vite+ 1.0 release](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.0.0), and [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Sources and attribution

Pixel sprite artwork: Copyright The Chromium Authors, distributed under the BSD 3-Clause license in dist/LICENSE.txt.

- Sprite: https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/images/default_100_percent/offline/100-offline-sprite.png
- Reference: https://chromium.googlesource.com/chromium/src/+/main/components/neterror/resources/dino_game/
- License: https://chromium.googlesource.com/chromium/src/+/main/LICENSE

No endorsement by Google or Chromium contributors is implied. Gameplay, interface, rendering, and arcade mechanics are an independent implementation.

## MAX upgrade

- Shift / X or the large BOOST card: 2.6 seconds of invincible acceleration, coin magnet, and double scoring. Three-second post-boost cooldown; energy recharges over ten seconds or faster with coins. Every run begins charged.
- Smooth acceleration with desktop/mobile speed limits and speed-aware spawn spacing. Protection briefly persists while slowing down.
- Four 600 m sectors repeat: neon city, sunset dunes, low-gravity lunar orbit, and aurora ice. Each sector grants 250 points, some boost energy, a transition safety window, and a fresh obstacle queue.
- Boost + fever multiplies points by four. Rainbow afterimages, expanding impact rings, combo fireworks, and stage-entry celebrations have bounded particles (260), rings (12), and score labels (24). No white-screen flashes, camera shake, or strobing. Reduced-motion disables particles, rings, speed lines, and moving afterimages.
- Stage backdrop atlas is original generated pixel art. Chromium sprite attribution is unchanged.

Checks: `node test-engine.mjs && node test-upgrade.mjs && node test-ui.mjs`.
The UI integration test uses DOM/canvas stubs; it verifies event bindings and HUD updates, not browser rendering or real-device performance.

## Full-screen playable parody ads

- After a collision, choose 遊べる広告で復活. Unlimited revivals per run; restarting without an ad is always available.
- The entire opaque ad slides up from below the viewport over 400 ms on every opening, then covers the full viewport. Reduced-motion preferences show it immediately. Resize and input do not restart the entrance. It locks page scrolling and background inputs, and pauses the runner completely. It does not request browser fullscreen permission.
- The skip button unlocks after five active, visible seconds. Five seconds never ends the game or revives automatically. All three mini-games continue until the user chooses to skip; winning or losing does not gate revival. Blur and hidden tabs pause their timer and inputs.
- On skip, score, coins, combo, distance, stage, and boost charge persist. Obstacles are cleared, the dinosaur is grounded, and a three-second shield plus delayed spawns prevents an immediate second death.
- Ads use a shuffled bag: all three games appear once per round, the first game is randomized, and adjacent repeats are prevented even across round boundaries. FROSTFIRE CAMP gathers and carries wood to warm a snowy settlement; CITY FEAST grows a hole from street props to buildings, regenerating the city after it is eaten.
- SPIRAL DROP preserves velocity and continuous position through gaps. Three consecutive gaps charge a fireball; the next solid floor, including a red hazard, shatters into moving platform pieces and consumes the charge. Safe bounces reset the streak. An uncharged red hit breaks the ball and automatically restarts the attempt after 650 ms, without closing the ad or resetting its skip timer. Floors are recycled indefinitely.
- Reference-led visual refinements include a larger dark-navy furnace with curved pipes and braces, corrected peaked cabin roofs, closer snow/city cameras, lavender-gray roads, a thick cyan hole rim and dark-blue well, and a thicker helix shaft with substantial slate platforms and separate dark vertical faces. Geometry and assets remain original.
- The playable scenes are genuine Three.js r180 WebGL 3D: original mesh geometry, extruded helix platforms, MeshStandard materials, orthographic game cameras, hemisphere/directional lighting, soft PCF shadow maps, and point-lit furnace. Three.js and its MIT license are vendored in dist/vendor with no CDN or third-party runtime request. Static geometry is merged by material. The ad scenes dispose geometries, materials, shadow maps and render lists when dismissed; a single reusable WebGL context avoids repeated context creation. The existing main runner remains Canvas 2D. No screenshots, logos, or game assets from the reference titles are embedded. The visible small label says this is a fictional parody. No real advertising SDK, tracking, payment, install prompt, or third-party requests are used.
- Supports touch/pointer, keyboard arrows/WASD, Escape after skip unlock, and focus containment. Snow decoration respects the reduced-motion setting.

Official game/store screenshots and mechanics reviewed on 2026-10-07:
- Whiteout Survival: https://apps.apple.com/us/app/whiteout-survival/id6443575749
- Hole.io (VOODOO): https://voodoo.io/games/hole-io
- Helix Jump (VOODOO): https://apps.apple.com/us/app/helix-jump/id1345968745
- Helix Jump three-gap invincibility rule: https://store.steampowered.com/app/2751330/Helix_Jump/
- Helix Jump next-floor destruction rule: https://www.crazygames.com/game/helix-jump
These are game references rather than proof of specific advertising campaigns; no official affiliation is claimed.

Skip semantics reference: https://support.google.com/authorizedbuyers/answer/2691733?hl=en describes unlocking video-ad skip after five seconds without truncating the video. Our five-second playable-ad choice follows the user's requested behavior; it is not a claim that all playable ad networks use five seconds.

Checks: `node test-engine.mjs && node test-upgrade.mjs && node test-ui.mjs && node test-ads.mjs && node test-ad-lifecycle.mjs && node test-three-scene.mjs && node test-helix-rules.mjs`. Tests cover 12 actual collision/ad/skip/revive cycles, entrance class stability, reduced-motion CSS rules, per-session RAF and pointer-capture cleanup, three interactive loops, 10-minute continued play, exact unlock boundary, no automatic exit, early/double-skip rejection, pause/visibility, pointer targeting, resize, revival preservation and safety, reset, and existing runner regressions. DOM event integration tests use stubs. Previous Canvas snapshots no longer validate these replaced scenes. Three.js scene graph construction, geometry counts, camera projection, raycasting and disposal are checked independently. Dedicated tests verify continuous accelerating drops, three-gap activation, single-use red-floor destruction, safe bounce/reset, red death/retry, frame-rate agreement, moving platform fragments and their cleanup, and 90,000 seeded shuffle draws. These tests do not validate GPU-rendered pixels or device performance. Real browser/WebGL QA remains blocked by Chromium socket creation restrictions and unavailable portable preview forwarding; do not claim it passed.
