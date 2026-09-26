const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/appointments.controller');

const router = express.Router();

const createSchema = z.object({
  body: z.object({ serviceId: z.string().uuid(), slotId: z.string().uuid() }),
});
const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });
const rescheduleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ newSlotId: z.string().uuid() }),
});

router.use(authenticate);
router.post('/', validate(createSchema), ctrl.create);
router.get('/me', ctrl.listMine);
router.patch('/:id', validate(rescheduleSchema), ctrl.reschedule);
router.delete('/:id', validate(idParamSchema), ctrl.cancel);

module.exports = router;
