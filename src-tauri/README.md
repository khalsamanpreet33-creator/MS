# School ERP — Desktop Shell (Tauri)

The desktop wrapper around the LAN-edition web app. The Rust binary launches a
WebView pointing at the bundled `web/dist` (production) or the Vite dev server
(during development).

## Architecture

```
+------------------+      loads       +--------------------+
| Tauri WebView    |  <-------------- | web/dist (built)   |
| (Rust + WebKit)  |                   | via tauri.conf.json|
+--------+---------+                   +--------------------+
         |
         | invokes commands via tauri::api
         v
+------------------+
| Rust commands    |  app_info(), open_external()
| (src/lib.rs)     |
+------------------+
```

The Tauri shell is a thin client. The Node backend (`server/`) is *not*
embedded — LAN deployments run it as a separate process so the backend can be
upgraded independently of the shell. (Embedding via `tauri::api::process`
is possible but out of scope for v0.1.)

## Prerequisites

| Platform | Tools |
|----------|-------|
| Linux    | `rustup`, `cargo`, `webkit2gtk-4.1`, `libsoup-3.0`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential` |
| macOS    | Xcode command-line tools, `rustup` |
| Windows  | Microsoft C++ Build Tools, WebView2 Runtime, `rustup` |

Install Rust:

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

Install Tauri CLI (one-time):

```
cargo install tauri-cli --version "^1.6"
```

## Generate icons

```
cd src-tauri
cargo tauri icon icons/icon.svg
```

Produces `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`
in this directory. The `bundle.icon` array in `tauri.conf.json` references
them. The `icons/README.md` explains why they're not committed.

## Dev mode

In one terminal:

```
npm run dev
# (web at :3000, server at :4000)
```

In another:

```
npm run tauri:dev
# Tauri opens a WebView pointing at http://localhost:3000
```

HMR works through the proxy; the WebView auto-reloads on Rust changes.

## Production build

```
npm run build           # server TS check + web production build
npm run tauri:build     # produces src-tauri/target/release/bundle/{msi,dmg,deb,AppImage}
```

The bundled app installs to platform defaults; `resources` in
`tauri.conf.json` carries the prebuilt web/dist and the (optional) server
dist next to the binary.

## Verifying it builds

After `cargo tauri icon` and `npm install`, the cheapest end-to-end smoke
test is `npm run tauri:build -- --debug` — produces a debug bundle without
LTO and skips signing, taking a couple of minutes instead of 10+.
