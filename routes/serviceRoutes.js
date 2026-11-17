const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Service = require('../models/Service');

// @route   GET /api/services
// @desc    Get services with pagination, search, category, featured filters, grouped by category
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { search, category, featured } = req.query;
    const filter = {};

    // Search by name or description
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
      ];
    }

    // Filter by category
    if (category && category.trim()) {
      filter.category = new RegExp(`^${category.trim()}$`, 'i');
    }

    // Filter by featured status
    if (featured !== undefined) {
      filter.isFeatured = featured === 'true' || featured === true;
    }

    // Pagination query parameters
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 6);
    const skip = (page - 1) * limit;

    // Total count of matching services
    const totalServices = await Service.countDocuments(filter);
    const totalPages = Math.ceil(totalServices / limit);

    // Fetch matching services with skip and limit
    const services = await Service.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Group services by category into an array of { category, services } objects
    const groupedMap = new Map();
    for (const service of services) {
      const cat = service.category;
      if (!groupedMap.has(cat)) {
        groupedMap.set(cat, []);
      }
      groupedMap.get(cat).push(service);
    }

    const groupedServices = Array.from(groupedMap.entries()).map(
      ([categoryName, serviceList]) => ({
        category: categoryName,
        services: serviceList,
      })
    );

    // Pagination metadata object
    const pagination = {
      currentPage: page,
      limit,
      totalServices,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return res.status(200).json({
      success: true,
      count: services.length,
      pagination,
      data: groupedServices,
      services: groupedServices,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   GET /api/services/:id
// @desc    Get single service by ID
// @access  Public
router.get('/:id', async (req, res) => {
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

    return res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

module.exports = router;
