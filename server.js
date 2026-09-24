const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { WebSocketServer, WebSocket } = require('ws');
const { dbHelpers } = require('./models');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexus-social-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to broadcast WS messages
function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// WebSocket Connection Management
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    data: {
      message: 'Connected to live feed sync network (MongoDB Powered)',
      onlineCount: wss.clients.size
    }
  }));

  broadcast({
    type: 'ONLINE_COUNT',
    data: { count: wss.clients.size }
  });

  ws.on('close', () => {
    broadcast({
      type: 'ONLINE_COUNT',
      data: { count: wss.clients.size }
    });
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err.message);
  });
});

// Authentication Helpers
function generateToken(user) {
  const id = user._id ? user._id.toString() : user.id;
  return jwt.sign(
    { id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbHelpers.getUserById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    req.user = {
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      badge: user.badge
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await dbHelpers.getUserById(decoded.id);
      if (user) {
        req.user = {
          id: user._id.toString(),
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          badge: user.badge
        };
      }
    } catch {
      // Ignore token decode errors for optional auth
    }
  }
  next();
}

// ==========================================
// AUTH ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, displayName, email, password, avatarUrl, bio } = req.body;

    if (!username || !displayName || !email || !password) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 alphanumeric characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await dbHelpers.getUserByUsername(cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const existingEmail = await dbHelpers.getUserByEmail(email.trim());
    if (existingEmail) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const defaultAvatars = [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80'
    ];
    const finalAvatar = avatarUrl && avatarUrl.trim()
      ? avatarUrl.trim()
      : defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

    const user = await dbHelpers.createUser({
      username: cleanUsername,
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      avatarUrl: finalAvatar,
      bio: bio ? bio.trim() : '',
      badge: 'Member'
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Account created successfully in MongoDB',
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        badge: user.badge
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required' });
    }

    const cleanLogin = login.trim();
    const user = cleanLogin.includes('@')
      ? await dbHelpers.getUserByEmail(cleanLogin)
      : await dbHelpers.getUserByUsername(cleanLogin);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        badge: user.badge
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Current User Profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Demo accounts for instant multi-user simulation & testing
app.get('/api/auth/demo-users', async (req, res) => {
  try {
    const users = await dbHelpers.getAllDemoUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch demo accounts' });
  }
});

// Quick Switch Demo Persona
app.post('/api/auth/switch-demo', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await dbHelpers.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    const token = generateToken(user);
    res.json({
      message: `Switched to @${user.username}`,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        badge: user.badge
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to switch demo user' });
  }
});

// User Profile by Username
app.get('/api/users/:username', optionalAuth, async (req, res) => {
  try {
    const profile = await dbHelpers.getUserProfile(req.params.username, req.user ? req.user.id : null);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ==========================================
// POSTS ROUTES
// ==========================================

// Get feed posts
app.get('/api/posts', optionalAuth, async (req, res) => {
  try {
    const { tag, search, sortBy } = req.query;
    const posts = await dbHelpers.getAllPosts({
      currentUserId: req.user ? req.user.id : null,
      tag: tag || null,
      search: search || null,
      sortBy: sortBy || 'latest'
    });
    res.json(posts);
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ error: 'Failed to retrieve posts' });
  }
});

// Get single post
app.get('/api/posts/:id', optionalAuth, async (req, res) => {
  try {
    const post = await dbHelpers.getPostById(req.params.id, req.user ? req.user.id : null);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve post' });
  }
});

// Create new post
app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { content, imageUrl, tags } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    let extractedTags = tags ? tags.trim() : '';
    if (!extractedTags) {
      const matches = content.match(/#[a-zA-Z0-9_]+/g);
      if (matches) {
        extractedTags = matches.map(m => m.replace('#', '').toLowerCase()).join(',');
      }
    }

    const postId = await dbHelpers.createPost({
      userId: req.user.id,
      content: content.trim(),
      imageUrl: imageUrl ? imageUrl.trim() : '',
      tags: extractedTags
    });

    const fullPost = await dbHelpers.getPostById(postId, req.user.id);

    // Broadcast new post via WebSocket
    broadcast({
      type: 'NEW_POST',
      data: fullPost
    });

    res.status(201).json(fullPost);
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Delete post
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await dbHelpers.getPostById(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this post' });
    }

    const deleted = await dbHelpers.deletePost(postId, req.user.id);
    if (deleted) {
      broadcast({
        type: 'POST_DELETED',
        data: { postId }
      });
      res.json({ message: 'Post deleted successfully', postId });
    } else {
      res.status(400).json({ error: 'Could not delete post' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ==========================================
// LIKES ROUTES
// ==========================================

// Toggle like
app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await dbHelpers.getPostById(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const { hasLiked, likesCount } = await dbHelpers.toggleLike(req.user.id, postId);

    broadcast({
      type: 'LIKE_UPDATED',
      data: {
        postId,
        likesCount,
        userId: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
        hasLiked
      }
    });

    res.json({ hasLiked, likesCount, postId });
  } catch (err) {
    console.error('Toggle like error:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Get post likes list
app.get('/api/posts/:id/likes', async (req, res) => {
  try {
    const postId = req.params.id;
    const likes = await dbHelpers.getPostLikes(postId);
    res.json(likes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

// ==========================================
// COMMENTS ROUTES
// ==========================================

// Get comments for post
app.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const postId = req.params.id;
    const comments = await dbHelpers.getCommentsForPost(postId);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add comment
app.post('/api/posts/:id/comments', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const post = await dbHelpers.getPostById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const { comment, commentsCount } = await dbHelpers.createComment({
      postId,
      userId: req.user.id,
      content: content.trim()
    });

    broadcast({
      type: 'NEW_COMMENT',
      data: {
        postId,
        comment,
        commentsCount
      }
    });

    res.status(201).json({ comment, commentsCount });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete comment
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const result = await dbHelpers.deleteComment(commentId, req.user.id);

    if (!result.success) {
      if (result.unauthorized) {
        return res.status(403).json({ error: 'Unauthorized to delete this comment' });
      }
      return res.status(404).json({ error: 'Comment not found' });
    }

    broadcast({
      type: 'COMMENT_DELETED',
      data: {
        commentId,
        postId: result.postId,
        commentsCount: result.commentsCount
      }
    });

    res.json({ message: 'Comment deleted', commentId, postId: result.postId, commentsCount: result.commentsCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 NexusFeed Social Platform is running at http://localhost:${PORT}`);
  console.log(`⚡ WebSocket live sync ready at ws://localhost:${PORT}`);
  console.log(`🍃 Persistence: MongoDB`);
});
