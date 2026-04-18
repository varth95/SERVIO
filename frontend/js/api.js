/**
 * Servio API Client
 * Centralized fetch wrapper for all backend calls.
 * Flask serves the frontend on the same origin, so no CORS issues.
 */

const Api = {
  async request(method, endpoint, body = null, isFormData = false) {
    const options = {
      method,
      credentials: "include", // send session cookies
      headers: {},
    };

    if (body) {
      if (isFormData) {
        options.body = body; // FormData — don't set Content-Type (browser sets it with boundary)
      } else {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
    }

    try {
      const res = await fetch(`/api${endpoint}`, options);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: { error: "Network error. Is the server running?" } };
    }
  },

  get: (endpoint) => Api.request("GET", endpoint),
  post: (endpoint, body) => Api.request("POST", endpoint, body),
  postForm: (endpoint, formData) => Api.request("POST", endpoint, formData, true),

  // Auth
  auth: {
    login: (email, password) => Api.post("/auth/login", { email, password }),
    register: (formData) => Api.postForm("/auth/register", formData),
    logout: () => Api.post("/auth/logout"),
    me: () => Api.get("/auth/me"),
  },

  // Food
  food: {
    list: (status = "available") => Api.get(`/food/list?status=${status}`),
    get: (id) => Api.get(`/food/${id}`),
    post: (formData) => Api.postForm("/food/post", formData),
    claim: (id) => Api.post(`/food/${id}/claim`),
    deliver: (id) => Api.post(`/food/${id}/deliver`),
    received: (id) => Api.post(`/food/${id}/received`),
    expire: (id) => Api.post(`/food/${id}/expire`),
    my: () => Api.get("/food/my"),
  },

  // Notifications
  notifications: {
    list: () => Api.get("/notifications/"),
    unreadCount: () => Api.get("/notifications/unread-count"),
    markRead: (id) => Api.post(`/notifications/${id}/read`),
    markAllRead: () => Api.post("/notifications/read-all"),
  },

  // Verification
  verification: {
    upload: (foodId, formData) => Api.postForm(`/verification/upload/${foodId}`, formData),
    get: (foodId) => Api.get(`/verification/${foodId}`),
  },

  // Decomposition
  decomposition: {
    create: (data) => Api.post("/decomposition/request", data),
    list: () => Api.get("/decomposition/requests"),
    collect: (id) => Api.post(`/decomposition/requests/${id}/collect`),
  },

  // AI
  ai: {
    suggest: (query) => Api.post("/ai/suggest", { query }),
    expiryWarnings: () => Api.get("/ai/expiry-warnings"),
  },
};
