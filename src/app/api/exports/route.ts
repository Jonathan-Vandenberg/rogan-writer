import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ExportService } from '@/services'

export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const exports = await ExportService.getExportsByUserId(session.user.id)
    
    return NextResponse.json(exports)
  } catch (error) {
    console.error('Error fetching exports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    const exportRequest = await ExportService.requestBookExport(
      session.user.id,
      data.bookId,
      data.format,
      data.settings
    )
    
    return NextResponse.json(exportRequest, { status: 201 })
  } catch (error) {
    console.error('Error creating export:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 