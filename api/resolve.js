/**
 * Vercel Serverless: Twitch kanalından m3u8 URL çıkarır
 */
const twitch = require('twitch-m3u8');

function extractChannel(input) {
  const trimmed = (input || '').trim();
  const match = trimmed.match(/(?:twitch\.tv\/|^)([a-zA-Z0-9_]+)(?:\?|$|\/)/) || trimmed.match(/^([a-zA-Z0-9_]+)$/);
  return match ? match[1].toLowerCase() : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const input = req.query.url;
  if (!input) {
    return res.status(400).json({ error: 'url parametresi gerekli' });
  }

  const channel = extractChannel(decodeURIComponent(input));
  if (!channel) {
    return res.status(400).json({ error: 'Geçersiz Twitch linki. Örnek: twitch.tv/kanaladi' });
  }

  try {
    const streams = await twitch.getStream(channel);
    if (!streams || streams.length === 0) {
      return res.status(404).json({ error: 'Yayın bulunamadı veya kanal çevrimdışı' });
    }
    return res.status(200).json({ url: streams[0].url, channel, qualities: streams });
  } catch (err) {
    let errMsg = err.message || 'Akış alınamadı';
    if (errMsg.includes('offline') || errMsg.includes('Transcode')) {
      errMsg = 'Kanal çevrimdışı veya yayın yok. Canlı yayın açık bir kanal deneyin.';
    }
    return res.status(502).json({ error: errMsg });
  }
};
