const { estimateWaitMinutes } = require('../src/services/waitTime.service');

describe('estimateWaitMinutes', () => {
  it('returns average * peopleAhead when no one is in service', () => {
    const result = estimateWaitMinutes({ peopleAhead: 3, averageServiceMinutes: 9 });
    expect(result).toBe(27);
  });

  it('returns 0-bound remaining time when the customer is next in line', () => {
    const result = estimateWaitMinutes({ peopleAhead: 0, averageServiceMinutes: 10 });
    expect(result).toBe(10);
  });

  it('never returns a negative estimate', () => {
    const result = estimateWaitMinutes({ peopleAhead: 0, averageServiceMinutes: 10, inServiceRemainingMinutes: -5 });
    expect(result).toBe(0);
  });
});
