// background.js – Service Worker

let lastColor = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ACTIVATE_PICKER") {
    // Inject the picker activation into the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "START_PICK" }, (response) => {
          // Ignore errors if content script isn't loaded yet
          if (chrome.runtime.lastError) {
            console.log("Content script not ready yet, injecting...");
            // Content script will auto-load on next page interaction
          }
        });
      }
    });
    sendResponse({ ok: true });
    return true;
  }

  // Store last color in memory
  if (msg.type === "COLOR_PICKED") {
    lastColor = msg.payload;
    sendResponse({ ok: true });
    return true;
  }

  // Popup asks for the last picked color
  if (msg.type === "GET_LAST_COLOR") {
    sendResponse(lastColor || null);
    return true;
  }
});
