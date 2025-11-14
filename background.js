// Background service worker for PDF interception
const PDF_URL_REGEX = /\.pdf(?:$|[?#])/i;
const PDF_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'application/acrobat',
  'application/vnd.pdf',
  'text/pdf'
]);
const pendingPdfSources = new Map();
let extensionEnabled = true;

function isPdfUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'file:', 'ftp:'].includes(parsed.protocol)) {
      return false;
    }
    return PDF_URL_REGEX.test(parsed.pathname + parsed.search + parsed.hash);
  } catch (err) {
    return PDF_URL_REGEX.test(url);
  }
}

async function fetchPdfBytes(url) {
  const MAX_ATTEMPTS = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      return {
        bytes: Array.from(new Uint8Array(buffer)),
        contentType: response.headers.get('content-type') || ''
      };
    } catch (err) {
      lastError = err;
      if (url.startsWith('file:')) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 200));
    }
  }
  throw lastError || new Error('Unable to fetch PDF bytes.');
}

function cachePdfSource(tabId, url) {
  if (!tabId || !url) return;
  pendingPdfSources.set(tabId, url);
}

function getCachedPdfSource(tabId) {
  if (!tabId) return null;
  return pendingPdfSources.get(tabId) || null;
}

function getHeaderValue(headers, name) {
  if (!Array.isArray(headers)) return '';
  const lowerName = name.toLowerCase();
  for (const header of headers) {
    if (typeof header?.name === 'string' && header.name.toLowerCase() === lowerName) {
      if (Array.isArray(header.value)) {
        return header.value.join(',');
      }
      return header.value || '';
    }
  }
  return '';
}

function hasPdfContentType(value) {
  if (!value) return false;
  const normalized = value.split(';', 1)[0].trim().toLowerCase();
  return PDF_CONTENT_TYPES.has(normalized);
}

function hasPdfDisposition(value) {
  if (!value) return false;
  return /filename\s*=\s*"?[^";]+\.pdf/i.test(value);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pendingPdfSources.delete(tabId);
});

function registerPdfForTab(tabId, url) {
  if (!tabId || tabId === chrome.tabs.TAB_ID_NONE) return;
  if (!url) return;
  cachePdfSource(tabId, url);
  try {
    chrome.tabs.sendMessage(tabId, { action: 'pdfDetected', url }, () => {
      void chrome.runtime.lastError;
    });
  } catch (err) {
    // Ignore messaging errors (e.g., no content script yet).
  }
}

function isPdfResponse(details) {
  const contentType = getHeaderValue(details.responseHeaders, 'content-type');
  if (hasPdfContentType(contentType)) {
    return true;
  }
  const disposition = getHeaderValue(details.responseHeaders, 'content-disposition');
  if (hasPdfDisposition(disposition)) {
    return true;
  }
  return false;
}

if (chrome.webRequest?.onHeadersReceived) {
  try {
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        if (!extensionEnabled) return;
        if (details.frameId !== 0) return;
        if (!isPdfResponse(details)) return;
        registerPdfForTab(details.tabId, details.url);
      },
      { urls: ['<all_urls>'], types: ['main_frame'] },
      ['responseHeaders']
    );
  } catch (err) {
    console.warn('Failed to register onHeadersReceived listener', err);
  }
}

// Cache PDF URLs when detected via navigation heuristics
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.frameId !== 0) return;
  if (details.url && isPdfUrl(details.url)) {
    registerPdfForTab(details.tabId, details.url);
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.frameId !== 0) return;
  if (details.url && isPdfUrl(details.url)) {
    registerPdfForTab(details.tabId, details.url);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action === 'getPdfUrl') {
    let pdfUrl = null;
    if (sender?.tab?.id) {
      pdfUrl = getCachedPdfSource(sender.tab.id);
    }
    if (!pdfUrl && sender?.tab?.url) {
      pdfUrl = sender.tab.url;
    }
    sendResponse({ pdfUrl: pdfUrl });
    return false;
  }

  if (request?.action === 'shouldInjectPdf') {
    if (!extensionEnabled) {
      sendResponse({ shouldInject: false, extensionEnabled: false, pdfUrl: null });
      return false;
    }
    const tabId = sender?.tab?.id ?? null;
    const pdfUrl = tabId ? getCachedPdfSource(tabId) : null;
    sendResponse({
      shouldInject: Boolean(pdfUrl),
      extensionEnabled: true,
      pdfUrl: pdfUrl || sender?.tab?.url || null
    });
    return false;
  }

  if (request?.action === 'fetchPdf') {
    if (!extensionEnabled) {
      sendResponse({ success: false, error: 'Extension is currently disabled.' });
      return false;
    }
    const url = request.url || getCachedPdfSource(sender?.tab?.id);
    if (!url) {
      sendResponse({ success: false, error: 'No PDF source URL is available.' });
      return false;
    }
    fetchPdfBytes(url)
      .then(({ bytes, contentType }) => {
        sendResponse({ success: true, data: bytes, contentType });
      })
      .catch((error) => {
        console.error('Failed to fetch PDF bytes', error);
        sendResponse({ success: false, error: error?.message || 'Failed to fetch PDF.' });
      });
    return true;
  }

  return false;
});

chrome.action.onClicked.addListener(() => {
  extensionEnabled = !extensionEnabled;

  if (extensionEnabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    chrome.declarativeNetRequest.updateEnabledRulesets({ 
      enableRulesetIds: ['ruleset_1'] 
    });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    chrome.declarativeNetRequest.updateEnabledRulesets({ 
      disableRulesetIds: ['ruleset_1'] 
    });
  }
});