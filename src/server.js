require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { startSlotScheduler } = require('./utils/slotScheduler');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      
      // Start the slot status scheduler
      startSlotScheduler();
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
