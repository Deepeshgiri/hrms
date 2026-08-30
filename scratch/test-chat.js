import { io } from 'socket.io-client';

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function loginUser(email, password) {
  const res = await request('/api/login', {
    method: 'POST',
    body: { email, password }
  });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Failed to login as ${email}: ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

function createSocket(token) {
  return io(`http://localhost:${PORT}`, {
    auth: { token },
    query: { token },
    transports: ['websocket', 'polling']
  });
}

async function runChatAndCallingTestSuite() {
  console.log('========================================================');
  console.log('   HRMS WHATSAPP CHAT & WEBRTC CALLING TEST SUITE');
  console.log('========================================================\n');

  // 1. Log in Admin & Employee
  console.log('1. Logging in test users (Admin & Employee)...');
  const admin = await loginUser('admin@hrms.com', 'admin123');
  const employee = await loginUser('rahul@hrms.com', 'emp123');
  console.log(`   ✓ Admin ID: ${admin.user.id}, Employee ID: ${employee.user.id}`);

  const adminHeaders = { Authorization: `Bearer ${admin.token}` };
  const empHeaders = { Authorization: `Bearer ${employee.token}` };

  // 2. Test REST API: Get available users for chat
  console.log('\n2. Testing GET /api/chat/users...');
  const usersRes = await request('/api/chat/users', { headers: adminHeaders });
  if (usersRes.status !== 200 || !Array.isArray(usersRes.data)) {
    throw new Error(`Failed to get chat users: ${JSON.stringify(usersRes.data)}`);
  }
  console.log(`   ✓ Found ${usersRes.data.length} staff members available for chat`);

  // 3. Test REST API: Create or Get 1-to-1 conversation
  console.log('\n3. Testing POST /api/chat/conversations/direct (1-to-1 chat)...');
  const convRes = await request('/api/chat/conversations/direct', {
    method: 'POST',
    headers: adminHeaders,
    body: { targetUserId: employee.user.id }
  });
  if (convRes.status !== 200 || !convRes.data.conversationId) {
    throw new Error(`Failed to create 1-to-1 conversation: ${JSON.stringify(convRes.data)}`);
  }
  const convId = convRes.data.conversationId;
  console.log(`   ✓ 1-to-1 conversation active with ID: ${convId}`);

  // 4. Test REST API: Create Group Conversation
  console.log('\n4. Testing POST /api/chat/conversations/group (Group chat)...');
  const groupRes = await request('/api/chat/conversations/group', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'HRMS Engineering Team',
      description: 'Core developer discussions',
      memberIds: [employee.user.id]
    }
  });
  if (groupRes.status !== 201 || !groupRes.data.conversationId) {
    throw new Error(`Failed to create group: ${JSON.stringify(groupRes.data)}`);
  }
  console.log(`   ✓ Created Group "${groupRes.data.name}" with ID: ${groupRes.data.conversationId}`);

  // 5. Connect Socket.IO Clients
  console.log('\n5. Connecting Socket.IO real-time clients...');
  const adminSocket = createSocket(admin.token);
  const empSocket = createSocket(employee.token);

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    adminSocket.on('connect', check);
    empSocket.on('connect', check);
  });
  console.log('   ✓ Both Admin and Employee connected to Socket.IO real-time server');

  // Join Conversation room
  adminSocket.emit('chat:join_conversation', { conversationId: convId });
  empSocket.emit('chat:join_conversation', { conversationId: convId });
  await new Promise(r => setTimeout(r, 400));

  // 6. Test Real-time Messaging & Typing Indicator
  console.log('\n6. Testing Real-time Messaging & Typing...');
  const messagePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for socket message')), 6000);
    empSocket.on('chat:receive_message', (msg) => {
      clearTimeout(timeout);
      resolve(msg);
    });
  });

  const sendRes = await request(`/api/chat/conversations/${convId}/messages`, {
    method: 'POST',
    headers: adminHeaders,
    body: {
      content: 'Hello Rahul, this is a real-time WhatsApp-style message!',
      messageType: 'text'
    }
  });
  if (sendRes.status !== 201) throw new Error(`Send message failed: ${JSON.stringify(sendRes.data)}`);

  const receivedMsg = await messagePromise;
  console.log(`   ✓ Employee received message in real-time: "${receivedMsg.content}"`);

  // 7. Test Emoji Reactions
  console.log('\n7. Testing POST /api/chat/messages/:id/react (Emoji reaction)...');
  const reactRes = await request(`/api/chat/messages/${receivedMsg.id}/react`, {
    method: 'POST',
    headers: empHeaders,
    body: { emoji: '❤️' }
  });
  if (reactRes.status !== 200 || !reactRes.data.reactions) {
    throw new Error(`Reaction failed: ${JSON.stringify(reactRes.data)}`);
  }
  console.log(`   ✓ Emoji reaction added: ${reactRes.data.reactions[0]?.emoji}`);

  // 8. Test WebRTC Calling Signaling Flow
  console.log('\n8. Testing WebRTC Audio & Video Calling Signaling Flow...');

  const incomingCallPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for incoming call')), 6000);
    empSocket.on('call:incoming', (call) => {
      clearTimeout(timeout);
      resolve(call);
    });
  });

  // Admin initiates audio call to Employee
  adminSocket.emit('call:initiate', {
    receiverId: employee.user.id,
    callType: 'audio',
    conversationId: convId
  });

  const incomingCall = await incomingCallPromise;
  console.log(`   ✓ Employee received incoming call notification from: ${incomingCall.caller.name} (Call ID: ${incomingCall.callId})`);

  // Employee accepts call
  const callAcceptedPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for call:accepted')), 6000);
    adminSocket.on('call:accepted', (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  empSocket.emit('call:accept', {
    callId: incomingCall.callId,
    callerId: admin.user.id
  });

  await callAcceptedPromise;
  console.log('   ✓ Admin received call:accepted signal');

  // Test WebRTC SDP Offer / Answer exchange
  const sdpOfferPromise = new Promise((resolve) => {
    empSocket.on('call:webrtc:offer', (data) => resolve(data));
  });

  adminSocket.emit('call:webrtc:offer', {
    targetUserId: employee.user.id,
    sdp: { type: 'offer', sdp: 'v=0\r\no=admin 123456 IN IP4 127.0.0.1' },
    callId: incomingCall.callId
  });

  const receivedOffer = await sdpOfferPromise;
  console.log('   ✓ Employee received WebRTC SDP Offer');

  const sdpAnswerPromise = new Promise((resolve) => {
    adminSocket.on('call:webrtc:answer', (data) => resolve(data));
  });

  empSocket.emit('call:webrtc:answer', {
    targetUserId: admin.user.id,
    sdp: { type: 'answer', sdp: 'v=0\r\no=employee 654321 IN IP4 127.0.0.1' },
    callId: incomingCall.callId
  });

  await sdpAnswerPromise;
  console.log('   ✓ Admin received WebRTC SDP Answer');

  // End Call
  adminSocket.emit('call:end', {
    callId: incomingCall.callId,
    targetUserId: employee.user.id,
    duration: 45
  });
  console.log('   ✓ Call ended and duration recorded');

  // 9. Verify Call History
  console.log('\n9. Testing GET /api/chat/calls/history...');
  const callsRes = await request('/api/chat/calls/history', { headers: adminHeaders });
  if (callsRes.status !== 200 || callsRes.data.length === 0) {
    throw new Error(`Failed to fetch call history: ${JSON.stringify(callsRes.data)}`);
  }
  const lastCall = callsRes.data[0];
  console.log(`   ✓ Retrieved call history: ${lastCall.callType} call with ${lastCall.partnerName} (${lastCall.status})`);

  // Disconnect Sockets
  adminSocket.disconnect();
  empSocket.disconnect();

  console.log('\n========================================================');
  console.log('   🎉 ALL CHAT & WEBRTC CALLING TESTS PASSED! 🎉');
  console.log('========================================================\n');
}

runChatAndCallingTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
