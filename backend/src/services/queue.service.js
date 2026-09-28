const AppError = require('../utils/AppError');
const { estimateWaitMinutes } = require('./waitTime.service');

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Gets or creates today's queue for a service, inside an existing transaction.
 * Uses an atomic upsert on the unique(serviceId, queueDate) constraint so two
 * concurrent bookings for the first slot of the day can't both try to insert
 * the same row (which would otherwise surface as an unhandled P2002 error).
 */
async function getOrCreateQueue(tx, serviceId, queueDate) {
  const day = startOfDay(queueDate);
  return tx.queue.upsert({
    where: { serviceId_queueDate: { serviceId, queueDate: day } },
    create: { serviceId, queueDate: day },
    update: {},
  });
}

/**
 * Concurrency-safe token generation. Must be called within a transaction that
 * has already locked the parent Queue row (see appointments.controller.js,
 * which uses `SELECT ... FOR UPDATE` via $queryRaw before calling this).
 */
async function generateNextToken(tx, queueId) {
  const queue = await tx.queue.update({
    where: { id: queueId },
    data: { lastToken: { increment: 1 } },
  });
  const tokenNumber = queue.lastToken;
  const waitingCount = await tx.queueEntry.count({
    where: { queueId, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
  });
  return {
    tokenNumber,
    tokenLabel: `A-${tokenNumber}`,
    position: waitingCount + 1,
  };
}

async function buildQueueSnapshot(prisma, queueId, averageServiceMinutes) {
  const entries = await prisma.queueEntry.findMany({
    where: { queueId, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
    orderBy: { tokenNumber: 'asc' },
    include: { appointment: { include: { user: true, service: true } } },
  });

  const inService = entries.find((e) => e.status === 'IN_SERVICE');
  const waiting = entries.filter((e) => e.status !== 'IN_SERVICE');

  return {
    queueId,
    nowServing: inService ? inService.tokenLabel : null,
    waitingCount: waiting.length,
    entries: waiting.map((entry, idx) => ({
      id: entry.id,
      tokenLabel: entry.tokenLabel,
      status: entry.status,
      position: idx + 1,
      estimatedWaitMinutes: estimateWaitMinutes({
        peopleAhead: idx + (inService ? 1 : 0),
        averageServiceMinutes,
      }),
      customerName: entry.appointment.user.name,
    })),
  };
}

async function reindexPositions(tx, queueId) {
  const entries = await tx.queueEntry.findMany({
    where: { queueId, status: 'WAITING' },
    orderBy: { tokenNumber: 'asc' },
  });
  for (let i = 0; i < entries.length; i += 1) {
    await tx.queueEntry.update({ where: { id: entries[i].id }, data: { position: i + 1 } });
  }
}

module.exports = { getOrCreateQueue, generateNextToken, buildQueueSnapshot, reindexPositions, startOfDay };
