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

    // Step 1: Modern CSS with Indeterminate Progress Bar
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
      /* Modern Loading Overlay */
      #pdfViewerLoading {
        position: fixed;
        inset: 0;
        background: #faf8f4;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #333;
        transition: opacity 0.3s ease-out;
      }
      .loading-card {
        background: white;
        padding: 32px 40px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.08);
        text-align: center;
        width: 300px;
      }
      .loading-icon {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.8;
        animation: float 2s ease-in-out infinite;
      }
      .loading-text {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 20px;
        color: #1a1a1a;
      }
      /* The Indeterminate Progress Bar */
      .progress-track {
        width: 100%;
        height: 6px;
        background: #f0f0f0;
        border-radius: 3px;
        overflow: hidden;
        position: relative;
      }
      .progress-bar {
        position: absolute;
        height: 100%;
        width: 40%;
        background: #2563eb;
        border-radius: 3px;
        animation: indeterminate 1.5s infinite linear;
        transform-origin: 0% 50%;
      }
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      @keyframes indeterminate {
        0% { transform: translateX(-100%) scaleX(0.2); }
        50% { transform: translateX(50%) scaleX(0.5); }
        100% { transform: translateX(200%) scaleX(0.2); }
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

    // Step 2: Create the structured loading card
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'pdfViewerLoading';
    loadingDiv.innerHTML = `
      <div class="loading-card">
        <svg class="loading-icon" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
           <polyline points="14 2 14 8 20 8"></polyline>
           <line x1="12" y1="18" x2="12" y2="12"></line>
           <polyline points="9 15 12 12 15 15"></polyline>
        </svg>
        <div class="loading-text">Opening Document...</div>
        <div class="progress-track">
          <div class="progress-bar"></div>
        </div>
      </div>
    `;

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
      loadingDiv.style.opacity = '0';
      // Wait for transition to finish before removing from DOM
      setTimeout(() => {
        loadingDiv?.remove();
      }, 350);
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
      const observer = new MutationObserver(() => {
        if (document.body) {
          observer.disconnect();
          injectElements();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }

    // Step 4: Clean up on navigation
    window.addEventListener('pagehide', () => {
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