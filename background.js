chrome.storage.onChanged.addListener(() => {
  handleBadgedState();
});

handleBadgedState();

async function handleBadgedState() {
  const intercepts = (await getValueFromStorage("intercepts")) ?? [];

  const activeIntercepts = intercepts.filter(
    (intercept) => intercept.active
  ).length;

  const badgeText = activeIntercepts > 0 ? activeIntercepts.toString() : "";
  const badgeColor = activeIntercepts > 0 ? "#6E11B0" : "#000000";
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  chrome.action.setBadgeText({ text: badgeText });
}

function getValueFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ? JSON.parse(result[key]) : undefined);
    });
  });
}
