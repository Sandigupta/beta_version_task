const Redis = require('ioredis');
const dotenv = require('dotenv');
dotenv.config();

let redisClient = null;
let isConnecting = false;

const connectRedis = async () => {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    console.log('Redis connection already in progress...');
    return redisClient;
  }
  
  if (redisClient && redisClient.status === 'ready') {
    console.log('Redis already connected');
    return redisClient;
  }

  try {
    isConnecting = true;
    
    // Enhanced configuration options
    const redisConfig = {
      // Parse from environment or use default options
      ...(process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {
        host: process.env.REDIS_URL || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
      }),
      
      // Connection options
      connectTimeout: 10000,
      lazyConnect: true,
      
      // Retry strategy
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      
      // Keep alive
      keepAlive: 30000,
      
      // Family preference (IPv4)
      family: 4,
    };

    redisClient = new Redis(redisConfig);

    // Event handlers
    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('Redis is ready to receive commands');
      isConnecting = false;
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err.message);
      isConnecting = false;
    });

    redisClient.on('close', () => {
      console.log('Redis connection closed');
    });

    redisClient.on('reconnecting', (ms) => {
      console.log(`Redis reconnecting in ${ms}ms...`);
    });

    redisClient.on('end', () => {
      console.log('Redis connection ended');
      redisClient = null;
    });

    // Explicitly connect (since we're using lazyConnect)
    await redisClient.connect();
    
    // Test the connection
    const pong = await redisClient.ping();
    console.log('Redis ping response:', pong);

    return redisClient;
  } catch (error) {
    console.error('Redis connection error:', error.message);
    isConnecting = false;
    redisClient = null;
    throw error; // Re-throw to let caller handle
  }
};

const getRedisClient = () => {
  if (!redisClient || redisClient.status !== 'ready') {
    console.warn('Redis client not ready. Current status:', redisClient?.status || 'null');
    return null;
  }
  return redisClient;
};

const isRedisConnected = () => {
  return redisClient && redisClient.status === 'ready';
};

const disconnectRedis = async () => {
  if (redisClient) {
    try {
      console.log('Disconnecting from Redis...');
      await redisClient.quit();
      console.log('Redis disconnected gracefully');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error.message);
      // Force disconnect if graceful quit fails
      redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
};

// Utility function for Redis operations with error handling
const safeRedisOperation = async (operation, ...args) => {
  const client = getRedisClient();
  if (!client) {
    throw new Error('Redis client not available');
  }
  
  try {
    return await client[operation](...args);
  } catch (error) {
    console.error(`Redis ${operation} operation failed:`, error.message);
    throw error;
  }
};

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('Shutting down Redis connection...');
  await disconnectRedis();
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGQUIT', gracefulShutdown);

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
  isRedisConnected,
  safeRedisOperation
};



// const Redis = require('ioredis');
// const dotenv = require('dotenv');
// dotenv.config();
// let redisClient = null;

// const connectRedis = async () => {
//   try {
//     redisClient = new Redis(process.env.REDIS_URL); // Automatically parses URL

//     redisClient.on('connect', () => {
//       console.log('Redis connected successfully');
//     });

//     redisClient.on('error', (err) => {
//       console.error('Redis Client Error:', err);
//     });

//     redisClient.on('close', () => {
//       console.log('Redis connection closed');
//     });

//     redisClient.on('reconnecting', () => {
//       console.log('Redis reconnecting...');
//     });

//     // Test the connection
//     await redisClient.ping();

//     return redisClient;
//   } catch (error) {
//     console.error('Redis connection error:', error.message);
//     return null;
//   }
// };

// const getRedisClient = () => redisClient;

// const disconnectRedis = async () => {
//   if (redisClient) {
//     try {
//       await redisClient.quit();
//       console.log('Redis disconnected gracefully');
//     } catch (error) {
//       console.error('Error disconnecting from Redis:', error);
//     }
//   }
// };

// module.exports = {
//   connectRedis,
//   getRedisClient,
//   disconnectRedis
// };


