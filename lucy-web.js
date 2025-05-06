import { urlMatchesPattern, onMessage, sendMessage } from "./helpers.js";
(function () {
  sendMessage("GET_INTERCEPTS_ASK");
  onMessage("INTERCEPTS_CHANGED", (savedTraps = []) => {
    const shouldRunInThisTab = savedTraps.some(
      (item) => item.webSite === window.location.origin && item.active
    );

    if (window.__hasLucyTraps === undefined && !shouldRunInThisTab) {
      return;
    }

    if (window.__hasLucyTraps === true && !shouldRunInThisTab) {
      window.location.reload();
      return;
    }

    if (!shouldRunInThisTab) return;

    function findTrap(url, method = "GET") {
      return savedTraps.find((item) => {
        try {
          if (
            !item.active ||
            item.method.toUpperCase() !== method.toUpperCase()
          )
            return false;
          const hasMatch = urlMatchesPattern(url, item.url);
          return hasMatch;
        } catch (e) {
          console.error("Error in findIntercept", e);
          return false;
        }
      });
    }

    function logCatch(type, url, method) {
      console.log(`Lucy ha capturado un bicho ${type}: 🕷️🕸️🐞`, method, url);
      sendMessage("ON_BUG_CATCH");
    }

    // Interceptar Fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const [input, rest] = args;
        const url = typeof input === "string" ? input : input?.url ?? "";
        if (!url) return originalFetch(...args);

        const method = input?.method ?? rest?.method;
        const matched = findTrap(url, method);
        if (!matched) {
          return originalFetch(...args);
        }
        const data = JSON.stringify(matched.response ?? {});
        logCatch("fetch", url, method);
        return new Response(data, {
          status: Number(matched.responseCode),
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
            const matched = findTrap(config.url, config.method);
            if (!matched) return config;
            logCatch("axios", config.url, config.method);
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
              status: Number(error.intercept.responseCode),
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
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__interceptedBug = findTrap(url, method);
      this.__method = method;
      this.__url = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      const intercepted = this.__interceptedBug;

      if (!intercepted) {
        return originalSend.apply(this, args);
      }

      setTimeout(() => {
        // Simular respuesta mock
        Object.defineProperty(this, "readyState", {
          configurable: true,
          value: 4,
        });
        Object.defineProperty(this, "status", {
          configurable: true,
          value: Number(intercepted.responseCode),
        });

        if (this.responseType === "" || this.responseType === "text") {
          Object.defineProperty(this, "responseText", {
            configurable: true,
            value: intercepted.response,
          });
          Object.defineProperty(this, "response", {
            configurable: true,
            value: intercepted.response,
          });
        }

        logCatch("xhr", this.__url, this.__method);

        this.onreadystatechange?.();
        this.onload?.();
        this.onloadend?.();
      }, 0);
    };

    window.__hasLucyTraps = true;
  });
})();
