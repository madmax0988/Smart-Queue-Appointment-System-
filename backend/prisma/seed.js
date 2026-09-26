const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartqueue.dev' },
    update: {},
    create: { name: 'Alex Admin', email: 'admin@smartqueue.dev', passwordHash, role: 'ADMIN' },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@smartqueue.dev' },
    update: {},
    create: { name: 'Sam Staff', email: 'staff@smartqueue.dev', passwordHash, role: 'STAFF' },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@smartqueue.dev' },
    update: {},
    create: { name: 'Casey Customer', email: 'customer@smartqueue.dev', passwordHash, role: 'CUSTOMER' },
  });

  const org = await prisma.organization.create({
    data: {
      name: 'Riverside General Clinic',
      description: 'A multi-specialty outpatient clinic.',
      address: '12 Riverside Ave',
      operatingHours: 'Mon-Sat 9:00 AM - 5:00 PM',
      services: {
        create: [
          { name: 'General Consultation', description: 'Routine checkups and consultations.', durationMinutes: 15, capacityPerSlot: 1 },
          { name: 'Blood Test', description: 'Sample collection for lab tests.', durationMinutes: 10, capacityPerSlot: 2 },
        ],
      },
    },
    include: { services: true },
  });

  await prisma.staffAssignment.create({
    data: { staffId: staff.id, serviceId: org.services[0].id },
  });

  const service = org.services[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slots = [];
  let cursor = new Date(today);
  cursor.setHours(9, 0, 0, 0);
  for (let i = 0; i < 16; i += 1) {
    const start = new Date(cursor);
    const end = new Date(start.getTime() + service.durationMinutes * 60000);
    slots.push({ serviceId: service.id, startTime: start, endTime: end, capacity: 1 });
    cursor = end;
  }
  await prisma.appointmentSlot.createMany({ data: slots });

  console.log('Seed complete.');
  console.log('Admin login: admin@smartqueue.dev / Password123!');
  console.log('Staff login: staff@smartqueue.dev / Password123!');
  console.log('Customer login: customer@smartqueue.dev / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
