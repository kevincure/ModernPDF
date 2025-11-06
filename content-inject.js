// Content script to inject viewer into PDF pages
(function() {
  'use strict';

  // Check if this looks like a PDF URL
  const isPdfUrl = location.pathname.toLowerCase().endsWith('.pdf') ||
                   location.search.toLowerCase().includes('.pdf') ||
                   location.hash.toLowerCase().includes('.pdf');

  if (!isPdfUrl) return;

  // Prevent multiple injections
  if (window.__pdfViewerInjected) return;
  window.__pdfViewerInjected = true;

  // Wait a moment for the page to start loading
  setTimeout(() => {
    // Clear and inject viewer
    document.open();
    document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }
          iframe {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
            z-index: 999999;
          }
        </style>
      </head>
      <body>
        <iframe id="pdfViewer" src="${chrome.runtime.getURL('viewer.html') + '?src=' + encodeURIComponent(location.href)}" allow="fullscreen"></iframe>
      </body>
      </html>
    `);
    document.close();
 // Forward Ctrl/Cmd+P to the viewer iframe so it can prepare pages before printing
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        document.getElementById('pdfViewer')
          ?.contentWindow?.postMessage({ type: 'PDF_VIEWER_PRINT' }, '*');
      }
    }, true);
  }, 10);
})();