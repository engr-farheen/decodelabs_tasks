require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error('❌ Missing JWT_SECRET in environment. Copy .env.example to .env and set one.');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🧠 Synapse API running at http://localhost:${PORT}`);
  console.log(`📖 Interactive docs at   http://localhost:${PORT}/api-docs`);
});
