const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/organizations.controller');

const router = express.Router();

const orgSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150),
    description: z.string().max(1000).optional(),
    address: z.string().max(300).optional(),
    operatingHours: z.string().max(200).optional(),
  }),
});

const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

router.get('/', ctrl.list);
router.get('/:id', validate(idParamSchema), ctrl.getOne);
router.post('/', authenticate, authorize('ADMIN'), validate(orgSchema), ctrl.create);
router.patch('/:id', authenticate, authorize('ADMIN'), validate(idParamSchema), ctrl.update);
router.delete('/:id', authenticate, authorize('ADMIN'), validate(idParamSchema), ctrl.remove);

module.exports = router;
