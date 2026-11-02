# Deployment and infrastructure: rollouts and shutdown

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 4 - Zero-Downtime Deployment & Graceful Shutdown

During rolling deployments or autoscaling, load balancers continuously terminate old containers and route traffic to new ones. Without graceful shutdown handling, active client requests are abruptly aborted with `502 Bad Gateway` or `Connection Reset`.

### 4.1 Container Lifecycle Events

```
1. Orchestrator (K8s/ECS) sends SIGTERM to the application container.
2. Load Balancer deregisters container from routing pool (stops sending NEW requests).
3. Application enters SHUTTING_DOWN state.
4. Liveness probe continues returning 200 OK (process is still alive).
5. Readiness probe immediately returns 503 Service Unavailable (signals not to route traffic).
6. Application completes all currently in-flight requests (up to 30-second timeout).
7. Application closes DB pools, Redis connections, and message consumers.
8. Process exits cleanly with code 0.
```

### 4.2 Production Graceful Shutdown Implementation (Node.js)

```typescript
// src/server.ts
import { createServer } from 'node:http';
import { app } from './app';
import { dbPool } from './infrastructure/db';
import { redisClient } from './infrastructure/cache/redis';
import { logger } from './infrastructure/logging/logger';

const server = createServer(app);
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Application server successfully started');
});

// Flag indicating shutdown state
let isShuttingDown = false;

// Liveness & Readiness endpoints
app.get('/healthz/live', (req, res) => {
  // Liveness: Process is alive and responding
  res.status(200).json({ status: 'live' });
});

app.get('/healthz/ready', async (req, res) => {
  // Readiness: Ready to process traffic (fails if shutting down or DB disconnected)
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down' });
  }

  try {
    // Ping database
    await dbPool.query('SELECT 1');
    return res.status(200).json({ status: 'ready' });
  } catch (error) {
    return res.status(503).json({ status: 'unhealthy', error: 'Database unreachable' });
  }
});

// Signals handler
const handleSignal = (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received. Initiating graceful shutdown sequence...');
  isShuttingDown = true;

  // Set 25-second emergency force-kill timeout (orchestrator kill timeout is usually 30s)
  const forceKillTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 25000);
  forceKillTimer.unref();

  // 1. Stop receiving new HTTP requests
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error closing HTTP server');
      process.exit(1);
    }
    logger.info('HTTP server closed. In-flight requests drained.');

    // 2. Close external connections cleanly
    try {
      await dbPool.end();
      logger.info('Database pool drained and disconnected.');

      await redisClient.quit();
      logger.info('Redis client disconnected.');

      logger.info('Graceful shutdown complete. Exiting cleanly.');
      process.exit(0);
    } catch (cleanupErr) {
      logger.error({ cleanupErr }, 'Error during resource disconnection');
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGINT', () => handleSignal('SIGINT'));
```

---
