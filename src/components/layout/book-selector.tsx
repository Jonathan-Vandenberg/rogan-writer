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

  const selectedBook = books.find(book => book.id === selectedBookId) || null

  React.useEffect(() => {
    async function fetchBooks() {
      try {
        const response = await fetch('/api/books')
        if (response.ok) {
          const booksData = await response.json()
          setBooks(booksData)
          if (booksData.length > 0 && !selectedBookId) {
            setSelectedBookId(booksData[0].id)
          }
        }
      } catch (error) {
        console.error('Error fetching books:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooks()
  }, [selectedBookId, setSelectedBookId])

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

  if (!selectedBook || books.length === 0) {
    return (
      <Button variant="outline" className="w-[200px] justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span>No books</span>
        </div>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-[200px] justify-between"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="truncate">{selectedBook.title}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                selectedBook?.id === book.id ? "opacity-100" : "opacity-0"
              )}
            />
            <div className="flex flex-col gap-1">
              <span className="font-medium">{book.title}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {book.status.replace("_", " ")}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Create New Book
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 