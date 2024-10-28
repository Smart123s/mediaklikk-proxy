# Mediaklikk-Proxy

A simple node application that scrapes m3u8 files from https://mediaklikk.hu.
It also proxies the video stream, because the IP address of the requestor of the m3u8 file should match the one who requests the video/audio segments.

# Running

```bash
npm i
node index.js
```

# Building Docker image
```bash
docker build -t ghcr.io/smart123s/mediaklikk-proxy:latest .
```

# Running (docker compose)
todo
