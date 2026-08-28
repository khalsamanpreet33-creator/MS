# Icon generation

The Tauri build pipeline needs PNG/ICO/ICNS icons at specific sizes. The SVG
source is `icons/icon.svg` (copied from `web/public/favicon.svg`).

Generate the raster set on a host with the toolchain:

```
cd src-tauri
cargo install tauri-cli --version "^1.6"
cargo tauri icon icons/icon.svg
```

That writes 32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico into
this directory. The tauri.conf.json bundle.icon array points at those files.
