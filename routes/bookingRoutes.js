const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const Notification = require('../models/Notification');
const protect = require('../middleware/authMiddleware');

// Protect all booking routes
router.use(protect);

const DEFAULT_TIME_SLOTS = [
  '09:00 AM - 10:30 AM',
  '10:30 AM - 12:00 PM',
  '12:00 PM - 01:30 PM',
  '02:00 PM - 03:30 PM',
  '03:30 PM - 05:00 PM',
  '05:00 PM - 06:30 PM',
];

// @route   GET /api/bookings/available-slots
// @desc    Get available time slots for a service & date (blocks non-Cancelled slots)
// @access  Private
router.get('/available-slots', async (req, res) => {
  try {
    const serviceId = req.query.serviceId || req.query.service;
    const date = req.query.date;

    if (!serviceId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both serviceId and date query parameters',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid serviceId format',
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Block any slot with a non-Cancelled booking (Pending, Confirmed, Completed)
    const bookedRecords = await Booking.find({
      service: serviceId,
      date: date.trim(),
      status: { $ne: 'Cancelled' },
    });

    const bookedSlots = bookedRecords.map((b) => b.timeSlot);
    const availableSlots = DEFAULT_TIME_SLOTS.filter(
      (slot) => !bookedSlots.includes(slot)
    );

    return res.status(200).json({
      success: true,
      serviceId,
      date: date.trim(),
      allSlots: DEFAULT_TIME_SLOTS,
      bookedSlots,
      availableSlots,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   POST /api/bookings
// @desc    Create a new booking (preventing double bookings)
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { serviceId, service, date, timeSlot, address, notes, totalPrice } =
      req.body;

    const targetServiceId = serviceId || service;

    if (!targetServiceId || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Please provide serviceId, date, and timeSlot',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(targetServiceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID format',
      });
    }

    const serviceDoc = await Service.findById(targetServiceId);
    if (!serviceDoc) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    const bookingAddress = (address || req.user.address || '').trim();
    if (!bookingAddress) {
      return res.status(400).json({
        success: false,
        message:
          'Service address is required. Please provide an address or update your profile.',
      });
    }

    const trimmedDate = date.trim();
    const trimmedTimeSlot = timeSlot.trim();

    // Prevent double bookings for non-cancelled bookings
    const existingBooking = await Booking.findOne({
      service: serviceDoc._id,
      date: trimmedDate,
      timeSlot: trimmedTimeSlot,
      status: { $ne: 'Cancelled' },
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message:
          'This time slot is already booked for the selected date. Please choose another slot.',
      });
    }

    const finalPrice =
      totalPrice !== undefined && totalPrice !== null
        ? Number(totalPrice)
        : serviceDoc.price;

    const newBooking = await Booking.create({
      user: req.user._id,
      service: serviceDoc._id,
      date: trimmedDate,
      timeSlot: trimmedTimeSlot,
      address: bookingAddress,
      notes: (notes || '').trim(),
      totalPrice: finalPrice,
      status: 'Pending',
    });

    // Populate service and user details
    await newBooking.populate('service');
    await newBooking.populate('user', 'name email image address');

    // Trigger Admin Notification for all users with role: 'admin'
    try {
      const customerName = newBooking.user?.name || req.user.name || 'Customer';
      const serviceName = newBooking.service?.name || serviceDoc.name || 'Service';
      const admins = await User.find({ role: 'admin' });

      if (admins.length > 0) {
        const adminNotifications = admins.map((admin) => ({
          user: admin._id,
          recipientRole: 'admin',
          title: 'New Booking Request! 🔔',
          message: `${customerName} booked ${serviceName} on ${trimmedDate} at ${trimmedTimeSlot}.`,
          bookingId: newBooking._id,
          booking: newBooking._id,
          type: 'BOOKING',
          isRead: false,
        }));
        await Notification.insertMany(adminNotifications);
      }
    } catch (notifErr) {
      console.error('Failed to trigger admin notifications on new booking:', notifErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: newBooking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   GET /api/bookings/my-bookings
// @desc    Get current user's bookings with optional type (upcoming/previous) & status filters
// @access  Private
router.get('/my-bookings', async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = { user: req.user._id };

    // Explicit status filter
    if (status && status.trim()) {
      filter.status = status.trim();
    }

    // Type filter (upcoming vs previous)
    const today = new Date().toISOString().slice(0, 10);
    if (type === 'upcoming') {
      if (!filter.status) {
        filter.status = { $in: ['Pending', 'Confirmed'] };
      }
      filter.date = { $gte: today };
    } else if (type === 'previous') {
      if (!filter.status) {
        filter.$or = [
          { date: { $lt: today } },
          { status: { $in: ['Completed', 'Cancelled'] } },
        ];
      }
    }

    const bookings = await Booking.find(filter)
      .populate('service')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking details
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format',
      });
    }

    const booking = await Booking.findById(id)
      .populate('service')
      .populate('user', 'name email image address');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Authorization check
    if (booking.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking',
      });
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   PATCH /api/bookings/:id/cancel
// @desc    Cancel a booking (allowed only when status is 'Pending')
// @access  Private
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format',
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Authorization check
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking',
      });
    }

    // Allow cancellation only when status is 'Pending'
    if (booking.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a booking with '${booking.status}' status. Cancellation is only allowed when status is 'Pending'.`,
      });
    }

    booking.status = 'Cancelled';
    await booking.save();
    await booking.populate('service');

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

module.exports = router;
