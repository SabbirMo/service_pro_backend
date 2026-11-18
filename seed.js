require('dotenv').config();
const connectDB = require('./config/db');
const Service = require('./models/Service');

const sampleServices = [
  // --- 1. Plumbing (2 services) ---
  {
    name: 'Emergency Pipe Leak & Burst Repair',
    description: 'Rapid response leak detection and repair for broken pipes, leaking joints, valves, and water supply lines.',
    category: 'Plumbing',
    price: 45,
    durationMinutes: 60,
    image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800',
    rating: 4.7,
    reviewCount: 138,
    isFeatured: true,
  },
  {
    name: 'Drain Unclogging & Fixture Installation',
    description: 'Clearing stubborn drain clogs in sinks, bathtubs, and toilets, plus new faucet and showerhead fittings.',
    category: 'Plumbing',
    price: 35,
    durationMinutes: 45,
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800',
    rating: 4.6,
    reviewCount: 92,
    isFeatured: false,
  },

  // --- 2. Electrical (2 services) ---
  {
    name: 'Complete Home Electrical Inspection & Wiring',
    description: 'Safety audit, circuit breaker troubleshooting, short circuit diagnosis, and certified electrical rewiring.',
    category: 'Electrical',
    price: 55,
    durationMinutes: 90,
    image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800',
    rating: 4.8,
    reviewCount: 165,
    isFeatured: true,
  },
  {
    name: 'Ceiling Fan & Light Fixture Setup',
    description: 'Professional mounting and wiring of ceiling fans, chandeliers, pendant lamps, and LED smart light strips.',
    category: 'Electrical',
    price: 30,
    durationMinutes: 45,
    image: 'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=800',
    rating: 4.5,
    reviewCount: 78,
    isFeatured: false,
  },

  // --- 3. Painting (2 services) ---
  {
    name: 'Interior Wall & Ceiling Painting',
    description: 'Premium double-coat emulsion painting, wall putty preparation, and crack filling for living spaces and bedrooms.',
    category: 'Painting',
    price: 120,
    durationMinutes: 240,
    image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800',
    rating: 4.8,
    reviewCount: 112,
    isFeatured: true,
  },
  {
    name: 'Waterproof Exterior Painting & Primer',
    description: 'Weather-resistant exterior paint application, damp-proofing primer, and mold prevention coating.',
    category: 'Painting',
    price: 180,
    durationMinutes: 360,
    image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800',
    rating: 4.6,
    reviewCount: 64,
    isFeatured: false,
  },

  // --- 4. AC & Appliances (2 services) ---
  {
    name: 'Split & Window AC Jet Wash & Gas Top-up',
    description: 'High-pressure jet wash cleaning of indoor/outdoor units, coil sanitization, cooling check, and refrigerant top-up.',
    category: 'AC & Appliances',
    price: 50,
    durationMinutes: 90,
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800',
    rating: 4.9,
    reviewCount: 240,
    isFeatured: true,
  },
  {
    name: 'Refrigerator & Washing Machine Repair',
    description: 'Comprehensive diagnosis and component replacement for cooling issues, motor faults, drum vibrations, and water leaks.',
    category: 'AC & Appliances',
    price: 40,
    durationMinutes: 75,
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800',
    rating: 4.7,
    reviewCount: 105,
    isFeatured: false,
  },

  // --- 5. Cleaning (2 services) ---
  {
    name: 'Deep Home Sanitization & Cleaning',
    description: 'Intensive whole-home scrub, vacuuming, floor polishing, bathroom descaling, and eco-friendly disinfection.',
    category: 'Cleaning',
    price: 85,
    durationMinutes: 180,
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800',
    rating: 4.9,
    reviewCount: 315,
    isFeatured: true,
  },
  {
    name: 'Sofa, Carpet & Mattress Steam Wash',
    description: 'Deep fabric shampooing, high-temp steam stain removal, allergen extraction, and rapid moisture suction drying.',
    category: 'Cleaning',
    price: 60,
    durationMinutes: 120,
    image: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800',
    rating: 4.8,
    reviewCount: 178,
    isFeatured: false,
  },

  // --- 6. Spa (2 services) ---
  {
    name: 'Swedish Aroma Therapy Full Body Spa',
    description: 'Therapeutic essential oil massage, muscle relaxation therapy, and stress-relieving acupressure head massage.',
    category: 'Spa',
    price: 75,
    durationMinutes: 90,
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
    rating: 4.9,
    reviewCount: 224,
    isFeatured: true,
  },
  {
    name: 'Herbal Glow Facial & Body Polish',
    description: 'Deep-pore organic facial treatment, fruit scrub exfoliation, and relaxing hydration mask for radiant skin.',
    category: 'Spa',
    price: 55,
    durationMinutes: 60,
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800',
    rating: 4.7,
    reviewCount: 96,
    isFeatured: false,
  },
];

const seedDB = async () => {
  try {
    await connectDB();
    const count = await Service.countDocuments();
    if (count === 0) {
      await Service.insertMany(sampleServices);
      console.log(`12 sample services across 6 categories seeded successfully!`);
    } else {
      console.log(`Catalog already contains ${count} services. Seeding skipped to protect existing services.`);
    }
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Seed Error:', error.message || error);
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  seedDB();
}

module.exports = { sampleServices, seedDB };
