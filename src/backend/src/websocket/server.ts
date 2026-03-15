import { WebSocketServer as WS } from 'ws';

export class WebSocketHandler {
  private server: WS;

  constructor(server: WS) {
    this.server = server;
    this.setupHandlers();
  }

  start() {
    console.log(`WebSocket server listening on port ${this.server.options.port}`);
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.clients.forEach((client) => {
        try {
          client.close();
        } catch (error) {
          console.warn('Failed to close WebSocket client cleanly:', error);
        }
      });

      this.server.close(() => {
        resolve();
      });
    });
  }

  private setupHandlers() {
    this.server.on('connection', (ws) => {
      console.log('Client connected');
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
      });
    });
  }

  broadcastAgents(agents: any[]) {
    const message = JSON.stringify({
      type: 'AGENTS_UPDATE',
      data: agents,
    });
    
    this.server.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
    
    console.log(`Broadcasted ${agents.length} agent update(s)`);
  }

  broadcastTaskUpdate(projectId: string, task: any) {
    const message = JSON.stringify({
      type: 'TASK_UPDATE',
      projectId,
      task,
    });
    
    this.server.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    
    this.server.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
    
    console.log(`Broadcasted message: ${data.type}`);
  }
}
