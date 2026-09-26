const AVERAGE_SERVICE_MINUTES_FALLBACK = 10;

/**
 * Estimated wait = peopleAhead * averageServiceMinutes, adjusted for the
 * remaining time of whichever entry is currently IN_SERVICE.
 */
function estimateWaitMinutes({ peopleAhead, averageServiceMinutes, inServiceRemainingMinutes }) {
  const avg = averageServiceMinutes || AVERAGE_SERVICE_MINUTES_FALLBACK;
  const remaining = inServiceRemainingMinutes != null ? Math.max(inServiceRemainingMinutes, 0) : avg;
  if (peopleAhead <= 0) return Math.max(Math.round(remaining), 0);
  return Math.round(remaining + (peopleAhead - 1) * avg);
}

module.exports = { estimateWaitMinutes, AVERAGE_SERVICE_MINUTES_FALLBACK };
