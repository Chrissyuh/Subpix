# Subpix

Subpix is an open-source desktop editor and viewer for **Subpixel Image** files using the `.subpix` extension.

Traditional pixel art tools treat one screen pixel as one editable square. Subpix edits the logical subpixel cells inside each pixel. The first supported architecture is a horizontal 3 x 1 stripe layout:

```txt
R G B | R G B | R G B
```

That makes a 32 x 32 real-pixel document a 96 x 32 editable subpixel canvas.
New documents default to 32 x 32 real pixels, and Subpix v1 supports custom documents from 1 x 1 through 512 x 512 real pixels.

## Why `.subpix` Exists

A PNG only stores the final packed RGB pixels. That is useful for export, but it loses the intent of the artwork: which logical subpixel slots were edited, which display order was assumed, and which subpixel architecture the file requires.

The `.subpix` format stores the artwork as logical subpixel cells plus architecture metadata. Subpix can then remap the same logical artwork for compatible RGB and BGR horizontal stripe displays, show a simulated preview on any screen, and export a normal PNG when a compatible profile is selected.

## Current File Format

Version 1 uses readable JSON saved with a `.subpix` extension. The internal MIME-style name is `image/x-subpix`.

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

For a 32 x 32 document, each layer's `data` array contains `32 * 3 * 32 = 3072` intensity values. Each value is an integer from 0 to 255. The first editor tools draw in binary values: brush writes 255 and eraser writes 0. The format already allows intermediate intensities for later grayscale tools.

## RGB and BGR Compatibility

Subpix stores logical slot positions, not a baked final PNG. For the supported horizontal stripe architecture:

- RGB export maps logical slot 0 to red, slot 1 to green, and slot 2 to blue.
- BGR export maps logical slot 0 to blue, slot 1 to green, and slot 2 to red.
- Incompatible display profiles disable packed preview and PNG export, but simulated preview still works.

The app includes three display profile options:

- RGB horizontal stripe
- BGR horizontal stripe
- Incompatible / simulated only

## Canvas And Previews

- **Canvas**: the default editable subpixel grid. Each subpixel cell is drawn in its physical channel color.
- **Simulated preview**: an enlarged fake screen preview that shows the subpixel stripes clearly on any display.
- **Packed preview**: packs every three logical subpixel cells into one normal RGB pixel. This is the same packing used for PNG export.

The preview buttons switch the canvas into simulated or packed preview. Selecting the active preview again, or selecting a drawing tool, returns to the editable grid.
The right panel includes a **Subpixel Signal** readout that shows active logical slot counts and remaps the channel labels when switching between RGB and BGR display profiles.
It also includes an **Export** readout with packed PNG size, RGBA byte count, render order, and logical slot-to-channel mapping.

## Tools

- Brush
- Eraser
- Clear canvas
- Undo and redo
- Zoom in and out
- Grid toggle
- Pixel-boundary toggle every three subpixel columns
- Calibration and slot-sweep pattern insertion

The canvas is scrollable, which provides practical panning for zoomed-in documents.
Subpix remembers local workspace preferences, including selected tool, display profile, zoom, grid visibility, and pixel-boundary visibility.
The pattern controls insert deterministic `.subpix` artwork into the active layer, including RGB calibration bars and a grayscale-compatible slot sweep for preview/export checks.

## Desktop Menus

The Electron build includes native desktop menus for common work:

- **File**: new documents, open, save, save as, and packed PNG export
- **Edit**: undo, redo, brush, eraser, and clear canvas
- **Tools**: calibration bars and slot-sweep pattern insertion
- **View**: drawing grid, simulated preview, packed preview, zoom, grid, and pixel boundaries
- **Display**: RGB stripe, BGR stripe, and incompatible simulated-only profiles

These menu actions are routed through the same editor commands as the toolbar and keyboard shortcuts.

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

## Current Limitations

- True physical subpixel preview only works on compatible horizontal RGB/BGR stripe displays.
- OLED, PenTile, diamond, and other layouts are not supported for true physical mode.
- Simulated preview works on any display.
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

Create a Windows installer:

```sh
npm run dist:win
```

Windows builds register `.subpix` as a **Subpixel Image** file association. When Subpix is launched with a `.subpix` path, the desktop shell opens that file directly, and additional `.subpix` launches are routed into the existing app window.

## Exporting PNGs

Open or create a `.subpix` document, choose a compatible RGB or BGR horizontal stripe display profile, then use **Export PNG**. Subpix packs the logical subpixel data into normal RGBA pixels with alpha set to 255.
