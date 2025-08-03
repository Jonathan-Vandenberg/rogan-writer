"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreateBookDialog } from "@/components/ui/create-book-dialog"
import { useSelectedBook } from "@/contexts/selected-book-context"
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
  const { setSelectedBookId } = useSelectedBook()
  const [dashboardData, setDashboardData] = React.useState<DashboardData | null>(null)
  const [books, setBooks] = React.useState<Book[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  const fetchData = React.useCallback(async () => {
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
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Listen for book creation events from other components
  React.useEffect(() => {
    const handleBookCreatedEvent = (event: CustomEvent) => {
      const newBook = event.detail
      setBooks(prev => [newBook, ...prev])
      setSelectedBookId(newBook.id)
      // Also refresh dashboard data to get updated stats
      fetchData()
    }

    window.addEventListener('bookCreated', handleBookCreatedEvent as EventListener)
    return () => {
      window.removeEventListener('bookCreated', handleBookCreatedEvent as EventListener)
    }
  }, [setSelectedBookId, fetchData])

  const handleBookCreated = React.useCallback((newBook: Book) => {
    setShowCreateDialog(false)
    setSelectedBookId(newBook.id) // Set the newly created book as selected
    fetchData() // Refresh the data after creating a book
  }, [setSelectedBookId, fetchData])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'FINAL_DRAFT': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'EDITING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'FIRST_DRAFT_COMPLETE': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'IN_PROGRESS': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'DRAFT': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
          <p className="text-muted-foreground">Loading your writing workspace...</p>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
          <p className="text-muted-foreground">
            No data available. Please try refreshing the page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
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
                            {book.status && (
                              <Badge variant="outline" className={cn("text-xs", getStatusColor(book.status))}>
                                {formatStatus(book.status)}
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
                <Button onClick={() => setShowCreateDialog(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create First Book
                </Button>
                
                <CreateBookDialog
                  open={showCreateDialog}
                  onOpenChange={setShowCreateDialog}
                  onBookCreated={handleBookCreated}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }
