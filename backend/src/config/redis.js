const redis = require('redis');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('disconnect', () => {
      console.log('Redis disconnected');
    });

    redisClient.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    console.error('Redis connection error:', error.message);
    return null; // Let app continue even if Redis fails
  }
};



// const getRedisClient = () => redisClient;

const getRedisClient = () => redisClient;

// Graceful shutdown
const disconnectRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.disconnect();
      console.log('Redis disconnected gracefully');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis
};
