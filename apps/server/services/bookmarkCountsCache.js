const TTL_MS = 15 * 1000;

const countsByUser = new Map();

function getCachedCounts(userId) {
  const entry = countsByUser.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    countsByUser.delete(userId);
    return null;
  }
  return entry.value;
}

function setCachedCounts(userId, value) {
  countsByUser.set(userId, {
    value,
    expiresAt: Date.now() + TTL_MS,
  });
}

function invalidateUserCounts(userId) {
  countsByUser.delete(userId);
}

module.exports = {
  getCachedCounts,
  setCachedCounts,
  invalidateUserCounts,
};
