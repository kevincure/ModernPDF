const viewerUrl = chrome.runtime.getURL('pdf.html');

chrome.webRequest.onHeadersReceived.addListener(
  details => {
    const url = details.url;
    if (url.startsWith(viewerUrl)) {
      return {};
    }
    const headers = details.responseHeaders || [];
    const typeHeader = headers.find(h => h.name && h.name.toLowerCase() === 'content-type');
    const isPdf = typeHeader && typeof typeHeader.value === 'string' && typeHeader.value.toLowerCase().includes('application/pdf');
    if (isPdf) {
      return { redirectUrl: `${viewerUrl}?src=${encodeURIComponent(url)}` };
    }
    return {};
  },
  { urls: ['<all_urls>'], types: ['main_frame'] },
  ['blocking', 'responseHeaders']
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'fetchPdf' && message.url) {
    fetch(message.url)
      .then(async res => {
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const buffer = await res.arrayBuffer();
        sendResponse({ ok: true, data: Array.from(new Uint8Array(buffer)) });
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message || String(err) });
      });
    return true;
  }
  return undefined;
});
