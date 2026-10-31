import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Serve static directory with html extension fallback
app.use(express.static(__dirname, {
  extensions: ['html', 'htm']
}));

// Fallback to index.html for unknown routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Cognicopia server running at http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

