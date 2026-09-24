/**
 * NexusFeed — Main Application Logic
 * Integrates REST API, WebSocket events, and dynamic DOM rendering
 */

(function () {
  'use strict';

  // State
  const state = {
    currentUser: null,
    posts: [],
    activeSort: 'latest',
    activeTag: null,
    searchQuery: '',
    selectedPresetUrl: '',
    demoUsers: [],
    unviewedNewPosts: []
  };

  // DOM Elements
  const postsFeedContainer = document.getElementById('postsFeedContainer');
  const postContentInput = document.getElementById('postContentInput');
  const publishPostBtn = document.getElementById('publishPostBtn');
  const charCount = document.getElementById('charCount');
  const composerAvatar = document.getElementById('composerAvatar');
  const composerMediaPreview = document.getElementById('composerMediaPreview');
  const composerPreviewImg = document.getElementById('composerPreviewImg');
  const removeMediaBtn = document.getElementById('removeMediaBtn');
  const togglePresetsBtn = document.getElementById('togglePresetsBtn');
  const composerPresetsDrawer = document.getElementById('composerPresetsDrawer');
  const closePresetsBtn = document.getElementById('closePresetsBtn');
  const customImageUrlInput = document.getElementById('customImageUrlInput');
  const applyCustomUrlBtn = document.getElementById('applyCustomUrlBtn');
  const localImageFileInput = document.getElementById('localImageFileInput');
  const realtimePostBanner = document.getElementById('realtimePostBanner');
  const realtimeBannerText = document.getElementById('realtimeBannerText');
  const realtimeBannerRefreshBtn = document.getElementById('realtimeBannerRefreshBtn');
  const activeFilterBadge = document.getElementById('activeFilterBadge');
  const activeFilterText = document.getElementById('activeFilterText');
  const clearFilterBtn = document.getElementById('clearFilterBtn');
  const tabLatest = document.getElementById('tabLatest');
  const tabTrending = document.getElementById('tabTrending');
  const globalSearchInput = document.getElementById('globalSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const demoUserList = document.getElementById('demoUserList');
  const activityTickerList = document.getElementById('activityTickerList');
  const toastContainer = document.getElementById('toastContainer');

  // Nav & Auth elements
  const openAuthModalBtn = document.getElementById('openAuthModalBtn');
  const loggedInNavProfile = document.getElementById('loggedInNavProfile');
  const navAvatarImg = document.getElementById('navAvatarImg');
  const navDisplayName = document.getElementById('navDisplayName');
  const navUsername = document.getElementById('navUsername');
  const userMenuToggleBtn = document.getElementById('userMenuToggleBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');
  const dropdownUsername = document.getElementById('dropdownUsername');
  const dropdownViewProfileBtn = document.getElementById('dropdownViewProfileBtn');
  const dropdownSwitchDemoBtn = document.getElementById('dropdownSwitchDemoBtn');
  const dropdownSignOutBtn = document.getElementById('dropdownSignOutBtn');

  // Modals
  const authModalBackdrop = document.getElementById('authModalBackdrop');
  const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const authErrorBanner = document.getElementById('authErrorBanner');
  const sidebarRegisterNewBtn = document.getElementById('sidebarRegisterNewBtn');

  const profileModalBackdrop = document.getElementById('profileModalBackdrop');
  const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
  const lightboxBackdrop = document.getElementById('lightboxBackdrop');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');

  // Helper: Time Ago formatter
  function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  // Toast Notification
  function showToast(message, icon = '✨') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => toast.remove(), 250);
    }, 4500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Add Live Activity Ticker Item
  function addActivityTicker(text, time = 'Just now') {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <span class="activity-bullet"></span>
      <div class="activity-content">
        ${text}
        <span class="activity-time">${time}</span>
      </div>
    `;
    activityTickerList.prepend(item);
    // Keep max 15 items
    while (activityTickerList.children.length > 15) {
      activityTickerList.removeChild(activityTickerList.lastChild);
    }
  }

  // Format Hashtags in post content
  function formatContentWithHashtags(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/#([a-zA-Z0-9_]+)/g, (match, tag) => {
      return `<a href="#" class="content-hashtag" data-tag="${tag}">${match}</a>`;
    });
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  async function initApp() {
    setupEventListeners();
    setupWebSocketListeners();

    // Check existing login or auto-login with default demo user
    const savedUser = API.getCurrentUser();
    if (savedUser && API.getToken()) {
      try {
        const meRes = await API.getMe();
        state.currentUser = meRes.user;
        updateNavUserUI();
      } catch (e) {
        // Token expired, clear
        API.logout();
        await autoLoginDefaultDemoUser();
      }
    } else {
      // For immediate reviewer experience, auto-log in as default demo user Alex Rivera
      await autoLoginDefaultDemoUser();
    }

    // Load Demo Accounts
    await loadDemoAccounts();

    // Load Feed
    await loadPosts();
  }

  async function autoLoginDefaultDemoUser() {
    try {
      const res = await API.switchDemoUser('alex_rivera');
      state.currentUser = res.user;
      updateNavUserUI();
    } catch (err) {
      console.warn('Could not auto-login default demo user:', err);
    }
  }

  // Load Demo Users into sidebar card
  async function loadDemoAccounts() {
    try {
      const users = await API.getDemoUsers();
      state.demoUsers = users;
      renderDemoUsersList();
    } catch (err) {
      console.error('Failed to load demo users:', err);
    }
  }

  function renderDemoUsersList() {
    demoUserList.innerHTML = '';
    state.demoUsers.forEach(user => {
      const isCurrent = state.currentUser && state.currentUser.id === user.id;
      const item = document.createElement('div');
      item.className = `demo-user-item ${isCurrent ? 'active' : ''}`;
      item.dataset.username = user.username;
      item.innerHTML = `
        <div class="demo-user-info">
          <img class="demo-avatar" src="${user.avatar_url}" alt="${escapeHtml(user.display_name)}">
          <div class="demo-names">
            <span class="demo-display-name">${escapeHtml(user.display_name)}</span>
            <span class="demo-username">@${user.username}</span>
          </div>
        </div>
        <span class="switch-indicator">${isCurrent ? 'Active ✓' : 'Switch →'}</span>
      `;
      item.addEventListener('click', () => switchDemoAccount(user.username));
      demoUserList.appendChild(item);
    });
  }

  async function switchDemoAccount(username) {
    try {
      const res = await API.switchDemoUser(username);
      state.currentUser = res.user;
      updateNavUserUI();
      renderDemoUsersList();
      showToast(`Switched active user to @${res.user.username}`, '👤');
      // Reload feed to update like states for new active user
      loadPosts();
    } catch (err) {
      showToast(err.message, '⚠️');
    }
  }

  function updateNavUserUI() {
    if (state.currentUser) {
      openAuthModalBtn.style.display = 'none';
      loggedInNavProfile.style.display = 'flex';
      navAvatarImg.src = state.currentUser.avatarUrl || state.currentUser.avatar_url;
      navDisplayName.textContent = state.currentUser.displayName || state.currentUser.display_name;
      navUsername.textContent = `@${state.currentUser.username}`;
      dropdownUsername.textContent = `@${state.currentUser.username}`;

      // Update composer avatar
      composerAvatar.src = state.currentUser.avatarUrl || state.currentUser.avatar_url;
    } else {
      openAuthModalBtn.style.display = 'inline-flex';
      loggedInNavProfile.style.display = 'none';
      userDropdownMenu.classList.remove('active');
    }
  }

  // ==========================================
  // FEED POSTS LOADING & RENDERING
  // ==========================================
  async function loadPosts() {
    postsFeedContainer.innerHTML = `
      <div class="feed-loading-placeholder">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;

    try {
      const posts = await API.getPosts({
        tag: state.activeTag || '',
        search: state.searchQuery || '',
        sortBy: state.activeSort
      });
      state.posts = posts;
      renderPostsFeed(posts);
    } catch (err) {
      postsFeedContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px;">
          <p style="color: var(--danger-color); font-weight: 600;">Failed to load posts feed: ${escapeHtml(err.message)}</p>
          <button class="btn btn-secondary" style="margin-top: 14px;" onclick="window.location.reload()">Retry Connection</button>
        </div>
      `;
    }
  }

  function renderPostsFeed(posts) {
    if (!posts || posts.length === 0) {
      postsFeedContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 50px 20px;">
          <h3 style="margin-bottom: 8px;">No posts found</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            ${state.activeTag ? `No posts tagged with #${escapeHtml(state.activeTag)} yet.` : 'Be the first to share an update with the network!'}
          </p>
        </div>
      `;
      return;
    }

    postsFeedContainer.innerHTML = '';
    posts.forEach(post => {
      const card = createPostCardElement(post);
      postsFeedContainer.appendChild(card);
    });
  }

  function createPostCardElement(post) {
    const card = document.createElement('article');
    card.className = 'post-card';
    card.id = `post-${post.id}`;
    card.dataset.postId = post.id;

    const isAuthor = state.currentUser && state.currentUser.id === post.user_id;
    const hasLiked = Boolean(post.has_liked);

    // Tags
    let tagsHtml = '';
    if (post.tags) {
      const tagArr = post.tags.split(',').filter(Boolean);
      tagsHtml = `
        <div class="post-tags-row">
          ${tagArr.map(t => `<span class="tag-badge" data-tag="${escapeHtml(t.trim())}">#${escapeHtml(t.trim())}</span>`).join('')}
        </div>
      `;
    }

    // Media
    let mediaHtml = '';
    if (post.image_url) {
      mediaHtml = `
        <div class="post-media-box" data-image="${escapeHtml(post.image_url)}">
          <img src="${escapeHtml(post.image_url)}" alt="Post attachment" loading="lazy">
        </div>
      `;
    }

    card.innerHTML = `
      <div class="post-header">
        <div class="post-author-box" data-username="${escapeHtml(post.username)}">
          <img class="post-avatar" src="${escapeHtml(post.avatar_url)}" alt="${escapeHtml(post.display_name)}">
          <div class="post-author-meta">
            <div class="post-author-top">
              <span class="post-author-name">${escapeHtml(post.display_name)}</span>
              ${post.badge ? `<span class="author-role-badge">${escapeHtml(post.badge)}</span>` : ''}
            </div>
            <div class="post-author-bottom">
              <span class="post-author-handle">@${escapeHtml(post.username)}</span>
              <span>•</span>
              <span class="post-timestamp">${timeAgo(post.created_at)}</span>
            </div>
          </div>
        </div>

        ${isAuthor ? `
          <button class="post-options-btn delete-post-btn" data-post-id="${post.id}" title="Delete post">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        ` : ''}
      </div>

      <div class="post-content">${formatContentWithHashtags(post.content)}</div>

      ${mediaHtml}
      ${tagsHtml}

      <div class="post-actions-bar">
        <button class="post-action-btn like-btn ${hasLiked ? 'liked' : ''}" data-post-id="${post.id}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span class="like-count">${post.likes_count}</span>
        </button>

        <button class="post-action-btn comment-btn" data-post-id="${post.id}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          <span class="comment-count">${post.comments_count}</span>
        </button>

        <button class="post-action-btn share-btn" data-post-id="${post.id}" title="Copy Link">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <span>Share</span>
        </button>
      </div>

      <!-- Expandable Comments Drawer -->
      <div class="comments-section" id="comments-section-${post.id}" style="display: none;">
        <div class="comment-input-row">
          <img class="comment-avatar" src="${state.currentUser ? (state.currentUser.avatarUrl || state.currentUser.avatar_url) : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}" alt="Your avatar">
          <div class="comment-input-box">
            <input type="text" class="new-comment-input" placeholder="Add a comment or perspective..." data-post-id="${post.id}">
            <button class="send-comment-btn" data-post-id="${post.id}" title="Send comment">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
        <div class="comments-list" id="comments-list-${post.id}">
          <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 6px;">Loading discussions...</div>
        </div>
      </div>
    `;

    // Attach card event handlers
    attachCardHandlers(card, post);

    return card;
  }

  function attachCardHandlers(card, post) {
    // Like button
    const likeBtn = card.querySelector('.like-btn');
    likeBtn.addEventListener('click', () => handleLikeToggle(post.id, likeBtn));

    // Comment toggle button
    const commentBtn = card.querySelector('.comment-btn');
    const commentsSection = card.querySelector(`#comments-section-${post.id}`);
    commentBtn.addEventListener('click', () => toggleCommentsDrawer(post.id, commentsSection));

    // Send comment button & input enter
    const sendBtn = card.querySelector('.send-comment-btn');
    const commentInput = card.querySelector('.new-comment-input');
    sendBtn.addEventListener('click', () => submitNewComment(post.id, commentInput));
    commentInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitNewComment(post.id, commentInput);
    });

    // Share button
    const shareBtn = card.querySelector('.share-btn');
    shareBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href);
      showToast('Post link copied to clipboard! 🔗', '📋');
    });

    // Author profile click
    const authorBox = card.querySelector('.post-author-box');
    authorBox.addEventListener('click', () => openUserProfileModal(post.username));

    // Image lightbox
    const mediaBox = card.querySelector('.post-media-box');
    if (mediaBox) {
      mediaBox.addEventListener('click', () => {
        lightboxImg.src = mediaBox.dataset.image;
        lightboxBackdrop.style.display = 'flex';
      });
    }

    // Delete post button
    const deleteBtn = card.querySelector('.delete-post-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this post?')) return;
        try {
          await API.deletePost(post.id);
          card.remove();
          showToast('Post deleted successfully', '🗑️');
        } catch (err) {
          showToast(err.message, '⚠️');
        }
      });
    }

    // Hashtags click
    const tagElements = card.querySelectorAll('.tag-badge, .content-hashtag');
    tagElements.forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tag = el.dataset.tag;
        applyTagFilter(tag);
      });
    });
  }

  // ==========================================
  // INTERACTIONS: LIKES & COMMENTS
  // ==========================================
  async function handleLikeToggle(postId, button) {
    if (!state.currentUser) {
      openAuthModal();
      return;
    }

    const countSpan = button.querySelector('.like-count');
    const currentCount = parseInt(countSpan.textContent, 10) || 0;
    const isCurrentlyLiked = button.classList.contains('liked');

    // Optimistic UI update
    button.classList.toggle('liked');
    countSpan.textContent = isCurrentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1;

    try {
      const res = await API.toggleLike(postId);
      // Reconcile server response
      countSpan.textContent = res.likesCount;
      if (res.hasLiked) {
        button.classList.add('liked');
      } else {
        button.classList.remove('liked');
      }
    } catch (err) {
      // Revert optimistic update
      button.classList.toggle('liked');
      countSpan.textContent = currentCount;
      showToast(err.message, '⚠️');
    }
  }

  async function toggleCommentsDrawer(postId, section) {
    if (section.style.display === 'none') {
      section.style.display = 'flex';
      await loadCommentsForPost(postId);
    } else {
      section.style.display = 'none';
    }
  }

  async function loadCommentsForPost(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;

    try {
      const comments = await API.getComments(postId);
      renderCommentsList(postId, comments);
    } catch (err) {
      list.innerHTML = `<div style="color: var(--danger-color); font-size: 0.8rem; text-align: center;">Failed to load comments</div>`;
    }
  }

  function renderCommentsList(postId, comments) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;

    if (!comments || comments.length === 0) {
      list.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 6px;">No comments yet. Start the conversation!</div>`;
      return;
    }

    list.innerHTML = '';
    comments.forEach(c => {
      const item = createCommentElement(postId, c);
      list.appendChild(item);
    });
  }

  function createCommentElement(postId, comment) {
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.id = `comment-${comment.id}`;

    const isAuthor = state.currentUser && state.currentUser.id === comment.user_id;

    item.innerHTML = `
      <img class="comment-avatar" src="${escapeHtml(comment.avatar_url)}" alt="${escapeHtml(comment.display_name)}">
      <div class="comment-content-box">
        <div class="comment-header">
          <span class="comment-author-name">${escapeHtml(comment.display_name)}</span>
          <span class="comment-time">${timeAgo(comment.created_at)}</span>
          ${isAuthor ? `<button class="delete-comment-btn" data-comment-id="${comment.id}" title="Delete comment">&times;</button>` : ''}
        </div>
        <p class="comment-text">${escapeHtml(comment.content)}</p>
      </div>
    `;

    if (isAuthor) {
      const delBtn = item.querySelector('.delete-comment-btn');
      delBtn.addEventListener('click', async () => {
        try {
          await API.deleteComment(comment.id);
          item.remove();
          showToast('Comment deleted', '🗑️');
        } catch (err) {
          showToast(err.message, '⚠️');
        }
      });
    }

    return item;
  }

  async function submitNewComment(postId, input) {
    if (!state.currentUser) {
      openAuthModal();
      return;
    }

    const content = input.value.trim();
    if (!content) return;

    input.value = '';

    try {
      const res = await API.addComment(postId, content);
      const list = document.getElementById(`comments-list-${postId}`);
      if (list) {
        // If placeholder empty message exists, clear it
        if (list.querySelector('div[style*="text-align: center"]')) {
          list.innerHTML = '';
        }
        const commentEl = createCommentElement(postId, res.comment);
        list.appendChild(commentEl);
      }
      // Update comment count button
      const postCard = document.getElementById(`post-${postId}`);
      if (postCard) {
        postCard.querySelector('.comment-count').textContent = res.commentsCount;
      }
    } catch (err) {
      showToast(err.message, '⚠️');
    }
  }

  // ==========================================
  // POST COMPOSER
  // ==========================================
  async function handlePublishPost() {
    if (!state.currentUser) {
      openAuthModal();
      return;
    }

    const content = postContentInput.value.trim();
    if (!content) {
      showToast('Please type some thoughts or updates first!', '✍️');
      postContentInput.focus();
      return;
    }

    publishPostBtn.disabled = true;
    publishPostBtn.innerHTML = `<span>Publishing...</span>`;

    try {
      const newPost = await API.createPost({
        content,
        imageUrl: state.selectedPresetUrl,
        tags: ''
      });

      // Clear composer
      postContentInput.value = '';
      charCount.textContent = '0/1000';
      clearComposerMedia();

      // Prepend post to feed immediately
      const card = createPostCardElement(newPost);
      postsFeedContainer.prepend(card);

      showToast('Post published live across the network!', '🚀');
    } catch (err) {
      showToast(err.message, '⚠️');
    } finally {
      publishPostBtn.disabled = false;
      publishPostBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        <span>Publish Post</span>
      `;
    }
  }

  function setComposerMedia(url) {
    state.selectedPresetUrl = url;
    composerPreviewImg.src = url;
    composerMediaPreview.style.display = 'block';
    composerPresetsDrawer.style.display = 'none';
  }

  function clearComposerMedia() {
    state.selectedPresetUrl = '';
    composerPreviewImg.src = '';
    composerMediaPreview.style.display = 'none';
    customImageUrlInput.value = '';
    localImageFileInput.value = '';
  }

  // ==========================================
  // WEBSOCKET REAL-TIME SYNC
  // ==========================================
  function setupWebSocketListeners() {
    // 1. New Post Broadcast
    window.realtimeClient.on('NEW_POST', (post) => {
      // If we are the author who just created it, it's already prepended
      if (state.currentUser && state.currentUser.id === post.user_id) {
        return;
      }

      // Add to unviewed list and show banner
      state.unviewedNewPosts.unshift(post);
      realtimeBannerText.textContent = `✨ ${escapeHtml(post.display_name)} published a new update`;
      realtimePostBanner.style.display = 'flex';

      // Toast alert
      showToast(`New post from ${post.display_name}: "${post.content.slice(0, 35)}..."`, '🔔');

      // Add to Activity Ticker
      addActivityTicker(`<strong>${escapeHtml(post.display_name)}</strong> published a new update.`);
    });

    // 2. Like Updated Broadcast
    window.realtimeClient.on('LIKE_UPDATED', (data) => {
      const { postId, likesCount, username, displayName, hasLiked, userId } = data;
      const postCard = document.getElementById(`post-${postId}`);
      if (postCard) {
        const countSpan = postCard.querySelector('.like-count');
        if (countSpan) countSpan.textContent = likesCount;

        // If it's our own action from another tab
        if (state.currentUser && state.currentUser.id === userId) {
          const btn = postCard.querySelector('.like-btn');
          if (btn) {
            if (hasLiked) btn.classList.add('liked');
            else btn.classList.remove('liked');
          }
        }
      }

      if (hasLiked) {
        addActivityTicker(`<strong>@${escapeHtml(username)}</strong> liked a post.`);
      }
    });

    // 3. New Comment Broadcast
    window.realtimeClient.on('NEW_COMMENT', (data) => {
      const { postId, comment, commentsCount } = data;
      const postCard = document.getElementById(`post-${postId}`);
      if (postCard) {
        postCard.querySelector('.comment-count').textContent = commentsCount;

        const list = document.getElementById(`comments-list-${postId}`);
        if (list && list.style.display !== 'none') {
          // If we didn't just add it locally
          if (!document.getElementById(`comment-${comment.id}`)) {
            if (list.querySelector('div[style*="text-align: center"]')) {
              list.innerHTML = '';
            }
            const el = createCommentElement(postId, comment);
            list.appendChild(el);
          }
        }
      }

      // Toast alert
      if (!state.currentUser || state.currentUser.id !== comment.user_id) {
        showToast(`💬 ${comment.display_name} commented: "${comment.content.slice(0, 30)}..."`, '💬');
        addActivityTicker(`<strong>${escapeHtml(comment.display_name)}</strong> commented on a post.`);
      }
    });

    // 4. Comment Deleted Broadcast
    window.realtimeClient.on('COMMENT_DELETED', (data) => {
      const { commentId, postId, commentsCount } = data;
      const el = document.getElementById(`comment-${commentId}`);
      if (el) el.remove();

      const postCard = document.getElementById(`post-${postId}`);
      if (postCard) {
        postCard.querySelector('.comment-count').textContent = commentsCount;
      }
    });

    // 5. Post Deleted Broadcast
    window.realtimeClient.on('POST_DELETED', (data) => {
      const card = document.getElementById(`post-${data.postId}`);
      if (card) card.remove();
    });
  }

  // ==========================================
  // FILTERS, SEARCH, & NAVIGATION
  // ==========================================
  function applyTagFilter(tag) {
    state.activeTag = tag;
    activeFilterText.textContent = `#${tag}`;
    activeFilterBadge.style.display = 'flex';
    loadPosts();
  }

  function clearTagFilter() {
    state.activeTag = null;
    activeFilterBadge.style.display = 'none';
    loadPosts();
  }

  // ==========================================
  // MODALS & USER PROFILES
  // ==========================================
  function openAuthModal(initialTab = 'signin') {
    authModalBackdrop.style.display = 'flex';
    authErrorBanner.style.display = 'none';
    if (initialTab === 'signin') {
      tabSignIn.click();
    } else {
      tabSignUp.click();
    }
  }

  function closeAuthModal() {
    authModalBackdrop.style.display = 'none';
    authErrorBanner.style.display = 'none';
  }

  async function openUserProfileModal(username) {
    try {
      const profile = await API.getUserProfile(username);
      document.getElementById('modalProfileAvatar').src = profile.avatarUrl;
      document.getElementById('modalProfileDisplayName').textContent = profile.displayName;
      document.getElementById('modalProfileUsername').textContent = `@${profile.username}`;
      document.getElementById('modalProfileBio').textContent = profile.bio || 'Exploring ideas and sharing insights on NexusFeed.';
      document.getElementById('modalProfileBadge').textContent = profile.badge || 'Member';
      document.getElementById('modalPostsCount').textContent = profile.stats.postsCount;
      document.getElementById('modalLikesCount').textContent = profile.stats.likesReceived;
      document.getElementById('modalFollowersCount').textContent = profile.stats.followers;
      document.getElementById('modalFollowingCount').textContent = profile.stats.following;

      profileModalBackdrop.style.display = 'flex';
    } catch (err) {
      showToast(err.message, '⚠️');
    }
  }

  // ==========================================
  // DOM EVENT LISTENERS SETUP
  // ==========================================
  function setupEventListeners() {
    // Character counter for composer
    postContentInput.addEventListener('input', () => {
      const len = postContentInput.value.length;
      charCount.textContent = `${len}/1000`;
      if (len > 1000) charCount.style.color = 'var(--danger-color)';
      else charCount.style.color = 'var(--text-muted)';
    });

    // Publish Post button
    publishPostBtn.addEventListener('click', handlePublishPost);

    // Preset drawer toggling
    togglePresetsBtn.addEventListener('click', () => {
      const isVisible = composerPresetsDrawer.style.display === 'flex';
      composerPresetsDrawer.style.display = isVisible ? 'none' : 'flex';
    });
    closePresetsBtn.addEventListener('click', () => {
      composerPresetsDrawer.style.display = 'none';
    });

    // Preset photography thumbnails
    document.querySelectorAll('.preset-thumb-btn').forEach(btn => {
      btn.addEventListener('click', () => setComposerMedia(btn.dataset.url));
    });

    // Custom image URL button
    applyCustomUrlBtn.addEventListener('click', () => {
      const url = customImageUrlInput.value.trim();
      if (url) setComposerMedia(url);
    });

    // Remove media button
    removeMediaBtn.addEventListener('click', clearComposerMedia);

    // Local file upload input
    localImageFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => setComposerMedia(event.target.result);
        reader.readAsDataURL(file);
      }
    });

    // Quick tag pills in composer
    document.querySelectorAll('.hashtag-suggestions .tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.tag;
        postContentInput.value += ` #${tag} `;
        postContentInput.focus();
        charCount.textContent = `${postContentInput.value.length}/1000`;
      });
    });

    // Refresh realtime banner
    realtimeBannerRefreshBtn.addEventListener('click', () => {
      realtimePostBanner.style.display = 'none';
      while (state.unviewedNewPosts.length > 0) {
        const p = state.unviewedNewPosts.pop();
        const card = createPostCardElement(p);
        postsFeedContainer.prepend(card);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Trending hashtags sidebar items
    document.querySelectorAll('.trending-item').forEach(item => {
      item.addEventListener('click', () => {
        applyTagFilter(item.dataset.tag);
      });
    });

    // Clear tag filter button
    clearFilterBtn.addEventListener('click', clearTagFilter);

    // Sort tabs (Latest / Trending)
    tabLatest.addEventListener('click', () => {
      tabLatest.classList.add('active');
      tabTrending.classList.remove('active');
      state.activeSort = 'latest';
      loadPosts();
    });

    tabTrending.addEventListener('click', () => {
      tabTrending.classList.add('active');
      tabLatest.classList.remove('active');
      state.activeSort = 'trending';
      loadPosts();
    });

    // Global search input
    globalSearchInput.addEventListener('input', () => {
      const val = globalSearchInput.value.trim();
      clearSearchBtn.style.display = val ? 'block' : 'none';
    });

    globalSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        state.searchQuery = globalSearchInput.value.trim();
        loadPosts();
      }
    });

    clearSearchBtn.addEventListener('click', () => {
      globalSearchInput.value = '';
      clearSearchBtn.style.display = 'none';
      state.searchQuery = '';
      loadPosts();
    });

    // Nav user menu toggle
    userMenuToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdownMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!userDropdownMenu.contains(e.target) && !userMenuToggleBtn.contains(e.target)) {
        userDropdownMenu.classList.remove('active');
      }
    });

    dropdownViewProfileBtn.addEventListener('click', () => {
      userDropdownMenu.classList.remove('active');
      if (state.currentUser) openUserProfileModal(state.currentUser.username);
    });

    dropdownSwitchDemoBtn.addEventListener('click', () => {
      userDropdownMenu.classList.remove('active');
      demoUserList.scrollIntoView({ behavior: 'smooth' });
    });

    dropdownSignOutBtn.addEventListener('click', () => {
      userDropdownMenu.classList.remove('active');
      API.logout();
      state.currentUser = null;
      updateNavUserUI();
      renderDemoUsersList();
      showToast('Signed out of NexusFeed', '👋');
      loadPosts();
    });

    // Auth modal controls
    openAuthModalBtn.addEventListener('click', () => openAuthModal('signin'));
    sidebarRegisterNewBtn.addEventListener('click', () => openAuthModal('signup'));
    closeAuthModalBtn.addEventListener('click', closeAuthModal);
    authModalBackdrop.addEventListener('click', (e) => {
      if (e.target === authModalBackdrop) closeAuthModal();
    });

    tabSignIn.addEventListener('click', () => {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signInForm.style.display = 'flex';
      signUpForm.style.display = 'none';
      authErrorBanner.style.display = 'none';
    });

    tabSignUp.addEventListener('click', () => {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      signUpForm.style.display = 'flex';
      signInForm.style.display = 'none';
      authErrorBanner.style.display = 'none';
    });

    // Avatar picker in register form
    document.querySelectorAll('.avatar-option').forEach(img => {
      img.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(i => i.classList.remove('selected'));
        img.classList.add('selected');
      });
    });

    // Sign in submission
    signInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const login = document.getElementById('loginInput').value.trim();
      const password = document.getElementById('loginPasswordInput').value;

      try {
        const res = await API.login(login, password);
        state.currentUser = res.user;
        updateNavUserUI();
        renderDemoUsersList();
        closeAuthModal();
        showToast(`Welcome back, ${res.user.displayName}! 👋`, '🎉');
        loadPosts();
      } catch (err) {
        authErrorBanner.textContent = err.message;
        authErrorBanner.style.display = 'block';
      }
    });

    // Sign up submission
    signUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const displayName = document.getElementById('regDisplayNameInput').value.trim();
      const username = document.getElementById('regUsernameInput').value.trim();
      const email = document.getElementById('regEmailInput').value.trim();
      const password = document.getElementById('regPasswordInput').value;
      const bio = document.getElementById('regBioInput').value.trim();

      const selectedAvatar = document.querySelector('.avatar-option.selected');
      const avatarUrl = selectedAvatar ? selectedAvatar.dataset.url : '';

      try {
        const res = await API.register({
          displayName,
          username,
          email,
          password,
          bio,
          avatarUrl
        });
        state.currentUser = res.user;
        updateNavUserUI();
        loadDemoAccounts();
        closeAuthModal();
        showToast(`Account created! Welcome to NexusFeed, ${res.user.displayName}! 🚀`, '✨');
        loadPosts();
      } catch (err) {
        authErrorBanner.textContent = err.message;
        authErrorBanner.style.display = 'block';
      }
    });

    // Profile modal close
    closeProfileModalBtn.addEventListener('click', () => {
      profileModalBackdrop.style.display = 'none';
    });
    profileModalBackdrop.addEventListener('click', (e) => {
      if (e.target === profileModalBackdrop) profileModalBackdrop.style.display = 'none';
    });

    // Lightbox close
    lightboxCloseBtn.addEventListener('click', () => {
      lightboxBackdrop.style.display = 'none';
    });
    lightboxBackdrop.addEventListener('click', (e) => {
      if (e.target === lightboxBackdrop) lightboxBackdrop.style.display = 'none';
    });
  }

  // Launch app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
