// src/config/redis.js
const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.error('❌ Redis Client Error:', err));
client.on('connect', () => console.log('✅ Conectado a Redis'));

(async () => {
  await client.connect();
})();

module.exports = client;