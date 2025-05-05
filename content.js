const script = document.createElement("script");
script.type = "module";
script.src = chrome.runtime.getURL("lucy-web.js");
script.onload = () => script.remove(); // Limpieza opcional
(document.head || document.documentElement).appendChild(script);

sendIntercepts();

function sendIntercepts() {
  getValueFromStorage("intercepts").then((intercepts = []) => {
    sendMessage("INTERCEPTS_CHANGED", intercepts);
  });
}

onMessage("GET_INTERCEPTS_ASK", () => {
  sendIntercepts();
});

chrome.storage.onChanged.addListener(async () => {
  sendIntercepts();
});

onMessage("ON_BUG_CATCH", () => {
  chrome.runtime.sendMessage("BLINK_CATCH_BADGE");
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
