# ModernPDF

This project is a lightweight PDF reader that supports just enough annotation tools for quick markups. Load a document, drop text or comment pins, reuse a stored signature, and export an updated copy — all without extra chrome.

**Chrome Extension:** ModernPDF is designed as a Chrome extension. While it may work in other Chromium-based browsers (Edge, Brave, Opera), it is not compatible with Firefox or Safari, which use different extension architectures.

## Install as a Chrome or Edge extension
1. Clone or download this repository to your machine and note the folder location.
2. In **Google Chrome**, open `chrome://extensions`, toggle **Developer mode** on, then click **Load unpacked** and choose the folder. In **Microsoft Edge**, open `edge://extensions`, enable **Developer mode**, and select **Load unpacked** to pick the same folder.
3. (Recommended) After loading, enable **Allow access to file URLs** in the extension card if you plan to open local PDFs from disk.
4. The ModernPDF action button toggles interception on/off. Leave it **ON** for automatic PDF replacement in the custom viewer.

## Workflow
- **Open** a PDF with the folder icon, then **Save** to download the annotated copy. Any existing PDF text comments are imported as pins you can continue.
- Use the person icon to set your **name and signature**; both values persist between sessions.
- Tools (text, comments, signatures) are single-use. Pick a tool, click the page once, and the interface returns to select mode.

## Navigation & Layout
- **Arrow keys**: Left/Right change pages, Up/Down scroll the current page.
- **Zoom** with the +/- magnifier buttons. Annotations are hidden whenever you zoom away from 100% to prevent misalignment.
- **Fit width** fills the reading column (excluding the toolbar). Press **F** or use the maximize icon for fullscreen reader mode.

## Tips
- Click outside the comment drawer to close it quickly.
- Return to 100% zoom — or click Save — to bring annotations back after zooming.
- Signatures are draggable and resizable once placed; use the corner handle or reopen the identity dialog to redraw them at any time.

