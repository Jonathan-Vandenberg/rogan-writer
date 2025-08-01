import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { CommentService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const comments = await CommentService.getCommentsByPageId(params.pageId)
    
    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { pageId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    const comment = await CommentService.createPageComment({
      content: data.content,
      collaboratorId: data.collaboratorId,
      pageId: params.pageId
    })
    
    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 