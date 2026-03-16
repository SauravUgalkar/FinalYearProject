const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const authStorage = {
  getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  },

  setToken(token) {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  },

  clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  },

  getUser() {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  clearUser() {
    sessionStorage.removeItem(USER_KEY);
  },

  getAuthHeaders(extra = {}) {
    const token = this.getToken();
    if (!token) return { ...extra };
    return {
      ...extra,
      Authorization: `Bearer ${token}`,
    };
  },
};
