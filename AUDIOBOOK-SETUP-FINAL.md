# 🎙️ Audiobook Setup - OpenAI TTS

## ✅ **Simple Setup** (No local models needed!)

### 1. Add OpenAI API Key

Add to your `.env.local`:

```bash
OPENAI_API_KEY=sk-proj-...your-key-here...
```

Get your key from: https://platform.openai.com/api-keys

### 2. Install ffmpeg (for audio concatenation)

```bash
# macOS
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### 3. Restart Dev Server

```bash
npm run dev
```

---

## 💰 **Pricing**

- **Model**: `tts-1` (cheapest)
- **Cost**: $0.015 per 1,000 characters
- **Average Chapter** (5,000 chars): ~$0.075
- **Full Book** (100,000 chars): ~$1.50

**Example Cost Breakdown:**
- Short chapter (2,000 chars): $0.03
- Medium chapter (5,000 chars): $0.075
- Long chapter (10,000 chars): $0.15

---

## 🚀 **How It Works**

1. **Automatic Chunking**: Long chapters split into ~3,000 char chunks
2. **Parallel Generation**: Each chunk converted to speech
3. **Audio Concatenation**: Chunks merged into single MP3 file
4. **S3 Upload**: Final audio stored in your S3 bucket
5. **Seamless Playback**: Single audio file per chapter

---

## 🎯 **Features**

✅ **Handles any chapter length** - Automatic chunking  
✅ **Fast generation** - ~10-30 seconds per chapter  
✅ **High quality** - Natural-sounding speech  
✅ **Single audio file** - No playlist complexity  
✅ **Cost logging** - See estimated cost before generation  
✅ **No local setup** - Uses OpenAI cloud API  

---

## 📋 **Usage**

1. Go to `/write` page
2. Click **"Audiobook"** button
3. Click **"Generate Audiobook"**
4. Wait for generation (status updates automatically)
5. Play or download audio

---

## 🔧 **Configuration**

### Available Voices

Edit `src/app/api/books/[bookId]/chapters/[chapterId]/audio/route.ts`:

```typescript
voice: 'alloy'  // Options: alloy, echo, fable, onyx, nova, shimmer
```

### Use HD Model (2x cost, better quality)

```typescript
model: 'tts-1-hd'  // $0.030 per 1K chars (instead of $0.015)
```

---

## ⚠️ **Requirements**

- ✅ OpenAI API key
- ✅ `ffmpeg` installed
- ✅ AWS S3 configured (for storage)
- ✅ Sufficient OpenAI credits

---

## 🐛 **Troubleshooting**

### "OpenAI TTS service is not available"
- Check `OPENAI_API_KEY` is set in `.env.local`
- Restart dev server

### "ffmpeg: command not found"
```bash
brew install ffmpeg
```

### "insufficient_quota" error
- Add credits to your OpenAI account
- Check: https://platform.openai.com/settings/organization/billing

---

## 📊 **Cost Estimation**

The system logs estimated cost before generation:

```
💰 Estimated cost: $0.0750
```

Track your usage: https://platform.openai.com/usage

---

**All set! No Dia, no VibeVoice, no local models - just fast, reliable TTS!** 🎉

