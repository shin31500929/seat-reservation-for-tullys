import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { initSocket } from './socket.js';
import { startNotificationScheduler } from './notifyScheduler.js';

const server = createServer(app);
initSocket(server);
startNotificationScheduler();

server.listen(config.port, () => {
  console.log(`Backend listening on ${config.port}`);
});
