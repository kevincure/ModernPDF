// Background service worker for PDF interception
const PDF_URL_REGEX = /\.pdf(?:$|[?#])/i;
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pendingPdfSources.delete(tabId);
});

// Cache PDF URLs when detected
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.frameId !== 0) return;
  if (details.url && isPdfUrl(details.url)) {
    cachePdfSource(details.tabId, details.url);
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (!extensionEnabled) return;
  if (details.frameId !== 0) return;
  if (details.url && isPdfUrl(details.url)) {
    cachePdfSource(details.tabId, details.url);
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