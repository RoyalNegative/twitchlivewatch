/**
 * Vercel Serverless: HLS m3u8 ve video segmentlerini proxy eder
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.twitch.tv/',
  'Accept': '*/*',
};

function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const protocol = targetUrl.startsWith('https') ? https : http;
    const req = protocol.get(targetUrl, { headers: FETCH_HEADERS }, (res) => {
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve({
        data: Buffer.concat(data),
        contentType: res.headers['content-type'] || 'application/octet-stream'
      }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function rewritePlaylist(baseUrl, content, basePath) {
  const base = baseUrl.replace(/\/[^/]*$/, '/');
  const lines = content.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith('#') || line === '') {
      result.push(line);
      continue;
    }
    const segmentUrl = line.startsWith('http') ? line : new URL(line, base).href;
    result.push(`${basePath}?url=${encodeURIComponent(segmentUrl)}`);
  }
  return result.join('\n');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).end('url parametresi gerekli');
  }

  const decodedUrl = decodeURIComponent(targetUrl);
  // Vercel'de base path: /api/proxy
  const basePath = '/api/proxy';

  try {
    const { data, contentType } = await fetchUrl(decodedUrl);

    if (decodedUrl.endsWith('.m3u8') || decodedUrl.includes('.m3u8?')) {
      const text = data.toString('utf8');
      const rewritten = rewritePlaylist(decodedUrl, text, basePath);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).send(rewritten);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(data);
  } catch (err) {
    return res.status(502).send('Akış alınamadı: ' + err.message);
  }
};
