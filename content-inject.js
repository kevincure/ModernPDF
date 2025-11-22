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

    // Don't use document.open() - it breaks navigation and history
    // Instead, inject CSS and iframe overlay on the existing document
    // This preserves URL bar and history entry while showing our viewer

    // Step 1: Inject CSS immediately to hide body (prevents text mess while loading)
    const style = document.createElement('style');
    style.id = 'pdfViewerHideStyle';
    style.textContent = `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        width: 100% !important;
        height: 100% !important;
        background: #faf8f4 !important;
      }
      body > *:not(#pdfViewer):not(#pdfViewerLoading) {
        display: none !important;
      }
      #pdfViewerLoading {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #faf8f4;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #666;
        font-size: 14px;
      }
      #pdfViewerLoading::after {
        content: 'Loading PDF...';
        animation: pdfPulse 1.5s ease-in-out infinite;
      }
      @keyframes pdfPulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
      #pdfViewer {
        opacity: 0;
        transition: opacity 0.2s ease-in;
      }
      #pdfViewer.loaded {
        opacity: 1;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    // Step 2: Create loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'pdfViewerLoading';

    // Step 3: Create viewer iframe overlay
    const iframe = document.createElement('iframe');
    iframe.id = 'pdfViewer';
    iframe.src = viewerSrc;
    iframe.allow = 'fullscreen';
    iframe.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
      z-index: 2147483647;
    `;

    // Handle iframe load - fade in and remove loading indicator
    iframe.addEventListener('load', () => {
      iframe.classList.add('loaded');
      // Remove loading indicator after fade-in completes
      setTimeout(() => {
        loadingDiv?.remove();
      }, 200);
    });

    // Inject elements when DOM is ready
    const injectElements = () => {
      const container = document.body || document.documentElement;
      container.appendChild(loadingDiv);
      container.appendChild(iframe);
    };

    if (document.body) {
      injectElements();
    } else {
      // Wait for body to exist
      const observer = new MutationObserver(() => {
        if (document.body) {
          observer.disconnect();
          injectElements();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }

    // Step 4: Clean up on navigation away (fixes back button)
    window.addEventListener('pagehide', () => {
      // Remove our injected elements so back-forward cache doesn't preserve them
      iframe?.remove();
      loadingDiv?.remove();
      style?.remove();
    }, { once: true });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        iframe.contentWindow?.postMessage({ type: 'PDF_VIEWER_PRINT' }, '*');
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
