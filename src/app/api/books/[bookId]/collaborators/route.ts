import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BookCollaboratorService } from '@/services'

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const collaborators = await BookCollaboratorService.getCollaboratorsByBookId(params.bookId)
    
    return NextResponse.json(collaborators)
  } catch (error) {
    console.error('Error fetching collaborators:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    const collaborator = await BookCollaboratorService.inviteCollaborator({
      bookId: params.bookId,
      email: data.email,
      role: data.role
    })
    
    return NextResponse.json(collaborator, { status: 201 })
  } catch (error) {
    console.error('Error inviting collaborator:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 