import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BookVersionService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const versions = await BookVersionService.getVersionsByBookId(resolvedParams.bookId)
    
    return NextResponse.json(versions)
  } catch (error) {
    console.error('Error fetching versions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const data = await request.json()
    
    const version = await BookVersionService.createBookSnapshot(
      resolvedParams.bookId,
      data.version,
      data.description
    )
    
    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    console.error('Error creating version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 