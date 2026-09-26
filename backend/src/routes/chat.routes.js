const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../ai/chatController');

const router = express.Router();

const sendSchema = z.object({
  body: z.object({ message: z.string().min(1).max(2000), sessionId: z.string().uuid().optional() }),
});
const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

router.use(authenticate);
router.post('/', validate(sendSchema), ctrl.sendMessage);
router.get('/sessions', ctrl.listSessions);
router.get('/sessions/:id', validate(idParamSchema), ctrl.getSessionMessages);

module.exports = router;
