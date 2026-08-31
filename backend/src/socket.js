import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { presenceStore } from './redis.js';
import { JWT_SECRET } from './auth.js';

let ioInstance = null;

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  ioInstance = io;

  // Socket.IO JWT Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const secret = JWT_SECRET;
      const decoded = jwt.verify(token, secret);

      const userId = decoded.userId || decoded.id;
      const [rows] = await pool.query(
        'SELECT id, name, email, employeeId, roleId FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.user = {
        userId: rows[0].id,
        id: rows[0].id,
        name: rows[0].name,
        email: rows[0].email,
        employeeId: rows[0].employeeId,
        roleId: rows[0].roleId,
      };

      next();
    } catch (err) {
      next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    const userId = user.userId;

    // Join personal user room
    socket.join(`user_${userId}`);

    // Update presence
    await presenceStore.setUserOnline(userId, socket.id);
    await pool.query(
      `INSERT INTO chat_user_presence (userId, isOnline, socketId, lastSeen)
       VALUES (?, TRUE, ?, NOW())
       ON DUPLICATE KEY UPDATE isOnline = TRUE, socketId = VALUES(socketId), lastSeen = NOW()`,
      [userId, socket.id]
    );

    // Broadcast presence to all users
    io.emit('presence:update', {
      userId,
      isOnline: true,
      lastSeen: new Date().toISOString(),
    });

    console.log(`[Socket.IO] Connected: ${user.name} (ID: ${userId}) [Socket: ${socket.id}]`);

    // ---------------- CHAT ROOM EVENTS ----------------

    socket.on('chat:join_conversation', ({ conversationId }) => {
      if (conversationId) {
        socket.join(`conv_${conversationId}`);
      }
    });

    socket.on('chat:leave_conversation', ({ conversationId }) => {
      if (conversationId) {
        socket.leave(`conv_${conversationId}`);
      }
    });

    socket.on('chat:typing', ({ conversationId, isTyping }) => {
      if (conversationId) {
        socket.to(`conv_${conversationId}`).emit('chat:user_typing', {
          conversationId,
          userId,
          userName: user.name,
          isTyping,
        });
      }
    });

    socket.on('chat:message_read', async ({ conversationId, messageId }) => {
      try {
        if (!conversationId) return;

        // Update read status in participant table
        await pool.query(
          `UPDATE chat_participants SET lastReadMessageId = ?, lastReadAt = NOW() WHERE conversationId = ? AND userId = ?`,
          [messageId || null, conversationId, userId]
        );

        // Update message receipts
        if (messageId) {
          await pool.query(
            `UPDATE chat_messages SET status = 'read' WHERE conversationId = ? AND id <= ? AND senderId != ?`,
            [conversationId, messageId, userId]
          );
        }

        io.to(`conv_${conversationId}`).emit('chat:messages_read', {
          conversationId,
          readerId: userId,
          messageId,
          readAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error handling chat:message_read:', err);
      }
    });

    // ---------------- WEBRTC AUDIO & VIDEO CALLING SIGNALING ----------------

    // 1. Initiate Call
    socket.on('call:initiate', async ({ receiverId, callType = 'audio', conversationId = null }) => {
      try {
        const targetUserId = Number(receiverId);

        // Check if receiver is online
        const isReceiverOnline = await presenceStore.isUserOnline(targetUserId);

        const [insertResult] = await pool.query(
          `INSERT INTO chat_calls (callerId, receiverId, callType, status, conversationId)
           VALUES (?, ?, ?, 'initiated', ?)`,
          [userId, targetUserId, callType, conversationId]
        );

        const callId = insertResult.insertId;

        const callPayload = {
          callId,
          caller: {
            userId: user.userId,
            name: user.name,
            email: user.email,
            employeeId: user.employeeId,
          },
          receiverId: targetUserId,
          callType,
          conversationId,
          timestamp: new Date().toISOString(),
        };

        if (isReceiverOnline) {
          // Ring the receiver
          io.to(`user_${targetUserId}`).emit('call:incoming', callPayload);
          socket.emit('call:ringing', { callId, receiverId: targetUserId });
        } else {
          // User is offline
          await pool.query(`UPDATE chat_calls SET status = 'missed', endedAt = NOW() WHERE id = ?`, [callId]);
          socket.emit('call:unavailable', { callId, message: 'User is currently offline' });
        }
      } catch (err) {
        console.error('Error initiating call:', err);
        socket.emit('call:error', { message: 'Failed to initiate call' });
      }
    });

    // 2. Accept Call
    socket.on('call:accept', async ({ callId, callerId }) => {
      try {
        await pool.query(
          `UPDATE chat_calls SET status = 'answered', startedAt = NOW() WHERE id = ?`,
          [callId]
        );

        io.to(`user_${callerId}`).emit('call:accepted', {
          callId,
          receiverId: userId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error accepting call:', err);
      }
    });

    // 3. Reject Call
    socket.on('call:reject', async ({ callId, callerId, reason = 'declined' }) => {
      try {
        await pool.query(
          `UPDATE chat_calls SET status = 'rejected', endedAt = NOW() WHERE id = ?`,
          [callId]
        );

        io.to(`user_${callerId}`).emit('call:rejected', {
          callId,
          receiverId: userId,
          reason,
        });
      } catch (err) {
        console.error('Error rejecting call:', err);
      }
    });

    // 4. End Call
    socket.on('call:end', async ({ callId, targetUserId, duration = 0 }) => {
      try {
        if (callId) {
          await pool.query(
            `UPDATE chat_calls SET status = 'ended', endedAt = NOW(), duration = ? WHERE id = ?`,
            [Number(duration) || 0, callId]
          );
        }

        if (targetUserId) {
          io.to(`user_${targetUserId}`).emit('call:ended', {
            callId,
            endedBy: userId,
            duration,
          });
        }
      } catch (err) {
        console.error('Error ending call:', err);
      }
    });

    // 5. WebRTC Signaling: SDP Offer
    socket.on('call:webrtc:offer', ({ targetUserId, sdp, callId }) => {
      io.to(`user_${targetUserId}`).emit('call:webrtc:offer', {
        callerId: userId,
        sdp,
        callId,
      });
    });

    // 6. WebRTC Signaling: SDP Answer
    socket.on('call:webrtc:answer', ({ targetUserId, sdp, callId }) => {
      io.to(`user_${targetUserId}`).emit('call:webrtc:answer', {
        receiverId: userId,
        sdp,
        callId,
      });
    });

    // 7. WebRTC Signaling: ICE Candidate
    socket.on('call:webrtc:ice_candidate', ({ targetUserId, candidate, callId }) => {
      io.to(`user_${targetUserId}`).emit('call:webrtc:ice_candidate', {
        senderId: userId,
        candidate,
        callId,
      });
    });

    // ---------------- DISCONNECTION ----------------

    socket.on('disconnect', async () => {
      await presenceStore.setUserOffline(userId);
      await pool.query(
        `UPDATE chat_user_presence SET isOnline = FALSE, lastSeen = NOW(), socketId = NULL WHERE userId = ?`,
        [userId]
      );

      io.emit('presence:update', {
        userId,
        isOnline: false,
        lastSeen: new Date().toISOString(),
      });

      console.log(`[Socket.IO] Disconnected: ${user.name} (ID: ${userId})`);
    });
  });

  return io;
}

export function getIO() {
  return ioInstance;
}

/**
 * Broadcasts a new message to all participants of a conversation
 */
export async function broadcastNewMessage(message) {
  if (!ioInstance) return;

  const convId = message.conversationId;

  // Emit to active conversation room
  ioInstance.to(`conv_${convId}`).emit('chat:receive_message', message);

  // Also emit notification to individual participant rooms for unread badge updates and instant message delivery
  try {
    const [participants] = await pool.query(
      'SELECT userId FROM chat_participants WHERE conversationId = ?',
      [convId]
    );

    participants.forEach((p) => {
      ioInstance.to(`user_${p.userId}`).emit('chat:receive_message', message);
      ioInstance.to(`user_${p.userId}`).emit('chat:conversation_updated', {
        conversationId: convId,
        lastMessage: message,
      });
    });
  } catch (err) {
    console.error('Error broadcasting to participants:', err);
  }
}
