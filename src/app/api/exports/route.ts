import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ExportService } from '@/services'

export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      console.log('Unauthorized request for export stats')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching export stats for user:', session.user.id)
    const exportStats = await ExportService.getExportStats(session.user.id)
    console.log('Export stats retrieved:', exportStats)
    
    return NextResponse.json(exportStats)
  } catch (error) {
    console.error('Error fetching export stats:', error)
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