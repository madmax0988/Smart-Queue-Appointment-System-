require('dotenv').config();
const http = require('http');
const app = require('./app');
const initSockets = require('./sockets');

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
initSockets(server);

server.listen(PORT, () => {
  console.log(`Smart Queue backend listening on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
