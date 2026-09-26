const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(100),
    role: z.enum(['CUSTOMER', 'STAFF']).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().min(1) }),
});

router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login', validate(loginSchema), ctrl.login);
router.post('/refresh', validate(refreshSchema), ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
