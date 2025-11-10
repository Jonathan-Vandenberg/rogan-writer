# 🎙️ Audiobook Feature Quick Start

## For MacBook Pro Max (64GB) - Your Setup

Your M-series Mac cannot use Docker GPU. Run VibeVoice natively instead.

### ⚡ Quick Setup (5 minutes)

```bash
# Run automated setup script
./setup-vibevoice-macos.sh
```

This script will:
- ✅ Install dependencies (Python, FFmpeg)
- ✅ Clone and install VibeVoice
- ✅ Configure Metal acceleration
- ✅ Create start/stop/status scripts

### 🚀 Start VibeVoice

```bash
~/vibevoice/start-vibevoice.sh
```

**First run:** Downloads 7B model (~14GB, 10-20 minutes)

### ✅ Verify It's Working

```bash
# Check status
~/vibevoice/check-vibevoice.sh

# Or manually test
curl http://127.0.0.1:7860/health
```

### ⚙️ Configure Your App

Add to `.env`:

```bash
VIBEVOICE_ENDPOINT=http://127.0.0.1:7860

# Your existing S3 config
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=your-bucket
```

### 🎯 Use the Feature

1. **Start only Postgres in Docker:**
   ```bash
   docker compose up -d postgres
   ```

2. **Start VibeVoice natively:**
   ```bash
   ~/vibevoice/start-vibevoice.sh
   ```

3. **Start your Next.js app:**
   ```bash
   npm run dev
   ```

4. **Navigate to any book and generate audiobook!**

### 📊 Performance on Your Hardware

| Task | Expected Time |
|------|---------------|
| Model Load | ~3-5 minutes |
| Chapter Audio (5 min reading) | ~30-60 seconds |
| Memory Usage | ~12-16 GB |

Your 64GB M-series Max handles this perfectly! 🚀

### 🛠️ Management Commands

```bash
# Start
~/vibevoice/start-vibevoice.sh

# Stop
~/vibevoice/stop-vibevoice.sh

# Check status
~/vibevoice/check-vibevoice.sh

# View logs (if running in background)
tail -f ~/vibevoice/vibevoice.log
```

### 📚 Full Documentation

- **Detailed Setup:** `VIBEVOICE-MACOS.md`
- **API Usage:** `AUDIOBOOK-SETUP.md`
- **Docker (Linux):** `DOCKER-VIBEVOICE.md`

### 🔧 Troubleshooting

**Port already in use:**
```bash
lsof -i :7860
kill -9 <PID>
```

**Service not responding:**
```bash
# Stop and restart
~/vibevoice/stop-vibevoice.sh
~/vibevoice/start-vibevoice.sh
```

**Model download slow:**
Pre-download before starting:
```bash
python3 << EOF
from huggingface_hub import snapshot_download
snapshot_download("Jmica/VibeVoice7B")
EOF
```

### ⚡ Next Steps

1. ✅ Run `./setup-vibevoice-macos.sh`
2. ✅ Start VibeVoice service
3. ✅ Update `.env` with endpoint
4. ✅ Generate your first audiobook!

---

**Note:** Keep VibeVoice running while using the audiobook feature. It's a service that your app calls via HTTP.

