/**
 * High-Performance In-Memory Cache Service for INVINTELL Backend
 */
class CacheService {
  constructor(defaultTTLSeconds = 30) {
    this.cache = new Map();
    this.defaultTTL = defaultTTLSeconds * 1000;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data, ttlSeconds) {
    const ttl = (ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
  }

  del(key) {
    this.cache.delete(key);
  }

  flush() {
    this.cache.clear();
  }
}

module.exports = new CacheService();
