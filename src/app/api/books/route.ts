import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { BookService } from '@/services'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const books = await BookService.getBooksByUserId(session.user.id)
    
    return NextResponse.json(books)
  } catch (error) {
    console.error('Error fetching books:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 