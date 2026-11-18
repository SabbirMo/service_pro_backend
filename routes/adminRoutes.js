const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// @route   POST /api/admin/login
// @desc    Authenticate admin & return tokens
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate that both email and password are provided
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find the user in MongoDB by email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have administrator privileges.',
      });
    }

    // Compare password using bcryptjs
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    // Generate JWT accessToken (1d expiry) and refreshToken (7d expiry)
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'servicepro_secret_key_2026',
      { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_REFRESH_SECRET || 'servicepro_refresh_secret_key_2026',
      { expiresIn: '7d' }
    );

    // Save refreshToken on the user document
    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      accessToken,
      refreshToken,
      admin: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   GET /api/admin/dashboard
// @desc    Get dashboard metrics, KPIs, catalog stats, and recent pending bookings
// @access  Private (Admin only)
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    // 1. KPIs
    const [
      totalBookings,
      pendingCount,
      confirmedCount,
      completedCount,
      cancelledCount,
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'Pending' }),
      Booking.countDocuments({ status: 'Confirmed' }),
      Booking.countDocuments({ status: 'Completed' }),
      Booking.countDocuments({ status: 'Cancelled' }),
    ]);

    // Gross revenue: sum of totalPrice for Confirmed and Completed bookings
    const revenueAgg = await Booking.aggregate([
      {
        $match: {
          status: { $in: ['Confirmed', 'Completed'] },
        },
      },
      {
        $group: {
          _id: null,
          grossRevenue: { $sum: '$totalPrice' },
        },
      },
    ]);
    const grossRevenue = revenueAgg.length > 0 ? revenueAgg[0].grossRevenue : 0;

    // Fulfilled rate percentage
    const fulfilledRate =
      totalBookings > 0 ? Math.round((completedCount / totalBookings) * 100) : 0;

    const kpis = {
      totalBookings,
      pendingCount,
      confirmedCount,
      completedCount,
      cancelledCount,
      grossRevenue,
      totalRevenue: grossRevenue,
      fulfilledRate,
    };

    // 2. Catalog Stats
    const CATEGORIES = [
      'Plumbing',
      'Electrical',
      'Painting',
      'AC & Appliances',
      'Cleaning',
      'Spa',
    ];

    const totalServices = await Service.countDocuments();

    const categoryAgg = await Service.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
    ]);

    const categoryCounts = {};
    CATEGORIES.forEach((cat) => {
      categoryCounts[cat] = 0;
    });
    categoryAgg.forEach((item) => {
      if (item._id && categoryCounts[item._id] !== undefined) {
        categoryCounts[item._id] = item.count;
      }
    });

    const categoryDistribution = CATEGORIES.map((cat) => {
      const count = categoryCounts[cat] || 0;
      const sharePercent =
        totalServices > 0 ? Math.round((count / totalServices) * 100) : 0;
      return {
        category: cat,
        count,
        sharePercent,
      };
    });

    const catalogStats = {
      totalServices,
      categoryDistribution,
      categoryCounts,
    };

    // 3. Recent Pending Bookings (latest 10 Pending bookings populated with user and service details)
    const rawPendingBookings = await Booking.find({ status: 'Pending' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email address image')
      .populate('service');

    const recentPendingBookings = rawPendingBookings.map((b) => {
      const user = b.user || {};
      const service = b.service || {};
      const addressStr = b.address || user.address || '';

      return {
        _id: b._id,
        id: b._id.toString(),
        user: b.user,
        service: b.service,
        customer: {
          name: user.name || 'Customer',
          email: user.email || '',
          phone: user.email || 'N/A',
          avatar: user.image || '',
        },
        address: {
          street: addressStr,
          city: '',
        },
        serviceTitle: service.name || 'Service',
        category: service.category || 'General',
        date: b.date,
        timeSlot: b.timeSlot,
        price: b.totalPrice,
        totalPrice: b.totalPrice,
        notes: b.notes || '',
        status: b.status,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      kpis,
      catalogStats,
      recentPendingBookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get revenue and dispatch analytics & fulfillment pipeline for selected range (7d or 30d)
// @access  Private (Admin only)
router.get('/analytics', protect, adminOnly, async (req, res) => {
  try {
    const rangeParam = (req.query.range || '7d').toLowerCase().trim();
    const range = rangeParam === '30d' ? '30d' : '7d';
    const numDays = range === '30d' ? 30 : 7;

    const now = new Date();
    // Helper to format Date into YYYY-MM-DD
    const formatDateKey = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const buckets = [];
    const bucketMap = {};

    for (let i = 0; i < numDays; i++) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() - (numDays - 1 - i));
      const key = formatDateKey(dayDate);

      let label = '';
      if (range === '7d') {
        if (i === numDays - 1) {
          label = 'Today';
        } else {
          label = dayNames[dayDate.getDay()];
        }
      } else {
        label = `${monthNames[dayDate.getMonth()]} ${String(dayDate.getDate()).padStart(2, '0')}`;
      }

      buckets.push({
        key,
        label,
        revenue: 0,
        orderCount: 0,
      });
      bucketMap[key] = i;
    }

    // Query bookings within the selected window
    const startOfWindow = new Date(now);
    startOfWindow.setDate(now.getDate() - (numDays - 1));
    startOfWindow.setHours(0, 0, 0, 0);
    const startKey = formatDateKey(startOfWindow);

    const bookings = await Booking.find({
      $or: [
        { createdAt: { $gte: startOfWindow } },
        { date: { $gte: startKey } },
      ],
    });

    const getBookingDateKey = (b) => {
      if (b.createdAt) {
        const d = new Date(b.createdAt);
        if (!isNaN(d.getTime())) {
          const k = formatDateKey(d);
          if (bucketMap[k] !== undefined) return k;
          const utck = d.toISOString().split('T')[0];
          if (bucketMap[utck] !== undefined) return utck;
        }
      }
      if (b.date && typeof b.date === 'string') {
        const raw = b.date.trim().split('T')[0];
        if (bucketMap[raw] !== undefined) return raw;
      }
      return null;
    };

    let totalBookings = 0;
    let completedCount = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;

    let cycleVolume = 0;
    let validOrderCount = 0;

    for (const b of bookings) {
      const dateKey = getBookingDateKey(b);
      // Only process bookings that fall into our selected window
      if (!dateKey) continue;

      totalBookings++;
      const status = b.status || 'Pending';

      if (status === 'Completed') {
        completedCount++;
      } else if (status === 'Confirmed') {
        confirmedCount++;
      } else if (status === 'Pending') {
        pendingCount++;
      } else if (status === 'Cancelled') {
        cancelledCount++;
      }

      // Revenue analytics excludes Cancelled bookings
      if (status !== 'Cancelled') {
        validOrderCount++;
        const price = Number(b.totalPrice) || 0;
        cycleVolume += price;

        const bucketIdx = bucketMap[dateKey];
        if (bucketIdx !== undefined) {
          buckets[bucketIdx].revenue += price;
          buckets[bucketIdx].orderCount++;
        }
      }
    }

    const revenues = buckets.map((b) => b.revenue);
    const labels = buckets.map((b) => b.label);
    const peakDayRate = revenues.length > 0 ? Math.max(...revenues, 0) : 0;
    const averageTicket = validOrderCount > 0 ? Math.round(cycleVolume / validOrderCount) : 0;

    const fulfilledPercent =
      totalBookings > 0
        ? Math.round(((completedCount + confirmedCount) / totalBookings) * 100)
        : 0;

    const totalForBreakdown = totalBookings > 0 ? totalBookings : 1;
    const breakdown = {
      completed: {
        count: completedCount,
        percent: totalBookings > 0 ? Math.round((completedCount / totalForBreakdown) * 100) : 0,
      },
      confirmed: {
        count: confirmedCount,
        percent: totalBookings > 0 ? Math.round((confirmedCount / totalForBreakdown) * 100) : 0,
      },
      pending: {
        count: pendingCount,
        percent: totalBookings > 0 ? Math.round((pendingCount / totalForBreakdown) * 100) : 0,
      },
      cancelled: {
        count: cancelledCount,
        percent: totalBookings > 0 ? Math.round((cancelledCount / totalForBreakdown) * 100) : 0,
      },
    };

    return res.status(200).json({
      success: true,
      range,
      revenueAnalytics: {
        cycleVolume,
        averageTicket,
        peakDayRate,
        labels,
        revenues,
      },
      fulfillmentPipeline: {
        fulfilledPercent,
        totalBookings,
        completedCount,
        confirmedCount,
        pendingCount,
        cancelledCount,
        breakdown,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   POST /api/admin/services
// @desc    Create a new service with desktop file upload or text image URL
// @access  Private (Admin only)
router.post(
  '/services',
  protect,
  adminOnly,
  upload.single('imageFile'),
  async (req, res) => {
    try {
      const {
        name,
        title,
        description,
        desc,
        category,
        price,
        durationMinutes,
        duration,
        isFeatured,
      } = req.body;

      const serviceName = (name || title || '').trim();
      const serviceDesc = (description || desc || '').trim();
      const serviceCategory = (category || '').trim();

      if (!serviceName || !serviceCategory || price === undefined || price === null || price === '') {
        return res.status(400).json({
          success: false,
          message: 'Please provide name, category, and price',
        });
      }

      const parsedPrice = Number(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid service price',
        });
      }

      const parsedDuration =
        durationMinutes !== undefined && durationMinutes !== null && durationMinutes !== ''
          ? Number(durationMinutes)
          : (duration !== undefined && duration !== null && duration !== ''
              ? Number(duration)
              : 60);

      // Determine image URL: either uploaded file (req.file.path from Cloudinary) or text image URL
      let imageUrl = '';
      if (req.file) {
        imageUrl = req.file.path || req.file.secure_url || '';
      } else if (req.body.image || req.body.imageUrl || req.body.imageFile) {
        imageUrl = req.body.image || req.body.imageUrl || (typeof req.body.imageFile === 'string' ? req.body.imageFile : '');
      }

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an image file or an image URL',
        });
      }

      const featuredBoolean =
        isFeatured === true ||
        isFeatured === 'true' ||
        isFeatured === 1 ||
        isFeatured === '1' ||
        isFeatured === 'on';

      const newService = await Service.create({
        name: serviceName,
        description: serviceDesc,
        category: serviceCategory,
        price: parsedPrice,
        durationMinutes: isNaN(parsedDuration) || parsedDuration <= 0 ? 60 : parsedDuration,
        image: imageUrl,
        isFeatured: featuredBoolean,
      });

      return res.status(201).json({
        success: true,
        message: 'Service created successfully',
        service: newService,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error',
      });
    }
  }
);

// @route   GET /api/admin/services
// @desc    Get all services with optional category & search filter
// @access  Private (Admin only)
router.get('/services', protect, adminOnly, async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category && category !== 'All') {
      filter.category = category.trim();
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const services = await Service.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   PUT /api/admin/services/:id
// @desc    Update an existing service with optional file upload or image URL
// @access  Private (Admin only)
router.put(
  '/services/:id',
  protect,
  adminOnly,
  upload.single('imageFile'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({
          success: false,
          message: 'Service not found',
        });
      }

      const service = await Service.findById(id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found',
        });
      }

      const {
        name,
        title,
        description,
        desc,
        category,
        price,
        durationMinutes,
        duration,
        isFeatured,
      } = req.body;

      if (name !== undefined || title !== undefined) {
        const serviceName = (name !== undefined ? name : title).trim();
        if (serviceName) {
          service.name = serviceName;
        }
      }

      if (description !== undefined || desc !== undefined) {
        service.description = (description !== undefined ? description : desc).trim();
      }

      if (category !== undefined && category.trim()) {
        service.category = category.trim();
      }

      if (price !== undefined && price !== null && price !== '') {
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid service price',
          });
        }
        service.price = parsedPrice;
      }

      if (durationMinutes !== undefined && durationMinutes !== null && durationMinutes !== '') {
        const parsedDuration = Number(durationMinutes);
        if (!isNaN(parsedDuration) && parsedDuration > 0) {
          service.durationMinutes = parsedDuration;
        }
      } else if (duration !== undefined && duration !== null && duration !== '') {
        const parsedDuration = Number(duration);
        if (!isNaN(parsedDuration) && parsedDuration > 0) {
          service.durationMinutes = parsedDuration;
        }
      }

      if (isFeatured !== undefined && isFeatured !== null && isFeatured !== '') {
        service.isFeatured =
          isFeatured === true ||
          isFeatured === 'true' ||
          isFeatured === 1 ||
          isFeatured === '1' ||
          isFeatured === 'on';
      }

      // Update image if newly uploaded file or text image URL provided
      if (req.file) {
        service.image = req.file.path || req.file.secure_url || service.image;
      } else if (req.body.image || req.body.imageUrl) {
        const img = (req.body.image || req.body.imageUrl).trim();
        if (img) {
          service.image = img;
        }
      } else if (typeof req.body.imageFile === 'string' && req.body.imageFile.trim()) {
        service.image = req.body.imageFile.trim();
      }

      await service.save();

      return res.status(200).json({
        success: true,
        message: 'Service updated successfully',
        service,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error',
      });
    }
  }
);

// @route   DELETE /api/admin/services/:id
// @desc    Delete a service from catalog
// @access  Private (Admin only)
router.delete('/services/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    const service = await Service.findByIdAndDelete(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
      service,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   GET /api/admin/bookings
// @desc    Get all bookings populated with user & service, supporting status/search filter & statusCounts
// @access  Private (Admin only)
router.get('/bookings', protect, adminOnly, async (req, res) => {
  try {
    const { status, search } = req.query;

    // 1. Calculate statusCounts across all bookings in database
    const [
      allCount,
      pendingCount,
      confirmedCount,
      completedCount,
      cancelledCount,
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'Pending' }),
      Booking.countDocuments({ status: 'Confirmed' }),
      Booking.countDocuments({ status: 'Completed' }),
      Booking.countDocuments({ status: 'Cancelled' }),
    ]);

    const statusCounts = {
      All: allCount,
      Pending: pendingCount,
      Confirmed: confirmedCount,
      Completed: completedCount,
      Cancelled: cancelledCount,
    };

    // 2. Build Query Filter
    const filter = {};
    if (status && status !== 'All') {
      filter.status = status.trim();
    }

    if (search && search.trim()) {
      const q = search.trim();
      const orConditions = [
        { address: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
      ];

      if (mongoose.Types.ObjectId.isValid(q) && q.length === 24) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(q) });
      }

      // Find matching users (name, email, or address)
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      }).select('_id');

      if (matchingUsers.length > 0) {
        orConditions.push({ user: { $in: matchingUsers.map((u) => u._id) } });
      }

      // Find matching services (name or category)
      const matchingServices = await Service.find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { category: { $regex: q, $options: 'i' } },
        ],
      }).select('_id');

      if (matchingServices.length > 0) {
        orConditions.push({ service: { $in: matchingServices.map((s) => s._id) } });
      }

      // Add $expr regex match on string representation of _id for partial matches
      orConditions.push({
        $expr: {
          $regexMatch: {
            input: { $toString: '$_id' },
            regex: q,
            options: 'i',
          },
        },
      });

      filter.$or = orConditions;
    }

    // 3. Query bookings and populate user & service details
    let bookings = await Booking.find(filter)
      .populate('user', 'name email address image')
      .populate('service', 'name category price durationMinutes image')
      .sort({ createdAt: -1 });

    // Fallback/in-memory safety for partial match on populated fields
    if (search && search.trim()) {
      const qLower = search.trim().toLowerCase();
      bookings = bookings.filter((b) => {
        const idStr = (b._id || b.id || '').toString().toLowerCase();
        const userName = (b.user?.name || '').toLowerCase();
        const userEmail = (b.user?.email || '').toLowerCase();
        const userAddr = (b.user?.address || '').toLowerCase();
        const bookingAddr = (b.address || '').toLowerCase();
        const serviceName = (b.service?.name || b.service?.title || '').toLowerCase();
        const serviceCat = (b.service?.category || '').toLowerCase();

        return (
          idStr.includes(qLower) ||
          userName.includes(qLower) ||
          userEmail.includes(qLower) ||
          userAddr.includes(qLower) ||
          bookingAddr.includes(qLower) ||
          serviceName.includes(qLower) ||
          serviceCat.includes(qLower)
        );
      });
    }

    return res.status(200).json({
      success: true,
      count: bookings.length,
      statusCounts,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   PATCH /api/admin/bookings/:id/status
// @desc    Update booking status and create corresponding Notification for user
// @access  Private (Admin only)
router.patch('/bookings/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const VALID_STATUSES = ['Confirmed', 'Completed', 'Cancelled'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid status ('Confirmed', 'Completed', or 'Cancelled')",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    booking.status = status;
    await booking.save();

    await booking.populate('user', 'name email address image');
    await booking.populate('service', 'name category price durationMinutes image');

    // Create Notification record for booking.user
    let notifTitle = '';
    let notifMsg = '';
    const serviceName = booking.service?.name || 'Service';

    if (status === 'Confirmed') {
      notifTitle = 'Booking Confirmed! 🚀';
      notifMsg = `Your booking for '${serviceName}' on ${booking.date} (${booking.timeSlot}) has been confirmed.`;
    } else if (status === 'Completed') {
      notifTitle = 'Service Completed! ✨';
      notifMsg = `Your service '${serviceName}' has been marked as completed. Thank you!`;
    } else if (status === 'Cancelled') {
      notifTitle = 'Booking Cancelled ⚠️';
      notifMsg = `Your booking for '${serviceName}' on ${booking.date} has been cancelled.`;
    }

    const targetUserId = booking.user?._id || booking.user;
    let notification = null;
    if (targetUserId) {
      notification = await Notification.create({
        user: targetUserId,
        recipientRole: 'user',
        bookingId: booking._id,
        booking: booking._id,
        title: notifTitle,
        message: notifMsg,
        type: status.toUpperCase(),
        isRead: false,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Booking #${id} status updated to '${status}' successfully`,
      booking,
      notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

module.exports = router;
