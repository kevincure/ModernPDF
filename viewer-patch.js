// Patch for viewer.js to handle Chrome extension environment better
// Add this code at the beginning of viewer.js or load it as a separate script

// Override the PDF loading section at the end of viewer.js (lines 2008-2018)
// This patch handles both direct file URLs and cross-origin PDFs

(function() {
  // Wait for the original code to set up
  const originalInit = window.onload;
  window.onload = function() {
    if (originalInit) originalInit();
    
    // Enhanced PDF loading for Chrome extension
    const u = new URL(location.href);
    const src = u.searchParams.get('src');
    
    if (!src) {
      console.log('No PDF source specified');
      return;
    }
    
    console.log('Loading PDF from:', src);
    
    // Function to load PDF with better error handling
    const loadPdf = async () => {
      try {
        // Check if we're in extension context
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          // In extension, we might need to handle CORS differently
          
          // First try direct fetch
          try {
            const response = await fetch(src, {
              mode: 'cors',
              credentials: 'omit'
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const buf = await response.arrayBuffer();
            await loadPdfBytesArray(new Uint8Array(buf));
            console.log('PDF loaded successfully via direct fetch');
          } catch (fetchError) {
            console.warn('Direct fetch failed:', fetchError);
            
            // Try using XMLHttpRequest as fallback
            const xhr = new XMLHttpRequest();
            xhr.open('GET', src, true);
            xhr.responseType = 'arraybuffer';
            
            xhr.onload = async function() {
              if (xhr.status === 200) {
                const buf = xhr.response;
                await loadPdfBytesArray(new Uint8Array(buf));
                console.log('PDF loaded successfully via XHR');
              } else {
                throw new Error(`XHR failed with status: ${xhr.status}`);
              }
            };
            
            xhr.onerror = function() {
              console.error('XHR failed to load PDF');
              // Last resort: try to open the PDF in a new tab
              alert('Unable to load PDF in viewer. The PDF will open in a new tab.');
              window.open(src, '_blank');
            };
            
            xhr.send();
          }
        } else {
          // Not in extension, use regular fetch
          const response = await fetch(src);
          const buf = await response.arrayBuffer();
          await loadPdfBytesArray(new Uint8Array(buf));
          console.log('PDF loaded successfully (non-extension mode)');
        }
      } catch (error) {
        console.error('Failed to load PDF:', error);
        
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 20px;
          background: white;
          border: 2px solid red;
          border-radius: 5px;
          z-index: 9999;
        `;
        errorDiv.innerHTML = `
          <h3>Error Loading PDF</h3>
          <p>Unable to load the PDF file.</p>
          <p>Error: ${error.message}</p>
          <button onclick="window.location.reload()">Retry</button>
          <button onclick="window.open('${src}', '_blank')">Open in New Tab</button>
        `;
        document.body.appendChild(errorDiv);
      }
    };
    
    // Start loading the PDF
    loadPdf();
  };
})();

// Additional helper for handling Chrome's PDF plugin conflicts
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Disable Chrome's PDF plugin on this page if possible
  document.addEventListener('DOMContentLoaded', function() {
    // Check if Chrome's PDF viewer is trying to take over
    const embedElements = document.querySelectorAll('embed[type="application/pdf"]');
    embedElements.forEach(embed => {
      embed.style.display = 'none';
    });
  });
}