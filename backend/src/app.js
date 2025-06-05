const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const cacheService = require('./services/cacheService');

// Route files
const chapters = require('./routes/chapters');
const chapter = require('./routes/chapter');

const app = express();


// Initialize cache service
cacheService.initialize();


// Trust proxy (IMPORTANT: Set this early for rate limiting with correct IP)
app.set('trust proxy', 1);


// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Security middleware
app.use(helmet());
app.use(cors());


// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}else {
  app.use(morgan('combined'));
}



// // Rate limiting
const { rateLimit } = require('express-rate-limit')

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 30, // 30 requests per minute
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

// Apply the rate limiting middleware to all requests.

app.use(rateLimit);


// Health check endpoint
app.get('/health', (req, res) => {
    console.log("good health")
  res.status(200).json({
    success: true,
    message: 'Server is running',
    // timestamp: new Date().toISOString(),
  });
});

// Mount routers
app.use('/api/v1/chapters', chapters);     // Handles: GET /chapters, POST /chapters/upload
app.use('/api/v1/chapter', chapter);      // Handles: GET /chapter/:id (reuses same router)

// Auth routes for admin login (basic implementation)
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

      if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }
    console.log("Login request received");

    // Simple admin check (in production, use proper user model)
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        // In a real app, create a proper user and use JWT
        console.log("Admin credentials match");

      const User = require('./models/User');
      
      let adminUser = await User.findOne({ email: process.env.ADMIN_EMAIL });
      console.log("Admin user lookup complete:", adminUser);

        if (!adminUser) {
            console.log("Creating new admin user...");

        adminUser = await User.create({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
          role: 'admin',
        });
        console.log("Admin user created");
   
      }

      const token = adminUser.getSignedJwtToken();
      console.log("Token generated");

      res.status(200).json({
        success: true,
        token,
        user: {
          id: adminUser._id,
          email: adminUser.email,
          role: adminUser.role,
        },
      });
    } else {
        console.log("Invalid credentials");

      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// 404 handler
app.all('/{*any}', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;
