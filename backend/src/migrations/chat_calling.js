import { pool } from '../db.js';

async function migrate() {
  console.log('Running Chat & WebRTC Calling database migration...');

  // 1. chat_conversations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('direct', 'group') NOT NULL DEFAULT 'direct',
      name VARCHAR(255) NULL,
      avatar VARCHAR(255) NULL,
      description VARCHAR(500) NULL,
      createdBy INT NOT NULL,
      tenantId INT DEFAULT 1,
      lastMessageId BIGINT NULL,
      lastMessageText TEXT NULL,
      lastMessageAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_conv_tenant (tenantId),
      INDEX idx_conv_last_msg (lastMessageAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created chat_conversations table');

  // 2. chat_participants
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_participants (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      conversationId BIGINT NOT NULL,
      userId INT NOT NULL,
      role ENUM('member', 'admin') DEFAULT 'member',
      joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      lastReadMessageId BIGINT NULL,
      lastReadAt TIMESTAMP NULL,
      isMuted BOOLEAN DEFAULT FALSE,
      isArchived BOOLEAN DEFAULT FALSE,
      isPinned BOOLEAN DEFAULT FALSE,
      UNIQUE KEY unique_conv_user (conversationId, userId),
      INDEX idx_part_user (userId),
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created chat_participants table');

  // 3. chat_messages
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      conversationId BIGINT NOT NULL,
      senderId INT NOT NULL,
      messageType ENUM('text', 'image', 'video', 'document', 'audio', 'voice', 'system', 'call') DEFAULT 'text',
      content TEXT NULL,
      replyToId BIGINT NULL,
      isEdited BOOLEAN DEFAULT FALSE,
      isDeleted BOOLEAN DEFAULT FALSE,
      deletedForEveryone BOOLEAN DEFAULT FALSE,
      status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_msg_conv (conversationId, created_at),
      INDEX idx_msg_sender (senderId),
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created chat_messages table');

  // 4. chat_attachments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_attachments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      messageId BIGINT NOT NULL,
      fileName VARCHAR(255) NOT NULL,
      fileUrl VARCHAR(500) NOT NULL,
      fileType VARCHAR(100) NOT NULL,
      fileSize BIGINT NOT NULL,
      duration INT NULL,
      thumbnailUrl VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_att_msg (messageId),
      FOREIGN KEY (messageId) REFERENCES chat_messages(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created chat_attachments table');

  // 5. chat_reactions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_reactions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      messageId BIGINT NOT NULL,
      userId INT NOT NULL,
      emoji VARCHAR(32) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_msg_user_emoji (messageId, userId, emoji),
      INDEX idx_react_msg (messageId),
      FOREIGN KEY (messageId) REFERENCES chat_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created chat_reactions table');

  // 6. chat_calls
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_calls (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      conversationId BIGINT NULL,
      callerId INT NOT NULL,
      receiverId INT NOT NULL,
      callType ENUM('audio', 'video') NOT NULL DEFAULT 'audio',
      status ENUM('initiated', 'ringing', 'answered', 'rejected', 'missed', 'ended', 'busy') DEFAULT 'initiated',
      startedAt TIMESTAMP NULL,
      endedAt TIMESTAMP NULL,
      duration INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_call_caller (callerId),
      INDEX idx_call_receiver (receiverId),
      INDEX idx_call_status (status),
      FOREIGN KEY (callerId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created chat_calls table');

  // 7. chat_user_presence
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_user_presence (
      userId INT PRIMARY KEY,
      isOnline BOOLEAN DEFAULT FALSE,
      lastSeen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      socketId VARCHAR(100) NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created chat_user_presence table');

  console.log('\n🎉 Chat & WebRTC Calling database tables successfully created!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Chat migration error:', err);
  process.exit(1);
});
