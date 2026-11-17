require('dotenv').config();
const connectDB = require('./config/db');
const Service = require('./models/Service');

const sampleServices = [
  {
    name: 'Deep Home Cleaning',
    description: 'Complete sanitization and deep cleaning for living rooms, bedrooms, kitchen, and bathrooms using eco-friendly supplies.',
    category: 'Cleaning',
    price: 85,
    durationMinutes: 180,
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800',
    isFeatured: true
  },
  {
    name: 'AC Servicing & Gas Refill',
    description: 'Full split/window AC jet wash, filter cleaning, cooling check, and refrigerant gas top-up by certified technicians.',
    category: 'Repair',
    price: 45,
    durationMinutes: 90,
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800',
    isFeatured: true
  },
  {
    name: 'Full Car Interior Detailing',
    description: 'Steam cleaning, leather conditioning, dashboard polishing, and odor removal for all vehicle types.',
    category: 'Automotive',
    price: 65,
    durationMinutes: 120,
    imageUrl: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=800',
    isFeatured: false
  },
  {
    name: 'Plumbing & Leak Repair',
    description: 'Quick diagnosis and repair of pipe leaks, faucet replacements, clogged drains, and water heater issues.',
    category: 'Repair',
    price: 35,
    durationMinutes: 60,
    imageUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800',
    isFeatured: false
  },
  {
    name: 'Salon & Spa at Home',
    description: 'Relaxing facial, hair spa, and manicure package delivered in the comfort of your home.',
    category: 'Wellness',
    price: 55,
    durationMinutes: 90,
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
    isFeatured: true
  },
  {
    name: 'Laptop & PC Optimization',
    description: 'Hardware dust cleaning, thermal paste replacement, OS speedup, and malware removal.',
    category: 'Tech Support',
    price: 40,
    durationMinutes: 60,
    imageUrl: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800',
    isFeatured: false
  }
];

const seedDB = async () => {
  try {
    await connectDB();
    await Service.deleteMany({});
    await Service.insertMany(sampleServices);
    console.log('Sample services seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed Error:', error.message || error);
    process.exit(1);
  }
};

seedDB();
