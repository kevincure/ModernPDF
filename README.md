# Minimal PDF Viewer

This project is a lightweight PDF reader that supports focused annotation tools for quick markups. Load a document, drop styled text or threaded comments, reuse a stored signature, and export an updated copy — all without heavy UI chrome.

## Workflow
- **Open** a PDF with the folder icon, then **Save** to download the annotated copy. Any existing PDF text comments are imported as pins you can continue.
- Use the person icon to set your **name and signature**; both values persist between sessions.
- Tools (text, comments, signatures) are single-use. Pick a tool, click the page once, and the interface returns to select mode. A dedicated **Select text** button exposes a selectable text layer for copy/paste without leaving the viewer.

## Navigation & Layout
- **Arrow keys**: Left/Right change pages, Up/Down scroll the current page.
- **Zoom** with the +/- magnifier buttons. Annotations stay perfectly aligned at any zoom level.
- **Fit width** fills the reading column (excluding the toolbar). Press **F** or use the maximize icon for fullscreen reader mode.

## Tips
- Comment pins carry full reply threads. Use the reply button inside the sidebar to keep conversations tidy.
- Click outside the comment drawer to close it quickly.
- Signatures are draggable and resizable once placed; use the corner handle or reopen the identity dialog to redraw them at any time.

## Browser extension

The repository ships with a Chrome-compatible extension that redirects any PDF opened in the browser into this viewer and performs cross-origin fetches on behalf of the page. To install it:

1. Open `chrome://extensions` in a Chromium-based browser, enable **Developer mode**, and choose **Load unpacked**.
2. Select the repository folder. The extension uses the root-level `manifest.json`, `background.js`, and the existing `pdf.html` file.
3. Visit a PDF URL. The extension redirects the tab to `pdf.html?src=...` and streams the bytes through the background service worker, bypassing CORS restrictions.

If a remote PDF still fails to load, the viewer surfaces an error explaining how to download the file or use a CORS-enabled link.

