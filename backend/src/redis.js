import Redis from 'ioredis';

class PresenceStore {
  constructor() {
    this.memoryStore = new Map(); // fallback memory store
    this.redisClient = null;
    this.isRedisConnected = false;

    this.init();
  }

  init() {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
    if (redisUrl || process.env.ENABLE_REDIS === 'true') {
      try {
        this.redisClient = new Redis(redisUrl || 'redis://127.0.0.1:6379', {
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => (times > 3 ? null : 1000),
          lazyConnect: true,
        });

        this.redisClient.connect()
          .then(() => {
            this.isRedisConnected = true;
            console.log('✓ Connected to Redis for presence & real-time state');
          })
          .catch(() => {
            this.isRedisConnected = false;
            console.log('ℹ Redis unavailable, utilizing high-performance in-memory presence store');
          });

        this.redisClient.on('error', () => {
          this.isRedisConnected = false;
        });
      } catch {
        this.isRedisConnected = false;
      }
    } else {
      console.log('ℹ Running with built-in in-memory presence & typing state store');
    }
  }

  async setUserOnline(userId, socketId) {
    if (this.isRedisConnected && this.redisClient) {
      await this.redisClient.hset('presence:online', userId, socketId);
      await this.redisClient.hset('presence:lastseen', userId, new Date().toISOString());
    }
    this.memoryStore.set(`user:${userId}`, { socketId, isOnline: true, lastSeen: new Date().toISOString() });
  }

  async setUserOffline(userId) {
    if (this.isRedisConnected && this.redisClient) {
      await this.redisClient.hdel('presence:online', userId);
      await this.redisClient.hset('presence:lastseen', userId, new Date().toISOString());
    }
    const current = this.memoryStore.get(`user:${userId}`) || {};
    this.memoryStore.set(`user:${userId}`, { ...current, isOnline: false, lastSeen: new Date().toISOString() });
  }

  async isUserOnline(userId) {
    if (this.isRedisConnected && this.redisClient) {
      const socketId = await this.redisClient.hget('presence:online', userId);
      return !!socketId;
    }
    return Boolean(this.memoryStore.get(`user:${userId}`)?.isOnline);
  }

  async getUserPresence(userId) {
    if (this.isRedisConnected && this.redisClient) {
      const socketId = await this.redisClient.hget('presence:online', userId);
      const lastSeen = await this.redisClient.hget('presence:lastseen', userId);
      return { isOnline: !!socketId, lastSeen: lastSeen || new Date().toISOString() };
    }
    const data = this.memoryStore.get(`user:${userId}`);
    return {
      isOnline: Boolean(data?.isOnline),
      lastSeen: data?.lastSeen || new Date().toISOString(),
    };
  }

  async getAllOnlineUsers() {
    if (this.isRedisConnected && this.redisClient) {
      const all = await this.redisClient.hgetall('presence:online');
      return Object.keys(all).map(Number);
    }
    const online = [];
    for (const [key, val] of this.memoryStore.entries()) {
      if (val.isOnline && key.startsWith('user:')) {
        online.push(Number(key.replace('user:', '')));
      }
    }
    return online;
  }
}

export const presenceStore = new PresenceStore();
