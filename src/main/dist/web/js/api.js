// REST helpers scoped to /api/game endpoints
export const api = {
  request: async (method, endpoint, body) => {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(`/api/game/${endpoint}`, opts);
    if (!res.ok) throw new Error(`${method} ${endpoint} failed: ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  },
  get: (endpoint = "") => api.request("GET", endpoint),
  put: (endpoint, body) => api.request("PUT", endpoint, body),
  post: (endpoint, body) => api.request("POST", endpoint, body),
  del: (endpoint) => api.request("DELETE", endpoint),
};
