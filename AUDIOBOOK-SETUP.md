# Audiobook Generation Integration

This document describes how to set up and use the VibeVoice TTS integration for generating audiobook narration from your book chapters.

## 📚 Overview

The audiobook feature allows you to:
- Generate high-quality AI narration for individual chapters or entire books
- Store audio files securely on AWS S3
- Play, download, and manage audiobook chapters
- Track generation status and progress
- Support multiple speaker voices

## 🔧 Prerequisites

### 1. AWS S3 Setup

You'll need an AWS account with S3 access:

1. Create an S3 bucket for storing audio files
2. Create an IAM user with S3 permissions
3. Generate access keys

Add these to your `.env` file:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
S3_BUCKET_NAME=your-audiobook-bucket
```

**Required S3 Permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::your-audiobook-bucket/*"
    }
  ]
}
```

### 2. VibeVoice Setup

VibeVoice is a frontier Text-to-Speech model that needs to be run locally or hosted.

#### Option A: Local Installation (Recommended for Development)

1. **Install Prerequisites:**
```bash
# Launch NVIDIA Docker (Required for GPU support)
sudo docker run --privileged --net=host --ipc=host \
  --ulimit memlock=-1:-1 --ulimit stack=-1:-1 \
  --gpus all --rm -it nvcr.io/nvidia/pytorch:24.07-py3
```

2. **Install VibeVoice:**
```bash
git clone https://github.com/JarodMica/VibeVoice.git
cd VibeVoice/
pip install -e .
apt update && apt install ffmpeg -y
```

3. **Start VibeVoice Service:**
```bash
# For 7B model (more stable, recommended)
python demo/gradio_demo.py --model_path Jmica/VibeVoice7B --server_port 7860

# Or for 1.5B model (faster, less GPU memory)
python demo/gradio_demo.py --model_path microsoft/VibeVoice-1.5B --server_port 7860
```

4. **Configure Endpoint:**
Add to your `.env`:
```bash
VIBEVOICE_ENDPOINT=http://localhost:7860
```

#### Option B: Hosted Deployment

If you're deploying VibeVoice on a separate server:

```bash
VIBEVOICE_ENDPOINT=https://your-vibevoice-server.com
```

## 📦 Installation

Dependencies are already installed if you followed the main setup. The required packages are:
- `@aws-sdk/client-s3` - AWS S3 SDK
- `@aws-sdk/s3-request-presigner` - S3 signed URL generation
- `axios` - HTTP client
- `form-data` - Multipart form data

## 🚀 Usage

### Frontend Integration

Add the AudiobookManager component to your book management page:

```typescript
import AudiobookManager from '@/components/audiobook-manager'

export default function BookPage({ bookId }: { bookId: string }) {
  return (
    <div>
      {/* Your other book components */}
      <AudiobookManager bookId={bookId} />
    </div>
  )
}
```

### API Endpoints

#### Generate Audio for Single Chapter
```bash
POST /api/books/{bookId}/chapters/{chapterId}/audio
```

#### Get Audio Status
```bash
GET /api/books/{bookId}/chapters/{chapterId}/audio
```

#### Delete Chapter Audio
```bash
DELETE /api/books/{bookId}/chapters/{chapterId}/audio
```

#### Generate Audiobook (All Chapters)
```bash
POST /api/books/{bookId}/audiobook/generate
```

#### Get Audiobook Status
```bash
GET /api/books/{bookId}/audiobook/generate
```

## 🎙️ Speaker Voices

VibeVoice supports multiple speaker voices. Default speakers:
- **Alice** (Default) - Female voice
- **Bob** - Male voice
- **Charlie** - Male voice
- **Diana** - Female voice

To change the speaker for a chapter, update the `speakerName` field in the database:

```sql
UPDATE chapters SET "speakerName" = 'Bob' WHERE id = 'chapter-id';
```

## 📊 Database Schema

The following fields were added to the `chapters` table:

| Field | Type | Description |
|-------|------|-------------|
| `audioUrl` | TEXT | Public S3 URL to audio file |
| `audioS3Key` | TEXT | S3 key for the audio file |
| `audioDuration` | FLOAT | Duration in seconds |
| `audioGenerated` | TIMESTAMP | When audio was generated |
| `audioStatus` | TEXT | Status: not_generated, generating, completed, failed |
| `audioError` | TEXT | Error message if generation failed |
| `speakerName` | TEXT | Voice/speaker name (default: Alice) |

## 🔍 Monitoring & Troubleshooting

### Check VibeVoice Health

```bash
curl http://localhost:7860/health
```

### Check Generation Status

The AudiobookManager component automatically polls for status updates every 5 seconds while chapters are generating.

### Common Issues

#### 1. VibeVoice Service Not Available
```
Error: VibeVoice service is not available
```
**Solution:** Ensure VibeVoice is running on the configured endpoint.

#### 2. S3 Upload Failures
```
Error: Failed to upload audio
```
**Solution:** Check AWS credentials and bucket permissions.

#### 3. Long Generation Times
- **Expected:** VibeVoice can take 1-5 minutes per chapter depending on:
  - Chapter length
  - Model size (7B vs 1.5B)
  - GPU performance
  - Server load

#### 4. Memory Issues
**Solution:** Use the 1.5B model if running out of GPU memory.

## 📈 Performance Optimization

### Batch Generation
The system automatically handles batch generation by processing chapters sequentially to avoid overwhelming the GPU.

### Caching
Generated audio files are stored permanently in S3 until manually deleted.

### Cost Optimization

**S3 Storage Costs:**
- Average chapter: 5-15 MB
- 100 chapters ≈ 0.5-1.5 GB
- S3 cost: ~$0.02-0.03/month

**Generation Costs:**
- Local: Free (uses your GPU)
- Hosted: Depends on your hosting provider

## 🔐 Security

### S3 Security
- Audio files use signed URLs with configurable expiration
- Default expiration: 24 hours
- URLs automatically regenerated on access

### Access Control
- All API endpoints require authentication
- Users can only access audio for their own books
- S3 bucket should be private (not public)

## 🎯 Best Practices

1. **Generate During Off-Hours:** Audio generation is GPU-intensive
2. **Use Batch Generation:** More efficient than generating one-by-one
3. **Monitor Storage:** Regularly review and delete unused audio
4. **Test Speaker Voices:** Different voices work better for different content
5. **Chunk Long Chapters:** Very long chapters (>10,000 words) may need to be split

## 🚨 Important Notes

### Content Policies
VibeVoice inherits biases from its training data. Review generated audio for:
- Pronunciation errors
- Inappropriate content
- Biased or problematic language

### Language Support
Currently supports:
- ✅ English (Primary)
- ✅ Chinese (Secondary)
- ❌ Other languages (unstable)

### Cross-Lingual Transfer
VibeVoice can preserve accents across languages, but results may be unstable. Use with caution.

## 📚 References

- [VibeVoice GitHub](https://github.com/JarodMica/VibeVoice)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [VibeVoice Technical Report](https://github.com/JarodMica/VibeVoice#readme)

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review VibeVoice logs in the Docker container
3. Check AWS CloudWatch for S3 errors
4. Ensure all environment variables are set correctly

## 🎉 Next Steps

1. Test generation with a single short chapter
2. Verify audio quality and speaker voice
3. Generate audiobook for entire book
4. Share or download completed audiobook

