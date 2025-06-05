const { getRedisClient } = require('../config/redis');

class CacheService {
  constructor() {
    this.client = null;
    this.CACHE_EXPIRY = 3600; // 1 hour in seconds
    this.initialized = false;
  }
  

  async initialize() {
    // v2: Add delay and retry mechanism for initialization
    const attemptInit = async () => {
      this.client = await getRedisClient();
      if (this.client) {
        this.initialized = true;
        console.log('Cache service initialized successfully');
      } else {
        console.warn('Cache service initialization failed - Redis not available');
        // v2: Retry initialization after 3 seconds
        setTimeout(() => {
          if (!this.initialized) {
            console.log('Retrying cache service initialization...');
            attemptInit();
          }
        }, 3000);
      }
    };
    
    await attemptInit(); // Fix: Add await here
  }
  
  isAvailable() {
    // Fix: Remove async/await - make this synchronous
    // Don't call getClient() here as it's async and would complicate this method
    return this.client && this.client.isOpen && this.initialized;
  }
  
  // v2: Add method to get fresh client reference
  async getClient() {
    if (!this.client || !this.client.isOpen) {
      this.client = await getRedisClient();
    }
    return this.client;
  }

 async generateCacheKey(endpoint, query = {}) {
    // const queryString = Object.keys(query)
    //   .sort()
    //   .map(key => `${key}=${query[key]}`)
    //   .join('&');
    
    // return `${endpoint}${queryString ? `?${queryString}` : ''}`;

    // v2: Enhanced key generation with better error handling
    try {
      // Handle empty query object
      if (!query || Object.keys(query).length === 0) {
        return endpoint;
      }

      const queryString = Object.keys(query)
        .sort()
        .filter(key => query[key] !== undefined && query[key] !== null) // Filter out undefined/null values
        .map(key => `${key}=${encodeURIComponent(query[key])}`) // URL encode values
        .join('&');
      
      return `${endpoint}${queryString ? `?${queryString}` : ''}`;
    } catch (error) {
      console.error('Error generating cache key:', error);
      return endpoint; // Fallback to just endpoint
    }
  }

  async get(key) {
    if (!this.isAvailable()) {
      console.warn('Cache not available, falling back to database');
      return null;
    }

    try {
      // v2: Use dynamic client reference
      const client = await this.getClient();
      if (!client) {
        console.warn('Redis client not available for cache get');
        return null;
      }

      // v2: Add timeout for Redis operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis operation timeout')), 5000);
      });

      const getPromise = await client.get(key);
      const data = await Promise.race([getPromise, timeoutPromise]);

      if (data) {
        console.log(`Cache HIT for key: ${key}`);
        return JSON.parse(data);
      }
      console.log(`Cache MISS for key: ${key}`);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, data, expiry = this.CACHE_EXPIRY) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      // v2: Use dynamic client reference
      const client = await this.getClient();
      if (!client) {
        console.warn('Redis client not available for cache set');
        return false;
      }

      // v2: Add timeout for Redis operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis operation timeout')), 5000);
      });

      const setPromise =await client.setEx(key, expiry, JSON.stringify(data));
      await Promise.race([setPromise, timeoutPromise]);

      console.log(`Cache SET for key: ${key} (TTL: ${expiry}s)`);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async delete(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      // v2: Use dynamic client reference with timeout
      const client =await this.getClient();
      if (!client) {
        console.warn('Redis client not available for cache delete');
        return false;
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis operation timeout')), 5000);
      });

      const deletePromise = await client.del(key);
      const result = await Promise.race([deletePromise, timeoutPromise]);

      console.log(`Cache DELETE for key: ${key} (deleted: ${result > 0})`);
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      // v2: Use dynamic client reference with timeout
      const client =await this.getClient();
      if (!client) {
        console.warn('Redis client not available for cache invalidation');
        return false;
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis operation timeout')), 10000); // Longer timeout for pattern operations
      });

      const keysPromise = await client.keys(pattern);
      const keys = await Promise.race([keysPromise, timeoutPromise]);

      if (keys.length > 0) {
        const deletePromise =await client.del(keys);
        await Promise.race([deletePromise, timeoutPromise]);
        console.log(`Cache INVALIDATED pattern: ${pattern} (${keys.length} keys deleted)`);
      } else {
        console.log(`Cache pattern: ${pattern} - no keys found to delete`);
      }
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  async invalidateChapterCache() {
    return await this.invalidatePattern('/api/v1/chapters*');
  }

  // v2: Utility method to clear all cache with timeout
  async clearAll() {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const client =await this.getClient();
      if (!client) {
        console.warn('Redis client not available for cache clear');
        return false;
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis operation timeout')), 10000);
      });

      const flushPromise =await client.flushDb();
      await Promise.race([flushPromise, timeoutPromise]);

      console.log('All cache cleared');
      return true;
    } catch (error) {
      console.error('Cache clear all error:', error);
      return false;
    }
  }

  // v2: Enhanced health check method
  async healthCheck() {
    if (!this.initialized) {
      return { status: 'not_initialized', connected: false };
    }

    const client =await this.getClient();
    if (!client || !client.isOpen) {
      return { status: 'unavailable', connected: false };
    }

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Ping timeout')), 3000);
      });

      const pingPromise = client.ping();
      const pong = await Promise.race([pingPromise, timeoutPromise]);

      return { 
        status: 'healthy', 
        connected: true, 
        response: pong,
        clientOpen: client.isOpen
      };
    } catch (error) {
      return { 
        status: 'error', 
        connected: false, 
        error: error.message 
      };
    }
  }
}

module.exports = new CacheService();






















// const { getRedisClient } = require('../config/redis');


// class CacheService {
//   constructor() {
//     this.client = null;
//     this.CACHE_EXPIRY = 3600; // 1 hour in seconds
//     this.initialized = false;
//   }

//   initialize() {
//     this.client = getRedisClient();
//     this.initialized = true;
//   }

//   isAvailable() {
//     return this.client && this.client.isOpen && this.initialized;
//   }

//   generateCacheKey(endpoint, query = {}) {
//     // const queryString = Object.keys(query)
//     //   .sort()
//     //   .map(key => `${key}=${query[key]}`)
//     //   .join('&');
    
//     // return `${endpoint}${queryString ? `?${queryString}` : ''}`;

//     // v2
//     // Handle empty query object
//     if (!query || Object.keys(query).length === 0) {
//       return endpoint;
//     }

//     const queryString = Object.keys(query)
//       .sort()
//       .filter(key => query[key] !== undefined && query[key] !== null) // Filter out undefined/null values
//       .map(key => `${key}=${encodeURIComponent(query[key])}`) // URL encode values
//       .join('&');
    
//     return `${endpoint}${queryString ? `?${queryString}` : ''}`;
//   }

//   async get(key) {
//     if (!this.isAvailable()) {
//       console.warn('Cache not available, falling back to database');
//       return null;
//     }

//     try {
//     //   const data = await this.client.get(key);
//     //   return data ? JSON.parse(data) : null;
//     // } catch (error) {
//     //   console.error('Cache get error:', error);
//     //   return null;
//       // }
      
//       // v2
//       const data = await this.client.get(key);
//       if (data) {
//         console.log(`Cache HIT for key: ${key}`);
//         return JSON.parse(data);
//       }
//       console.log(`Cache MISS for key: ${key}`);
//       return null;
//     } catch (error) {
//       console.error('Cache get error:', error);
//       return null;
//     }
//   }

//   async set(key, data, expiry = this.CACHE_EXPIRY) {
//     if (!this.isAvailable()) {
//       return false;
//     }

//     try {
//       // await this.client.setEx(key, expiry, JSON.stringify(data));
//       // return true;

//       // v2
//       await this.client.setEx(key, expiry, JSON.stringify(data));
//       console.log(`Cache SET for key: ${key} (TTL: ${expiry}s)`);
//       return true;
//     } catch (error) {
//       console.error('Cache set error:', error);
//       return false;
//     }
//   }

//   async delete(key) {
//     if (!this.isAvailable()) {
//       return false;
//     }

//     try {
//       // await this.client.del(key);
//       // return true;

//       // v2
//       const result = await this.client.del(key);
//       console.log(`Cache DELETE for key: ${key} (deleted: ${result > 0})`);
//       return result > 0;
//     } catch (error) {
//       console.error('Cache delete error:', error);
//       return false;
//     }
//   }

//   async invalidatePattern(pattern) {
//     if (!this.isAvailable()) {
//       return false;
//     }

//     try {
//       // const keys = await this.client.keys(pattern);
//       // if (keys.length > 0) {
//       //   await this.client.del(keys);
//       // }
//       // return true;

//       // v2
//       const keys = await this.client.keys(pattern);
//       if (keys.length > 0) {
//         await this.client.del(keys);
//         console.log(`Cache INVALIDATED pattern: ${pattern} (${keys.length} keys deleted)`);
//       } else {
//         console.log(`Cache pattern: ${pattern} - no keys found to delete`);
//       }
//       return true;
//     } catch (error) {
//       console.error('Cache invalidation error:', error);
//       return false;
//     }
//   }


//   async invalidateChapterCache() {
//     return await this.invalidatePattern('/api/v1/chapters*');
//   }


//   //v2 Utility method to clear all cache
//   async clearAll() {
//     if (!this.isAvailable()) {
//       return false;
//     }

//     try {
//       await this.client.flushDb();
//       console.log('All cache cleared');
//       return true;
//     } catch (error) {
//       console.error('Cache clear all error:', error);
//       return false;
//     }
//   }

//   //v2 Health check method
//   async healthCheck() {
//     if (!this.isAvailable()) {
//       return { status: 'unavailable', connected: false };
//     }

//     try {
//       const pong = await this.client.ping();
//       return { 
//         status: 'healthy', 
//         connected: true, 
//         response: pong 
//       };
//     } catch (error) {
//       return { 
//         status: 'error', 
//         connected: false, 
//         error: error.message 
//       };
//     }
//   }
// }

// module.exports = new CacheService();