# Animated Bird Models

Original procedural polygon models and textures for the kite and swan.
These are stylized models, not photographic scans or photorealistic assets.

## Files

- `kite.glb`, `swan.glb`: self-contained geometry, PBR textures and animation.
- `build-textures.cjs`: deterministic original feather/body diffuse and normal maps.
- `build-models.cjs`: exports the geometry generator in `../../sky-tag.js` to GLB.
- `../../bird-preview.html`: Three.js preview with species, viewpoint and animation controls.

## Animation

The root has independent body, neck, leftWing, rightWing and tail nodes.
Wing pivots are at the shoulders. The looping `Wingbeat` clip animates both
wings and the tail; the neck is separate for future head/neck motion.
The neutral pose is a glide. Model coordinates use +X forward and +Y up.
Cesium's glTF axis conversion is accounted for in the opponent orientation.

The game enables the clip throughout active play, including neutral controls.
Both Cesium clocks advance during the match and restore their previous setting
on exit. Flight bank and pitch follow the player's actual camera orientation.

## Rebuild

Run from the site root with Node.js. Texture generation requires `sharp`;
set `SHARP_MODULE` to its installed module path if the default is unavailable.

```sh
node metaverse/assets/tonbi/build-textures.cjs
node metaverse/assets/tonbi/build-models.cjs
```

Serve the site over HTTP to use the preview. No map tiles or admission API
are requested by the model preview. Keep the generated GLB files and source
textures together in version control. Bump the GLB query version in the game
and preview when rebuilding for deployment.
