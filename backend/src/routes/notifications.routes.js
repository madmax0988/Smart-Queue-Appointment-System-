const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notifications.controller');

const router = express.Router();
const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

router.use(authenticate);
router.get('/', ctrl.list);
router.patch('/:id/read', validate(idParamSchema), ctrl.markRead);

module.exports = router;
