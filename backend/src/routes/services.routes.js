const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/services.controller');

const router = express.Router();

const serviceSchema = z.object({
  body: z.object({
    organizationId: z.string().uuid(),
    name: z.string().min(2).max(150),
    description: z.string().max(1000).optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
    capacityPerSlot: z.number().int().min(1).max(100).optional(),
  }),
});

const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });
const listQuerySchema = z.object({ query: z.object({ organizationId: z.string().uuid().optional() }) });

router.get('/', validate(listQuerySchema), ctrl.list);
router.get('/:id', validate(idParamSchema), ctrl.getOne);
router.post('/', authenticate, authorize('ADMIN'), validate(serviceSchema), ctrl.create);
router.patch('/:id', authenticate, authorize('ADMIN'), validate(idParamSchema), ctrl.update);
router.delete('/:id', authenticate, authorize('ADMIN'), validate(idParamSchema), ctrl.remove);

module.exports = router;
