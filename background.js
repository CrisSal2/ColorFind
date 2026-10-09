// background.js – Service Worker

const MAX_HISTORY = 16;

// Saves are chained so rapid picks can't read the same old history and
// overwrite each other's writes.
let saveQueue = Promise.resolve();

function saveColorToHistory(payload) {
  saveQueue = saveQueue
    .then(async () => {
      const { colorHistory } = await chrome.storage.local.get({ colorHistory: [] });
      const history = colorHistory.filter((h) => h.hex !== payload.hex);
      history.unshift(payload);
      await chrome.storage.local.set({ colorHistory: history.slice(0, MAX_HISTORY) });
    })
    .catch(() => {});
}

function startPick(tabId, screenshot) {
  return chrome.tabs.sendMessage(tabId, { type: "START_PICK", screenshot });
}

async function activatePicker() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return { ok: false, error: "No active tab found." };

  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (e) {
    return { ok: false, error: "Couldn't capture this page." };
  }

  try {
    return await startPick(tab.id, dataUrl);
  } catch (e) {
    // No content script listening, e.g. the tab was open before the extension
    // was installed or reloaded. Inject it and try once more.
  }

  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return await startPick(tab.id, dataUrl);
  } catch (e) {
    return { ok: false, error: "ColorFind can't run on this page." };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "ACTIVATE_PICKER") {
    activatePicker().then(sendResponse);
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
