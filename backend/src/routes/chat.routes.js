import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';
import { asyncHandler, toIso } from '../helpers.js';
import { presenceStore } from '../redis.js';
import { broadcastNewMessage, getIO } from '../socket.js';
import { logAudit } from '../audit.js';

const router = express.Router();
router.use(authMiddleware);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/chat');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
});

// GET /api/chat/users - Available staff directory for starting chats
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const currentUserId = req.user.userId;
    const [rows] = await pool.query(
      `SELECT u.id as userId, u.name, u.email, u.employeeId, u.designation, u.department, u.roleId,
              p.isOnline, p.lastSeen
       FROM users u
       LEFT JOIN chat_user_presence p ON p.userId = u.id
       WHERE u.id != ?
       ORDER BY u.name ASC`,
      [currentUserId]
    );

    const onlineUsers = await presenceStore.getAllOnlineUsers();

    res.json(
      rows.map((u) => ({
        ...u,
        isOnline: onlineUsers.includes(u.userId) || Boolean(u.isOnline),
        lastSeen: u.lastSeen ? toIso(u.lastSeen) : null,
      }))
    );
  })
);

// GET /api/chat/conversations - List user's conversations
router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const [convRows] = await pool.query(
      `SELECT c.id, c.type, c.name, c.avatar, c.description, c.lastMessageId, c.lastMessageText,
              c.lastMessageAt, cp.isMuted, cp.isPinned, cp.isArchived, cp.lastReadMessageId,
              (SELECT COUNT(*) FROM chat_messages m
               WHERE m.conversationId = c.id
                 AND m.id > COALESCE(cp.lastReadMessageId, 0)
                 AND m.senderId != ?) as unreadCount
       FROM chat_conversations c
       JOIN chat_participants cp ON cp.conversationId = c.id AND cp.userId = ?
       ORDER BY cp.isPinned DESC, c.lastMessageAt DESC`,
      [userId, userId]
    );

    const conversations = [];

    for (const c of convRows) {
      // Fetch participants for this conversation
      const [participants] = await pool.query(
        `SELECT u.id as userId, u.name, u.email, u.employeeId, u.designation, u.department,
                cp.role, p.isOnline, p.lastSeen
         FROM chat_participants cp
         JOIN users u ON u.id = cp.userId
         LEFT JOIN chat_user_presence p ON p.userId = u.id
         WHERE cp.conversationId = ?`,
        [c.id]
      );

      let displayName = c.name;
      let displayAvatar = c.avatar;
      let otherUser = null;

      if (c.type === 'direct') {
        otherUser = participants.find((p) => p.userId !== userId) || participants[0];
        if (otherUser) {
          displayName = otherUser.name;
          const isOnline = await presenceStore.isUserOnline(otherUser.userId);
          otherUser.isOnline = isOnline || Boolean(otherUser.isOnline);
        }
      }

      conversations.push({
        id: c.id,
        type: c.type,
        name: displayName || 'Chat',
        avatar: displayAvatar,
        description: c.description,
        lastMessageText: c.lastMessageText,
        lastMessageAt: toIso(c.lastMessageAt),
        unreadCount: Number(c.unreadCount) || 0,
        isMuted: Boolean(c.isMuted),
        isPinned: Boolean(c.isPinned),
        isArchived: Boolean(c.isArchived),
        participants,
        partner: otherUser,
      });
    }

    res.json(conversations);
  })
);

// POST /api/chat/conversations/direct - Get or Create 1-to-1 conversation
router.post(
  '/conversations/direct',
  asyncHandler(async (req, res) => {
    const currentUserId = req.user.userId;
    const { targetUserId } = req.body;

    if (!targetUserId || Number(targetUserId) === currentUserId) {
      return res.status(400).json({ success: false, message: 'Valid targetUserId is required' });
    }

    const tUserId = Number(targetUserId);

    // Check if 1-to-1 conversation already exists
    const [existing] = await pool.query(
      `SELECT c.id
       FROM chat_conversations c
       JOIN chat_participants p1 ON p1.conversationId = c.id AND p1.userId = ?
       JOIN chat_participants p2 ON p2.conversationId = c.id AND p2.userId = ?
       WHERE c.type = 'direct'
       LIMIT 1`,
      [currentUserId, tUserId]
    );

    if (existing.length > 0) {
      return res.json({ success: true, conversationId: existing[0].id, isNew: false });
    }

    // Create new direct conversation
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [convResult] = await conn.query(
        `INSERT INTO chat_conversations (type, createdBy, tenantId) VALUES ('direct', ?, 1)`,
        [currentUserId]
      );
      const conversationId = convResult.insertId;

      await conn.query(
        `INSERT INTO chat_participants (conversationId, userId, role) VALUES (?, ?, 'member'), (?, ?, 'member')`,
        [conversationId, currentUserId, conversationId, tUserId]
      );

      await conn.commit();
      res.json({ success: true, conversationId, isNew: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// POST /api/chat/conversations/group - Create new Group Conversation
router.post(
  '/conversations/group',
  asyncHandler(async (req, res) => {
    const currentUserId = req.user.userId;
    const { name, description = '', memberIds = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    const members = Array.from(new Set([currentUserId, ...(memberIds || []).map(Number)]));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [convResult] = await conn.query(
        `INSERT INTO chat_conversations (type, name, description, createdBy, tenantId) VALUES ('group', ?, ?, ?, 1)`,
        [name.trim(), description, currentUserId]
      );
      const conversationId = convResult.insertId;

      for (const mId of members) {
        const role = mId === currentUserId ? 'admin' : 'member';
        await conn.query(
          `INSERT INTO chat_participants (conversationId, userId, role) VALUES (?, ?, ?)`,
          [conversationId, mId, role]
        );
      }

      // Add system message
      await conn.query(
        `INSERT INTO chat_messages (conversationId, senderId, messageType, content)
         VALUES (?, ?, 'system', ?)`,
        [conversationId, currentUserId, `${req.user.name} created group "${name.trim()}"`]
      );

      await conn.commit();

      logAudit(req, {
        action: 'CHAT_GROUP_CREATED',
        entityType: 'CHAT',
        entityId: conversationId,
        description: `Created new group chat "${name.trim()}" with ${members.length} members`,
      });

      res.status(201).json({ success: true, conversationId, name: name.trim() });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// GET /api/chat/conversations/:id/messages - Paginated Messages
router.get(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const conversationId = Number(req.params.id);
    const { limit = 50, beforeMessageId } = req.query;

    let sql = `SELECT m.id, m.conversationId, m.senderId, u.name as senderName, u.email as senderEmail,
                      m.messageType, m.content, m.replyToId, m.isEdited, m.isDeleted, m.status,
                      m.created_at, rm.content as replyContent, ru.name as replySenderName
               FROM chat_messages m
               JOIN users u ON u.id = m.senderId
               LEFT JOIN chat_messages rm ON rm.id = m.replyToId
               LEFT JOIN users ru ON ru.id = rm.senderId
               WHERE m.conversationId = ?`;
    const params = [conversationId];

    if (beforeMessageId) {
      sql += ' AND m.id < ?';
      params.push(Number(beforeMessageId));
    }

    sql += ' ORDER BY m.id DESC LIMIT ?';
    params.push(Number(limit) || 50);

    const [rows] = await pool.query(sql, params);

    const messageIds = rows.map((r) => r.id);
    let attachmentsByMsg = {};
    let reactionsByMsg = {};

    if (messageIds.length > 0) {
      // Attachments
      const [attRows] = await pool.query(
        `SELECT id, messageId, fileName, fileUrl, fileType, fileSize, duration, thumbnailUrl
         FROM chat_attachments
         WHERE messageId IN (?)`,
        [messageIds]
      );
      attRows.forEach((a) => {
        if (!attachmentsByMsg[a.messageId]) attachmentsByMsg[a.messageId] = [];
        attachmentsByMsg[a.messageId].push(a);
      });

      // Reactions
      const [reactRows] = await pool.query(
        `SELECT r.id, r.messageId, r.userId, u.name as userName, r.emoji
         FROM chat_reactions r
         JOIN users u ON u.id = r.userId
         WHERE r.messageId IN (?)`,
        [messageIds]
      );
      reactRows.forEach((r) => {
        if (!reactionsByMsg[r.messageId]) reactionsByMsg[r.messageId] = [];
        reactionsByMsg[r.messageId].push({
          id: r.id,
          userId: r.userId,
          userName: r.userName,
          emoji: r.emoji,
        });
      });
    }

    const messages = rows.reverse().map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      senderId: r.senderId,
      senderName: r.senderName,
      senderEmail: r.senderEmail,
      messageType: r.messageType,
      content: r.isDeleted ? 'This message was deleted' : r.content,
      replyToId: r.replyToId,
      replyContent: r.replyContent,
      replySenderName: r.replySenderName,
      isEdited: Boolean(r.isEdited),
      isDeleted: Boolean(r.isDeleted),
      status: r.status,
      created_at: toIso(r.created_at),
      attachments: attachmentsByMsg[r.id] || [],
      reactions: reactionsByMsg[r.id] || [],
    }));

    res.json(messages);
  })
);

// POST /api/chat/conversations/:id/messages - Send Message
router.post(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const conversationId = Number(req.params.id);
    const senderId = req.user.userId;
    const { content, messageType = 'text', replyToId = null, attachments = [] } = req.body;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Message content or attachment is required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [msgResult] = await conn.query(
        `INSERT INTO chat_messages (conversationId, senderId, messageType, content, replyToId, status)
         VALUES (?, ?, ?, ?, ?, 'sent')`,
        [conversationId, senderId, messageType, content || '', replyToId || null]
      );

      const messageId = msgResult.insertId;

      // Insert Attachments if present
      const savedAttachments = [];
      for (const a of attachments || []) {
        const [attResult] = await conn.query(
          `INSERT INTO chat_attachments (messageId, fileName, fileUrl, fileType, fileSize, duration)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [messageId, a.fileName, a.fileUrl, a.fileType || 'file', a.fileSize || 0, a.duration || null]
        );
        savedAttachments.push({
          id: attResult.insertId,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          fileSize: a.fileSize,
          duration: a.duration,
        });
      }

      // Update Conversation last message snippet
      const lastText = messageType === 'image' ? '📷 Photo' : (messageType === 'voice' ? '🎤 Voice Message' : (content || 'Attachment'));
      await conn.query(
        `UPDATE chat_conversations SET lastMessageId = ?, lastMessageText = ?, lastMessageAt = NOW() WHERE id = ?`,
        [messageId, lastText, conversationId]
      );

      await conn.commit();

      // Formulate full message payload for broadcast
      const messagePayload = {
        id: messageId,
        conversationId,
        senderId,
        senderName: req.user.name,
        senderEmail: req.user.email,
        messageType,
        content: content || '',
        replyToId: replyToId || null,
        status: 'sent',
        isEdited: false,
        isDeleted: false,
        created_at: new Date().toISOString(),
        attachments: savedAttachments,
        reactions: [],
      };

      // Broadcast via Socket.IO
      broadcastNewMessage(messagePayload);

      res.status(201).json(messagePayload);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// PUT /api/chat/messages/:id - Edit Message
router.put(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    const messageId = Number(req.params.id);
    const userId = req.user.userId;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const [rows] = await pool.query('SELECT senderId, conversationId FROM chat_messages WHERE id = ?', [messageId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    if (rows[0].senderId !== userId) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }

    await pool.query(
      'UPDATE chat_messages SET content = ?, isEdited = TRUE WHERE id = ?',
      [content.trim(), messageId]
    );

    const io = getIO();
    if (io) {
      io.to(`conv_${rows[0].conversationId}`).emit('chat:message_edited', {
        messageId,
        conversationId: rows[0].conversationId,
        content: content.trim(),
        isEdited: true,
      });
    }

    res.json({ success: true, message: 'Message edited successfully', content: content.trim() });
  })
);

// DELETE /api/chat/messages/:id - Delete Message
router.delete(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    const messageId = Number(req.params.id);
    const userId = req.user.userId;

    const [rows] = await pool.query('SELECT senderId, conversationId FROM chat_messages WHERE id = ?', [messageId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    if (rows[0].senderId !== userId && req.user.roleId > 2) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await pool.query(
      `UPDATE chat_messages SET isDeleted = TRUE, content = 'This message was deleted' WHERE id = ?`,
      [messageId]
    );

    const io = getIO();
    if (io) {
      io.to(`conv_${rows[0].conversationId}`).emit('chat:message_deleted', {
        messageId,
        conversationId: rows[0].conversationId,
      });
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  })
);

// POST /api/chat/messages/:id/react - Toggle Emoji Reaction
router.post(
  '/messages/:id/react',
  asyncHandler(async (req, res) => {
    const messageId = Number(req.params.id);
    const userId = req.user.userId;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ success: false, message: 'Emoji is required' });
    }

    const [msgRows] = await pool.query('SELECT conversationId FROM chat_messages WHERE id = ?', [messageId]);
    if (msgRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    const convId = msgRows[0].conversationId;

    const [existing] = await pool.query(
      'SELECT id FROM chat_reactions WHERE messageId = ? AND userId = ? AND emoji = ?',
      [messageId, userId, emoji]
    );

    if (existing.length > 0) {
      // Remove reaction
      await pool.query('DELETE FROM chat_reactions WHERE id = ?', [existing[0].id]);
    } else {
      // Add reaction
      await pool.query(
        'INSERT INTO chat_reactions (messageId, userId, emoji) VALUES (?, ?, ?)',
        [messageId, userId, emoji]
      );
    }

    const [allReactions] = await pool.query(
      `SELECT r.id, r.userId, u.name as userName, r.emoji
       FROM chat_reactions r
       JOIN users u ON u.id = r.userId
       WHERE r.messageId = ?`,
      [messageId]
    );

    const io = getIO();
    if (io) {
      io.to(`conv_${convId}`).emit('chat:reactions_updated', {
        messageId,
        conversationId: convId,
        reactions: allReactions,
      });
    }

    res.json({ success: true, reactions: allReactions });
  })
);

// POST /api/chat/upload - Upload file attachments / media
router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('video/')
      ? 'video'
      : req.file.mimetype.startsWith('audio/')
      ? 'voice'
      : 'document';

    res.json({
      success: true,
      fileUrl,
      fileName: req.file.originalname,
      fileType,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  })
);

// GET /api/chat/calls/history - Call history log
router.get(
  '/calls/history',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const [rows] = await pool.query(
      `SELECT c.id, c.callerId, c.receiverId, c.callType, c.status, c.startedAt, c.endedAt, c.duration,
              c.created_at, u1.name as callerName, u1.employeeId as callerEmpId,
              u2.name as receiverName, u2.employeeId as receiverEmpId
       FROM chat_calls c
       JOIN users u1 ON u1.id = c.callerId
       JOIN users u2 ON u2.id = c.receiverId
       WHERE c.callerId = ? OR c.receiverId = ?
       ORDER BY c.created_at DESC LIMIT 50`,
      [userId, userId]
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        callType: r.callType,
        status: r.status,
        isOutgoing: r.callerId === userId,
        partnerName: r.callerId === userId ? r.receiverName : r.callerName,
        partnerId: r.callerId === userId ? r.receiverId : r.callerId,
        partnerEmpId: r.callerId === userId ? r.receiverEmpId : r.callerEmpId,
        duration: Number(r.duration) || 0,
        startedAt: r.startedAt ? toIso(r.startedAt) : null,
        created_at: toIso(r.created_at),
      }))
    );
  })
);

export default router;
