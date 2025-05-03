const script = document.createElement("script");
script.type = "module";
script.src = chrome.runtime.getURL("catcher.js");
script.onload = () => script.remove(); // Limpieza opcional
(document.head || document.documentElement).appendChild(script);

setTimeout(() => {
  sendIntercepts();
}, 3000);

chrome.storage.onChanged.addListener(async () => {
  sendIntercepts();
});
function sendIntercepts() {
  getValueFromStorage("intercepts").then((intercepts = []) => {
    sendMessage("INTERCEPTS_CHANGED", intercepts);
  });
}

function sendMessage(name, value) {
  window.postMessage({ name, value }, window.location.origin);
}

function getValueFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ? JSON.parse(result[key]) : undefined);
    });
  });
}
