import { urlMatchesPattern, onMessage, sendMessage } from "./helpers.js";
(function () {
  sendMessage("GET_INTERCEPTS_ASK");
  onMessage("INTERCEPTS_CHANGED", (savedTraps = []) => {
    // const shouldRunInThisTab = savedTraps.some(
    //   (item) => item.webSite === window.location.origin && item.active
    // );

    // if (window.__hasLucyTraps === undefined && !shouldRunInThisTab) {
    //   return;
    // }

    // if (window.__hasLucyTraps === true && !shouldRunInThisTab) {
    //   window.location.reload();
    //   return;
    // }

    // if (!shouldRunInThisTab) return;

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

    function logCatch(type, trap) {
      console.log(
        `Lucy ha capturado un bicho ${type}: 🕷️🕸️🐞`,
        trap.method,
        trap.url,
        trap.response
      );
      sendMessage("ON_BUG_CATCH");
    }

    // REQUEST SPY QUEUE
    let requestQueue = [];
    let isProcessing = false;
    const intervalMs = 1000;
    function processQueue() {
      if (requestQueue.length === 0) {
        isProcessing = false;
        return;
      }
      isProcessing = true;
      const data = requestQueue.shift();
      sendMessage("ON_REQUEST_SPY", JSON.stringify(data));
      setTimeout(processQueue, intervalMs);
    }
    function sendRequestSpy(data) {
      if (!data.url || !data.method) return;
      requestQueue.push(data);
      requestQueue = requestQueue.slice(0, 30);
      if (!isProcessing) {
        processQueue();
      }
    }

    // TRAPS

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
          const originalResponse = await originalFetch(...args);
          const responseClone = originalResponse.clone();
          const isJSON = responseClone.headers
            .get("Content-Type")
            .includes("application/json");

          if (isJSON) {
            sendRequestSpy({
              url,
              method: method?.toUpperCase?.(),
              statusCode: originalResponse.status,
              response: await responseClone.json(),
            });
          }
          return originalResponse;
        }
        const data = JSON.stringify(matched.response ?? {});
        logCatch("fetch", matched);
        return new Response(data, {
          status: Number(matched.statusCode),
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
            logCatch("axios", matched);
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
          if (
            response.request.responseType === "" ||
            response.request.responseType === "text"
          ) {
            sendRequestSpy({
              url: response.config.url,
              method: response.config.method?.toUpperCase?.(),
              statusCode: response.status,
              response: response.data,
            });
          }
          // Any status code that lie within the range of 2xx cause this function to trigger
          return response;
        },
        function (error) {
          // Any status codes that falls outside the range of 2xx cause this function to trigger
          try {
            if (!error.__isIntercepted) {
              sendRequestSpy({
                url: error.config.url,
                method: error.config.method?.toUpperCase?.(),
                statusCode: error.status,
                response: error.response.data,
              });
              return Promise.reject(error);
            }
            const data = {
              data: error.intercept.response ?? {},
              status: Number(error.intercept.statusCode),
              config: error.config,
              headers: {
                "Content-Type": "application/json",
              },
            };
            const hasErrorCode = data.status >= 400;
            if (hasErrorCode) {
              return Promise.reject(data);
            }
            return Promise.resolve(data);
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
      try {
        const intercepted = this.__interceptedBug;

        if (!intercepted) {
          this.addEventListener("loadend", () => {
            if (this.responseType === "" || this.responseType === "text") {
              sendRequestSpy({
                url: this.__url,
                method: this.__method,
                statusCode: this.status,
                response:  JSON.parse(this.responseText),
              });
            }
          });
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
            value: Number(intercepted.statusCode),
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

          logCatch("xhr", intercepted);

          this.onreadystatechange?.();
          this.onload?.();
          this.onloadend?.();
        }, 0);
      } catch (e) {
        console.error("Error in xhr", e);
        return originalSend.apply(this, args);
      }
    };

    window.__hasLucyTraps = true;
  });
})();
