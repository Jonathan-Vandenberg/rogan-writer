"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpen, PenTool, Users, BarChart3, Target, Lightbulb, Clock, FileText } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface DashboardData {
  books: {
    total: number
    active: number
    editing: number
  }
  writing: {
    totalWords: number
    streak: number
    todayWords: number
    weekWords: number
  }
  characters: {
    total: number
  }
  plot: {
    totalPoints: number
    completedPoints: number
    progressPercent: number
    plotStatus: Array<{
      type: string
      title: string
      completed: boolean
    }>
  }
  recentNotes: Array<{
    id: string
    title: string
    createdAt: string
    tags: string[]
  }>
}

interface Book {
  id: string
  title: string
  description: string | null
  genre: string | null
  status: string
  createdAt: string
  updatedAt: string
  coverImageUrl: string | null
  targetWords: number | null
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = React.useState<DashboardData | null>(null)
  const [books, setBooks] = React.useState<Book[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchData() {
      try {
        // Fetch dashboard data
        const dashboardResponse = await fetch('/api/dashboard')
        if (dashboardResponse.ok) {
          const data = await dashboardResponse.json()
          setDashboardData(data)
        }

        // Fetch user's books
        const booksResponse = await fetch('/api/books')
        if (booksResponse.ok) {
          const booksData = await booksResponse.json()
          setBooks(booksData || [])
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'bg-green-500'
      case 'FINAL_DRAFT': return 'bg-blue-500'
      case 'EDITING': return 'bg-yellow-500'
      case 'FIRST_DRAFT_COMPLETE': return 'bg-purple-500'
      case 'IN_PROGRESS': return 'bg-orange-500'
      case 'DRAFT': return 'bg-gray-500'
      default: return 'bg-gray-400'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Loading your writing workspace...</p>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            No data available. Please try refreshing the page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back to your writing workspace
        </p>
      </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Books</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.books.total}</div>
              <p className="text-xs text-muted-foreground">
                {dashboardData.books.active} in progress, {dashboardData.books.editing} editing
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Characters</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.characters.total}</div>
              <p className="text-xs text-muted-foreground">
                Across all books
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Writing Streak</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.writing.streak} days</div>
              <p className="text-xs text-muted-foreground">
                {dashboardData.writing.streak > 0 ? 'Keep it up!' : 'Start your streak!'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Jump into your writing flow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/write">
                <Button className="w-full" variant="default">
                  Continue Writing
                </Button>
              </Link>
              <Link href="/chapters">
                <Button className="w-full" variant="outline">
                  Manage Chapters
                </Button>
              </Link>
              <Link href="/characters">
                <Button className="w-full" variant="outline">
                  Add New Character
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Plot Progress
              </CardTitle>
              <CardDescription>
                Track your story structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboardData.plot.plotStatus.length > 0 ? (
                  dashboardData.plot.plotStatus.slice(0, 4).map((point, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{point.title}</span>
                      <span className={point.completed ? "text-green-600" : "text-gray-400"}>
                        {point.completed ? "✓" : "Pending"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No plot points yet</p>
                )}
                {dashboardData.plot.totalPoints > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{dashboardData.plot.progressPercent}%</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Recent Ideas
              </CardTitle>
              <CardDescription>
                Your latest brainstorming notes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {dashboardData.recentNotes.length > 0 ? (
                  dashboardData.recentNotes.map((note, index) => {
                    const colors = ['blue', 'green', 'purple', 'orange', 'pink']
                    const color = colors[index % colors.length]
                    const timeAgo = new Date(note.createdAt).toLocaleDateString()
                    
                    return (
                      <div key={note.id} className={`border-l-2 border-${color}-500 pl-2`}>
                        <p className="font-medium">{note.title}</p>
                        <p className="text-muted-foreground text-xs">{timeAgo}</p>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No ideas yet. Start brainstorming!</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Book Library Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Your Library</h2>
            </div>
          </div>

          {books.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {books.map((book) => (
                <Link key={book.id} href={`/books/${book.id}`}>
                  <div className="bg-card rounded-lg border border-border py-3 cursor-pointer hover:shadow-lg transition-shadow group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                            {book.title}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {book.genre && (
                              <Badge variant="outline" className="text-xs">
                                {book.genre}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Updated {new Date(book.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No books yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first book to start your writing journey
                </p>
                <Link href="/books">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Create First Book
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }
