// Content script to inject viewer into confirmed PDF pages
(function() {
  'use strict';

  const viewerBaseUrl = chrome.runtime.getURL('viewer.html');

  function looksLikePdfUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url, location.href);
      const path = parsed.pathname.toLowerCase();
      if (path.endsWith('.pdf')) {
        return true;
      }
      const query = parsed.search.toLowerCase();
      if (query.includes('.pdf')) {
        return true;
      }
      const hash = parsed.hash.toLowerCase();
      return hash.includes('.pdf');
    } catch (err) {
      return /\.pdf(?:$|[?#])/i.test(url);
    }
  }

  const heuristicallyPdf = looksLikePdfUrl(location.href);

  function buildViewerSrc(sourceUrl) {
    const target = sourceUrl || location.href;
    return `${viewerBaseUrl}?src=${encodeURIComponent(target)}`;
  }

  function injectViewer(sourceUrl) {
    if (window.__pdfViewerInjected) return;
    window.__pdfViewerInjected = true;

    const viewerSrc = buildViewerSrc(sourceUrl);

    setTimeout(() => {
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
          <iframe id="pdfViewer" src="${viewerSrc}" allow="fullscreen"></iframe>
        </body>
        </html>
      `);
      document.close();
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
          e.preventDefault();
          document.getElementById('pdfViewer')
            ?.contentWindow?.postMessage({ type: 'PDF_VIEWER_PRINT' }, '*');
        }
      }, true);
    }, 10);
  }

  function evaluateInjectionResponse(response) {
    if (!response) {
      if (heuristicallyPdf) {
        injectViewer();
      }
      return;
    }

    if (response.extensionEnabled === false) {
      return;
    }

    if (response.shouldInject) {
      injectViewer(response.pdfUrl);
      return;
    }

    if (heuristicallyPdf) {
      injectViewer(response.pdfUrl);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.action === 'pdfDetected') {
      injectViewer(message.url);
    }
  });

  try {
    chrome.runtime.sendMessage({ action: 'shouldInjectPdf' }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        if (heuristicallyPdf) {
          injectViewer();
        }
        return;
      }
      evaluateInjectionResponse(response);
    });
  } catch (err) {
    if (heuristicallyPdf) {
      injectViewer();
    }
  }
})();
