// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Trust proxy (important for rate limiting behind proxies)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

// Apply rate limiter to all routes
app.use('/api/', limiter);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - IMPORTANT for Android phone testing
app.use(cors({
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'School Management API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API status route
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Mount routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));     
app.use('/api/teacher', require('./routes/teacher')); 
app.use('/api/student', require('./routes/student')); 

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

// IMPORTANT: Listen on 0.0.0.0 to allow Android phone connections
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 ================================');
  console.log(`✅ Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`✅ Port: ${PORT}`);
  console.log(`✅ Local: http://localhost:${PORT}`);
  
  // Get network IP for Android testing
  const networkInterfaces = require('os').networkInterfaces();
  const addresses = [];
  
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  
  if (addresses.length > 0) {
    console.log(`\n📱 FOR ANDROID PHONE - Use this IP in your React Native app:`);
    addresses.forEach(addr => {
      console.log(`   http://${addr}:${PORT}`);
    });
  }
  
  console.log('🚀 ================================\n');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

module.exports = app;