import { prisma } from "@/lib/db"
import type { WritingSession } from "@prisma/client"

export class WritingSessionService {
  static async getSessionsByUserId(userId: string): Promise<WritingSession[]> {
    return await prisma.writingSession.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' }
    })
  }

  static async getSessionsByBookId(bookId: string): Promise<WritingSession[]> {
    return await prisma.writingSession.findMany({
      where: { bookId },
      orderBy: { startTime: 'desc' }
    })
  }

  static async createSession(data: {
    userId: string
    bookId?: string
    targetWords?: number
    notes?: string
  }): Promise<WritingSession> {
    return await prisma.writingSession.create({
      data: {
        ...data,
        startTime: new Date()
      }
    })
  }

  static async endSession(id: string, wordsWritten: number): Promise<WritingSession> {
    return await prisma.writingSession.update({
      where: { id },
      data: {
        endTime: new Date(),
        wordsWritten,
        completed: true
      }
    })
  }

  static async getUserWritingStats(userId: string, bookId?: string) {
    const where = bookId 
      ? { userId, bookId }
      : { userId }

    const sessions = await prisma.writingSession.findMany({
      where,
      orderBy: { startTime: 'desc' }
    })

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const todaySessions = sessions.filter(s => s.startTime >= todayStart)
    const weekSessions = sessions.filter(s => s.startTime >= weekStart)
    const monthSessions = sessions.filter(s => s.startTime >= monthStart)

    const totalWords = sessions.reduce((total, session) => total + session.wordsWritten, 0)
    const todayWords = todaySessions.reduce((total, session) => total + session.wordsWritten, 0)
    const weekWords = weekSessions.reduce((total, session) => total + session.wordsWritten, 0)
    const monthWords = monthSessions.reduce((total, session) => total + session.wordsWritten, 0)

    // Calculate writing streak
    let streak = 0
    const days = new Map<string, number>()
    
    sessions.forEach(session => {
      if (session.wordsWritten > 0) {
        const dateKey = session.startTime.toISOString().split('T')[0]
        days.set(dateKey, (days.get(dateKey) || 0) + session.wordsWritten)
      }
    })

    // Count consecutive days with writing
    const sortedDays = Array.from(days.keys()).sort().reverse()
    let currentDate = new Date()
    
    for (let i = 0; i < sortedDays.length; i++) {
      const dayKey = currentDate.toISOString().split('T')[0]
      if (days.has(dayKey)) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else {
        break
      }
    }

    return {
      totalWords,
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.completed).length,
      todayWords,
      weekWords,
      monthWords,
      streak,
      averageWordsPerSession: sessions.length > 0 ? Math.round(totalWords / sessions.length) : 0,
      lastSession: sessions[0] || null
    }
  }

  static async getTodaysSessions(userId: string): Promise<WritingSession[]> {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    return await prisma.writingSession.findMany({
      where: {
        userId,
        startTime: { gte: todayStart }
      },
      orderBy: { startTime: 'desc' }
    })
  }
} 