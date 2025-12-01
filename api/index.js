require('dotenv').config();
const app = require('../src/app');
const connectDB = require('../src/config/db');

// Connect to database
let isConnected = false;

const cors = require("cors");

// CORS that allows ANY vercel frontend + localhost
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowed =
      origin.endsWith(".vercel.app") ||
      origin.startsWith("http://localhost");

    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  exposedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};

// CORS MUST be before all routes
app.use(cors({ credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  origin : ['https://frontend-ayk34bal3-arul-goyals-projects-121a033d.vercel.app/'],
  exposedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,}));
app.options("*", cors(corsOptions));


const handler = async (req, res) => {
  // Ensure database connection for serverless
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (error) {
      console.error('Database connection error:', error);
      return res.status(500).json({ error: 'Database connection failed' });
    }
  }

  // Let Express handle the request
  return app(req, res);
};

// Export the handler for Vercel serverless function
module.exports = handler;
