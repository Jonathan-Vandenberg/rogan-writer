import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ExportService } from '@/services'
import { BookService } from '@/services'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import puppeteer from 'puppeteer'

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

    // Ensure exports directory exists
    const exportsDir = join(process.cwd(), 'public', 'exports')
    if (!existsSync(exportsDir)) {
      await mkdir(exportsDir, { recursive: true })
    }

    try {
      const fileName = exportRequest.fileName
      let fileBuffer: Buffer | string

      // Generate content based on format
      switch (exportRequest.format) {
        case 'PDF':
          fileBuffer = await generatePDF(book, exportRequest.settings)
          break
          
        case 'TXT':
        default:
          fileBuffer = generateTXT(book, exportRequest.settings)
          break
      }

      // Write file
      const filePath = join(exportsDir, fileName)
      
      if (typeof fileBuffer === 'string') {
        await writeFile(filePath, fileBuffer, 'utf-8')
      } else {
        await writeFile(filePath, fileBuffer)
      }

      // Update export with file URL
      const fileUrl = `/exports/${fileName}`
      await ExportService.updateExportStatus(exportId, 'COMPLETED', fileUrl)

      return NextResponse.json({ 
        success: true, 
        fileUrl, 
        message: 'Export completed successfully' 
      })

    } catch (error) {
      console.error('File generation error:', error)
      await ExportService.updateExportStatus(exportId, 'FAILED')
      return NextResponse.json({ error: 'File generation failed' }, { status: 500 })
    }

  } catch (error) {
    console.error('Error processing export:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generatePDF(book: any, settings: any): Promise<Buffer> {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  try {
    const page = await browser.newPage()
    
    const html = generateHTML(book, settings)
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdfBuffer = await page.pdf({
      format: settings?.paperSize || 'letter',
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in'
      },
      printBackground: true
    })
    
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

function generateTXT(book: any, settings: any): string {
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
    
    content += `${chapter.content}\n\n`
    
    if (index < chapters.length - 1) {
      content += `${'='.repeat(30)}\n\n`
    }
  })
  
  return content
}

function generateHTML(book: any, settings: any): string {
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
        * {
            box-sizing: border-box;
        }
        body {
            font-family: ${settings?.fontFamily || 'Times New Roman'}, serif;
            font-size: ${settings?.fontSize || 12}pt;
            line-height: ${settings?.lineSpacing || 1.6};
            color: black;
            margin: 0;
            padding: 0;
        }
        h1 {
            page-break-before: always;
            text-align: center;
            font-size: 24pt;
            margin: 0 0 2em 0;
            font-weight: bold;
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
            text-align: center;
            margin: 4em 0;
            page-break-after: always;
        }
        .title-page h1 {
            page-break-before: avoid;
            margin: 0 0 1em 0;
        }
        .title-page p {
            text-indent: 0;
            text-align: center;
            font-style: italic;
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
    ${settings?.includeCover ? `
    <div class="title-page">
        <h1>${book.title}</h1>
        ${book.description ? `<p>${book.description}</p>` : ''}
    </div>
    ` : ''}
    
    ${chapters.map((chapter: any, chapterIndex: number) => {
      const paragraphs = chapter.content
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
</body>
</html>`
} 