import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  BookService, 
  WritingSessionService, 
  BrainstormingService, 
  PlotService 
} from '@/services'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const books = await BookService.getBooksByUserId(userId)
    const writingStats = await WritingSessionService.getUserWritingStats(userId)
    
    // Get first book for detailed stats
    const firstBook = books[0]
    let bookStats = null
    let recentNotes: any[] = []
    let plotProgress = null

    if (firstBook) {
      bookStats = await BookService.getBookStats(firstBook.id)
      recentNotes = await BrainstormingService.getRecentNotes(firstBook.id, 3)
      plotProgress = await PlotService.getPlotProgress(firstBook.id)
    }

    const dashboard = {
      user: session.user,
      books: {
        total: books.length,
        active: books.filter(b => b.status === 'IN_PROGRESS' || b.status === 'DRAFT').length,
        editing: books.filter(b => b.status === 'EDITING').length
      },
      writing: {
        totalWords: bookStats?.totalWords || 0,
        streak: writingStats.streak,
        todayWords: writingStats.todayWords,
        weekWords: writingStats.weekWords
      },
      characters: {
        total: bookStats?.totalCharacters || 0
      },
      plot: plotProgress || {
        totalPoints: 0,
        completedPoints: 0,
        progressPercent: 0,
        plotStatus: []
      },
      recentNotes: recentNotes.map(note => ({
        id: note.id,
        title: note.title,
        createdAt: note.createdAt,
        tags: note.tags
      }))
    }

    return NextResponse.json(dashboard)
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 