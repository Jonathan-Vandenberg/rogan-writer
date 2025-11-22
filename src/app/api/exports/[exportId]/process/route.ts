import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ExportService } from '@/services'
import { BookService } from '@/services'
import { s3Service } from '@/services/s3.service'
import puppeteer from 'puppeteer'

// Detect if we're in a serverless environment (Vercel, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ exportId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { exportId } = await params
    const exportRequest = await ExportService.getExportById(exportId)
    
    if (!exportRequest) {
      return NextResponse.json({ error: 'Export not found' }, { status: 404 })
    }

    if (exportRequest.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get book data
    const book = await BookService.getBookById(exportRequest.bookId)
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    try {
      const fileName = exportRequest.fileName
      
      // Validate book has chapters
      if (!book.chapters || book.chapters.length === 0) {
        throw new Error('Book has no chapters to export')
      }

      // Validate chapters have content
      const chaptersWithContent = book.chapters.filter((ch: any) => ch.content && ch.content.trim().length > 0)
      if (chaptersWithContent.length === 0) {
        throw new Error('Book chapters have no content to export')
      }
      
      // Generate content based on format
      let fileBuffer: Buffer | string
      let shouldSendToKindle = false
      let kindleEmail: string | undefined

      switch (exportRequest.format) {
        case 'PDF':
          fileBuffer = await generatePDF(book, exportRequest.settings)
          break
          
        case 'EPUB':
          fileBuffer = await generateEPUB(book, exportRequest.settings)
          break

        case 'MOBI':
          fileBuffer = await generateMOBI(book, exportRequest.settings)
          break

        case 'KINDLE':
          // Generate MOBI file for Kindle
          fileBuffer = await generateMOBI(book, exportRequest.settings)
          kindleEmail = (exportRequest.settings as any)?.kindleEmail as string | undefined
          shouldSendToKindle = !!kindleEmail
          break
          
        case 'TXT':
        default:
          fileBuffer = generateTXT(book, exportRequest.settings)
          break
      }

      // Convert string buffer to Buffer if needed
      const bufferToUpload = typeof fileBuffer === 'string' 
        ? Buffer.from(fileBuffer, 'utf-8')
        : fileBuffer

      // Upload to S3
      console.log(`📤 Uploading ${exportRequest.format} export to S3...`)
      const s3Result = await s3Service.uploadExport({
        fileBuffer: bufferToUpload,
        bookId: exportRequest.bookId,
        exportId: exportId,
        fileName: fileName,
        format: exportRequest.format,
      })
      
      console.log(`✅ Export uploaded to S3: ${s3Result.s3Key}`)

      // Send to Kindle if requested (download from S3 first)
      if (shouldSendToKindle && kindleEmail) {
        try {
          // Download file from S3 to send via email
          const fileBufferForEmail = await s3Service.downloadFile(s3Result.s3Key)
          const tmpFilePath = `/tmp/${fileName}`
          const fs = await import('fs/promises')
          await fs.writeFile(tmpFilePath, fileBufferForEmail)
          
          await sendToKindle(tmpFilePath, fileName, kindleEmail, book.title)
          console.log(`📧 Sent ${fileName} to Kindle: ${kindleEmail}`)
          
          // Clean up tmp file
          try {
            await fs.unlink(tmpFilePath)
          } catch (cleanupError) {
            console.warn('Could not clean up tmp file:', cleanupError)
          }
        } catch (error) {
          console.error('Error sending to Kindle:', error)
          // Don't fail the export if email fails - file is still generated
        }
      }

      // Generate download URL with proper content type
      const contentTypes: Record<string, string> = {
        'PDF': 'application/pdf',
        'EPUB': 'application/epub+zip',
        'MOBI': 'application/x-mobipocket-ebook',
        'KINDLE': 'application/x-mobipocket-ebook',
        'TXT': 'text/plain',
        'HTML': 'text/html',
      }
      const contentType = contentTypes[exportRequest.format.toUpperCase()] || 'application/octet-stream'
      
      // Generate signed download URL (valid for 7 days)
      const downloadUrl = await s3Service.getExportDownloadUrl(
        s3Result.s3Key,
        fileName,
        contentType,
        7 * 24 * 60 * 60 // 7 days
      )

      // Update export with download URL (signed S3 URL)
      await ExportService.updateExportStatus(exportId, 'COMPLETED', downloadUrl)

      return NextResponse.json({ 
        success: true, 
        fileUrl: downloadUrl, 
        message: shouldSendToKindle 
          ? 'Export completed and sent to Kindle!' 
          : 'Export completed successfully' 
      })

    } catch (error) {
      console.error('File generation error:', error)
      const errorMessage = error instanceof Error ? error.message : 'File generation failed'
      console.error('Error details:', {
        exportId,
        format: exportRequest.format,
        bookId: exportRequest.bookId,
        bookTitle: book?.title,
        chaptersCount: book?.chapters?.length || 0,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      })
      await ExportService.updateExportStatus(exportId, 'FAILED')
      return NextResponse.json({ 
        error: 'File generation failed',
        details: errorMessage 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error processing export:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to convert margin string to valid Puppeteer margin value
function parseMargin(margin: string | undefined): string {
  if (!margin) return '1in'
  
  // Convert common margin presets to valid values
  const marginMap: Record<string, string> = {
    'standard': '1in',
    'narrow': '0.5in',
    'wide': '1.5in',
    'none': '0'
  }
  
  // If it's a preset, return the mapped value
  if (marginMap[margin.toLowerCase()]) {
    return marginMap[margin.toLowerCase()]
  }
  
  // If it already has units (in, cm, mm, px), return as-is
  if (/^\d+(\.\d+)?(in|cm|mm|px)$/i.test(margin)) {
    return margin
  }
  
  // If it's just a number, assume inches
  if (/^\d+(\.\d+)?$/.test(margin)) {
    return `${margin}in`
  }
  
  // Default to 1in if we can't parse it
  return '1in'
}

async function generatePDF(book: any, settings: any): Promise<Buffer> {
  if (!book.chapters || book.chapters.length === 0) {
    throw new Error('No chapters found in book')
  }
  
  // Configure Puppeteer for serverless environments
  const launchOptions: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // Important for serverless
      '--disable-gpu'
    ]
  }
  
  // In serverless/production, try to use bundled Chrome or system Chrome
  if (isServerless) {
    // Try to use Chromium from @sparticuz/chromium if available
    try {
      // Use eval to avoid TypeScript errors for optional dependency
      const chromiumModule = await eval('import("@sparticuz/chromium")').catch(() => null) as any
      if (chromiumModule && chromiumModule.default) {
        const chromium = chromiumModule.default
        if (typeof chromium.setGraphicsMode === 'function') {
          chromium.setGraphicsMode(false) // Disable graphics for serverless
        }
        if (typeof chromium.executablePath === 'function') {
          launchOptions.executablePath = await chromium.executablePath()
          console.log('✅ Using @sparticuz/chromium for PDF generation')
        }
      }
    } catch (chromiumError) {
      console.warn('⚠️ @sparticuz/chromium not available, trying system Chrome:', chromiumError)
      // Fall back to system Chrome or puppeteer's bundled Chrome
      // Puppeteer should handle this, but we may need to install Chrome separately
      // In Vercel, you may need to install Chrome via build command or use puppeteer-core
    }
  }
  
  const browser = await puppeteer.launch(launchOptions)
  
  try {
    const page = await browser.newPage()
    
    const html = generateHTML(book, settings)
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    // Wait for images to load, especially the cover image
    if (settings?.includeCover && book.coverImageUrl) {
      await page.evaluate(() => {
        return Promise.all(
          Array.from(document.images).map(img => {
            if (img.complete) return Promise.resolve()
            return new Promise((resolve, reject) => {
              img.onload = resolve
              img.onerror = reject
              // Timeout after 5 seconds
              setTimeout(() => reject(new Error('Image load timeout')), 5000)
            })
          })
        )
      }).catch(err => {
        console.warn('Some images failed to load:', err)
        // Continue anyway
      })
    }
    
    const marginValue = parseMargin(settings?.margins)
    
    const pdfBuffer = await page.pdf({
      format: settings?.paperSize || 'letter',
      margin: {
        top: marginValue,
        right: marginValue,
        bottom: marginValue,
        left: marginValue
      },
      printBackground: true,
      preferCSSPageSize: true
    })
    
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

function generateTXT(book: any, settings: any): string {
  if (!book.chapters || book.chapters.length === 0) {
    throw new Error('No chapters found in book')
  }
  const chapters = book.chapters.sort((a: any, b: any) => a.orderIndex - b.orderIndex)
  
  let content = ''
  
  // Add title page if cover is included
  if (settings?.includeCover) {
    content += `${book.title}\n`
    if (book.description) {
      content += `\n${book.description}\n`
    }
    content += `\n${'='.repeat(50)}\n\n`
  }
  
  // Add table of contents if enabled
  if (settings?.includeTableOfContents && chapters.length > 0) {
    content += `TABLE OF CONTENTS\n\n`
    chapters.forEach((chapter: any, index: number) => {
      content += `${settings?.includeChapterNumbers ? `${index + 1}. ` : ''}${chapter.title}\n`
    })
    content += `\n${'='.repeat(50)}\n\n`
  }
  
  // Add chapters
  chapters.forEach((chapter: any, index: number) => {
    if (settings?.includeChapterNumbers) {
      content += `Chapter ${index + 1}: ${chapter.title}\n\n`
    } else {
      content += `${chapter.title}\n\n`
    }
    
    content += `${chapter.content || ''}\n\n`
    
    if (index < chapters.length - 1) {
      content += `${'='.repeat(30)}\n\n`
    }
  })
  
  return content
}

function generateHTML(book: any, settings: any): string {
  if (!book.chapters || book.chapters.length === 0) {
    throw new Error('No chapters found in book')
  }
  const chapters = book.chapters.sort((a: any, b: any) => a.orderIndex - b.orderIndex)
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${book.title}</title>
    <style>
        @page {
            margin: ${settings?.margins || '1in'};
            size: ${settings?.paperSize || 'letter'};
        }
        @page:first {
            margin: 0 !important;
            size: ${settings?.paperSize || 'letter'};
        }
        body {
            margin: 0;
            padding: 0;
        }
        * {
            box-sizing: border-box;
        }
        body {
            font-family: ${settings?.fontFamily || 'Times New Roman'}, serif;
            font-size: ${settings?.fontSize || 12}pt;
            line-height: ${settings?.lineSpacing || 1.6};
            color: black;
            padding: 0;
        }
        .content-wrapper {
            margin: ${settings?.includeCover && book.coverImageUrl ? (settings?.margins || '1in') : '0'};
        }
        h1 {
            page-break-before: auto;
            text-align: center;
            font-size: 24pt;
            margin: 0 0 2em 0;
            font-weight: bold;
        }
        .chapter:first-of-type h2 {
            page-break-before: always;
        }
        h2 {
            page-break-before: always;
            font-size: 18pt;
            margin: 0 0 1.5em 0;
            font-weight: bold;
        }
        p {
            margin: 0 0 1em 0;
            text-align: justify;
            text-indent: 0;
            orphans: 2;
            widows: 2;
        }
        p.no-indent {
            text-indent: 0 !important;
        }
        p.first-paragraph {
            text-indent: 0 !important;
        }
        .chapter-content p:first-child {
            text-indent: 0 !important;
        }
        .title-page {
            margin: 0;
            padding: 0;
            page-break-after: always;
            page-break-before: auto;
            page-break-inside: avoid;
            width: 100%;
            min-height: 100vh;
            height: 100vh;
            position: relative;
            overflow: hidden;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            display: block;
        }
        .title-page .cover-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 0;
            margin: 0;
            padding: 0;
            display: block;
            min-width: 100%;
            min-height: 100%;
        }
        .title-page h1,
        .title-page p {
            display: none;
        }
        .chapter {
            page-break-before: always;
        }
        .chapter h2 {
            page-break-after: avoid;
        }
        .chapter-content {
            margin-top: 0;
        }
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    ${settings?.includeCover && book.coverImageUrl ? `
    <div class="title-page" style="background-image: url('${book.coverImageUrl}');">
        <img src="${book.coverImageUrl}" alt="Cover" class="cover-background" />
    </div>
    ` : ''}
    
    ${chapters.map((chapter: any, chapterIndex: number) => {
      const chapterContent = chapter.content || ''
      const paragraphs = chapterContent
        .split('\n')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0)
      
      return `
    <div class="chapter">
        <h2>${settings?.includeChapterNumbers ? `Chapter ${chapterIndex + 1}: ` : ''}${chapter.title}</h2>
        <div class="chapter-content">
            ${paragraphs.map((paragraph: string, pIndex: number) => 
              `<p${pIndex === 0 ? ' class="first-paragraph"' : ''}>${paragraph}</p>`
            ).join('')}
        </div>
    </div>`
    }).join('')}
    </div>
</body>
</html>`
}

/**
 * Generate EPUB file using epub-gen-memory (works in memory, no temp files needed)
 */
async function generateEPUB(book: any, settings: any): Promise<Buffer> {
  if (!book.chapters || book.chapters.length === 0) {
    throw new Error('No chapters found in book')
  }
  // Dynamic import of epub-gen-memory (only load when needed)
  const epubModule = await import('epub-gen-memory')
  // epub-gen-memory exports default as a function
  const epub = (epubModule.default && typeof epubModule.default === 'function') 
    ? epubModule.default 
    : (typeof epubModule === 'function' ? epubModule : epubModule.default)
  
  const chapters = book.chapters.sort((a: any, b: any) => a.orderIndex - b.orderIndex)
  
  // Format content for epub-gen-memory
  const content = chapters.map((chapter: any, index: number) => {
    const chapterContent = chapter.content || ''
    const paragraphs = chapterContent
      .split('\n')
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0)
      .map((paragraph: string) => {
        // Escape HTML but preserve line breaks
        const escaped = paragraph
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
        return `<p>${escaped}</p>`
      })
      .join('\n')
    
    // Don't include the title in content - epub-gen-memory will add it automatically from the title property
    // Ensure we always have some content, even if empty
    const chapterData = paragraphs.length > 0 ? paragraphs : '<p></p>'
    
    return {
      title: settings?.includeChapterNumbers ? `Chapter ${index + 1}: ${chapter.title}` : chapter.title,
      content: chapterData  // epub-gen-memory expects 'content', not 'data', and will add the title automatically
    }
  })

  // Validate content array
  if (!content || content.length === 0) {
    throw new Error('No content chapters available for EPUB generation')
  }

  const epubOptions: any = {
    title: book.title || 'Untitled Book',
    author: book.author?.name || 'Unknown Author',
    publisher: 'Rogan Writer',
    description: book.description || '',
    content: content, // Ensure content is always an array
    ...(book.coverImageUrl && { cover: book.coverImageUrl }), // Add cover URL if available (epub-gen-memory expects string URL)
    css: `
      body {
        font-family: ${settings?.fontFamily || 'Georgia'}, serif;
        font-size: ${settings?.fontSize || 12}pt;
        line-height: ${settings?.lineSpacing || 1.6};
        margin: 1em;
      }
      h1 {
        font-size: 1.5em;
        margin-bottom: 1em;
        page-break-after: avoid;
      }
      p {
        margin-bottom: 1em;
        text-align: justify;
      }
    `
  }

  // Debug: Log content to verify it's set correctly
  console.log('EPUB Options:', {
    title: epubOptions.title,
    author: epubOptions.author,
    contentLength: epubOptions.content?.length,
    firstChapterTitle: epubOptions.content?.[0]?.title
  })

  // Validate epubOptions before passing to epub-gen-memory
  if (!epubOptions.content || !Array.isArray(epubOptions.content)) {
    console.error('Invalid epubOptions:', {
      hasContent: !!epubOptions.content,
      contentType: typeof epubOptions.content,
      contentIsArray: Array.isArray(epubOptions.content),
      contentLength: epubOptions.content?.length,
      epubOptionsKeys: Object.keys(epubOptions)
    })
    throw new Error('Content array is missing or invalid for EPUB generation')
  }

  // Ensure epub is a function
  if (typeof epub !== 'function') {
    console.error('epub is not a function:', typeof epub, Object.keys(epubModule))
    throw new Error('Failed to load epub-gen-memory function')
  }

  // Generate EPUB in memory - epub-gen-memory expects options and content as separate parameters
  // epub(optionsOrTitle, content, [version | verbose][])
  try {
    // Separate options from content - epub-gen-memory expects content as a separate parameter
    const epubGenOptions: any = {
      title: epubOptions.title,
      author: epubOptions.author,
      publisher: epubOptions.publisher,
      description: epubOptions.description,
      css: epubOptions.css,
      ...(epubOptions.cover && { cover: epubOptions.cover }) // Include cover if available
    }
    
    // Content is passed as the second parameter, not inside options
    const chapters = epubOptions.content
    
    // Debug: Log to verify structure
    console.log('epub call structure:', {
      optionsTitle: epubGenOptions.title,
      optionsAuthor: epubGenOptions.author,
      chaptersLength: chapters?.length,
      chaptersIsArray: Array.isArray(chapters),
      firstChapterKeys: chapters?.[0] ? Object.keys(chapters[0]) : null
    })
    
    // Call: epub(options, content)
    const epubBuffer = await epub(epubGenOptions, chapters)
    return epubBuffer as Buffer
  } catch (error) {
    console.error('EPUB generation error:', error)
    console.error('EPUB options that failed:', {
      title: epubOptions.title,
      author: epubOptions.author,
      contentLength: epubOptions.content?.length,
      contentType: typeof epubOptions.content,
      contentIsArray: Array.isArray(epubOptions.content),
      epubType: typeof epub
    })
    throw new Error(`EPUB generation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Generate MOBI file (convert from EPUB)
 * Note: Requires Calibre's ebook-convert command-line tool
 * Alternative: Use a service or library that can convert EPUB to MOBI
 */
async function generateMOBI(book: any, settings: any): Promise<Buffer> {
  // First generate EPUB
  const epubBuffer = await generateEPUB(book, settings)
  
  // For now, return EPUB buffer (MOBI conversion requires Calibre)
  // TODO: Implement MOBI conversion using Calibre's ebook-convert or a service
  // This is a placeholder - in production, you'd want to:
  // 1. Write EPUB to temp file
  // 2. Use Calibre's ebook-convert: ebook-convert input.epub output.mobi
  // 3. Read MOBI file and return as buffer
  
  console.warn('MOBI generation: Currently returning EPUB format. MOBI conversion requires Calibre ebook-convert tool.')
  
  // Return EPUB for now (many eReaders can read EPUB)
  return epubBuffer
}

/**
 * Send file to Kindle via email
 */
async function sendToKindle(
  filePath: string,
  fileName: string,
  kindleEmail: string,
  bookTitle: string
): Promise<void> {
  // Dynamic import of nodemailer (only load when needed)
  const nodemailer = await import('nodemailer')
  
  // Check if email is configured
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPassword = process.env.SMTP_PASSWORD
  const smtpFrom = process.env.SMTP_FROM || smtpUser

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    throw new Error('Email service not configured. Please set SMTP environment variables.')
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword
    }
  })

  // Read file
  const fs = await import('fs/promises')
  const fileBuffer = await fs.readFile(filePath)

  // Send email
  await transporter.sendMail({
    from: smtpFrom,
    to: kindleEmail,
    subject: bookTitle,
    text: `Your book "${bookTitle}" has been sent to your Kindle.`,
    attachments: [
      {
        filename: fileName,
        content: fileBuffer
      }
    ]
  })

  console.log(`✅ Email sent to Kindle: ${kindleEmail}`)
} 