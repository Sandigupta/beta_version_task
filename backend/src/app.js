const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
// const mongoSanitize = require('express-mongo-sanitize'); // Temporarily commented out

const { createRateLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const cacheService = require('./services/cacheService');

// Route files
const chapters = require('./routes/chapters');
const chapter = require('./routes/chapter');

const app = express();




// Initialize cache service
cacheService.initialize();

// v2
// Trust proxy (IMPORTANT: Set this early for rate limiting with correct IP)
app.set('trust proxy', 1);


// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Security middleware
app.use(helmet());
app.use(cors());


// v2
// Custom sanitization middleware
const sanitizeInput = (req, res, next) => {
  
  // v3
  const sanitize = (obj) => {
    console.log('Sanitizing:', obj);

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // Perform sanitization logic here
          if (/^\$/.test(key)) {
            delete obj[key]; // Remove keys starting with `$`
          } else if (typeof obj[key] === 'object') {
            sanitize(obj[key]); // Recursively sanitize nested objects
          }
        }
      }
    }
  };
  
  // Sanitize body, params, and query
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  if (req.query) sanitize(req.query);
  
  next();
};

app.use(sanitizeInput); // Use custom sanitization instead of express-mongo-sanitize



// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}else {
  app.use(morgan('combined'));
}



// // Rate limiting
// const rateLimiter = createRateLimiter();
// app.use(rateLimiter);

try {
  const rateLimiter = createRateLimiter();
  app.use(rateLimiter);
  console.log('Rate limiter initialized successfully');
} catch (error) {
  console.error('Failed to initialize rate limiter:', error);
  console.log('Continuing without rate limiting...');
}



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












// Custom sanitization middleware (replaces express-mongo-sanitize)
// const sanitizeInput = (req, res, next) => {
//   const sanitize = (obj) => {
//     if (obj && typeof obj === 'object') {
//       for (const key in obj) {
//         if (typeof obj[key] === 'string') {
//           // Remove MongoDB operators and other dangerous patterns
//           obj[key] = obj[key].replace(/^\$/, '_').replace(/\./g, '_');
//         } else if (typeof obj[key] === 'object' && obj[key] !== null) {
//           sanitize(obj[key]);
//         }
//       }
//     }
//   };
  
//   // Sanitize body and params (skip query to avoid the error)
//   if (req.body) {
//     sanitize(req.body);
//   }
//   if (req.params) {
//     sanitize(req.params);
//   }
  
//   // For query parameters, create a sanitized copy
//   if (req.query && Object.keys(req.query).length > 0) {
//     const sanitizedQuery = JSON.parse(JSON.stringify(req.query));
//     sanitize(sanitizedQuery);
//     req.sanitizedQuery = sanitizedQuery;
    
//     // Log sanitization if needed
//     const originalKeys = Object.keys(req.query);
//     const sanitizedKeys = Object.keys(sanitizedQuery);
//     const modified = originalKeys.some(key =>
//       JSON.stringify(req.query[key]) !== JSON.stringify(sanitizedQuery[key])
//     );
    
//     if (modified) {
//       console.warn(`Sanitized query parameters in ${req.path}`);
//     }
//   }
  
//   next();
// };




// const sanitize = (obj) => {
  //   if (obj && typeof obj === 'object' && obj !== null) {
  //     for (const key in obj) {
  //       if (obj.hasOwnProperty(key)) {
  //         if (typeof obj[key] === 'string') {
  //           // Remove MongoDB operators and other dangerous patterns
  //           obj[key] = obj[key].replace(/^\$/, '_').replace(/\./g, '_');
  //         } else if (typeof obj[key] === 'object' && obj[key] !== null) {
  //           sanitize(obj[key]);
  //         }
  //       }
  //     }
  //   }
  // };
