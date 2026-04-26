# Video Audio Downloader API

API yang powerful dan mudah digunakan untuk mengunduh video dan audio dari berbagai sumber platform secara otomatis.

## 📋 Daftar Isi

- [Fitur](#fitur)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Penggunaan](#penggunaan)
- [Dokumentasi API](#dokumentasi-api)
- [Konfigurasi](#konfigurasi)
- [Kontribusi](#kontribusi)
- [Lisensi](#lisensi)

## ✨ Fitur

- 🎥 **Download Video** - Unduh video dari YouTube, TikTok, Instagram, dan platform lainnya
- 🎵 **Download Audio** - Ekstrak dan unduh audio dari berbagai sumber
- ⚡ **High Performance** - API yang cepat dan responsif
- 🔄 **Queue System** - Sistem antrian untuk download multiple files
- 📊 **Progress Tracking** - Pantau progress download secara real-time
- 🛡️ **Error Handling** - Penanganan error yang robust
- 📝 **Logging** - Sistem logging yang komprehensif
- 🔐 **Security** - Rate limiting dan validasi input

## 📦 Prasyarat

Sebelum memulai, pastikan Anda memiliki:

- Node.js >= 14.0.0
- npm atau yarn
- ffmpeg (untuk konversi audio/video)

## 🚀 Instalasi

### Clone Repository

```bash
git clone https://github.com/MonMed26/video-audio-downloader-api.git
cd video-audio-downloader-api
```

### Install Dependencies

```bash
npm install
# atau
yarn install
```

### Install FFmpeg

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
choco install ffmpeg
```

## 💻 Penggunaan

### Start Server

```bash
npm start
# atau
npm run dev  # untuk development mode
```

Server akan berjalan di `http://localhost:3000`

### Basic API Request

```bash
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=...",
    "type": "video",
    "format": "mp4"
  }'
```

## 📚 Dokumentasi API

### Download Video

**Endpoint:** `POST /api/download`

**Request Body:**
```json
{
  "url": "string (required)",
  "type": "video|audio (required)",
  "format": "mp4|mkv|avi|mp3|wav (optional)",
  "quality": "highest|high|medium|low (optional)"
}
```

**Response:**
```json
{
  "status": "success",
  "downloadId": "unique_id",
  "filename": "video_name.mp4",
  "size": 1024000,
  "duration": "05:30"
}
```

### Get Status Download

**Endpoint:** `GET /api/download/:downloadId`

**Response:**
```json
{
  "downloadId": "unique_id",
  "status": "completed|downloading|failed",
  "progress": 95,
  "filename": "video_name.mp4"
}
```

### Supported Platforms

- YouTube
- TikTok
- Instagram
- Facebook
- Twitter
- Vimeo
- Dan banyak platform lainnya

## ⚙️ Konfigurasi

Buat file `.env` di root directory:

```env
# Server
PORT=3000
NODE_ENV=development

# Download Settings
DOWNLOAD_PATH=./downloads
MAX_CONCURRENT_DOWNLOADS=3
MAX_FILE_SIZE=5000

# API Settings
ENABLE_RATE_LIMITING=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=15

# Logging
LOG_LEVEL=info
```

## 🤝 Kontribusi

Kami menerima kontribusi dari komunitas! Untuk berkontribusi:

1. Fork repository ini
2. Buat branch feature Anda (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan Anda (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buka Pull Request

## 📄 Lisensi

Project ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail lebih lanjut.

## 📞 Support

Untuk pertanyaan dan support, silahkan:

- Buka [Issues](https://github.com/MonMed26/video-audio-downloader-api/issues)
- Hubungi tim development
- Baca [Discussion](https://github.com/MonMed26/video-audio-downloader-api/discussions)

---

**Dibuat oleh:** [MonMed26](https://github.com/MonMed26)  
**Update terakhir:** April 2026