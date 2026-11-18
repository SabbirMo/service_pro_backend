require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const Service = require('./models/Service');
const { sampleServices } = require('./seed');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const aiRoutes = require('./routes/aiRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Seed default administrator if not present
const seedDefaultAdmin = async () => {
  try {
    const adminEmail = 'admin@servicepro.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      await User.create({
        name: 'Sabbir Molla',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        address: 'ServicePro HQ, Dhaka',
      });
      console.log('Default Admin created: admin@servicepro.com / admin123');
    }
  } catch (error) {
    console.error('Error seeding default admin:', error.message);
  }
};

// Auto-seed 12 default services ONLY if the catalog is completely empty
const seedDefaultServices = async () => {
  try {
    const count = await Service.countDocuments();
    if (count === 0) {
      await Service.insertMany(sampleServices);
      console.log('12 default services seeded successfully into empty catalog');
    } else {
      console.log(`Service catalog already has ${count} services. Auto-seeding skipped to preserve existing data.`);
    }
  } catch (error) {
    console.error('Error auto-seeding default services:', error.message);
  }
};

// Connect to MongoDB
connectDB().then(async () => {
  await seedDefaultAdmin();
  await seedDefaultServices();
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'API is running...' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
