import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    // Check if book exists and user has access
    const book = await prisma.book.findFirst({
      where: {
        id: resolvedParams.bookId,
        userId: session.user.id,
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Get or create brainstorming workspace
    let workspace = await prisma.brainstormingWorkspace.findFirst({
      where: {
        bookId: resolvedParams.bookId,
      },
    })

    if (!workspace) {
      // Create new workspace if it doesn't exist
      workspace = await prisma.brainstormingWorkspace.create({
        data: {
          bookId: resolvedParams.bookId,
          data: null,
        },
      })
    }

    return NextResponse.json({
      data: workspace.data,
      updatedAt: workspace.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching workspace data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const body = await request.json()
    const { data } = body

    // Check if book exists and user has access
    const book = await prisma.book.findFirst({
      where: {
        id: resolvedParams.bookId,
        userId: session.user.id,
      },
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Update or create workspace
    const workspace = await prisma.brainstormingWorkspace.upsert({
      where: {
        bookId: resolvedParams.bookId,
      },
      create: {
        bookId: resolvedParams.bookId,
        data: data || null,
      },
      update: {
        data: data || null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      updatedAt: workspace.updatedAt,
    })
  } catch (error) {
    console.error('Error saving workspace data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

