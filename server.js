import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Cognicopia' });
});

// No endpoint accepts resident data: everything stays in the browser.

// Clean URLs for resource pages
const pageRoutes = [
  'about',
  'features',
  'faq',
  'profile',
  'therapy',
  'contact',
  'zentangle-art',
  'cognitive-journals',
  'life-planners',
  'clinical-alignment',
  'high-volume-facilities',
  'publishing-excellence',
  'institutional-standards',
  'resources'
];
pageRoutes.forEach(route => {
  app.get(`/${route}`, (req, res) => {
    const htmlPath = path.join(__dirname, `${route}.html`);
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.redirect('/');
    }
  });
});

// Serve static assets and root directory
app.use(express.static(__dirname, {
  extensions: ['html', 'htm']
}));

// Fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Cognicopia server running on http://${HOST}:${PORT}`);
});
