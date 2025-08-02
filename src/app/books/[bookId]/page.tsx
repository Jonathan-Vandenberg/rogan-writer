"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, BookOpen, Users, MapPin, Lightbulb, FileText, Eye, Settings } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface BookStats {
  id: string
  title: string
  description: string | null
  status: string
  genre: string | null
  targetWords: number | null
  createdAt: string
  updatedAt: string
  coverImageUrl: string | null
  _count: {
    chapters: number
    characters: number
    plotPoints: number
  }
  stats: {
    totalWords: number
    totalPages: number
    totalChapters: number
    totalCharacters: number
    totalPlotPoints: number
    avgWordsPerChapter: number
  }
}

interface StatsData {
  locationsCount: number
  charactersCount: number
  brainstormingCount: number
  chaptersCount: number
}

export default function BookStatsPage() {
  const params = useParams()
  const bookId = params.bookId as string
  
  const [book, setBook] = React.useState<BookStats | null>(null)
  const [stats, setStats] = React.useState<StatsData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchBookStats() {
      if (!bookId) return
      
      try {
        setLoading(true)
        
        // Fetch book details
        const bookResponse = await fetch(`/api/books/${bookId}`)
        if (bookResponse.ok) {
          const bookData = await bookResponse.json()
          setBook(bookData)
        }

        // Fetch all stats in parallel
        const [locationsRes, charactersRes, brainstormingRes, chaptersRes] = await Promise.all([
          fetch(`/api/books/${bookId}/locations`),
          fetch(`/api/books/${bookId}/characters`),
          fetch(`/api/books/${bookId}/brainstorming`),
          fetch(`/api/books/${bookId}/chapters`)
        ])

        const statsData: StatsData = {
          locationsCount: 0,
          charactersCount: 0,
          brainstormingCount: 0,
          chaptersCount: 0
        }

        if (locationsRes.ok) {
          const locations = await locationsRes.json()
          statsData.locationsCount = locations.length
        }

        if (charactersRes.ok) {
          const characters = await charactersRes.json()
          statsData.charactersCount = characters.length
        }

        if (brainstormingRes.ok) {
          const brainstorming = await brainstormingRes.json()
          statsData.brainstormingCount = brainstorming.length
        }

        if (chaptersRes.ok) {
          const chapters = await chaptersRes.json()
          statsData.chaptersCount = chapters.length
        }

        setStats(statsData)
      } catch (error) {
        console.error('Error fetching book stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBookStats()
  }, [bookId])

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    )
  }

  if (!book || !stats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Book not found</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{book.title}</h1>
              <div className="flex items-center gap-2 mt-2">
                {book.genre && (
                  <Badge variant="outline">
                    {book.genre}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  Created {new Date(book.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href={`/write?book=${bookId}`}>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Edit Book
              </Button>
            </Link>
          </div>
        </div>

        {/* Description */}
        {book.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{book.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Book Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chapters</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.chaptersCount}</div>
              <p className="text-xs text-muted-foreground">
                {book.stats?.totalWords.toLocaleString() || 0} total words
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Characters</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.charactersCount}</div>
              <p className="text-xs text-muted-foreground">
                People in your story
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Locations</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.locationsCount}</div>
              <p className="text-xs text-muted-foreground">
                Places in your world
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ideas</CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.brainstormingCount}</div>
              <p className="text-xs text-muted-foreground">
                Brainstorming notes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        {book.stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Writing Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Words:</span>
                  <span className="font-semibold">{book.stats.totalWords.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Pages:</span>
                  <span className="font-semibold">{book.stats.totalPages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Avg Words/Chapter:</span>
                  <span className="font-semibold">{book.stats.avgWordsPerChapter}</span>
                </div>
                {book.targetWords && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Progress:</span>
                    <span className="font-semibold">
                      {Math.round((book.stats.totalWords / book.targetWords) * 100)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Story Elements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Plot Points:</span>
                  <span className="font-semibold">{book.stats.totalPlotPoints}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">World Locations:</span>
                  <span className="font-semibold">{stats.locationsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cast Size:</span>
                  <span className="font-semibold">{stats.charactersCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Creative Notes:</span>
                  <span className="font-semibold">{stats.brainstormingCount}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Book Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <span className="font-semibold">{formatStatus(book.status)}</span>
                </div>
                {book.genre && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Genre:</span>
                    <span className="font-semibold">{book.genre}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Last Updated:</span>
                  <span className="font-semibold">{new Date(book.updatedAt).toLocaleDateString()}</span>
                </div>
                {book.targetWords && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Target Words:</span>
                    <span className="font-semibold">{book.targetWords.toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reading Card */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Read Your Book</h2>
            <p className="text-muted-foreground">
              Experience your story in a beautiful double-page reading view
            </p>
          </div>
          
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <BookOpen className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{book.title}</h3>
                    <p className="text-muted-foreground">
                      {book.stats?.totalPages || 0} pages • {book.stats?.totalWords.toLocaleString() || 0} words
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Link href={`/read/${bookId}`}>
                    <Button size="lg" className="gap-2">
                      <Eye className="h-4 w-4" />
                      Start Reading
                    </Button>
                  </Link>
                </div>
              </div>
              
              {book.description && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {book.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  )
} 