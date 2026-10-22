if (!process.env.PORT || process.env.PORT === '8080') {
  process.env.PORT = '3000';
}
const { start } = require('./backend/src/server.js');

start().catch((error) => {
  console.error(JSON.stringify({ level: 'fatal', event: 'startup_failed', message: error.message }));
  process.exitCode = 1;
});
