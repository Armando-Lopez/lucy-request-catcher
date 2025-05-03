import { urlMatchesPattern, onMessage, sendMessage } from "./helpers.js";
(function () {
  // const code = `
  //     window.findIntercept = ${findIntercept.toString()};
  //   `;
  // const injected = document.createElement("script");
  // injected.textContent = code;
  // (document.head || document.documentElement).appendChild(injected);
  // // injected.remove();
  // setTimeout(() => {
  // console.log(chrome.storage.local);

  let savedIntercepts = [];
  sendMessage("GET_INTERCEPTS_ASK");
  onMessage("INTERCEPTS_CHANGED", (data = []) => {
    savedIntercepts = data;
  });

  function findIntercept(url, method = "GET") {
    // console.log("findIntercept", url, method, savedIntercepts);

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
  console.log("OriginalXHR", window.XMLHttpRequest.toString());
  
  class FakeXHR {
    constructor() {
      this.xhr = new OriginalXHR();
      this._method = "";
      this._url = "";
      this._listeners = {};

      // Proxy all events
      this.onreadystatechange = null;
      this.onload = null;
      this.onerror = null;
    }
    open(method, url, ...rest) {
      this._method = method.toUpperCase();
      this._url = url;
      this.xhr.open(method, url, ...rest);
    }
    send(body) {
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
          Object.defineProperty(this, "responseText", { value: fakeResponse });

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

      this.xhr.send(body);
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
  [
    "getAllResponseHeaders",
    "getResponseHeader",
    "abort",
    "overrideMimeType",
  ].forEach((fn) => {
    FakeXHR.prototype[fn] = function (...args) {
      return this.xhr[fn](...args);
    };
  });

  ["responseType", "withCredentials"].forEach((prop) => {
    Object.defineProperty(FakeXHR.prototype, prop, {
      get() {
        return this.xhr[prop];
      },
      set(value) {
        this.xhr[prop] = value;
      },
    });
  });

  Object.defineProperty(FakeXHR.prototype, "upload", {
    get() {
      return this.xhr.upload;
    },
  });

  window.XMLHttpRequest = FakeXHR;
  console.log("window.XMLHttpRequest", window.XMLHttpRequest);
  
  
})();

// Interceptar XHR
// class FakeXHR {
//   constructor() {
//     this.readyState = 0;
//     this.status = 0;
//     this.responseText = "";
//     this.onreadystatechange = null;
//     this.onload = null;
//     this._method = "";
//     this._url = "";
//   }

//   open(method, url) {
//     // console.log("OPNEN", method, url);

//     this._method = method;
//     this._url = url;
//   }

//   send() {
//     // console.log(findIntercept);

//     const matched = findIntercept?.(this._url, this._method);
//     console.log(
//       "Lucy intenta atrapar un XHR 🕷️🕸️:",
//       this._url,
//       this._method,
//       matched
//     );

//     if (matched) {
//       console.log("Lucy atrapó un XHR 🕸️", this._url);
//       setTimeout(() => {
//         this.readyState = 4;
//         this.status = Number(matched.responseCode ?? 200);
//         this.responseText = JSON.stringify(matched.response ?? {});
//         this.onreadystatechange?.();
//         this.onload?.();
//       }, 0);
//     }
//   }

//   // Implementar más métodos o propiedades si tu app los usa
// }

// window.XMLHttpRequest = FakeXHR;

// return;
// const OriginalXHR = window.XMLHttpRequest;

// function InterceptedXHR() {
//   const xhr = new OriginalXHR();

//   let method = "";
//   let url = "";

//   const open = xhr.open;
//   xhr.open = function (_method, _url, ...rest) {
//     method = _method;
//     url = _url;
//     return open.call(xhr, _method, _url, ...rest);
//   };

//   const send = xhr.send;
//   xhr.send = function (body) {
//     const matched = findIntercept?.(url, method);
//     if (matched) {
//       console.log("🕷️ Intercepted XHR:", url);

//       setTimeout(() => {
//         Object.defineProperty(xhr, "readyState", { value: 4 });
//         Object.defineProperty(xhr, "status", {
//           value: Number(matched.responseCode ?? 200),
//         });
//         Object.defineProperty(xhr, "responseText", {
//           value: JSON.stringify(matched.response ?? {}),
//         });

//         xhr.onreadystatechange?.();
//         xhr.onload?.();
//       }, 0);

//       return; // Cancel real request
//     }

//     return send.call(xhr, body); // Proceed as normal
//   };

//   return xhr;
// }

// window.XMLHttpRequest = InterceptedXHR;

// return;
// // const OriginalXHR = window.XMLHttpRequest;

// function CustomXHR() {
//   const xhr = new OriginalXHR();
//   const self = this;

//   this._url = "";
//   this._method = "";

//   for (let prop in xhr) {
//     if (typeof xhr[prop] === "function") {
//       this[prop] = xhr[prop].bind(xhr);
//     } else {
//       Object.defineProperty(this, prop, {
//         get() {
//           return xhr[prop];
//         },
//         set(val) {
//           xhr[prop] = val;
//         },
//       });
//     }
//   }

//   this.open = function (method, url, ...rest) {
//     self._method = method;
//     self._url = url;
//     return xhr.open(method, url, ...rest);
//   };

//   this.send = function (...args) {
//     const matched = findIntercept(self._url, self._method);
//     console.log(
//       "Lucy intenta atrapar un XHR 🕷️🕸️:",
//       self._url,
//       self._method,
//       matched
//     );

//     if (matched) {
//       console.log("Lucy atrapó un XHR 🕷️🕸️:", self._url);
//       // setTimeout(() => {
//       // xhr.readyState = 4;
//       Object.defineProperty(xhr, "readyState", {
//         value: 4,
//       });
//       // xhr.status = Number(matched.responseCode ?? 200);
//       Object.defineProperty(xhr, "status", {
//         value: Number(matched.responseCode ?? 200),
//       });
//       // xhr.responseText = JSON.stringify(matched.response ?? {});
//       Object.defineProperty(xhr, "responseText", {
//         value: JSON.stringify(matched.response ?? {}),
//       });

//       self.onreadystatechange?.();
//       self.onload?.();
//       // }, 10);

//       return;
//     }

//     return xhr.send(...args);
//   };
// }
// window.XMLHttpRequest = CustomXHR;
// })();
// });
