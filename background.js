// background.js – Service Worker

const MAX_HISTORY = 16;

function saveColorToHistory(payload) {
  chrome.storage.local.get({ colorHistory: [] }, ({ colorHistory }) => {
    let history = colorHistory.filter((h) => h.hex !== payload.hex);
    history.unshift(payload);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    chrome.storage.local.set({ colorHistory: history });
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "ACTIVATE_PICKER") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) {
        sendResponse({ ok: false, error: "No active tab found." });
        return;
      }
      chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({ ok: false, error: "Couldn't capture this page." });
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: "START_PICK", screenshot: dataUrl }, (_response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: "ColorFind can't run on this page." });
          } else {
            sendResponse({ ok: true });
          }
        });
      });
    });
    return true; // sendResponse is called asynchronously
  }

  if (msg.type === "DEACTIVATE_PICKER") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: "STOP_PICK" }, () => {
          // Ignore errors: content script may not be present on this page.
          void chrome.runtime.lastError;
        });
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === "COLOR_PICKED") {
    saveColorToHistory(msg.payload);
    sendResponse({ ok: true });
    return true;
  }
});
