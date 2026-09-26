const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/slots.controller');

const router = express.Router();

const listSchema = z.object({
  query: z.object({ serviceId: z.string().uuid(), date: z.string().optional() }),
});

const generateSchema = z.object({
  body: z.object({
    serviceId: z.string().uuid(),
    date: z.string(),
    startHour: z.number().int().min(0).max(23).optional(),
    endHour: z.number().int().min(1).max(24).optional(),
    capacity: z.number().int().min(1).max(100).optional(),
  }),
});

router.get('/', validate(listSchema), ctrl.list);
router.post('/generate', authenticate, authorize('ADMIN'), validate(generateSchema), ctrl.generate);

module.exports = router;
