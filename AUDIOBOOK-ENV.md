# 🎙️ Audiobook Environment Setup

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Dia TTS Service
DIA_TTS_ENDPOINT=http://127.0.0.1:7860

# AWS S3 for Audio Storage
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
```

---

## Setup Steps

### 1. Install Dia TTS

```bash
./setup-dia-macos.sh
```

### 2. Start Dia TTS Service

```bash
~/dia-tts/start-dia.sh
```

### 3. Verify Dia TTS is Running

```bash
~/dia-tts/check-dia.sh
```

Or visit: http://127.0.0.1:7860

### 4. Start Your Application

```bash
npm run dev
```

---

## Usage

1. Navigate to the **Write** page (`/write`)
2. Click the **Audiobook** button (speaker icon 🔊)
3. Click **"Generate Audiobook"** to create audio for all chapters
4. Listen to individual chapters or download the full audiobook

---

## Troubleshooting

### Dia TTS Not Responding
```bash
# Stop and restart
~/dia-tts/stop-dia.sh
~/dia-tts/start-dia.sh
```

### Check Logs
Dia TTS runs in foreground - check terminal output for errors.

### S3 Upload Errors
Verify AWS credentials in `.env.local`:
```bash
# Test AWS credentials
aws s3 ls s3://your-bucket-name/
```

---

## Performance Notes

- **Generation speed**: ~30s-2min per chapter (much faster than VibeVoice!)
- **Metal acceleration**: Enabled on M-series Macs
- **Model size**: 1.6B parameters (lightweight)
- **Quality**: Natural-sounding speech with proper intonation

---

## Stop Dia TTS

```bash
~/dia-tts/stop-dia.sh
```

Or press `Ctrl+C` in the terminal running Dia TTS.
