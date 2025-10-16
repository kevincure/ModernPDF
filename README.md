# ModernPDF Annotator

ModernPDF is a lightweight in-browser PDF viewer that supports text annotations, comments with threaded replies, signatures, and exporting those edits back into the PDF. The viewer uses pdf.js for rendering and pdf-lib for writing annotations.

## Running the viewer locally

1. Clone or download this repository.
2. Open `pdf.html` directly in a modern browser, or host the folder with any static web server.
3. Use the toolbar on the left to open a PDF, add annotations, and save the updated document.
4. The `?src=` query parameter can be used to open a remote PDF (for example `pdf.html?src=https%3A%2F%2Fexample.com%2Ffile.pdf`). When a PDF cannot be loaded because of cross-origin (CORS) restrictions, the viewer displays a banner that explains how to proceed.

## Installing as a Chrome/Edge extension

1. Download this repository or clone it locally.
2. Open `chrome://extensions` (or `edge://extensions` in Microsoft Edge`).
3. Enable **Developer mode** in the top-right corner.
4. Choose **Load unpacked** and select the folder that contains `manifest.json`.
5. The extension registers a blocking webRequest handler that redirects PDFs to `pdf.html` inside the extension. Whenever a PDF is opened in the browser, it will automatically load in ModernPDF with the original URL passed in the `src` parameter.
6. Because the extension declares the `<all_urls>` host permission, it can fetch cross-origin PDFs without being blocked by CORS.

To remove the extension, return to the extensions page and click **Remove**.

## Features

- Text annotations keep their bold/italic styling and line breaks when exported.
- Automatic word wrapping based on the annotation box width.
- Comment pins support threaded replies; replies are preserved when saving.
- Drag-and-drop annotations stay within the page bounds.
- The annotation layer scales with zoom so items stay aligned at any zoom level.
- Virtualized page rendering renders only visible pages for better performance.
- Optional text selection mode that exposes a text layer for copy/paste.
- Signature annotations accept pasted PNG data URLs or a quick drawing pad.

## Known limitations

- The built-in word wrapping is based on pdf-lib font metrics. Extremely unusual scripts may require manual adjustment.
- The PDF is saved with standard fonts (Helvetica, Times, Courier). Custom fonts are not embedded.
