chrome.storage.onChanged.addListener(() => {
  handleBadgedState();
});

handleBadgedState();

async function handleBadgedState() {
  const intercepts = (await getValueFromStorage("intercepts")) ?? [];

  const activeIntercepts = intercepts.filter(
    (intercept) => intercept.active
  ).length;

  const badgeText = activeIntercepts.toString();
  const badgeColor = activeIntercepts > 0 ? "#6E11B0" : "#000000";
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  chrome.action.setBadgeText({ text: badgeText });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message === "BLINK_CATCH_BADGE") {
    handleBlinkBadge();
  }
});

async function handleBlinkBadge() {
  for (let i = 0; i < 11; i++) {
    await chrome.action.setBadgeBackgroundColor({
      color: i % 2 === 0 ? "#6E11B0" : "#008236",
    });
    await sleep(300);
  }
}

function getValueFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ? JSON.parse(result[key]) : undefined);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}