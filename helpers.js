export function getValueFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key]);
    });
  });
}
export function setValueInStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
}

export function urlMatchesPattern(url, pattern) {
  if (url === pattern) return true;
  const regexStr = pattern.replaceAll("{id}", "\\d+");
  const regex = new RegExp("^" + regexStr + "$");
  return regex.test(url);
}
 
export function onMessage(name, callback) {
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin)
      return;

    if (event.data.name === name) {
      callback(event.data.value);
    }
  });
}
 
export function sendMessage(name, value) {
  window.postMessage({ name, value }, window.location.origin);
}

export function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

export function createElement(tag) {
  return {
    el: document.createElement(tag),
    attrs(attrs = {}) {
      for (const key in attrs) {
        const value = attrs[key];
        if (value === null || value === undefined) {
          this.el.removeAttribute(key);
        } else {
          this.el.setAttribute(key, value);
        }
      }
      return this;
    },
    text(text) {
      this.el.textContent = text;
      return this;
    },
    children(elements = []) {
      elements.forEach((element) => {
        if (typeof element === "string") {
          this.el.appendChild(document.createTextNode(element));
        } else {
          this.el.appendChild(element.el || element);
        }
      });
      return this;
    },
    events(events = {}) {
      for (const eventName in events) {
        this.el.addEventListener(eventName, events[eventName]);
      }
      return this;
    },
    appendTo(parent) {
      (parent.el || parent).appendChild(this.el);
      return this;
    },
  };
}
