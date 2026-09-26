/**
 * Integration test: requires a running PostgreSQL database reachable via
 * DATABASE_URL, with migrations applied (`npm run prisma:migrate`).
 * Verifies that when two customers race for the last seat in a slot with
 * capacity 1, exactly one booking succeeds and the slot's bookedCount never
 * exceeds capacity.
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

const dbAvailable = !!process.env.DATABASE_URL;

(dbAvailable ? describe : describe.skip)('Concurrent appointment booking', () => {
  let organizationId;
  let serviceId;
  let slotId;
  let userA;
  let userB;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('Password123!', 12);
    userA = await prisma.user.create({ data: { name: 'Racer A', email: `racer-a-${Date.now()}@test.dev`, passwordHash, role: 'CUSTOMER' } });
    userB = await prisma.user.create({ data: { name: 'Racer B', email: `racer-b-${Date.now()}@test.dev`, passwordHash, role: 'CUSTOMER' } });

    const org = await prisma.organization.create({ data: { name: `Test Org ${Date.now()}` } });
    organizationId = org.id;
    const service = await prisma.service.create({ data: { organizationId, name: 'Test Service', durationMinutes: 10, capacityPerSlot: 1 } });
    serviceId = service.id;

    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 10 * 60000);
    const slot = await prisma.appointmentSlot.create({ data: { serviceId, startTime: start, endTime: end, capacity: 1 } });
    slotId = slot.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { serviceId } });
    await prisma.appointmentSlot.deleteMany({ where: { serviceId } });
    await prisma.queue.deleteMany({ where: { serviceId } });
    await prisma.service.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.$disconnect();
  });

  function tokenFor(user) {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ sub: user.id, role: user.role, email: user.email, name: user.name }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  }

  it('allows only one of two simultaneous bookings for a single-capacity slot', async () => {
    const [resA, resB] = await Promise.all([
      request(app).post('/api/appointments').set('Authorization', `Bearer ${tokenFor(userA)}`).send({ serviceId, slotId }),
      request(app).post('/api/appointments').set('Authorization', `Bearer ${tokenFor(userB)}`).send({ serviceId, slotId }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const slot = await prisma.appointmentSlot.findUnique({ where: { id: slotId } });
    expect(slot.bookedCount).toBe(1);
    expect(slot.bookedCount).toBeLessThanOrEqual(slot.capacity);
  });
});
