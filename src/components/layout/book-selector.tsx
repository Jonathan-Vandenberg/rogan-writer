"use client"

import * as React from "react"
import { BookOpen, Check, ChevronsUpDown, Plus } from "lucide-react"
import { useSelectedBook } from "@/contexts/selected-book-context"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateBookDialog } from "@/components/ui/create-book-dialog"
import { cn } from "@/lib/utils"

interface Book {
  id: string
  title: string
  status: string
}

export function BookSelector() {
  const { selectedBookId, setSelectedBookId } = useSelectedBook()
  const [books, setBooks] = React.useState<Book[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  const selectedBook = books.find(book => book.id === selectedBookId) || null

  const fetchBooks = React.useCallback(async () => {
    try {
      const response = await fetch('/api/books')
      
      if (response.ok) {
        const booksData = await response.json()
        setBooks(booksData)
        // Only default to first book if there's no saved selection and no current selection
        if (booksData.length > 0 && !selectedBookId && !localStorage.getItem('selectedBookId')) {
          setSelectedBookId(booksData[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching books:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedBookId, setSelectedBookId])

  React.useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  // Listen for book deletion events
  React.useEffect(() => {
    const handleBookDeleted = (event: CustomEvent) => {
      const deletedBookId = event.detail.bookId
      setBooks(prev => prev.filter(book => book.id !== deletedBookId))
      
      // If the deleted book was selected, clear selection or select first remaining book
      if (selectedBookId === deletedBookId) {
        const remainingBooks = books.filter(book => book.id !== deletedBookId)
        if (remainingBooks.length > 0) {
          setSelectedBookId(remainingBooks[0].id)
        } else {
          setSelectedBookId(null)
          localStorage.removeItem('selectedBookId')
        }
      }
    }

    window.addEventListener('bookDeleted', handleBookDeleted as EventListener)
    return () => window.removeEventListener('bookDeleted', handleBookDeleted as EventListener)
  }, [selectedBookId, setSelectedBookId, books])

  const handleBookCreated = React.useCallback((newBook: Book) => {
    setBooks(prev => [newBook, ...prev])
    setSelectedBookId(newBook.id)
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('bookCreated', { detail: newBook }))
  }, [setSelectedBookId])

  if (loading) {
    return (
      <Button variant="outline" disabled className="w-[200px] justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span>Loading...</span>
        </div>
      </Button>
    )
  }

  // Only show "Create Book" button if there are no books at all
  if (books.length === 0) {
    return (
      <>
        <Button 
          variant="outline" 
          className="w-[200px] justify-between"
          onClick={() => setShowCreateDialog(true)}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span>Create Book</span>
          </div>
          <Plus className="h-4 w-4" />
        </Button>
        
        <CreateBookDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onBookCreated={handleBookCreated}
        />
      </>
    )
  }
  
  // If we have books but no selected book, show first book or placeholder
  const displayBook = selectedBook || books[0]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-[200px] justify-between"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">{displayBook.title}</span>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]" align="start">
          <DropdownMenuLabel>Your Books</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {books.map((book: Book) => (
            <DropdownMenuItem
              key={book.id}
              onSelect={() => setSelectedBookId(book.id)}
              className="cursor-pointer"
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  displayBook.id === book.id ? "opacity-100" : "opacity-0"
                )}
              />
              <div className="flex flex-col gap-1">
                <span className="font-medium">{book.title}</span>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            className="cursor-pointer"
            onSelect={() => setShowCreateDialog(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Book
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateBookDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onBookCreated={handleBookCreated}
      />
    </>
  )
} 