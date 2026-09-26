const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { notFoundHandler, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth.routes');
const organizationsRoutes = require('./routes/organizations.routes');
const servicesRoutes = require('./routes/services.routes');
const slotsRoutes = require('./routes/slots.routes');
const appointmentsRoutes = require('./routes/appointments.routes');
const queuesRoutes = require('./routes/queues.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const chatRoutes = require('./routes/chat.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/queues', queuesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
