# Subpix

Subpix is an open-source desktop editor and viewer for **Subpixel Image** files using the `.subpix` extension.

Traditional pixel art tools treat one screen pixel as one editable square. Subpix edits the logical subpixel cells inside each pixel. The first supported architecture is a horizontal 3 x 1 stripe layout:

```txt
R G B | R G B | R G B
```

That makes a 128 x 128 real-pixel document a 384 x 128 editable subpixel canvas.
New documents default to 128 x 128 real pixels, and Subpix v1 supports custom documents from 1 x 1 through 512 x 512 real pixels.

## Why `.subpix` Exists

A PNG only stores the final RGB pixels. That is useful for export, but it loses the intent of the artwork: which logical subpixel slots were edited, which display order was assumed, and which subpixel architecture the file requires.

The `.subpix` format stores the artwork as logical subpixel cells plus architecture metadata. Subpix can then remap the same logical artwork for compatible RGB and BGR horizontal stripe displays, show a simulated preview on any screen, and export a normal PNG when a compatible profile is selected.

## Current File Format

Version 1 uses readable JSON saved with a `.subpix` extension. The internal MIME-style name is `image/x-subpix`.
Subpix validates and canonicalizes documents before saving so ad hoc runtime fields do not leak into the file. The loader accepts normal UTF-8 text files, including files with a UTF-8 BOM, and reports empty files separately from malformed JSON.

```json
{
  "format": "SUBPIX",
  "version": 1,
  "document": {
    "name": "Untitled",
    "widthPixels": 32,
    "heightPixels": 32
  },
  "architecture": {
    "geometry": "horizontal-stripe",
    "slotsPerPixel": [3, 1],
    "compatibleOrders": ["RGB", "BGR"],
    "defaultOrder": "RGB",
    "lossyFallbackAllowed": false
  },
  "layers": [
    {
      "name": "Layer 1",
      "visible": true,
      "opacity": 1,
      "widthSubpixels": 96,
      "heightSubpixels": 32,
      "dataEncoding": "array",
      "data": [0, 0, 255]
    }
  ]
}
```

For a 128 x 128 document, each layer's `data` array contains `128 * 3 * 128 = 49152` intensity values. Each value is an integer from 0 to 255. The first editor tools draw in binary values: Draw On and shapes write 255, while Erase Off and Box Eraser write 0. The format already allows intermediate intensities for later grayscale tools.

## RGB and BGR Compatibility

Subpix stores logical slot positions, not a baked final PNG. For the supported horizontal stripe architecture:

- RGB export maps logical slot 0 to red, slot 1 to green, and slot 2 to blue.
- BGR export maps logical slot 0 to blue, slot 1 to green, and slot 2 to red.
- Incompatible display profiles disable PNG export, but the simulated canvas still works.

The app includes three display profile options:

- RGB horizontal stripe
- BGR horizontal stripe
- Incompatible / simulated only

## Canvas

The canvas is an editable simulated subpixel screen. Each logical slot is shown as an enlarged horizontal RGB/BGR stripe, so the editor always shows the same subpixel structure that a simulated preview would show.
The editor coordinate origin is shown as a small point at the center of the canvas. The file format still stores the layer as a normal array, so existing `.subpix` files remain compatible.
Final RGB pixels are still available through **Export PNG**.
The right inspector includes compact **Document**, **Display & Export**, and **Signal** readouts. It can be collapsed to a narrow rail when the canvas needs more space.

## Tools

- Draw On
- Erase Off
- Box eraser, which previews a red selection box and clears every subpixel inside it on release
- Lines, with Shift locking to horizontal or vertical 90-degree strokes
- Rectangle outlines and filled rectangles
- Ellipse outlines and filled ellipses
- Clear canvas
- Undo and redo
- Zoom in and out, including mouse-wheel zoom centered on the cursor
- Zoom to drawing, which recenters the viewport around active artwork or the canvas origin
- Combined grid menu with grid and pixel-boundary toggles
- Ignore color view setting, off by default, which renders active subpixels as white intensity instead of RGB/BGR channel colors
- Calibration and slot-sweep pattern insertion

The canvas is scrollable, and holding the right mouse button while dragging pans across the workspace.
Subpix remembers local workspace preferences, including selected tool, display profile, zoom, grid visibility, and pixel-boundary visibility.
The Image menu can insert deterministic `.subpix` artwork into the active layer, including RGB calibration bars and a grayscale-compatible slot sweep for preview/export checks.

Useful keyboard binds:

- `B`: Draw On
- `E`: Erase Off
- `X`: box eraser
- `L`: line
- `R`: rectangle outline
- `F`: filled rectangle
- `O`: ellipse outline
- `I`: filled ellipse
- `G`: grid
- `P`: pixel boundaries
- `C`: ignore color
- `0`: zoom to drawing

## Desktop Menus

The Electron build includes native desktop menus for common work:

- **File**: new documents, open, save, save as, and PNG export
- **Edit**: undo, redo, Draw On, Erase Off, Box Eraser, and clear canvas
- **Tools**: shape tools, calibration bars, and slot-sweep pattern insertion
- **View**: zoom, zoom to drawing, grid, pixel boundaries, and ignore color
- **Display**: RGB stripe, BGR stripe, and incompatible simulated-only profiles

These menu actions are routed through the same editor commands as the toolbar and keyboard shortcuts.
The desktop build also protects unsaved edits when opening another `.subpix` file, creating a new document, or closing/quitting the app.

## Validation

When loading a `.subpix` file, Subpix checks:

- `format` is `SUBPIX`
- `version` is supported
- document dimensions are whole pixels in the supported v1 range
- the architecture is horizontal 3 x 1 stripe
- layer dimensions match the document dimensions
- layer data length is correct
- layer data values are integers from 0 to 255

Invalid files show a useful error in the status bar.
Saving also runs the same validation path before writing the `.subpix` JSON. In the Electron desktop build, `.subpix` and PNG exports are written through a same-directory temporary file and then renamed into place, reducing the chance of leaving a partially written file if a save fails.

## Current Limitations

- True physical subpixel preview only works on compatible horizontal RGB/BGR stripe displays.
- OLED, PenTile, diamond, and other layouts are not supported for true physical mode.
- The simulated canvas works on any display.
- Browser/Electron scaling, OS scaling, and display DPI can affect true 1:1 viewing.
- This first version uses JSON `.subpix` files. A zipped or binary version can be added later.

## Development

Install dependencies:

```sh
npm install
```

Run the desktop app:

```sh
npm run dev
```

Build the app:

```sh
npm run build
```

Run tests:

```sh
npm test
```

Run the product website locally:

```sh
npm run dev:site
```

Build the product website:

```sh
npm run build:site
```

The static product site is written to `site-dist`. Its Windows download button points to the latest GitHub release: <https://github.com/Chrissyuh/Subpix/releases/latest>.

Create an unsigned Windows installer:

```sh
npm run dist:win
```

Subpix intentionally builds unsigned Windows installers for now. Windows SmartScreen may warn that the installer is from an unknown publisher. The app can still be installed by choosing the advanced/run-anyway option.

Create an unpacked local desktop build:

```sh
npm run dist:win:unpacked
```

Windows build output defaults to `%LOCALAPPDATA%\Subpix\release` so OneDrive project-folder locking does not interfere with packaging. Set `SUBPIX_WIN_OUTPUT_DIR` before running a packaging command to choose a different output directory.

Installer builds use a per-user assisted NSIS installer with Start menu and desktop shortcuts, uninstall support, run-after-install, and `.subpix` registered as a **Subpixel Image** file association. When Subpix is launched with a `.subpix` path, the desktop shell opens that file directly, and additional `.subpix` launches are routed into the existing app window.

Packaged app QA before release:

- Install Subpix, launch it from the Start menu, and verify the app icon.
- Create a document, draw, save, reopen, and export PNG.
- Double-click a `.subpix` file and verify it opens in Subpix.
- Launch a second `.subpix` file while Subpix is already open and verify it routes into the existing window.
- Try closing with unsaved edits and verify cancel and discard both work.
- Uninstall and verify shortcuts and the `.subpix` association are removed.

## Exporting PNGs

Open or create a `.subpix` document, choose a compatible RGB or BGR horizontal stripe display profile, then use **Export PNG**. Subpix packs the logical subpixel data into normal RGBA pixels with alpha set to 255.
