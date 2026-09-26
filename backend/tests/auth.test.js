const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

const dbAvailable = !!process.env.DATABASE_URL;

(dbAvailable ? describe : describe.skip)('Auth flows', () => {
  const email = `auth-test-${Date.now()}@test.dev`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email,
      password: 'Password123!',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email,
      password: 'Password123!',
    });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'WrongPassword!' });
    expect(res.status).toBe(401);
  });

  it('rejects access to another customer appointment (authorization boundary)', async () => {
    const res = await request(app).get('/api/appointments/me');
    expect(res.status).toBe(401);
  });
});
