# Authored 3D arcade art pass

The ten local Three.js games now use separate scene directions rather than one shared neon/plastic treatment. This pass changes rendering only; model physics, scoring and saved progress stay in their existing modules.

## Scene directions

- **Frostfire:** blue-hour timber settlement; grained cabins and logs, wind-shaped snow banks, reflective ice, cast-iron furnace, supply wagon and axe block, warm hearth against cool ambient light
- **City Hole:** sun-warmed coastal town; masonry facades, shaped metal roofs, timber rooftop tanks, chrome-trimmed rounded cars, asphalt aggregate and jointed paving
- **Helix:** porcelain-and-brass observatory; veined mineral platforms, aged metal edges, distinct dark-red danger surfaces, stone colonnade and orbital rings
- **Crowd Gates:** tropical expedition causeway; fibrous folded palm fronds, sand islands, textured causeway, animated water material, suspension ropes, timber posts and rounded cutwaters
- **Stack:** sunrise mineral tower; restrained stone-color progression, marble slabs, brass reveals, a colonnaded pedestal and stepped skyline silhouettes
- **Golf:** botanical miniature; turf and sand, limestone footing, oak-capped rails, three plant silhouettes, flower beds, slatted benches, woven flag and metal putter
- **Breaker:** enamel-and-brass arcade instrument; rounded ceramic keys, wood cheeks, physical speaker grilles, analog dials, metal vents and restrained signal lights
- **Range:** weathered orbital hangar; brushed panels, patterned floor, ducts, trusses, tanks, octagonal portal and a chamfered, detailed pulse tool
- **Pins:** sandstone water temple; jointed relief walls, aged bronze hardware, foliage, treasure chest, glossy water, molten material and cooled obsidian
- **Merge:** porcelain patisserie cabinet; ivory and pistachio, scalloped crown, tufted inset, brass/marble/walnut details and six tactile orb finishes

## Rendering and ownership

`dist/ads-visuals.js` contains original deterministic texture generation and art-direction helpers. All authored albedo, bump and roughness maps are local 128×128 DataTextures. Reflection lighting uses an original 128×64 equirectangular texture. No external image service, downloaded texture pack, new dependency, heavy post-processing pass or remote asset request is introduced.

Albedo maps use sRGB; bump/roughness maps remain non-color data. The reflection sky uses linear sRGB. Mipmaps and bounded anisotropy are enabled. Water and lava have a small standard-material fragment hook; reduced motion freezes its time uniform. Shader program keys distinguish the two hooks.

Shared materials and texture variants are cached per scene. Updates allocate no new material or texture. Scene teardown disposes all scene, pool and environment resources once, including unused pooled materials. Repeated geometry remains instanced or merged where already applicable. Rounded geometry retains the original outside dimensions; all hit-testing still uses the game model and camera projection.

Source texture data ranges from 544 KiB (Stack) to 2,080 KiB (Golf) per scene, before GPU mipmaps and generated reflection preprocessing. Initial visible geometry, counting all city/crowd instances, stays below 200,000 triangles. These are structural budgets, not measured mobile frame rates.

Two inherited visual/input issues were also corrected: portrait golf rails no longer clip the frame, and pin handles mount in front of their pillars while keeping their existing model coordinates. Golf ramps now have UVs.

## Verification

- All repository `test-*.mjs` suites pass against the combined working tree
- New `test-art-direction.mjs` checks ten distinct scene directions, multiple material families, color-space correctness, source texture budgets, deterministic maps, caching, exact-once disposal, reduced motion, rounded bounds, finite geometry and fragment-hook compatibility with vendored Three.js r180
- Focused course/cabinet tests cover desktop, portrait and landscape picking, repeated layouts, stable pools and disposal
- Vite build and Cloudflare prebuilt dry-run pass; this step does not publish

**Unverified:** actual WebGL shader compilation, rendered pixels, GPU memory and mobile performance. The existing cloud browser has WebGL disabled. A separate headless Chromium probe could not start because its process socket is unavailable in this sandbox. No rendered screenshot or professional-quality verification is claimed.

## Primary references

- https://threejs.org/docs/pages/MeshStandardMaterial.html
- https://threejs.org/docs/pages/DataTexture.html
- https://threejs.org/docs/pages/Material.html

References checked 2026-10-07; implementation is checked against locally vendored r180 rather than assuming current-documentation API additions are present.
