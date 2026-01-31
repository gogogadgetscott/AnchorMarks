/**
 * Request batching middleware
 * Batches multiple API requests to reduce network overhead
 */

class RequestBatcher {
  constructor(options = {}) {
    this.batchDelay = options.batchDelay || 50; // ms
    this.maxBatchSize = options.maxBatchSize || 10;
    this.pendingRequests = new Map();
    this.batchTimeout = null;
  }

  /**
   * Add a request to the batch queue
   */
  addRequest(req, res, next, handler) {
    const key = `${req.method}:${req.path}`;
    
    if (!this.pendingRequests.has(key)) {
      this.pendingRequests.set(key, []);
    }

    const batch = this.pendingRequests.get(key);
    batch.push({ req, res, next, handler });

    // If batch is full, process immediately
    if (batch.length >= this.maxBatchSize) {
      this.processBatch(key);
      return;
    }

    // Otherwise, schedule processing after delay
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatches();
    }, this.batchDelay);
  }

  /**
   * Process a specific batch
   */
  async processBatch(key) {
    const batch = this.pendingRequests.get(key);
    if (!batch || batch.length === 0) {
      return;
    }

    this.pendingRequests.delete(key);

    // Group by handler
    const handlerGroups = new Map();
    batch.forEach((item) => {
      const handlerKey = item.handler.name || 'default';
      if (!handlerGroups.has(handlerKey)) {
        handlerGroups.set(handlerKey, []);
      }
      handlerGroups.get(handlerKey).push(item);
    });

    // Process each handler group
    for (const [handlerKey, items] of handlerGroups) {
      try {
        // If handler supports batch processing, use it
        if (items[0].handler.batch) {
          await items[0].handler.batch(items.map((i) => i.req));
          items.forEach((item) => {
            item.res.json({ batched: true, count: items.length });
          });
        } else {
          // Otherwise, process individually but in parallel
          await Promise.all(
            items.map((item) =>
              Promise.resolve(item.handler(item.req, item.res, item.next)).catch(
                (err) => {
                  if (!item.res.headersSent) {
                    item.res.status(500).json({ error: err.message });
                  }
                }
              )
            )
          );
        }
      } catch (error) {
        items.forEach((item) => {
          if (!item.res.headersSent) {
            item.res.status(500).json({ error: error.message });
          }
        });
      }
    }
  }

  /**
   * Process all pending batches
   */
  processBatches() {
    const keys = Array.from(this.pendingRequests.keys());
    keys.forEach((key) => {
      this.processBatch(key);
    });
  }
}

// Create singleton instance
const batcher = new RequestBatcher({
  batchDelay: 50,
  maxBatchSize: 10,
});

/**
 * Middleware to enable request batching
 */
function batchMiddleware(handler) {
  return (req, res, next) => {
    // Only batch GET requests
    if (req.method !== 'GET') {
      return handler(req, res, next);
    }

    // Check if batching is enabled via header
    const enableBatching = req.headers['x-enable-batching'] === 'true';
    if (!enableBatching) {
      return handler(req, res, next);
    }

    batcher.addRequest(req, res, next, handler);
  };
}

module.exports = {
  batchMiddleware,
  RequestBatcher,
};
