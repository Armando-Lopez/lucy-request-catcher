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

chrome.runtime.onMessage.addListener(async ({ action, data }) => {
  if (action === "BLINK_CATCH_BADGE") {
    handleBlinkBadge();
  }
  if (action === "SAVE_REQUEST_SPY") {
    const savedSpies = await getValueFromSession("requests_spies");
    if (!savedSpies) {
      setValueToSession("requests_spies", [data]);
    } else {
      savedSpies.unshift(data);
      const limitedSpies = savedSpies.slice(0, 30);
      setValueToSession("requests_spies", limitedSpies);
    }
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

// Helpers duplicados porque este archivo no tiene acceso al resto del código
function getValueFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ? JSON.parse(result[key]) : undefined);
    });
  });
}

function setValueToSession(key, value) {
  return new Promise((resolve) => {
    chrome.storage.session.set({ [key]: JSON.stringify(value) }, () => {
      resolve();
    });
  });
}

function getValueFromSession(key) {
  return new Promise((resolve) => {
    chrome.storage.session.get(key, (result) => {
      resolve(result[key] ? JSON.parse(result[key]) : undefined);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
