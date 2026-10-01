import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MODULES, moduleHref } from './scripts/site-nav.mjs';

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

// The reference pages live under /resources/<slug>/ (the Resource & Clinical Hub).
// Their old addresses answer with a permanent redirect, keeping any ?query;
// the browser keeps the #section. /resources itself is the hub.
for (const m of MODULES.filter(x => x.legacy)) {       // the Research Center is new: no old address
  const base = m.legacy.replace(/\.html$/, '');
  const paths = base === 'resources' ? [`/${m.legacy}`] : [`/${base}`, `/${m.legacy}`];
  app.get(paths, (req, res) => {
    const q = req.originalUrl.indexOf('?');
    res.redirect(301, '/' + moduleHref(m) + (q < 0 ? '' : req.originalUrl.slice(q)));
  });
}

// Clean URLs for the other pages
const pageRoutes = [
  'profile',
  'contact',
  'zentangle-art',
  'cognitive-journals',
  'life-planners'
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
