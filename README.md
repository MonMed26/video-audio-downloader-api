# video-audio-downloader-api

REST API untuk mengunduh **video** dan **audio** dari berbagai platform (YouTube, TikTok, Instagram, Facebook, X/Twitter, Twitch clip, dsb.) dengan kualitas terbaik. Dibangun di atas:

- **Node.js + Express + TypeScript**
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** sebagai mesin download multi-platform
- **ffmpeg** untuk merge video+audio dan konversi MP3

API men-download file di server, lalu mengembalikan **URL publik** yang bisa langsung dipakai untuk mengunduh hasilnya. File otomatis dihapus setelah TTL (default 60 menit).

---

## Fitur

- `GET  /api/info?url=...` — metadata video (judul, durasi, thumbnail, daftar format).
- `POST /api/download` — download video / audio kualitas terbaik, return URL publik.
- `GET  /files/:filename` — serve file hasil download (dipanggil otomatis lewat `downloadUrl` di response).
- `GET  /health` & `GET /health/deps` — health check + cek binary yt-dlp.
- Auto cleanup file expired tiap 5 menit.
- Rate limiting per IP.
- Proteksi opsional via `x-api-key` header.
- Hardening dasar: helmet, CORS, anti-SSRF (block private/local hostnames), path-traversal guard.

---

## Persyaratan

- Node.js **18.17+** (rekomendasi 20 LTS).
- **yt-dlp** terinstall dan ada di `$PATH` (atau set `YTDLP_PATH`).
- **ffmpeg** terinstall dan ada di `$PATH` (atau set `FFMPEG_PATH`). Diperlukan untuk:
  - Merge stream video + audio terpisah menjadi MP4.
  - Ekstraksi MP3 dari audio.

### Install yt-dlp & ffmpeg

**Ubuntu / Debian VPS:**

```bash
sudo apt update
sudo apt install -y ffmpeg python3 python3-pip
# Install yt-dlp via pip (selalu versi terbaru, penting!)
sudo pip3 install --upgrade yt-dlp
# Verifikasi
yt-dlp --version
ffmpeg -version
```

> yt-dlp sering update karena situs sumber sering berubah. Jadwalkan auto-update mingguan:
> `0 3 * * 0 root pip3 install --upgrade yt-dlp`

**macOS (lokal):**

```bash
brew install yt-dlp ffmpeg
```

**Windows (lokal, lewat winget):**

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

Setelah install, **tutup & buka ulang terminal** supaya `PATH` ter-refresh, lalu verifikasi:

```bash
yt-dlp --version
ffmpeg -version
```

> Kalau pakai Git Bash/MINGW dan ffmpeg/yt-dlp tidak ketemu di `PATH`, set lokasinya secara eksplisit di `.env`:
> ```
> YTDLP_PATH=C:/Users/<user>/AppData/Local/Microsoft/WinGet/Packages/yt-dlp.yt-dlp_.../yt-dlp.exe
> FFMPEG_PATH=C:/ffmpeg/bin/ffmpeg.exe
> ```
> Atau download binary ffmpeg dari https://www.gyan.dev/ffmpeg/builds/ (release essentials), ekstrak ke `C:\ffmpeg`, lalu tambahkan `C:\ffmpeg\bin` ke system PATH.

### Verifikasi server bisa menemukan binary

Cek endpoint `/health/deps` setelah server jalan:

```bash
curl http://localhost:3000/health/deps
# → {"ok":true,"ytdlp":{"ok":true,"version":"..."},"ffmpeg":{"ok":true,"version":"..."}}
```

Jika `ok: false`, lihat field `error` untuk diagnosa.

---

## Setup Lokal

```bash
git clone https://github.com/MonMed26/video-audio-downloader-api.git
cd video-audio-downloader-api
cp .env.example .env
npm install
npm run dev
```

Server jalan di `http://localhost:3000`.

### Build production

```bash
npm run build
npm start
```

---

## Konfigurasi (`.env`)

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `HOST` | `0.0.0.0` | Bind address |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | Base URL yang dipakai membentuk `downloadUrl` di response. **Wajib di-set ke domain publik / IP VPS** untuk produksi. |
| `DOWNLOAD_DIR` | `./downloads` | Lokasi penyimpanan file hasil download |
| `FILE_TTL_MINUTES` | `60` | Berapa lama file disimpan sebelum dihapus |
| `MAX_FILE_SIZE_MB` | `2048` | Batas ukuran maksimum file (anti-abuse) |
| `YTDLP_PATH` | `yt-dlp` | Path binary yt-dlp |
| `FFMPEG_PATH` | `ffmpeg` | Path binary ffmpeg |
| `RATE_LIMIT_WINDOW_MINUTES` | `15` | Window rate limit |
| `RATE_LIMIT_MAX` | `60` | Maksimum request per window per IP |
| `API_KEY` | _(kosong)_ | Jika di-set, semua endpoint `/api/*` butuh header `x-api-key: <value>` |

---

## API Reference

### `GET /api/info`

Ambil metadata + daftar format yang tersedia.

**Query:**

- `url` (string, required) — URL video sumber.

**Response 200:**

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "uploader": "Rick Astley",
  "duration": 213,
  "thumbnail": "https://i.ytimg.com/vi/.../hqdefault.jpg",
  "source": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "extractor": "youtube",
  "formats": [
    { "format_id": "137", "ext": "mp4", "resolution": "1080p", "height": 1080, "fps": 30, "vcodec": "avc1.640028", "acodec": "none", "filesize": 47123456 },
    ...
  ]
}
```

### `POST /api/download`

Download video atau audio kualitas terbaik. Server akan:

1. Pilih `bestvideo*+bestaudio` (untuk video) atau `bestaudio` lalu konversi ke MP3 320kbps (untuk audio).
2. Merge dengan ffmpeg ke MP4 (untuk video).
3. Simpan ke `DOWNLOAD_DIR` dan return URL publik.

**Body (JSON):**

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "type": "video"   // "video" | "audio" — default "video"
}
```

**Response 200:**

```json
{
  "id": "V1StGXR8_Z5j",
  "type": "video",
  "filename": "V1StGXR8_Z5j.mp4",
  "size": 41234567,
  "downloadUrl": "https://downloader.example.com/files/V1StGXR8_Z5j.mp4",
  "expiresAt": "2026-04-26T08:46:53.000Z"
}
```

### `GET /files/:filename`

Serve file hasil download (dipanggil lewat `downloadUrl`). Mengembalikan `404` jika file sudah expired/dihapus.

### `GET /health` / `GET /health/deps`

Health check. `/health/deps` juga memverifikasi binary yt-dlp aktif.

---

## Contoh `curl`

```bash
# Info
curl "http://localhost:3000/api/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Download video
curl -X POST http://localhost:3000/api/download \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","type":"video"}'

# Download audio (MP3 320kbps)
curl -X POST http://localhost:3000/api/download \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","type":"audio"}'
```

Lalu `wget` / `curl` URL yang dikembalikan di field `downloadUrl`.

---

## Deploy ke VPS Linux (Ubuntu 22.04+)

### 1. Siapkan dependensi sistem

```bash
sudo apt update
sudo apt install -y nodejs npm ffmpeg python3-pip nginx
sudo pip3 install --upgrade yt-dlp
```

> Untuk Node.js terbaru, gunakan [NodeSource](https://github.com/nodesource/distributions):
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
> sudo apt install -y nodejs
> ```

### 2. Deploy aplikasi

```bash
sudo useradd -m -s /bin/bash downloader
sudo -u downloader bash <<'EOF'
cd ~
git clone https://github.com/MonMed26/video-audio-downloader-api.git
cd video-audio-downloader-api
cp .env.example .env
# edit .env — set PUBLIC_BASE_URL ke https://downloader.example.com
npm ci
npm run build
EOF
```

### 3. systemd service

`/etc/systemd/system/downloader-api.service`:

```ini
[Unit]
Description=Video & Audio Downloader API
After=network.target

[Service]
Type=simple
User=downloader
WorkingDirectory=/home/downloader/video-audio-downloader-api
EnvironmentFile=/home/downloader/video-audio-downloader-api/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now downloader-api
sudo systemctl status downloader-api
```

### 4. Nginx reverse proxy + HTTPS

`/etc/nginx/sites-available/downloader-api`:

```nginx
server {
    listen 80;
    server_name downloader.example.com;

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/downloader-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d downloader.example.com   # HTTPS via Let's Encrypt
```

Setelah HTTPS aktif, ubah `PUBLIC_BASE_URL=https://downloader.example.com` di `.env` lalu `sudo systemctl restart downloader-api`.

---

## Catatan & Limitasi

- **YouTube** kadang memerlukan cookies untuk video age-restricted/private. Anda bisa menyiapkan file `cookies.txt` lalu tambahkan flag `--cookies` di `src/services/ytdlp.ts` jika diperlukan.
- **Hak cipta**: Anda bertanggung jawab memastikan konten yang diunduh tidak melanggar hak cipta / ToS platform sumber. API ini tidak ditujukan untuk pembajakan.
- yt-dlp wajib di-update rutin karena situs sumber sering berubah signature/format-nya.
- Default rate limit cukup ketat (60 req / 15 menit / IP). Sesuaikan via `.env`.

---

## Lisensi

MIT
