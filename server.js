/**
 * Twitch HLS Stream Proxy
 * Twitch kanal linkinden stream URL'sini otomatik çıkarır,
 * CORS kısıtlamalarını aşarak m3u8 ve video segmentlerini proxy eder
 */

const http = require('http');
const https = require('https');
const url = require('url');
const twitch = require('twitch-m3u8');

const PORT = process.env.PORT || 3000;

// Twitch URL'den kanal adını çıkarır
function extractChannel(input) {
  const trimmed = input.trim();
  // twitch.tv/kanaladi veya https://www.twitch.tv/kanaladi
  const match = trimmed.match(/(?:twitch\.tv\/|^)([a-zA-Z0-9_]+)(?:\?|$|\/)/) || trimmed.match(/^([a-zA-Z0-9_]+)$/);
  return match ? match[1].toLowerCase() : null;
}

// Twitch stream fetch için gerekli header'lar
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.twitch.tv/',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const protocol = parsed.protocol === 'https:' ? https : http;
    
    const req = protocol.get(targetUrl, {
      headers: FETCH_HEADERS
    }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        resolve({ data: buffer, contentType: res.headers['content-type'] || 'application/octet-stream' });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function rewritePlaylist(baseUrl, content) {
  const base = baseUrl.replace(/\/[^/]*$/, '/');
  const lines = content.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (line.startsWith('#') || line === '') {
      result.push(line);
      continue;
    }
    
    // Göreli URL'i mutlak URL'e çevir
    const segmentUrl = line.startsWith('http') ? line : new URL(line, base).href;
    result.push(`/api/proxy?url=${encodeURIComponent(segmentUrl)}`);
  }
  
  return result.join('\n');
}

const server = http.createServer(async (req, res) => {
  // CORS headers - tüm isteklere
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
    const fs = require('fs');
    const path = require('path');
    const indexPath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Sunucu hatası');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // Twitch kanal linkinden m3u8 URL'sini otomatik çıkar
  if ((parsedUrl.pathname === '/resolve' || parsedUrl.pathname === '/api/resolve') && parsedUrl.query.url) {
    const input = decodeURIComponent(parsedUrl.query.url);
    const channel = extractChannel(input);
    
    if (!channel) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Geçersiz Twitch linki. Örnek: twitch.tv/kanaladi' }));
      return;
    }
    
    try {
      const streams = await twitch.getStream(channel);
      if (!streams || streams.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Yayın bulunamadı veya kanal çevrimdışı' }));
        return;
      }
      // En iyi kaliteyi al (genelde ilk sırada source)
      const bestUrl = streams[0].url;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: bestUrl, channel, qualities: streams }));
    } catch (err) {
      console.error('Resolve hatası:', err.message);
      let errMsg = err.message || 'Akış alınamadı';
      if (errMsg.includes('offline') || errMsg.includes('Transcode')) {
        errMsg = 'Kanal çevrimdışı veya yayın yok. Canlı yayın açık bir kanal deneyin.';
      }
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: errMsg }));
    }
    return;
  }

  if ((parsedUrl.pathname === '/proxy' || parsedUrl.pathname === '/api/proxy') && parsedUrl.query.url) {
    const targetUrl = decodeURIComponent(parsedUrl.query.url);
    
    try {
      const { data, contentType } = await fetchUrl(targetUrl);
      
      if (targetUrl.endsWith('.m3u8') || targetUrl.includes('.m3u8?')) {
        const text = data.toString('utf8');
        const rewritten = rewritePlaylist(targetUrl, text);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache'
        });
        res.end(rewritten);
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600'
        });
        res.end(data);
      }
    } catch (err) {
      console.error('Proxy hatası:', err.message);
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Akış alınamadı: ' + err.message);
    }
    return;
  }

  res.writeHead(404);
  res.end('Bulunamadı');
});

server.listen(PORT, () => {
  console.log(`\n🎬 Twitch Live Watch çalışıyor: http://localhost:${PORT}\n`);
});
