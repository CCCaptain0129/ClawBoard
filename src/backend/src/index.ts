import { createApp, runInitialSyncs, startBackgroundServices, stopBackgroundServices } from './app/bootstrap';
import type { Socket } from 'net';

const { server, port, services } = createApp();
let pollingInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;
const sockets = new Set<Socket>();

console.log('🔒 Sync lock service initialized (timeout: 5000ms)');
console.log('📊 Progress orchestrator service initialized');

server.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => {
    sockets.delete(socket);
  });
});

server.listen(port, async () => {
  console.log(`✅ HTTP server listening on port ${port}`);
  await runInitialSyncs(services);
  pollingInterval = startBackgroundServices(services);
});

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error('❌ Graceful shutdown timed out, forcing exit');
    sockets.forEach((socket) => socket.destroy());
    process.exit(1);
  }, 5000);

  forceExitTimer.unref();

  try {
    await stopBackgroundServices(services, pollingInterval);

    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });

      sockets.forEach((socket) => socket.end());
      setTimeout(() => {
        sockets.forEach((socket) => socket.destroy());
      }, 1000).unref();
    });

    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
