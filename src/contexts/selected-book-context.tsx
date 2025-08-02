"use client"

import * as React from "react"

interface SelectedBookContextType {
  selectedBookId: string | null
  setSelectedBookId: (bookId: string | null) => void
}

const SelectedBookContext = React.createContext<SelectedBookContextType | null>(null)

export function SelectedBookProvider({ children }: { children: React.ReactNode }) {
  const [selectedBookId, setSelectedBookId] = React.useState<string | null>(null)
  const [isLoaded, setIsLoaded] = React.useState(false)

  // Load from localStorage on mount
  React.useEffect(() => {
    const savedBookId = localStorage.getItem('selectedBookId')
    if (savedBookId) {
      setSelectedBookId(savedBookId)
    }
    setIsLoaded(true)
  }, [])

  // Save to localStorage when selectedBookId changes
  React.useEffect(() => {
    if (isLoaded && selectedBookId) {
      localStorage.setItem('selectedBookId', selectedBookId)
    }
  }, [selectedBookId, isLoaded])

  const handleSetSelectedBookId = React.useCallback((bookId: string | null) => {
    setSelectedBookId(bookId)
    if (bookId) {
      localStorage.setItem('selectedBookId', bookId)
    } else {
      localStorage.removeItem('selectedBookId')
    }
  }, [])

  return (
    <SelectedBookContext.Provider value={{ selectedBookId, setSelectedBookId: handleSetSelectedBookId }}>
      {children}
    </SelectedBookContext.Provider>
  )
}

export function useSelectedBook() {
  const context = React.useContext(SelectedBookContext)
  if (!context) {
    throw new Error('useSelectedBook must be used within a SelectedBookProvider')
  }
  return context
} 