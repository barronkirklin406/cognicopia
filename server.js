import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Middleware for parsing JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic request logger for development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.endsWith('.html') || req.path === '/') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Cognicopia Dev Server', time: new Date().toISOString() });
});

// Custom middleware to handle clean URLs and URI-encoded filenames
app.use((req, res, next) => {
  try {
    const decodedPath = decodeURIComponent(req.path);
    const safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(__dirname, safePath);

    // If requesting directory root or exact directory, let express.static handle or serve index.html
    if (req.path === '/' || req.path === '') {
      return next();
    }

    // Check if the file exists directly (e.g. /Cognicopia Logo.jpg or assets)
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        return res.sendFile(fullPath);
      }
    }

    // Check if path with .html extension exists (clean URL: /builder -> /builder.html)
    const htmlPath = fullPath + '.html';
    if (fs.existsSync(htmlPath)) {
      const stat = fs.statSync(htmlPath);
      if (stat.isFile()) {
        return res.sendFile(htmlPath);
      }
    }
  } catch (err) {
    // If decoding or path resolution fails, fall through to static middleware
  }
  next();
});

// Serve static assets with standard options
app.use(express.static(__dirname, {
  extensions: ['html', 'htm'],
  index: 'index.html',
  dotfiles: 'ignore',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Fallback: 404 handler
app.use((req, res) => {
  const notFoundPath = path.join(__dirname, '404.html');
  if (fs.existsSync(notFoundPath)) {
    res.status(404).sendFile(notFoundPath);
  } else {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.status(200).sendFile(indexPath);
    } else {
      res.status(404).send('Page not found');
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Cognicopia server listening on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
