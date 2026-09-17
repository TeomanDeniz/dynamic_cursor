# Dynamic Swing Cursor

## [Live Demo!](https://teomandeniz.github.io/SELECTION_JS/)

Replace the system cursor with your own images, driven by your normal CSS `cursor:` rules, with optional swing physics.

<p align="center">
 <img src="https://raw.githubusercontent.com/TeomanDeniz/TeomanDeniz/refs/heads/main/images/repo_projects/DYNAMIC_SWING_HTML/maximum-tension.gif" alt="" />
</p>

## Features

* Uses the CSS you already write: `cursor: pointer`, `cursor: text`, `cursor: url(x.png) 4 4, auto`.
* Image files or inline `<svg>` strings.
* Three swing styles: `smooth`, `spring`, `pendulum`. The same feel at 60 Hz, 144 Hz or 240 Hz.
* `cursor: auto` behaves like the browser: text cursor over text and inputs, arrow elsewhere.
* Updates when you scroll, press buttons, or when classes change.
* Stays above modal dialogs and fullscreen elements.
* Gives the system cursor back where it can't be replaced: scrollbars, touch screens, iframes, and outside the window.
* Turns swinging off for users who ask for reduced motion.
* Sleeps when nothing moves (no work every frame).
* No CSS file and no dependencies.

## Install

Classic script:

```html
<script src="dynamic_cursor.js"></script>
<script>
	dynamic_cursor.start({ cursors: { ... } });
</script>
```

ES module (keep `dynamic_cursor.js` next to it):

```js
import dynamic_cursor from "./dynamic_cursor.mjs";

dynamic_cursor.start({ cursors: { ... } });
```

The script can be placed anywhere, including `<head>`.

## Usage

```js
const cursor = dynamic_cursor.start({
	cursors: {
		default: { src: "cursor_default.png", x: 2, y: 3, w: 20, h: 30 },
		pointer: { src: "cursor_pointer.svg", x: 9, y: 1 },
		text:    { src: "<svg ...>...</svg>", x: 6, y: 12, swing: false }
	},
	swing: "smooth"
});
```

Then write normal CSS:

```css
.my-button { cursor: pointer; }
```

### Cursor definition

| Field   | Meaning                                                                 |
| ------- | ----------------------------------------------------------------------- |
| `src`   | Image URL or an inline `<svg>...</svg>` string. Required.               |
| `x`,`y` | Hotspot: the point that touches the mouse position, in px. Default `0`. |
| `w`,`h` | Size in px. Give one and the other keeps the aspect ratio. Default: the image's own size. |
| `swing` | `false`, `true`, `"smooth"`, `"spring"`, `"pendulum"`, or an options object. Default: the global `swing`. |

Cursor names are CSS cursor keywords (`default`, `pointer`, `text`, `grab`, `move`, `not-allowed`, …). A keyword without an image uses a close relative (`grabbing` → `grab`, `vertical-text` → `text`), then `default`.

### Start options

| Option           | Default     | Meaning                                                                      |
| ---------------- | ----------- | ---------------------------------------------------------------------------- |
| `cursors`        | `{}`        | Named cursors (see above).                                                   |
| `swing`          | `"smooth"`  | Swing for every cursor that doesn't set its own. `false` turns it off.       |
| `fallback`       | `"default"` | When a keyword has no image: `"default"` shows your default cursor, `"native"` shows the system cursor. |
| `aliases`        | see above   | Extra keyword → name mappings, e.g. `{ "zoom-in": "pointer" }`.              |
| `reduced_motion` | `"respect"` | `"ignore"` keeps swinging even when the user asked for reduced motion.       |
| `watch_dom`      | `true`      | Re-check the cursor when classes or elements change under the mouse (at most 10 times per second). |

### Swing options

Pass a mode name, or an object to fine-tune it:

```js
swing: { mode: "spring", stiffness: 120, damping: 6 }
```

| Mode       | Feel                                                        | Settings                                           |
| ---------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `smooth`   | The original. Leans with the movement, never overshoots.     | `strength`, `decay`, `follow`, `max_angle`         |
| `spring`   | Leans, overshoots, and wobbles back into place.             | `strength`, `stiffness`, `damping`, `max_angle`    |
| `pendulum` | Reacts to speeding up and slowing down, keeps swinging, can spin all the way around. | `strength`, `gravity`, `damping`, `hang`, `max_angle` |

`hang: true` makes a pendulum cursor rest hanging straight down from its hotspot. `max_angle` is in radians (`null` means no limit). The defaults are in `dynamic_cursor.swing_presets`.

The swing comes from where the hotspot is. A hotspot at the image's center doesn't swing; a hotspot at the top edge swings the most.

### CSS controls

```css
/* Any image, hotspot 8 8. Size comes from the image or --cursor-size. */
.lamp { cursor: url("lamp.svg") 8 8, auto; }

/* Turn swinging off here, or pick a mode */
.form { --cursor-swing: off; }           /* off | on | smooth | spring | pendulum */

/* Resize the cursor here: one value for width (keeps aspect) or two */
.big  { --cursor-size: 48px; }
.wide { --cursor-size: 40px 24px; }
```

These are inherited like any custom property, so setting them on a container affects everything inside it.

### Controlling it later

```js
cursor.set_cursor("wait", { src: "hourglass.svg", x: 8, y: 0 });
cursor.remove_cursor("wait");
cursor.set_swing("pendulum");
cursor.refresh();   // re-read CSS right now
cursor.stop();      // remove everything, give back the system cursor
```

Calling `dynamic_cursor.start()` again replaces the previous cursor. `dynamic_cursor.stop()` stops whichever one is running.

## How it works

The library adds `cursor: none !important` to the page. To learn which cursor the page *wants*, it switches that rule off for one synchronous read of `getComputedStyle()` and switches it back on. The browser paints nothing in between, so there's no flicker. This read only happens when the element under the mouse changes, a button is pressed, the page scrolls, or the DOM changes, so it stays cheap.

The cursor image lives in a closed shadow root as a manual popover. The shadow root keeps page styles like `img { max-width: 100% }` from affecting it; the popover keeps it above dialogs.

## Limitations

* Scrollbars, native `<select>` menus, and iframes always show the system cursor; browsers don't allow anything else there.
* `image-set()` cursors are skipped (the next value in the list is used).
* The image cursor is drawn by the page, so it can lag one frame behind the real mouse position on slow pages.

## Upgrading from `DYNAMIC_CURSOR.RUN`

| Before                          | Now                                           |
| ------------------------------- | --------------------------------------------- |
| `DYNAMIC_CURSOR.RUN({ ... })`   | `dynamic_cursor.start({ cursors: { ... } })`  |
| `SRC`, `X`, `Y`, `W`, `H`       | `src`, `x`, `y`, `w`, `h`                     |
| `SWING: true`                   | `swing: true` (or a mode name)                |
| `transform-origin` for hotspot  | `cursor: url(x.png) 8 8, auto`                |
| `--swing: true`                 | `--cursor-swing: on` (`--swing` still works)  |
| `DYNAMIC_CURSOR.css`            | Not needed anymore                            |
