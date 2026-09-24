const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexusfeed';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('🍃 Connected to MongoDB at', MONGO_URI);
    seedDatabase();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

// ==========================================
// SCHEMAS
// ==========================================

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  displayName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  bio: { type: String, default: '' },
  badge: { type: String, default: 'Member' },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true },
  imageUrl: { type: String, default: '' },
  tags: [{ type: String, trim: true }],
  createdAt: { type: Date, default: Date.now }
});

const LikeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  createdAt: { type: Date, default: Date.now }
});
LikeSchema.index({ user: 1, post: 1 }, { unique: true });

const CommentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  content: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);
const Like = mongoose.model('Like', LikeSchema);
const Comment = mongoose.model('Comment', CommentSchema);

// ==========================================
// SEED DATABASE
// ==========================================
async function seedDatabase() {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) return;

    console.log('🌱 Seeding MongoDB demo users and posts...');
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('password123', salt);

    const u1 = await User.create({
      username: 'alex_rivera',
      displayName: 'Alex Rivera',
      email: 'alex@nexusfeed.io',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      bio: 'Creative Technologist & Full-Stack Architect. Exploring real-time streaming, shaders, and cybernetic UI/UX ⚡',
      badge: 'Staff Engineer'
    });

    const u2 = await User.create({
      username: 'sophia_chen',
      displayName: 'Sophia Chen',
      email: 'sophia@nexusfeed.io',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      bio: 'Product Designer & Design Systems Lead. Obsessed with Tailwind CSS v4, glassmorphism, and sleek dark modes ✨',
      badge: 'Design Lead'
    });

    const u3 = await User.create({
      username: 'marcus_vance',
      displayName: 'Marcus Vance',
      email: 'marcus@nexusfeed.io',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      bio: 'AI Researcher & Systems Hacker. Building real-time distributed agents and high-throughput feeds 🚀',
      badge: 'AI Explorer'
    });

    const p1 = await Post.create({
      user: u2._id,
      content: '✨ Just completed upgrading NexusFeed with Tailwind CSS v4 and MongoDB! Notice the clean utility hierarchy, glassmorphism, and lightning fast database queries.',
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      tags: ['design', 'tailwindcss', 'uiux'],
      createdAt: new Date(Date.now() - 45 * 60 * 1000)
    });

    const p2 = await Post.create({
      user: u1._id,
      content: '⚡ MongoDB + WebSockets is an absolute dream combination. Instant document updates broadcast across all connected clients with zero latency!',
      imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
      tags: ['tech', 'mongodb', 'websocket'],
      createdAt: new Date(Date.now() - 20 * 60 * 1000)
    });

    const p3 = await Post.create({
      user: u3._id,
      content: '🌌 Late night experimentation with autonomous AI agent workflows and edge streaming. The future of collaborative interfaces is hyper-responsive and real-time.',
      imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      tags: ['ai', 'future', 'coding'],
      createdAt: new Date(Date.now() - 5 * 60 * 1000)
    });

    // Seed Likes
    await Like.create({ user: u1._id, post: p1._id });
    await Like.create({ user: u3._id, post: p1._id });
    await Like.create({ user: u2._id, post: p2._id });
    await Like.create({ user: u3._id, post: p2._id });
    await Like.create({ user: u1._id, post: p3._id });

    // Seed Comments
    await Comment.create({
      user: u1._id,
      post: p1._id,
      content: 'Tailwind CSS v4 makes the glassmorphic cards look razor sharp! 💜',
      createdAt: new Date(Date.now() - 35 * 60 * 1000)
    });
    await Comment.create({
      user: u3._id,
      post: p1._id,
      content: 'MongoDB aggregation pipelines for feed rankings are blazing fast.',
      createdAt: new Date(Date.now() - 30 * 60 * 1000)
    });
    await Comment.create({
      user: u2._id,
      post: p2._id,
      content: 'The instant like sync over WebSockets is so satisfying to click! 🔥',
      createdAt: new Date(Date.now() - 12 * 60 * 1000)
    });

    console.log('✅ MongoDB seeding completed successfully!');
  } catch (err) {
    console.error('Error during MongoDB seed:', err);
  }
}

// ==========================================
// DB QUERY HELPERS
// ==========================================
const dbHelpers = {
  // Users
  async getUserById(id) {
    return await User.findById(id).lean();
  },

  async getUserByUsername(username) {
    return await User.findOne({ username: username.toLowerCase() }).lean();
  },

  async getUserByEmail(email) {
    return await User.findOne({ email: email.toLowerCase() }).lean();
  },

  async createUser({ username, displayName, email, passwordHash, avatarUrl, bio = '', badge = 'Member' }) {
    const user = await User.create({
      username: username.toLowerCase(),
      displayName,
      email: email.toLowerCase(),
      passwordHash,
      avatarUrl,
      bio,
      badge
    });
    return user;
  },

  async getAllDemoUsers() {
    const users = await User.find({}, 'id username displayName avatarUrl bio badge').lean();
    return users.map(u => ({
      id: u._id.toString(),
      username: u.username,
      display_name: u.displayName,
      avatar_url: u.avatarUrl,
      bio: u.bio,
      badge: u.badge
    }));
  },

  // Posts
  async getAllPosts({ currentUserId = null, tag = null, search = null, sortBy = 'latest' } = {}) {
    const query = {};

    if (tag) {
      query.$or = [
        { tags: { $in: [new RegExp(tag, 'i')] } },
        { content: { $regex: tag, $options: 'i' } }
      ];
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { content: searchRegex },
        { tags: { $in: [searchRegex] } }
      ];
    }

    const posts = await Post.find(query)
      .populate('user', 'username displayName avatarUrl badge')
      .sort({ createdAt: -1 })
      .lean();

    // Attach counts & like status
    const postIds = posts.map(p => p._id);
    const likes = await Like.find({ post: { $in: postIds } }).lean();
    const comments = await Comment.find({ post: { $in: postIds } }).lean();

    const formattedPosts = posts.map(p => {
      const pLikes = likes.filter(l => l.post.toString() === p._id.toString());
      const pComments = comments.filter(c => c.post.toString() === p._id.toString());
      const hasLiked = currentUserId ? pLikes.some(l => l.user.toString() === currentUserId.toString()) : false;

      return {
        id: p._id.toString(),
        user_id: p.user ? p.user._id.toString() : null,
        content: p.content,
        image_url: p.imageUrl,
        tags: Array.isArray(p.tags) ? p.tags.join(',') : '',
        created_at: p.createdAt,
        username: p.user ? p.user.username : 'unknown',
        display_name: p.user ? p.user.displayName : 'Anonymous',
        avatar_url: p.user ? p.user.avatarUrl : '',
        badge: p.user ? p.user.badge : '',
        likes_count: pLikes.length,
        comments_count: pComments.length,
        has_liked: hasLiked ? 1 : 0
      };
    });

    if (sortBy === 'trending') {
      formattedPosts.sort((a, b) => (b.likes_count * 2 + b.comments_count * 3) - (a.likes_count * 2 + a.comments_count * 3));
    }

    return formattedPosts;
  },

  async getPostById(postId, currentUserId = null) {
    const p = await Post.findById(postId).populate('user', 'username displayName avatarUrl badge').lean();
    if (!p) return null;

    const likesCount = await Like.countDocuments({ post: postId });
    const commentsCount = await Comment.countDocuments({ post: postId });
    const hasLiked = currentUserId ? await Like.exists({ post: postId, user: currentUserId }) : false;

    return {
      id: p._id.toString(),
      user_id: p.user ? p.user._id.toString() : null,
      content: p.content,
      image_url: p.imageUrl,
      tags: Array.isArray(p.tags) ? p.tags.join(',') : '',
      created_at: p.createdAt,
      username: p.user ? p.user.username : 'unknown',
      display_name: p.user ? p.user.displayName : 'Anonymous',
      avatar_url: p.user ? p.user.avatarUrl : '',
      badge: p.user ? p.user.badge : '',
      likes_count: likesCount,
      comments_count: commentsCount,
      has_liked: hasLiked ? 1 : 0
    };
  },

  async createPost({ userId, content, imageUrl = '', tags = '' }) {
    const tagArray = Array.isArray(tags)
      ? tags
      : tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);

    const post = await Post.create({
      user: userId,
      content,
      imageUrl,
      tags: tagArray
    });
    return post._id.toString();
  },

  async deletePost(postId, userId) {
    const post = await Post.findById(postId);
    if (!post) return false;
    if (post.user.toString() !== userId.toString()) return false;

    await Post.findByIdAndDelete(postId);
    await Like.deleteMany({ post: postId });
    await Comment.deleteMany({ post: postId });
    return true;
  },

  // Likes
  async toggleLike(userId, postId) {
    const existing = await Like.findOne({ user: userId, post: postId });
    let hasLiked = false;

    if (existing) {
      await Like.findByIdAndDelete(existing._id);
      hasLiked = false;
    } else {
      await Like.create({ user: userId, post: postId });
      hasLiked = true;
    }

    const likesCount = await Like.countDocuments({ post: postId });
    return { hasLiked, likesCount };
  },

  async getPostLikes(postId) {
    const likes = await Like.find({ post: postId })
      .populate('user', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .lean();

    return likes.map(l => ({
      created_at: l.createdAt,
      id: l.user ? l.user._id.toString() : '',
      username: l.user ? l.user.username : '',
      display_name: l.user ? l.user.displayName : '',
      avatar_url: l.user ? l.user.avatarUrl : ''
    }));
  },

  // Comments
  async getCommentsForPost(postId) {
    const comments = await Comment.find({ post: postId })
      .populate('user', 'username displayName avatarUrl badge')
      .sort({ createdAt: 1 })
      .lean();

    return comments.map(c => ({
      id: c._id.toString(),
      post_id: c.post.toString(),
      user_id: c.user ? c.user._id.toString() : '',
      content: c.content,
      created_at: c.createdAt,
      username: c.user ? c.user.username : '',
      display_name: c.user ? c.user.displayName : 'Anonymous',
      avatar_url: c.user ? c.user.avatarUrl : '',
      badge: c.user ? c.user.badge : ''
    }));
  },

  async createComment({ postId, userId, content }) {
    const comment = await Comment.create({
      post: postId,
      user: userId,
      content
    });

    const populated = await Comment.findById(comment._id)
      .populate('user', 'username displayName avatarUrl badge')
      .lean();

    const commentsCount = await Comment.countDocuments({ post: postId });

    return {
      comment: {
        id: populated._id.toString(),
        post_id: populated.post.toString(),
        user_id: populated.user ? populated.user._id.toString() : '',
        content: populated.content,
        created_at: populated.createdAt,
        username: populated.user ? populated.user.username : '',
        display_name: populated.user ? populated.user.displayName : '',
        avatar_url: populated.user ? populated.user.avatarUrl : '',
        badge: populated.user ? populated.user.badge : ''
      },
      commentsCount
    };
  },

  async deleteComment(commentId, userId) {
    const comment = await Comment.findById(commentId).populate('post');
    if (!comment) return { success: false, postId: null };

    const isCommentAuthor = comment.user.toString() === userId.toString();
    const isPostAuthor = comment.post && comment.post.user.toString() === userId.toString();

    if (!isCommentAuthor && !isPostAuthor) {
      return { success: false, unauthorized: true };
    }

    const postId = comment.post._id.toString();
    await Comment.findByIdAndDelete(commentId);
    const commentsCount = await Comment.countDocuments({ post: postId });

    return { success: true, postId, commentsCount };
  },

  // User Profile
  async getUserProfile(username, currentUserId = null) {
    const user = await User.findOne({ username: username.toLowerCase() }).lean();
    if (!user) return null;

    const postsCount = await Post.countDocuments({ user: user._id });
    const userPosts = await Post.find({ user: user._id }, '_id').lean();
    const userPostIds = userPosts.map(p => p._id);
    const totalLikesReceived = await Like.countDocuments({ post: { $in: userPostIds } });

    return {
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      badge: user.badge,
      createdAt: user.createdAt,
      stats: {
        postsCount,
        likesReceived: totalLikesReceived,
        following: 142,
        followers: 384
      }
    };
  }
};

module.exports = {
  mongoose,
  User,
  Post,
  Like,
  Comment,
  dbHelpers
};
