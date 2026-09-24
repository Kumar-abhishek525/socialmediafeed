/**
 * NexusFeed API Client
 * Wraps REST endpoints with token authentication and error handling
 */

const API = {
  TOKEN_KEY: 'nexus_auth_token',
  USER_KEY: 'nexus_auth_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  },

  getCurrentUser() {
    try {
      const u = localStorage.getItem(this.USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.USER_KEY);
    }
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(endpoint, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP error ${response.status}`);
    }

    return data;
  },

  // Auth Endpoints
  async register(userData) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: userData
    });
    this.setToken(res.token);
    this.setCurrentUser(res.user);
    return res;
  },

  async login(login, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: { login, password }
    });
    this.setToken(res.token);
    this.setCurrentUser(res.user);
    return res;
  },

  async getMe() {
    return await this.request('/api/auth/me');
  },

  async getDemoUsers() {
    return await this.request('/api/auth/demo-users');
  },

  async switchDemoUser(username) {
    const res = await this.request('/api/auth/switch-demo', {
      method: 'POST',
      body: { username }
    });
    this.setToken(res.token);
    this.setCurrentUser(res.user);
    return res;
  },

  logout() {
    this.setToken(null);
    this.setCurrentUser(null);
  },

  async getUserProfile(username) {
    return await this.request(`/api/users/${encodeURIComponent(username)}`);
  },

  // Posts Endpoints
  async getPosts({ tag = '', search = '', sortBy = 'latest' } = {}) {
    const params = new URLSearchParams();
    if (tag) params.append('tag', tag);
    if (search) params.append('search', search);
    if (sortBy) params.append('sortBy', sortBy);

    return await this.request(`/api/posts?${params.toString()}`);
  },

  async getPost(id) {
    return await this.request(`/api/posts/${id}`);
  },

  async createPost(postData) {
    return await this.request('/api/posts', {
      method: 'POST',
      body: postData
    });
  },

  async deletePost(id) {
    return await this.request(`/api/posts/${id}`, {
      method: 'DELETE'
    });
  },

  // Likes
  async toggleLike(postId) {
    return await this.request(`/api/posts/${postId}/like`, {
      method: 'POST'
    });
  },

  async getLikes(postId) {
    return await this.request(`/api/posts/${postId}/likes`);
  },

  // Comments
  async getComments(postId) {
    return await this.request(`/api/posts/${postId}/comments`);
  },

  async addComment(postId, content) {
    return await this.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: { content }
    });
  },

  async deleteComment(commentId) {
    return await this.request(`/api/comments/${commentId}`, {
      method: 'DELETE'
    });
  }
};

window.API = API;
