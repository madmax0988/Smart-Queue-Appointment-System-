const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/queues.controller');

const router = express.Router();

const serviceParamSchema = z.object({ params: z.object({ serviceId: z.string().uuid() }) });
const entryStatusSchema = z.object({
  params: z.object({ serviceId: z.string().uuid(), entryId: z.string().uuid() }),
  body: z.object({ status: z.enum(['SKIPPED', 'CANCELLED', 'WAITING', 'COMPLETED']) }),
});
const appointmentParamSchema = z.object({ params: z.object({ appointmentId: z.string().uuid() }) });

router.get('/service/:serviceId', validate(serviceParamSchema), ctrl.getByService);
router.get('/appointment/:appointmentId', authenticate, validate(appointmentParamSchema), ctrl.getMyQueueStatus);
router.patch('/service/:serviceId/next', authenticate, authorize('STAFF', 'ADMIN'), validate(serviceParamSchema), ctrl.callNext);
router.patch('/service/:serviceId/entries/:entryId', authenticate, authorize('STAFF', 'ADMIN'), validate(entryStatusSchema), ctrl.updateEntryStatus);

module.exports = router;
