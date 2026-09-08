# Animated Bird Models

## Kite Revision 20260908-5

The kite uses `kite-plumage.png`, an original built-in generated image approved
by the user. Prompt: "Seamless PBR macro texture of Japanese black kite brown
contour feathers, fine barbs, warm dark brown and tawny margins, neutral light;
no wood grain, scales, whole bird or text." This is not an external paid asset.
Its six-second cycle blends two wingbeats into a glide, using the same three
smooth deformation targets as the swan. The generated PNG must be retained
when rebuilding; the procedural texture script does not reproduce it.

Original procedural polygon models and textures for the kite and swan.
These are stylized models, not photographic scans or photorealistic assets.

## Swan Revision 20260908-4

The swan adds three smooth morph targets: spanwise bending, return-stroke
folding, and trailing-edge twist. A 2.2-second clip offsets these against
shoulder rotation. Setup and countdown also animate in the game.

`swan-plumage.png` is an original built-in image-generation output approved
by the user. It is not recreated by the procedural texture script.
Prompt: "Seamless square PBR base color texture of real white swan body
plumage, macro photographic detail, densely overlapping contour feathers,
fine barbs, neutral diffuse lighting, white and pearl grey; no whole bird,
background, text or borders." Generated using the built-in tool, not an API
script. The long flight-feather texture remains procedural.

Rebuild only the swan with `node metaverse/assets/tonbi/build-models.cjs swan`.

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
