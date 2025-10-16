const viewerPath = chrome.runtime.getURL('pdf.html');

function isPdf(headers) {
  if (!headers) return false;
  for (const header of headers) {
    if (header.name && header.value && header.name.toLowerCase() === 'content-type') {
      if (header.value.toLowerCase().includes('application/pdf')) {
        return true;
      }
    }
  }
  return false;
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.url.startsWith(viewerPath)) {
      return {};
    }
    if (details.initiator && details.initiator.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
      return {};
    }
    if (!isPdf(details.responseHeaders)) {
      return {};
    }
    const redirectUrl = new URL(viewerPath);
    redirectUrl.searchParams.set('src', encodeURIComponent(details.url));
    return { redirectUrl: redirectUrl.toString() };
  },
  { urls: ['<all_urls>'], types: ['main_frame'] },
  ['blocking', 'responseHeaders']
);
