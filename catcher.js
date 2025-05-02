import { urlMatchesPattern, onMessage } from "./helpers.js";

let savedIntercepts = [];
onMessage("INTERCEPTS_CHANGED", (data) => {
  savedIntercepts = Object.values(data);
});

function findIntercept(url, method) {
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

    const method = input.method ?? rest.method;
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

  // Add a response interceptor
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
