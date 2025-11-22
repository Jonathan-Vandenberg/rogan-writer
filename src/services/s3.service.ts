/**
 * AWS S3 Service for Audio and Image File Storage
 * Handles uploading, downloading, and managing audio files for audiobook generation
 * and images for brainstorming workspace
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface UploadAudioParams {
  audioBuffer: Buffer;
  bookId: string;
  chapterId: string;
  fileName: string;
  contentType?: string;
}

interface UploadImageParams {
  imageBuffer: Buffer;
  bookId: string;
  fileName: string;
  contentType?: string;
}

interface UploadCoverImageParams {
  imageBuffer: Buffer;
  bookId: string;
  fileName: string;
  contentType?: string;
}

interface S3AudioFile {
  s3Key: string;
  url: string;
  signedUrl: string;
  size: number;
}

interface S3ImageFile {
  s3Key: string;
  url: string;
  signedUrl: string;
  size: number;
}

export class S3Service {
  private client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.S3_BUCKET_NAME || '';

    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    console.log(`📦 S3 Service initialized - Bucket: ${this.bucketName}, Region: ${this.region}`);
  }

  /**
   * Upload audio file to S3
   */
  async uploadAudio(params: UploadAudioParams): Promise<S3AudioFile> {
    const { audioBuffer, bookId, chapterId, fileName, contentType = 'audio/mpeg' } = params;

    // Generate S3 key with organized folder structure
    const s3Key = `audiobooks/${bookId}/chapters/${chapterId}/${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: audioBuffer,
        ContentType: contentType,
        Metadata: {
          bookId,
          chapterId,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      // Generate public URL
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;

      // Generate signed URL (valid for 7 days)
      const signedUrl = await this.getSignedUrl(s3Key, 7 * 24 * 60 * 60);

      console.log(`✅ Audio uploaded to S3: ${s3Key}`);

      return {
        s3Key,
        url,
        signedUrl,
        size: audioBuffer.length,
      };
    } catch (error) {
      console.error('❌ Error uploading audio to S3:', error);
      throw new Error(`Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get signed URL for audio file (for private access)
   */
  async getSignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('❌ Error generating signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete audio file from S3
   */
  async deleteAudio(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.client.send(command);
      console.log(`🗑️  Audio deleted from S3: ${s3Key}`);
    } catch (error) {
      console.error('❌ Error deleting audio from S3:', error);
      throw new Error(`Failed to delete audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if audio file exists in S3
   */
  async audioExists(s3Key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.client.send(command);
      return true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return false;
    }
  }

  /**
   * Get audio file size
   */
  async getAudioSize(s3Key: string): Promise<number> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.client.send(command);
      return response.ContentLength || 0;
    } catch (error) {
      console.error('❌ Error getting audio size:', error);
      return 0;
    }
  }

  /**
   * Download audio file from S3 as buffer
   */
  async downloadAudio(s3Key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('❌ Error downloading audio from S3:', error);
      throw new Error(`Failed to download audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Alias for downloadAudio (for clarity in audiobook concatenation)
   */
  async getAudioBuffer(s3Key: string): Promise<Buffer> {
    return this.downloadAudio(s3Key);
  }

  /**
   * Upload image file to S3
   */
  async uploadImage(params: UploadImageParams): Promise<S3ImageFile> {
    const { imageBuffer, bookId, fileName, contentType = 'image/png' } = params;

    // Generate S3 key with organized folder structure
    const s3Key = `brainstorming/${bookId}/images/${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: contentType,
        Metadata: {
          bookId,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      // Generate public URL
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;

      // Generate signed URL (valid for 7 days)
      const signedUrl = await this.getSignedUrl(s3Key, 7 * 24 * 60 * 60);

      console.log(`✅ Image uploaded to S3: ${s3Key}`);

      return {
        s3Key,
        url,
        signedUrl,
        size: imageBuffer.length,
      };
    } catch (error) {
      console.error('❌ Error uploading image to S3:', error);
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload cover image file to S3
   */
  async uploadCoverImage(params: UploadCoverImageParams): Promise<S3ImageFile> {
    const { imageBuffer, bookId, fileName, contentType = 'image/png' } = params;

    // Generate S3 key with organized folder structure for cover images
    const s3Key = `covers/${bookId}/${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: contentType,
        Metadata: {
          bookId,
          uploadedAt: new Date().toISOString(),
          type: 'cover',
        },
      });

      await this.client.send(command);

      // Generate public URL
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;

      // Generate signed URL (valid for 7 days)
      const signedUrl = await this.getSignedUrl(s3Key, 7 * 24 * 60 * 60);

      console.log(`✅ Cover image uploaded to S3: ${s3Key}`);

      return {
        s3Key,
        url,
        signedUrl,
        size: imageBuffer.length,
      };
    } catch (error) {
      console.error('❌ Error uploading cover image to S3:', error);
      throw new Error(`Failed to upload cover image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete image file from S3
   */
  async deleteImage(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.client.send(command);
      console.log(`🗑️  Image deleted from S3: ${s3Key}`);
    } catch (error) {
      console.error('❌ Error deleting image from S3:', error);
      throw new Error(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const s3Service = new S3Service();

