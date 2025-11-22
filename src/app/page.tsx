"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreateBookDialog } from "@/components/ui/create-book-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { useSelectedBook } from "@/contexts/selected-book-context"
import { BookOpen, PenTool, Users, BarChart3, Target, Lightbulb, Clock, FileText, Image, Loader2, Upload, Sparkles, Trash2, Replace } from "lucide-react"
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
  const [generatingCoverFor, setGeneratingCoverFor] = React.useState<string | null>(null)
  const [uploadingCoverFor, setUploadingCoverFor] = React.useState<string | null>(null)
  const [coverPrompts, setCoverPrompts] = React.useState<Record<string, string>>({})
  const [openPopovers, setOpenPopovers] = React.useState<Record<string, boolean>>({})
  const [dragOver, setDragOver] = React.useState<Record<string, boolean>>({})
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState<{ bookId: string } | null>(null)
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({})

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

  const handleGenerateCover = async (bookId: string, customPrompt?: string) => {
    setGeneratingCoverFor(bookId)
    try {
      const response = await fetch(`/api/books/${bookId}/generate-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt || null }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Failed to generate cover art')
      }

      const result = await response.json()
      
      // Update the book in the list with the new cover image
      setBooks(prev => prev.map(book => 
        book.id === bookId 
          ? { ...book, coverImageUrl: result.book.coverImageUrl }
          : book
      ))

      // Close the popover
      setOpenPopovers(prev => ({ ...prev, [bookId]: false }))
      setCoverPrompts(prev => ({ ...prev, [bookId]: '' }))
    } catch (error) {
      console.error('Error generating cover art:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate cover art')
    } finally {
      setGeneratingCoverFor(null)
    }
  }

  const handleUploadCover = async (bookId: string, file: File) => {
    setUploadingCoverFor(bookId)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/books/${bookId}/upload-cover`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload cover image')
      }

      const result = await response.json()
      
      // Update the book in the list with the new cover image
      setBooks(prev => prev.map(book => 
        book.id === bookId 
          ? { ...book, coverImageUrl: result.book.coverImageUrl }
          : book
      ))

      // Close the popover
      setOpenPopovers(prev => ({ ...prev, [bookId]: false }))
    } catch (error) {
      console.error('Error uploading cover image:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload cover image')
    } finally {
      setUploadingCoverFor(null)
    }
  }

  const handleDrop = (e: React.DragEvent, bookId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(prev => ({ ...prev, [bookId]: false }))

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleUploadCover(bookId, file)
    }
  }

  const handleDragOver = (e: React.DragEvent, bookId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(prev => ({ ...prev, [bookId]: true }))
  }

  const handleDragLeave = (e: React.DragEvent, bookId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(prev => ({ ...prev, [bookId]: false }))
  }

  const handleDeleteCoverClick = (bookId: string) => {
    setDeleteConfirmOpen({ bookId })
  }

  const handleDeleteCover = async () => {
    if (!deleteConfirmOpen) return

    const bookId = deleteConfirmOpen.bookId
    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImageUrl: null }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete cover image')
      }

      const updatedBook = await response.json()
      
      // Update the book in the list
      setBooks(prev => prev.map(book => 
        book.id === bookId 
          ? { ...book, coverImageUrl: null }
          : book
      ))

      setDeleteConfirmOpen(null)
    } catch (error) {
      console.error('Error deleting cover image:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete cover image')
    }
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
                <div key={book.id} className="flex flex-col">
                  <div 
                    className={cn(
                      "border border-border overflow-hidden hover:shadow-lg transition-shadow group bg-card flex flex-col"
                    )}
                  >
                    {/* Cover Image - Book aspect ratio (2:3) */}
                    {book.coverImageUrl ? (
                      <Link href={`/books/${book.id}`} className="block">
                        <div className="w-full aspect-[2/3] overflow-hidden bg-muted">
                          <img
                            src={book.coverImageUrl}
                            alt={`${book.title} cover`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </Link>
                    ) : (
                      <Link href={`/books/${book.id}`} className="w-full aspect-[2/3] bg-muted flex flex-col items-center justify-center relative group/cover cursor-pointer">
                        <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <Popover 
                          open={openPopovers[book.id] || false}
                          onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [book.id]: open }))}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="bg-white text-black border border-border rounded-full opacity-0 group-hover/cover:opacity-100 transition-opacity z-10"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setOpenPopovers(prev => ({ ...prev, [book.id]: true }))
                              }}
                            >
                              <Image className="h-4 w-4 mr-2" />
                              <span>Add Cover Art</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-96 z-[100]" 
                            onClick={(e) => e.stopPropagation()}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <Tabs defaultValue="upload" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="upload">
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload
                                </TabsTrigger>
                                <TabsTrigger value="generate">
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Generate with AI
                                </TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="upload" className="space-y-4 mt-4">
                                <div
                                  className={cn(
                                    "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                                    dragOver[book.id] 
                                      ? "border-primary bg-primary/5" 
                                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                                  )}
                                  onDrop={(e) => handleDrop(e, book.id)}
                                  onDragOver={(e) => handleDragOver(e, book.id)}
                                  onDragLeave={(e) => handleDragLeave(e, book.id)}
                                >
                                  <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                                  <p className="text-sm font-medium mb-1">Drag and drop an image here</p>
                                  <p className="text-xs text-muted-foreground mb-4">or</p>
                                  <input
                                    ref={(el) => {
                                      fileInputRefs.current[book.id] = el
                                    }}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) {
                                        handleUploadCover(book.id, file)
                                      }
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      fileInputRefs.current[book.id]?.click()
                                    }}
                                    disabled={uploadingCoverFor === book.id}
                                  >
                                    {uploadingCoverFor === book.id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Uploading...
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Choose File
                                      </>
                                    )}
                                  </Button>
                                  <p className="text-xs text-muted-foreground mt-3">
                                    PNG, JPG, GIF or WEBP (max 10MB)
                                  </p>
                                </div>
                              </TabsContent>
                              
                              <TabsContent value="generate" className="space-y-4 mt-4">
                                <div>
                                  <h4 className="font-medium text-sm mb-2">Generate Cover Art</h4>
                                  <p className="text-xs text-muted-foreground mb-3">
                                    Leave empty to auto-generate from title and description, or enter a custom prompt.
                                  </p>
                                </div>
                                <Textarea
                                  placeholder="Describe what you want the cover to look like..."
                                  value={coverPrompts[book.id] || ''}
                                  onChange={(e) => setCoverPrompts(prev => ({ ...prev, [book.id]: e.target.value }))}
                                  rows={4}
                                  className="text-sm"
                                />
                                <Button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleGenerateCover(book.id, coverPrompts[book.id] || undefined)
                                  }}
                                  disabled={generatingCoverFor === book.id}
                                  className="w-full"
                                >
                                  {generatingCoverFor === book.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-4 w-4 mr-2" />
                                      Generate Cover Art
                                    </>
                                  )}
                                </Button>
                              </TabsContent>
                            </Tabs>
                          </PopoverContent>
                        </Popover>
                      </Link>
                    )}
                    
                    {/* Text Content Below Cover */}
                    <div className="p-4 flex flex-col flex-1">
                      <Link href={`/books/${book.id}`} className="flex-1">
                      <CardHeader className="pb-3 p-0">
                        <div className="space-y-2">
                          <CardTitle className="text-lg line-clamp-2 transition-colors group-hover:text-primary cursor-pointer">
                              {book.title}
                            </CardTitle>
                          <div className="flex items-start gap-2 flex-wrap">
                              {book.genre && (
                                <Badge 
                                  variant="outline" 
                                className="text-xs"
                                >
                                  {book.genre}
                                </Badge>
                              )}
                              {book.status && (
                                <Badge 
                                  variant="outline" 
                                className={cn("text-xs", getStatusColor(book.status))}
                              >
                                {formatStatus(book.status)}
                              </Badge>
                            )}
                            
                            {/* Cover Art Pill with Buttons Below - Single Grouped Object */}
                            {book.coverImageUrl && (
                              <div className="flex flex-col items-center gap-1">
                                <Badge 
                                  variant="outline" 
                                  className="text-xs"
                                >
                                  Cover Art
                                </Badge>
                                <div className="flex items-center gap-1">
                                  <Popover 
                                    open={openPopovers[book.id] || false}
                                    onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [book.id]: open }))}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setOpenPopovers(prev => ({ ...prev, [book.id]: true }))
                                        }}
                                      >
                                        <Replace className="h-3 w-3" />
                                      </Button>
                                    </PopoverTrigger>
                                  <PopoverContent 
                                    className="w-96 z-[100]" 
                                    onClick={(e) => e.stopPropagation()}
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                  >
                                    <Tabs defaultValue="upload" className="w-full">
                                      <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="upload">
                                          <Upload className="h-4 w-4 mr-2" />
                                          Upload
                                        </TabsTrigger>
                                        <TabsTrigger value="generate">
                                          <Sparkles className="h-4 w-4 mr-2" />
                                          Generate with AI
                                        </TabsTrigger>
                                      </TabsList>
                                      
                                      <TabsContent value="upload" className="space-y-4 mt-4">
                                        <div
                                          className={cn(
                                            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                                            dragOver[book.id] 
                                              ? "border-primary bg-primary/5" 
                                              : "border-muted-foreground/25 hover:border-muted-foreground/50"
                                          )}
                                          onDrop={(e) => handleDrop(e, book.id)}
                                          onDragOver={(e) => handleDragOver(e, book.id)}
                                          onDragLeave={(e) => handleDragLeave(e, book.id)}
                                        >
                                          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                                          <p className="text-sm font-medium mb-1">Drag and drop an image here</p>
                                          <p className="text-xs text-muted-foreground mb-4">or</p>
                                          <input
                                            ref={(el) => {
                                              fileInputRefs.current[book.id] = el
                                            }}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0]
                                              if (file) {
                                                handleUploadCover(book.id, file)
                                              }
                                            }}
                                          />
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              fileInputRefs.current[book.id]?.click()
                                            }}
                                            disabled={uploadingCoverFor === book.id}
                                          >
                                            {uploadingCoverFor === book.id ? (
                                              <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Uploading...
                                              </>
                                            ) : (
                                              <>
                                                <Upload className="h-4 w-4 mr-2" />
                                                Choose File
                                              </>
                                            )}
                                          </Button>
                                          <p className="text-xs text-muted-foreground mt-3">
                                            PNG, JPG, GIF or WEBP (max 10MB)
                                          </p>
                                        </div>
                                      </TabsContent>
                                      
                                      <TabsContent value="generate" className="space-y-4 mt-4">
                                        <div>
                                          <h4 className="font-medium text-sm mb-2">Generate Cover Art</h4>
                                          <p className="text-xs text-muted-foreground mb-3">
                                            Leave empty to auto-generate from title and description, or enter a custom prompt.
                                          </p>
                            </div>
                                        <Textarea
                                          placeholder="Describe what you want the cover to look like..."
                                          value={coverPrompts[book.id] || ''}
                                          onChange={(e) => setCoverPrompts(prev => ({ ...prev, [book.id]: e.target.value }))}
                                          rows={4}
                                          className="text-sm"
                                        />
                                        <Button
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleGenerateCover(book.id, coverPrompts[book.id] || undefined)
                                          }}
                                          disabled={generatingCoverFor === book.id}
                                          className="w-full"
                                        >
                                          {generatingCoverFor === book.id ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Generating...
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="h-4 w-4 mr-2" />
                                              Generate Cover Art
                                            </>
                                          )}
                                        </Button>
                                      </TabsContent>
                                    </Tabs>
                                    </PopoverContent>
                                  </Popover>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleDeleteCoverClick(book.id)
                                    }}
                                    title="Delete cover image"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                          <CardContent className="pt-0 p-0 mt-auto">
                        <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Updated {new Date(book.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </CardContent>
                        </Link>
                    </div>
                  </div>
                </div>
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

        {/* Delete Cover Confirmation Dialog */}
        <ConfirmationDialog
          open={deleteConfirmOpen !== null}
          onOpenChange={(open) => !open && setDeleteConfirmOpen(null)}
          title="Delete Cover Image"
          description="Are you sure you want to remove the cover image? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={handleDeleteCover}
        />
      </div>
    )
  }
