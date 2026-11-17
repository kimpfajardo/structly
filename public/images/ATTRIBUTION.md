Bundled media are sourced from `src/panel/assets/` and emitted with hashed filenames during the build.

# Refraction photograph

`refracted-glass.webp` is an AI-assisted photographic edit of **Abstract Blue Bottle Reflections on Striped Surface** by **Valentin Ivantsov**.

- Source: https://www.pexels.com/photo/abstract-blue-bottle-reflections-on-striped-surface-39027992/
- License: https://www.pexels.com/license/ — permits modification and use in apps.
- Treatment: macro crop, cobalt toning, optical defocus and directional softening; exported at 960 × 960 as WebP.
- The source photograph and editable sample remain in `output/design-reference/`.
- Used as decorative imagery, not as a logo or trademark.

# Loading animation

`refracted-glass.mp4` is an optimized derivative of the user-provided animation `gemini_generated_video_78752fa0.mp4`, used during loading and in the audit summary.

- Treatment: full frame and 10-second animation retained; scaled to 960 × 540 at 24 fps, encoded as H.264/yuv420p at CRF 24 with fast-start playback.
- Audio and source metadata removed. No crop, watermark removal, or other visual edits.
- The supplied original remains unchanged.

# Discovery interface examples

`discovery-seo.svg`, `discovery-aeo.svg`, and `discovery-geo.svg` are original, unbranded interface illustrations for Search, Answers, and Assistant. Their paper, cobalt, and ink palette belongs to Structly; they do not reproduce another platform's branding or interface.

- Each image is visibly labeled “Illustrative example.” The depicted result, citation, and recommendation are fictional examples, not observed rankings, actual AI responses, or platform endorsements. Copy describes local page checks only.
- The illustrations use authored vector geometry, Structly's guiding-light icon, and outlined Archivo lettering from the bundled OFL-licensed font. Production SVGs require no external assets or fonts.
- Editable text SVGs and the dependency-free macOS CoreText conversion script remain in `output/discovery-reference/`. Regenerate with `swift output/discovery-reference/outline-archivo.swift`.

# Archivo font

`Archivo.woff2` is a lossless WOFF2 conversion of the full Archivo variable font. All glyphs, weight and width axes, metrics, and layout tables are retained. The SIL Open Font License is included at `fonts/Archivo-OFL.txt` in the extension.
