chrome.storage.onChanged.addListener(() => {
  handleBadgedState();
});

handleBadgedState();

function handleBadgedState() {
  getValueFromStorage("intercepts").then((intercepts = {}) => {
    const activeIntercepts = Object.values(intercepts).filter(
      (intercept) => intercept.active
    ).length;
    const badgeText = activeIntercepts > 0 ? activeIntercepts.toString() : "";
    const badgeColor = activeIntercepts > 0 ? "#6E11B0" : "#000000";
    chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    chrome.action.setBadgeText({ text: badgeText });
  });
  // chrome.storage.local.get("intercepts", (result) => {
  //   // const activeIntercepts = Object.values(result.intercepts).filter(
  //   //   (intercept) => intercept.active
  //   // );
  // });
}

function getValueFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key]);
    });
  });
}
