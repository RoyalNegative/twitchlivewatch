# Twitch Live Watch

Reklamsız, dikkat dağıtmayan Twitch canlı yayın izleme arayüzü. Yayını HLS proxy üzerinden kendi sitenizde canlı izleyin.

## Özellikler

- Reklamsız izleme
- Minimal, odaklı arayüz (yan panel yok, küçülen pencere yok)
- HLS stream proxy ile CORS bypass
- Tam ekran desteği
- Düşük gecikme modu

## Kurulum

```bash
npm install
npm start
```

Tarayıcıda `http://localhost:3000` adresine gidin.

> **Port 3000 meşgulse:** `PORT=3001 npm start` ile farklı port kullanın. Windows'ta: `set PORT=3001 && npm start`

## Kullanım

Sadece Twitch yayın linkini yapıştırın. Örnek formatlar:

- `twitch.tv/kanaladi`
- `https://www.twitch.tv/kanaladi`
- `kanaladi`

Oynat'a tıkladığınızda uygulama Twitch GQL API üzerinden stream URL'sini otomatik çeker ve oynatır.

## Teknik Detaylar

- **Backend:** Node.js HTTP sunucusu, m3u8 ve video segmentlerini proxy eder
- **Frontend:** hls.js ile HLS oynatma
- **Twitch Referer:** İstekler `Referer: https://www.twitch.tv/` ile gönderilir
