require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/users', require('./routes/users'));

app.get('/', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

async function start() {
  if (MONGO_URI) {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');
  }
  app.listen(PORT, () => console.log(`Server on ${PORT}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
