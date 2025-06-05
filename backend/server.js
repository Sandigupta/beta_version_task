const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config();

const app = require('./src/app');
const connectDB = require('./src/config/database');
const { connectRedis, disconnectRedis } = require('./src/config/redis');

// Global flags to prevent multiple initializations
let isInitializing = false;
let isInitialized = false;
let server;

// Initialize services in proper order
const initializeServices = async () => {
  // Prevent multiple simultaneous initializations
  if (isInitializing || isInitialized) {
    console.log('Services already initialized or initializing...');
    return true;
  }
  
  isInitializing = true;
  
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    console.log('Connecting to Redis...');
    await connectRedis();
    console.log('Redis connected successfully');
    
    isInitialized = true;
    isInitializing = false;
    return true;
  } catch (error) {
    console.error('Service initialization error:', error);
    isInitializing = false;
    throw error;
  }
};

const PORT = process.env.PORT || 5000;

// Start server after services are initialized
const startServer = async () => {
  try {
    // Check if server is already running
    if (server && server.listening) {
      console.log('Server is already running');
      return;
    }

    // Initialize all services first
    await initializeServices();
    
    // Start the server
    server = app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log('All services initialized successfully');
    });

    // Add error handler for server
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown function
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received`);
  console.log('Shutting down gracefully...');
  
  try {
    if (server && server.listening) {
      await new Promise((resolve) => {
        server.close((err) => {
          if (err) {
            console.error('Error closing HTTP server:', err);
          } else {
            console.log('HTTP server closed');
          }
          resolve();
        });
      });
    }

    // Disconnect Redis
    await disconnectRedis();
    console.log('Redis disconnected');
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Unhandled Rejection Error: ${err.message}`);
  console.log('Shutting down the server due to unhandled promise rejection');
  gracefulShutdown('unhandledRejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Uncaught Exception Error: ${err.message}`);
  console.log('Shutting down the server due to uncaught exception');
  gracefulShutdown('uncaughtException');
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

// Process exit handler
process.on('exit', (code) => {
  console.log(`Process exiting with code: ${code}`);
});

// Export server for testing purposes (optional)
module.exports = server;