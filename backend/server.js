const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config();

const app = require('./src/app');
const connectDB = require('./src/config/database');
const { connectRedis, disconnectRedis } = require('./src/config/redis'); // v2: Added disconnectRedis import

// v2: Initialize services in proper order
const initializeServices = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    console.log('Connecting to Redis...');
    await connectRedis();
    console.log('Redis connection initiated');
    
    return true;
  } catch (error) {
    console.error('Service initialization error:', error);
    throw error;
  }
};

const PORT = process.env.PORT || 5000;
let server;

// v2: Start server after services are initialized
const startServer = async () => {
  try {
    // Initialize all services first
    await initializeServices();
    
    // Start the server
    server = app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log('All services initialized successfully');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// v2: Start the application
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Unhandled Rejection Error: ${err.message}`);
  console.log('Shutting down the server due to unhandled promise rejection');
  
  // v2: Enhanced shutdown with Redis cleanup
  const gracefulShutdown = async () => {
    try {
      if (server) {
        server.close(async () => {
          console.log('HTTP server closed');
          await disconnectRedis();
          process.exit(1);
        });
      } else {
        await disconnectRedis();
        process.exit(1);
      }
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
      process.exit(1);
    }
  };
  
  gracefulShutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Uncaught Exception Error: ${err.message}`);
  console.log('Shutting down the server due to uncaught exception');
  
  // v2: Enhanced shutdown with Redis cleanup
  const gracefulShutdown = async () => {
    try {
      await disconnectRedis();
      process.exit(1);
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
      process.exit(1);
    }
  };
  
  gracefulShutdown();
});

// v2: Enhanced graceful shutdown for SIGTERM
process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  console.log('Shutting down gracefully');
  
  try {
    if (server) {
      server.close(async () => {
        console.log('HTTP server closed');
        await disconnectRedis();
        console.log('Redis disconnected');
        console.log('Process terminated gracefully');
        process.exit(0);
      });
    } else {
      await disconnectRedis();
      console.log('Process terminated gracefully');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// v2: Add SIGINT handler for Ctrl+C
process.on('SIGINT', async () => {
  console.log('SIGINT received (Ctrl+C)');
  console.log('Shutting down gracefully');
  
  try {
    if (server) {
      server.close(async () => {
        console.log('HTTP server closed');
        await disconnectRedis();
        console.log('Redis disconnected');
        console.log('Process terminated gracefully');
        process.exit(0);
      });
    } else {
      await disconnectRedis();
      console.log('Process terminated gracefully');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// v2: Add process exit handler as final cleanup
process.on('exit', (code) => {
  console.log(`Process exiting with code: ${code}`);
});

// v2: Export server for testing purposes (optional)
module.exports = server;