import { createApp, runInitialSyncs, startBackgroundServices, stopBackgroundServices } from './app/bootstrap';

const { server, port, services } = createApp();
let pollingInterval: NodeJS.Timeout | null = null;

console.log('🔒 Sync lock service initialized (timeout: 5000ms)');
console.log('📊 Progress orchestrator service initialized');

server.listen(port, async () => {
  console.log(`✅ HTTP server listening on port ${port}`);
  await runInitialSyncs(services);
  pollingInterval = startBackgroundServices(services);
});

function shutdown(exitProcess: boolean = false): void {
  stopBackgroundServices(services, pollingInterval);
  server.close(() => {
    if (exitProcess) {
      process.exit(0);
    }
  });
}

process.on('SIGTERM', () => {
  shutdown(false);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  shutdown(true);
});
