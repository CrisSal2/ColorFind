

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "ACTIVATE_PICKER") {


        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: "START_PICK" });
            }
        });
        sendResponse({ ok: true });
        return true;
    }


    if (msg.type === "GET_LAST_COLOR") {
        sendResponse(lastColor || null);
        return true;
    }
});

let lastColor = null;

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "COLOR_PICKED") {
        lastColor = msg.payload;
    }
});
