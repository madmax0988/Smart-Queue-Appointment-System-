const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/admin.controller');

const router = express.Router();

const createStaffSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(100),
    serviceIds: z.array(z.string().uuid()).optional(),
  }),
});

const assignSchema = z.object({
  body: z.object({ staffId: z.string().uuid(), serviceId: z.string().uuid() }),
});

const analyticsSchema = z.object({ query: z.object({ organizationId: z.string().uuid().optional() }) });

router.use(authenticate, authorize('ADMIN'));
router.post('/staff', validate(createStaffSchema), ctrl.createStaff);
router.get('/staff', ctrl.listStaff);
router.post('/staff/assign', validate(assignSchema), ctrl.assignStaff);
router.get('/analytics', validate(analyticsSchema), ctrl.analytics);

module.exports = router;
