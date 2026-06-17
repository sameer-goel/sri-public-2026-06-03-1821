#!/usr/bin/env node
// ============================================
// Om Sacred Space - tiny Node server
// --------------------------------------------
// Serves the static site AND a single dynamic endpoint that creates a Stripe
// Checkout Session for the Group Sound Bath at the exact group size, applying
// volume (tiered) per-person pricing. Checkout Sessions support the exact-
// amount line item we need (Payment Links can't do tiered one-time pricing).
//
// No framework, no SDK - Node built-ins + the Stripe REST API.
//
// RUN
//   node --env-file=.env checkout/server.js                 (live by default)
//   OSS_CHECKOUT_MODE=test node --env-file=.env checkout/server.js   (sandbox)
//   PORT=8787 ... to change port (default 8787)
//
// ENV
//   STRIPE_SECRET_KEY_TEST / STRIPE_SECRET_KEY_LIVE  (per-mode keys)
//   OSS_CHECKOUT_MODE = test | live                  (default: live)
//   OSS_PUBLIC_URL = https://omsacredspace.com       (for success/cancel URLs)
// ============================================
'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const Pay = require('./checkout-core.js');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8787;

// --- Stripe key / mode resolution -----------------------------------------
const TEST_KEY = process.env.STRIPE_SECRET_KEY_TEST || '';
const LIVE_KEY = process.env.STRIPE_SECRET_KEY_LIVE || '';

function resolveMode() {
  const m = String(process.env.OSS_CHECKOUT_MODE || '').toLowerCase();
  if (m === 'test' || m === 'live') return m;
  if (TEST_KEY && !LIVE_KEY) return 'test';
  if (LIVE_KEY && !TEST_KEY) return 'live';
  return 'live'; // matches catalog DEFAULT_MODE
}
const MODE = resolveMode();
const STRIPE_KEY = MODE === 'test' ? TEST_KEY : LIVE_KEY;

// --- static file serving ----------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = path.normalize(path.join(root, decoded));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null; // traversal guard
  return resolved;
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = safeJoin(ROOT, urlPath);
  if (!filePath) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) { filePath = path.join(filePath, 'index.html'); }
    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        // SPA-style fallback to the custom 404 page if present.
        fs.readFile(path.join(ROOT, '404.html'), (e3, page) => {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(e3 ? 'Not found' : page);
        });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

// --- Stripe REST helper -----------------------------------------------------
function stripePost(apiPath, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const req = https.request('https://api.stripe.com' + apiPath, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        let j = {};
        try { j = JSON.parse(d); } catch (e) { /* ignore */ }
        resolve({ status: r.statusCode, json: j });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function originFor(req) {
  if (process.env.OSS_PUBLIC_URL) return process.env.OSS_PUBLIC_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return proto + '://' + host;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

// --- POST /api/sound-bath/checkout -----------------------------------------
async function handleSoundBathCheckout(req, res) {
  if (!STRIPE_KEY) { sendJson(res, 500, { error: 'Payments are not configured.' }); return; }

  let raw = '';
  req.on('data', (c) => {
    raw += c;
    if (raw.length > 1e4) req.destroy(); // basic flood guard
  });
  req.on('end', async () => {
    let payload = {};
    try { payload = JSON.parse(raw || '{}'); } catch (e) { sendJson(res, 400, { error: 'Invalid request.' }); return; }

    const productId = payload.productId || 'inperson-sound-bath';
    const product = Pay.getProduct(productId);
    if (!product || !product.variableQty) { sendJson(res, 400, { error: 'Unknown product.' }); return; }

    const check = Pay.validateQuantity(product, payload.people);
    if (!check.valid) { sendJson(res, 400, { error: check.error }); return; }

    const line = Pay.computeTieredLineItem(product, check.value);
    const people = line.quantity;
    const origin = originFor(req);

    const params = {
      'mode': 'payment',
      'line_items[0][price_data][currency]': product.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(line.unitMinor),
      'line_items[0][price_data][product_data][name]': product.name + ' (' + people + ' people)',
      'line_items[0][price_data][product_data][description]': 'In-person group sound bath \u00B7 ' + Pay.formatPrice(line.unitMinor, product.currency) + ' per person',
      'line_items[0][quantity]': String(people),
      'success_url': origin + '/sound-healing.html?booked=soundbath#soundbath',
      'cancel_url': origin + '/sound-healing.html#soundbath',
      'metadata[product_id]': product.id,
      'metadata[people]': String(people),
      'metadata[unit_minor]': String(line.unitMinor)
    };

    try {
      const result = await stripePost('/v1/checkout/sessions', params);
      if (result.status === 200 && result.json.url) {
        sendJson(res, 200, { url: result.json.url, mode: MODE });
      } else {
        sendJson(res, 502, { error: (result.json.error && result.json.error.message) || 'Could not start checkout.' });
      }
    } catch (e) {
      sendJson(res, 502, { error: 'Could not reach payment provider.' });
    }
  });
}

// --- router -----------------------------------------------------------------
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (req.method === 'POST' && urlPath === '/api/sound-bath/checkout') {
    return handleSoundBathCheckout(req, res);
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }
  res.writeHead(405, { 'Allow': 'GET, POST' });
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log('Om Sacred Space server running: http://127.0.0.1:' + PORT + '  (Stripe mode: ' + MODE + (STRIPE_KEY ? '' : ' - NO KEY') + ')');
});
