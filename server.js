require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests.' }
}));

app.use('/api/ai',        require('./routes/ai'));
app.use('/api/interview', require('./routes/interview'));
app.use('/api/admin',     require('./routes/admin'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
