const script = document.createElement("script");
script.type = "module";
script.src = chrome.runtime.getURL("lucy-web.js");
script.onload = () => script.remove(); // Limpieza opcional
(document.head || document.documentElement).appendChild(script);

const TRAPS = "traps";

sendTraps();

function sendTraps() {
  getValueFromStorage(TRAPS).then((traps = []) => {
    sendMessage("TRAPS_UPDATED", traps);
  });
}

onMessage("GET_TRAPS_ASK", () => {
  sendTraps();
});

chrome.storage.onChanged.addListener(() => {
  sendTraps();
});

onMessage("ON_BUG_CATCH", () => {
  chrome.runtime.sendMessage({ action: "BLINK_CATCH_BADGE" });
});

onMessage("ON_REQUEST_SPY", (data) => {
  chrome.runtime.sendMessage({ action: "SAVE_REQUEST_SPY", data });
});

// Helpers duplicados porque este archivo no tiene acceso al resto del código
function sendMessage(name, value) {
  window.postMessage({ name, value }, window.location.origin);
}
function onMessage(name, callback) {
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin)
      return;

    if (event.data.name === name) {
      callback(event.data.value);
    }
  });
}
function getValueFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ? JSON.parse(result[key]) : undefined);
    });
  });
}
