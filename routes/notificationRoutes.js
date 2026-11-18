const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// @route   GET /api/notifications
// @desc    Get current user/admin notifications with unreadCount
// @access  Private
router.get('/', async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? { $or: [{ user: req.user._id }, { recipientRole: 'admin' }] }
        : { user: req.user._id };

    const [unreadCount, notifications] = await Promise.all([
      Notification.countDocuments({ ...filter, isRead: false }),
      Notification.find(filter)
        .populate('bookingId')
        .sort({ createdAt: -1 }),
    ]);

    return res.status(200).json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   PATCH /api/notifications/read-all
// @desc    Mark all unread notifications of current user as isRead: true
// @access  Private
router.patch('/read-all', async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? { $or: [{ user: req.user._id }, { recipientRole: 'admin' }], isRead: false }
        : { user: req.user._id, isRead: false };

    await Notification.updateMany(filter, { $set: { isRead: true } });

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   PATCH /api/notifications/:id/read
// @desc    Mark a single notification as isRead: true
// @access  Private
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    const query =
      req.user.role === 'admin'
        ? { _id: id, $or: [{ user: req.user._id }, { recipientRole: 'admin' }] }
        : { _id: id, user: req.user._id };

    const notification = await Notification.findOne(query);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
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
