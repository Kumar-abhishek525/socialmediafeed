const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'social_feed.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    bio TEXT DEFAULT '',
    badge TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
`);

// Seed default users and posts if empty
function seedDatabase() {
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (countUsers > 0) {
    return;
  }

  console.log('🌱 Seeding initial demo users and posts...');
  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('password123', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (username, display_name, email, password_hash, avatar_url, bio, badge)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const user1 = insertUser.run(
    'alex_rivera',
    'Alex Rivera',
    'alex@nexusfeed.io',
    defaultPasswordHash,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    'Creative Technologist & Full-Stack Architect. Exploring real-time streaming, shaders, and cybernetic UI/UX ⚡',
    'Staff Engineer'
  );

  const user2 = insertUser.run(
    'sophia_chen',
    'Sophia Chen',
    'sophia@nexusfeed.io',
    defaultPasswordHash,
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    'Product Designer & Design Systems Lead. Obsessed with glassmorphism, micro-animations, and sleek dark modes ✨',
    'Design Lead'
  );

  const user3 = insertUser.run(
    'marcus_vance',
    'Marcus Vance',
    'marcus@nexusfeed.io',
    defaultPasswordHash,
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    'AI Researcher & Systems Hacker. Building real-time distributed agents and high-throughput feeds 🚀',
    'AI Explorer'
  );

  const u1Id = Number(user1.lastInsertRowid);
  const u2Id = Number(user2.lastInsertRowid);
  const u3Id = Number(user3.lastInsertRowid);

  const insertPost = db.prepare(`
    INSERT INTO posts (user_id, content, image_url, tags, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);

  const p1 = insertPost.run(
    u2Id,
    '✨ Just finished iterating on the new glassmorphic design system! Notice the subtle glowing backdrop blur and refined typography hierarchy. Real-time updates feel so instantaneous with WebSockets!',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    'design,uiux,inspiration',
    '-45 minutes'
  );

  const p2 = insertPost.run(
    u1Id,
    '⚡ Built a bidirectional WebSocket streaming engine for this feed application. Sub-millisecond latency when broadcasting likes, comments, and posts across connected peers. No manual polling required!',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    'tech,webdev,javascript',
    '-20 minutes'
  );

  const p3 = insertPost.run(
    u3Id,
    '🌌 Late night experimentation with autonomous AI agent workflows and edge streaming. The future of collaborative interfaces is hyper-responsive and real-time. What are you building this week?',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    'ai,future,coding',
    '-5 minutes'
  );

  const p1Id = Number(p1.lastInsertRowid);
  const p2Id = Number(p2.lastInsertRowid);
  const p3Id = Number(p3.lastInsertRowid);

  // Seed Likes
  const insertLike = db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)');
  insertLike.run(u1Id, p1Id);
  insertLike.run(u3Id, p1Id);
  insertLike.run(u2Id, p2Id);
  insertLike.run(u3Id, p2Id);
  insertLike.run(u1Id, p3Id);

  // Seed Comments
  const insertComment = db.prepare(`
    INSERT INTO comments (user_id, post_id, content, created_at)
    VALUES (?, ?, ?, datetime('now', ?))
  `);

  insertComment.run(u1Id, p1Id, 'The light refraction on those gradients is pristine! 💜', '-35 minutes');
  insertComment.run(u3Id, p1Id, 'Incredible work Sophia. Cleanest interface I have seen this year.', '-30 minutes');
  insertComment.run(u2Id, p2Id, 'The instant like sync over WebSockets is so satisfying to click! 🔥', '-12 minutes');
  insertComment.run(u1Id, p3Id, 'Looking forward to testing the agent pipelines Marcus!', '-2 minutes');

  console.log('✅ Seeding completed successfully!');
}

seedDatabase();

// Database Query Helpers
const dbHelpers = {
  // Users
  getUserById(id) {
    return db.prepare('SELECT id, username, display_name, email, avatar_url, bio, badge, created_at FROM users WHERE id = ?').get(id);
  },

  getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  },

  getUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  },

  createUser({ username, displayName, email, passwordHash, avatarUrl, bio = '', badge = '' }) {
    const stmt = db.prepare(`
      INSERT INTO users (username, display_name, email, password_hash, avatar_url, bio, badge)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, displayName, email, passwordHash, avatarUrl, bio, badge);
    return Number(result.lastInsertRowid);
  },

  getAllDemoUsers() {
    return db.prepare('SELECT id, username, display_name, avatar_url, bio, badge FROM users LIMIT 10').all();
  },

  // Posts
  getAllPosts({ currentUserId = null, tag = null, search = null, sortBy = 'latest' } = {}) {
    let query = `
      SELECT 
        p.id,
        p.user_id,
        p.content,
        p.image_url,
        p.tags,
        p.created_at,
        u.username,
        u.display_name,
        u.avatar_url,
        u.badge,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
        CASE WHEN ? IS NOT NULL AND EXISTS(
          SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?
        ) THEN 1 ELSE 0 END AS has_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;

    const params = [currentUserId, currentUserId];

    if (tag) {
      query += ' AND (p.tags LIKE ? OR p.content LIKE ?)';
      params.push(`%${tag}%`, `%#${tag}%`);
    }

    if (search) {
      query += ' AND (p.content LIKE ? OR u.username LIKE ? OR u.display_name LIKE ? OR p.tags LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (sortBy === 'trending') {
      query += ' ORDER BY (likes_count * 2 + comments_count * 3) DESC, p.created_at DESC';
    } else {
      query += ' ORDER BY p.created_at DESC';
    }

    return db.prepare(query).all(...params);
  },

  getPostById(postId, currentUserId = null) {
    const query = `
      SELECT 
        p.id,
        p.user_id,
        p.content,
        p.image_url,
        p.tags,
        p.created_at,
        u.username,
        u.display_name,
        u.avatar_url,
        u.badge,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
        CASE WHEN ? IS NOT NULL AND EXISTS(
          SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?
        ) THEN 1 ELSE 0 END AS has_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `;
    return db.prepare(query).get(currentUserId, currentUserId, postId);
  },

  createPost({ userId, content, imageUrl = '', tags = '' }) {
    const stmt = db.prepare(`
      INSERT INTO posts (user_id, content, image_url, tags)
      VALUES (?, ?, ?, ?)
    `);
    const res = stmt.run(userId, content, imageUrl, tags);
    return Number(res.lastInsertRowid);
  },

  deletePost(postId, userId) {
    const stmt = db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?');
    const res = stmt.run(postId, userId);
    return res.changes > 0;
  },

  // Likes
  toggleLike(userId, postId) {
    const checkStmt = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?');
    const existing = checkStmt.get(userId, postId);

    let hasLiked = false;
    if (existing) {
      db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
      hasLiked = false;
    } else {
      db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(userId, postId);
      hasLiked = true;
    }

    const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId).count;
    return { hasLiked, likesCount: count };
  },

  getPostLikes(postId) {
    return db.prepare(`
      SELECT l.created_at, u.id, u.username, u.display_name, u.avatar_url
      FROM likes l
      JOIN users u ON l.user_id = u.id
      WHERE l.post_id = ?
      ORDER BY l.created_at DESC
    `).all(postId);
  },

  // Comments
  getCommentsForPost(postId) {
    return db.prepare(`
      SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        u.username,
        u.display_name,
        u.avatar_url,
        u.badge
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(postId);
  },

  createComment({ postId, userId, content }) {
    const stmt = db.prepare(`
      INSERT INTO comments (post_id, user_id, content)
      VALUES (?, ?, ?)
    `);
    const res = stmt.run(postId, userId, content);
    const commentId = Number(res.lastInsertRowid);

    const fullComment = db.prepare(`
      SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        u.username,
        u.display_name,
        u.avatar_url,
        u.badge
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    const commentsCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(postId).count;

    return { comment: fullComment, commentsCount };
  },

  deleteComment(commentId, userId) {
    // Can delete if author of comment or author of post
    const comment = db.prepare(`
      SELECT c.*, p.user_id as post_author_id 
      FROM comments c 
      JOIN posts p ON c.post_id = p.id 
      WHERE c.id = ?
    `).get(commentId);

    if (!comment) return { success: false, postId: null };

    if (comment.user_id !== userId && comment.post_author_id !== userId) {
      return { success: false, unauthorized: true };
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    const count = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(comment.post_id).count;

    return { success: true, postId: comment.post_id, commentsCount: count };
  },

  // User Profile Stats
  getUserProfile(username, currentUserId = null) {
    const user = this.getUserByUsername(username);
    if (!user) return null;

    const postsCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE user_id = ?').get(user.id).count;
    const totalLikesReceived = db.prepare(`
      SELECT COUNT(*) as count 
      FROM likes l 
      JOIN posts p ON l.post_id = p.id 
      WHERE p.user_id = ?
    `).get(user.id).count;

    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      badge: user.badge,
      createdAt: user.created_at,
      stats: {
        postsCount,
        likesReceived: totalLikesReceived,
        following: 142, // Aesthetic simulated metric
        followers: 384
      }
    };
  }
};

module.exports = {
  db,
  dbHelpers
};
