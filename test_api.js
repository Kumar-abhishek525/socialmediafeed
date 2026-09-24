const http = require('http');
const { WebSocket } = require('ws');

// We can start the server directly on an isolated test port like 3099
process.env.PORT = '3099';
require('./server');

const BASE_URL = 'http://localhost:3099';
const WS_URL = 'ws://localhost:3099';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Social Media Feed API & WebSocket tests...');
  
  // Wait 500ms for server to boot
  await new Promise(r => setTimeout(r, 500));

  let token = null;
  let testUserId = null;
  let createdPostId = null;

  try {
    // 1. Get initial feed
    console.log('➡️ Testing GET /api/posts...');
    const feedRes = await request('GET', '/api/posts');
    if (feedRes.status !== 200 || !Array.isArray(feedRes.body)) {
      throw new Error(`Failed to get posts: ${JSON.stringify(feedRes.body)}`);
    }
    console.log(`✅ Received ${feedRes.body.length} initial seeded posts.`);

    // 2. Register user
    const username = `tester_${Math.floor(Math.random() * 89999 + 10000)}`;
    console.log(`➡️ Testing User Registration with @${username}...`);
    const regRes = await request('POST', '/api/auth/register', {
      username,
      displayName: 'Dev Tester',
      email: `${username}@test.com`,
      password: 'password123',
      bio: 'Automated test account for real-time validation'
    });

    if (regRes.status !== 201 || !regRes.body.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
    }
    token = regRes.body.token;
    testUserId = regRes.body.user.id;
    console.log(`✅ Registered user successfully! User ID: ${testUserId}`);

    // 3. User Login
    console.log('➡️ Testing User Login...');
    const loginRes = await request('POST', '/api/auth/login', {
      login: username,
      password: 'password123'
    });
    if (loginRes.status !== 200 || !loginRes.body.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }
    console.log('✅ Login authenticated successfully.');

    // 4. WebSocket test
    console.log('➡️ Testing WebSocket connection and live broadcast...');
    let wsReceivedNewPost = false;
    let wsReceivedLike = false;

    const wsClient = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
      wsClient.on('open', () => {
        console.log('✅ WebSocket connected successfully!');
        resolve();
      });
      wsClient.on('error', reject);
    });

    wsClient.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'NEW_POST') {
        wsReceivedNewPost = true;
      } else if (msg.type === 'LIKE_UPDATED') {
        wsReceivedLike = true;
      }
    });

    // 5. Create a new post
    console.log('➡️ Testing Post Creation...');
    const postRes = await request('POST', '/api/posts', {
      content: 'Real-time synchronization test with #websocket and #nodejs! 🚀',
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
      tags: 'websocket,nodejs,testing'
    }, token);

    if (postRes.status !== 201 || !postRes.body.id) {
      throw new Error(`Post creation failed: ${JSON.stringify(postRes.body)}`);
    }
    createdPostId = postRes.body.id;
    console.log(`✅ Post created successfully! Post ID: ${createdPostId}`);

    // 6. Like the post
    console.log(`➡️ Testing Like toggle on Post #${createdPostId}...`);
    const likeRes = await request('POST', `/api/posts/${createdPostId}/like`, {}, token);
    if (likeRes.status !== 200 || likeRes.body.hasLiked !== true || likeRes.body.likesCount !== 1) {
      throw new Error(`Like failed: ${JSON.stringify(likeRes.body)}`);
    }
    console.log('✅ Post liked successfully! Likes count: 1');

    // 7. Add Comment
    console.log(`➡️ Testing Comment on Post #${createdPostId}...`);
    const commentRes = await request('POST', `/api/posts/${createdPostId}/comments`, {
      content: 'WebSockets work seamlessly with zero latency! ⚡'
    }, token);

    if (commentRes.status !== 201 || !commentRes.body.comment.id) {
      throw new Error(`Comment failed: ${JSON.stringify(commentRes.body)}`);
    }
    console.log('✅ Comment created successfully!');

    // Wait a brief moment for WS events
    await new Promise(r => setTimeout(r, 600));

    if (!wsReceivedNewPost) {
      throw new Error('WebSocket failed to receive NEW_POST event');
    }
    if (!wsReceivedLike) {
      throw new Error('WebSocket failed to receive LIKE_UPDATED event');
    }
    console.log('✅ WebSocket broadcast received both NEW_POST and LIKE_UPDATED live events!');

    wsClient.close();
    console.log('\n🎉 ALL 7 TEST SUITES PASSED FLAWLESSLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTests();
