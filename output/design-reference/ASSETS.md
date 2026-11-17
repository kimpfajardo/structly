# Visual sample assets

This is an isolated visual sample with illustrative audit data. It does not change the extension's production UI. Buttons illustrate placement; native finding disclosures work.

- `source-photo.jpg`: Valentin Ivantsov, [Abstract Blue Bottle Reflections on Striped Surface](https://www.pexels.com/photo/abstract-blue-bottle-reflections-on-striped-surface-39027992/). The source lists a Canon EOS 5D Mark III and a June 28, 2019 capture date. Downloaded November 16, 2026. [Pexels license](https://www.pexels.com/license/) allows modification and app use. Not used as a logo or trademark.
- `edited-glass.png`: AI-assisted edit of that photograph, supplied as the image tool's input. Macro crop, cobalt toning, optical defocus, and directional softening. This is a transformed image, not an untouched photograph. Original retained for comparison.
- `fonts/Archivo.ttf`: [Archivo by Omnibus-Type](https://github.com/google/fonts/tree/main/ofl/archivo), SIL Open Font License; license included.
- Structly mark: existing project asset, unchanged.

Run the sample from the repository root:

```sh
./node_modules/.bin/vite output/design-reference --host 127.0.0.1 --port 4178 --strictPort --config .preview/vite.config.ts
```

Open `http://127.0.0.1:4178/` for the board, `/?screen=ready` for the opening screen, or `/?screen=report` for the report.
