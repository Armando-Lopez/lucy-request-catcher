import { urlMatchesPattern, onMessage, sendMessage } from "./helpers.js";
(function () {
  let savedIntercepts = [];
  sendMessage("GET_INTERCEPTS_ASK");
  onMessage("INTERCEPTS_CHANGED", (data = []) => {
    savedIntercepts = data;
  });

  function findIntercept(url, method = "GET") {
    return savedIntercepts.find((item) => {
      try {
        if (!item.active || item.method.toUpperCase() !== method.toUpperCase())
          return false;
        const hasMatch = urlMatchesPattern(url, item.url);
        return hasMatch;
      } catch (e) {
        console.error("Error in findIntercept", e);
        return false;
      }
    });
  }

  // Interceptar Fetch
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const [input, rest] = args;
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (!url) return originalFetch(...args);

      const method = input?.method ?? rest?.method;
      const matched = findIntercept(url, method);
      if (!matched) {
        return originalFetch(...args);
      }
      console.log("Intercepted fetch: 🕷️🕸️", url, input ?? rest);
      const data = JSON.stringify(matched.response ?? {});
      return new Response(data, {
        status: Number(matched.responseCode ?? 200),
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      console.error("Error in fetch", e);
      return originalFetch(...args);
    }
  };

  // Interceptar Axios
  const axios = window.axios;
  if (axios) {
    // Add a request interceptor
    axios.interceptors.request.use(
      function (config) {
        try {
          if (!config.url) return config;
          const matched = findIntercept(config.url, config.method);
          if (!matched) return config;
          console.log("Intercepted axios: 🕷️🕸️", config.url, config);
          return Promise.reject({
            __isIntercepted: true,
            intercept: matched,
            config,
          });
        } catch (e) {
          console.error("Error in axios", e);
          return config;
        }
      },
      function (error) {
        return Promise.reject(error);
      }
    );

    axios.interceptors.response.use(
      function (response) {
        // Any status code that lie within the range of 2xx cause this function to trigger
        return response;
      },
      function (error) {
        // Any status codes that falls outside the range of 2xx cause this function to trigger
        try {
          if (!error.__isIntercepted) {
            return Promise.reject(error);
          }
          return Promise.resolve({
            data: error.intercept.response ?? {},
            status: Number(error.intercept.responseCode ?? 200),
            config: error.config,
            statusText: "",
            headers: {
              "Content-Type": "application/json",
            },
          });
        } catch (e) {
          console.error("Error in axios", e);
          return Promise.reject(error);
        }
      }
    );
  }

  // Interceptar XHR

  const OriginalXHR = window.XMLHttpRequest;

  class LucyXHR {
    constructor() {
      this.xhr = new OriginalXHR();
      this._method = "";
      this._url = "";
      this._listeners = {};

      // Proxy all events
      this.onreadystatechange = null;
      this.onload = null;
      this.onerror = null;

      // ⚠️ Importante: devolver un Proxy al final
      // return new Proxy(this, {
      //   get(target, prop) {
      //     if (prop in target) return target[prop];
      //     if (prop in target.xhr) {
      //       const value = target.xhr[prop];
      //       return typeof value === "function" ? value.bind(target.xhr) : value;
      //     }
      //     return undefined;
      //   },
      //   set(target, prop, value) {
      //     if (prop in target) {
      //       target[prop] = value;
      //     } else {
      //       target.xhr[prop] = value;
      //     }
      //     return true;
      //   },
      // });
    }
    open(method, url, ...rest) {
      this._method = method.toUpperCase();
      this._url = url;
      this.xhr.open(method, url, ...rest);
    }
    send(body) {
      try {
        const matched = findIntercept?.(this._url, this._method);
        if (matched) {
          console.log("🕷️ Intercepted XHR:", this._url);

          // Simular respuesta asíncrona
          setTimeout(() => {
            const fakeResponse = JSON.stringify(matched.response ?? {});
            Object.defineProperty(this, "readyState", { value: 4 });
            Object.defineProperty(this, "status", {
              value: Number(matched.responseCode ?? 200),
            });
            Object.defineProperty(this, "responseText", {
              value: fakeResponse,
            });
            Object.defineProperty(this, "response", { value: fakeResponse });
            this.onreadystatechange?.();
            this.onload?.();
            this._dispatchEvent("load");
            this._dispatchEvent("readystatechange");
          }, 0);

          return;
        }

        // Si no hay match, seguir normalmente
        this.xhr.onreadystatechange = (...args) => {
          this.readyState = this.xhr.readyState;
          this.status = this.xhr.status;
          this.responseText = this.xhr.responseText;
          this.onreadystatechange?.apply(this, ...args);
          this._dispatchEvent("readystatechange");
        };
        this.xhr.onload = (...args) => {
          this.onload?.apply(this, ...args);
          this._dispatchEvent("load");
        };
        this.xhr.onerror = (...args) => {
          this.onerror?.apply(this, ...args);
          this._dispatchEvent("error");
        };
        this.xhr.onabort = (...args) => {
          this.onabort?.apply(this, ...args);
          this._dispatchEvent("abort");
        };
        this.xhr.ontimeout = (...args) => {
          this.ontimeout?.apply(this, ...args);
          this._dispatchEvent("timeout");
        };
        // this.xhr.onloadstart = (...args) => {
        //   this.onloadstart?.apply(this, ...args);
        //   this._dispatchEvent("loadstart");
        // };
        this.xhr.onprogress = (...args) => {
          this.onprogress?.apply(this, ...args);
          this._dispatchEvent("progress");
        };
        this.xhr.onloadend = (...args) => {
          this.onloadend?.apply(this, ...args);
          this._dispatchEvent("loadend");
        };

        this.xhr.send(body);
      } catch (e) {
        console.error(e);
      }
    }
    setRequestHeader(...args) {
      return this.xhr.setRequestHeader(...args);
    }
    addEventListener(type, listener) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(listener);
    }
    _dispatchEvent(type) {
      const listeners = this._listeners[type] || [];
      for (const listener of listeners) {
        listener.call(this);
      }
    }
  }

  // Proxy properties
  Object.defineProperty(LucyXHR.prototype, "statusText", {
    get() {
      return this.xhr.statusText;
    },
  });

  Object.defineProperty(LucyXHR.prototype, "responseURL", {
    get() {
      return this.xhr.responseURL;
    },
  });

  [
    "getAllResponseHeaders",
    "getResponseHeader",
    "abort",
    "overrideMimeType",
  ].forEach((fn) => {
    LucyXHR.prototype[fn] = function (...args) {
      return this.xhr[fn](...args);
    };
  });

  ["responseType", "withCredentials"].forEach((prop) => {
    Object.defineProperty(LucyXHR.prototype, prop, {
      get() {
        return this.xhr[prop];
      },
      set(value) {
        this.xhr[prop] = value;
      },
    });
  });

  Object.defineProperty(LucyXHR.prototype, "upload", {
    get() {
      return this.xhr.upload;
    },
  });

  window.XMLHttpRequest = LucyXHR;
})();
