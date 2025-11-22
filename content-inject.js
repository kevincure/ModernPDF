// Content script to inject viewer into confirmed PDF pages
(function() {
  'use strict';

  const viewerBaseUrl = chrome.runtime.getURL('viewer.html');

  // Track injection state
  let injectionScheduled = false;
  let confirmedPdf = false;

  function looksLikePdfUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url, location.href);
      const path = parsed.pathname.toLowerCase();

      // Strong signal: pathname ends with .pdf
      if (path.endsWith('.pdf')) {
        return true;
      }

      // REMOVED: query string matching to avoid false positives on SSRN-like sites
      // OLD: if (query.includes('.pdf')) return true;

      // Only match if .pdf appears in hash (rare but valid)
      const hash = parsed.hash.toLowerCase();
      if (hash.startsWith('#') && hash.includes('.pdf')) {
        return true;
      }

      return false;
    } catch (err) {
      // Fallback regex: only match .pdf at end of pathname
      return /\.pdf(?:[?#]|$)/i.test(url);
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
    const originalUrl = sourceUrl || location.href;

    // Stop the current page load to prevent it from creating a history entry
    try {
      window.stop();
    } catch (err) {
      // Ignore errors
    }

    // Inject immediately (no setTimeout) to prevent duplicate history entries
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

    // Fix back button: replace history state to prevent duplicate entries
    // This ensures the URL bar shows the PDF URL, not the viewer URL
    try {
      if (history.state !== null || location.href !== originalUrl) {
        history.replaceState(null, '', originalUrl);
      }
    } catch (err) {
      // Ignore errors (e.g., on file:// URLs)
    }

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        document.getElementById('pdfViewer')
          ?.contentWindow?.postMessage({ type: 'PDF_VIEWER_PRINT' }, '*');
      }
    }, true);
  }

  function evaluateInjectionResponse(response) {
    if (!response) {
      // No response from background - use heuristics
      if (heuristicallyPdf) {
        injectViewer();
      }
      return;
    }

    if (response.extensionEnabled === false) {
      return;
    }

    if (response.shouldInject) {
      confirmedPdf = true;
      injectViewer(response.pdfUrl);
      return;
    }

    // Heuristic match but not confirmed yet - wait a bit longer for header confirmation
    if (heuristicallyPdf && !injectionScheduled) {
      injectionScheduled = true;
      // Wait up to 500ms for header confirmation before falling back to heuristic
      setTimeout(() => {
        if (!window.__pdfViewerInjected && !confirmedPdf) {
          // Timeout - inject based on heuristic
          injectViewer(response.pdfUrl);
        }
      }, 500);
    }
  }

  // Listen for confirmed PDF detection from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.action === 'pdfDetected') {
      confirmedPdf = true;
      injectViewer(message.url);
    }
  });

  // Initial check with background script
  try {
    chrome.runtime.sendMessage({ action: 'shouldInjectPdf' }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        // Extension context invalid - use heuristic
        if (heuristicallyPdf) {
          injectViewer();
        }
        return;
      }
      evaluateInjectionResponse(response);
    });
  } catch (err) {
    // Fallback to heuristic
    if (heuristicallyPdf) {
      injectViewer();
    }
  }
})();
