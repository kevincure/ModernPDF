// Background service worker for PDF interception
chrome.runtime.onInstalled.addListener(() => {
  console.log('Local PDF Viewer extension installed');
  
  // Disable Chrome's built-in PDF viewer by default when extension is installed
  chrome.action.setBadgeText({ text: "ON" });
  chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
});

// Listen for tab updates to handle PDF navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if this is a PDF URL that somehow wasn't caught by declarativeNetRequest
    if (tab.url.toLowerCase().endsWith('.pdf') || 
        tab.url.includes('.pdf?') || 
        tab.url.includes('.pdf#')) {
      
      // Only redirect if we're not already on our viewer page
      if (!tab.url.includes(chrome.runtime.id)) {
        const viewerUrl = chrome.runtime.getURL('viewer.html') + '?src=' + encodeURIComponent(tab.url);
        chrome.tabs.update(tabId, { url: viewerUrl });
      }
    }
  }
});

// Handle messages from the viewer
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPdfUrl') {
    // Extract the PDF URL from the viewer URL parameters
    const url = new URL(sender.tab.url);
    const pdfUrl = url.searchParams.get('src');
    sendResponse({ pdfUrl: pdfUrl });
  }
  return true;
});

// Toggle extension on/off when action button is clicked
let extensionEnabled = true;

chrome.action.onClicked.addListener(async (tab) => {
  extensionEnabled = !extensionEnabled;
  
  if (extensionEnabled) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
    
    // Re-enable the declarative net request rules
    chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: ["ruleset_1"]
    });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    
    // Disable the declarative net request rules
    chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ["ruleset_1"]
    });
  }
});

// Handle PDF downloads to open in viewer instead
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  if (extensionEnabled && downloadItem.mime === 'application/pdf') {
    // Cancel the download and open in viewer instead
    chrome.downloads.cancel(downloadItem.id, () => {
      const viewerUrl = chrome.runtime.getURL('viewer.html') + '?src=' + encodeURIComponent(downloadItem.url);
      chrome.tabs.create({ url: viewerUrl });
    });
    // Return false to indicate we're handling this
    return false;
  }
});