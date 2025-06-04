// middleware/rateLimit.js (Fixed version)
const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../config/redis');

// Redis store for rate limiting
class RedisStore {
  constructor() {
    this.prefix = 'rl:';
  }

  getClient() {
    return getRedisClient();
  }

  async incr(key) {
    const client = this.getClient();
    if (!client || !client.isOpen) {
      // Fallback to memory-based limiting if Redis is not available
      throw new Error('Redis not available');
    }

    const redisKey = this.prefix + key;
    try {
      const current = await client.incr(redisKey);
      if (current === 1) {
        await client.expire(redisKey, 60); // 1 minute TTL
      }
      return { totalHits: current, resetTime: new Date(Date.now() + 60000) };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      throw error;
    }
  }

  async decrement(key) {
    const client = this.getClient();
    if (!client || !client.isOpen) return;

    const redisKey = this.prefix + key;
    try {
      const current = await client.decr(redisKey);
      // Don't let it go below 0
      if (current < 0) {
        await client.set(redisKey, 0);
      }
    } catch (error) {
      console.error('Redis decrement error:', error);
    }
  }

  async resetKey(key) {
    const client = this.getClient();
    if (!client || !client.isOpen) return;

    const redisKey = this.prefix + key;
    try {
      await client.del(redisKey);
    } catch (error) {
      console.error('Redis reset error:', error);
    }
  }
}

// Create different rate limiters for different routes
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 30, // 30 requests per minute
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  const store = new RedisStore();

  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message: typeof message === 'string' ? message : message.message || 'Rate limit exceeded',
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator: (req) => {
      // Use IP address as the key, but you could also use user ID if authenticated
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
    store: {
      incr: async (key) => {
        try {
          const result = await store.incr(key);
          return result;
        } catch (error) {
          // Fallback to default memory store behavior
          console.warn('Falling back to memory store for rate limiting');
          return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
        }
      },
      decrement: (key) => store.decrement(key),
      resetKey: (key) => store.resetKey(key),
    },
    handler: (req, res) => {
      console.log(`Rate limit exceeded for IP: ${req.ip} on ${req.method} ${req.path}`);
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: typeof message === 'string' ? message : message.message || 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
    onLimitReached: (req, res) => {
      console.log(`Rate limit reached for IP: ${req.ip} on ${req.method} ${req.path}`);
    },
  });
};

// Export different rate limiters for different use cases
const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many requests from this IP, please try again later.',
});

const strictLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests to this endpoint, please try again later.',
});

const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 uploads per minute
  message: 'Too many upload attempts, please try again later.',
  skipSuccessfulRequests: false,
  skipFailedRequests: true, // Don't count failed uploads
});

module.exports = {
  createRateLimiter,
  generalLimiter,
  strictLimiter,
  uploadLimiter,
};


// const rateLimit = require('express-rate-limit');
// const { getRedisClient } = require('../config/redis');

// // Redis store for rate limiting
// class RedisStore {
//   constructor() {
//     // v2
//     // this.client = getRedisClient();
//     this.prefix = 'rl:';
//   }

//   // v2
//   getClient() {
//     return getRedisClient();
//   }

//   async incr(key) {
//     const client = this.client;
//     if (!client || !client.isOpen) {
//       // Fallback to memory-based limiting if Redis is not available
//       throw new Error('Redis not available');
//     }

//     const redisKey = this.prefix + key;
//     try {
//       const current = await client.incr(redisKey);
//       if (current === 1) {
//         await client.expire(redisKey, 60); // 1 minute TTL
//       }
//       return { totalHits: current, resetTime: new Date(Date.now() + 60000) };
//     } catch (error) {
//       console.error('Redis rate limit error:', error);
//       throw error;
//     }
//   }

//   async decrement(key) {
//     const client = this.client;
//     if (!client || !client.isOpen) return;

//     const redisKey = this.prefix + key;
//     try {
      
//       // await client.decr(redisKey);

//       // v2
//       const current = await client.decr(redisKey);
//       // Don't let it go below 0
//       if (current < 0) {
//         await client.set(redisKey, 0);
//       }
//     } catch (error) {
//       console.error('Redis decrement error:', error);
//     }
//   }

//   async resetKey(key) {
//     const client = this.client;
//     if (!client || !client.isOpen) return;

//     const redisKey = this.prefix + key;
//     try {
//       await client.del(redisKey);
//     } catch (error) {
//       console.error('Redis reset error:', error);
//     }
//   }
// }

// // Create rate limiter
// const createRateLimiter = () => {
//   const store = new RedisStore();

//   return rateLimit({
//     windowMs: 60 * 1000, // 1 minute
//     max: 30, // 30 requests per minute
//       message: {
//           error: 'Too many requests',
//           message: 'Rate limit exceeded. Maximum 30 requests per minute allowed.',
//           retryAfter: 60,
//       },
//     standardHeaders: true,
//     legacyHeaders: false,
//     keyGenerator: (req) => {
//       return req.ip;
//     },
//     store: {
//       incr: async (key) => {
//         try {
//           return await store.incr(key);
//         } catch (error) {
//           // Fallback to default memory store behavior
//           return { totalHits: 1 };
//         }
//       },
//       decrement: (key) => store.decrement(key),
//       resetKey: (key) => store.resetKey(key),
//       },
    
//     // //// error : Update your rateLimiter.js file to replace onLimitReached with handler. For example:
//     handler: (req, res) => {
//         console.log(`Rate limit exceeded for IP: ${req.ip}`);
//         res.status(429).json({
//           error: 'Too many requests',
//           message: 'Rate limit exceeded. Please try again later.',
//         });
//       },
      
//   });
// };

// module.exports = createRateLimiter;