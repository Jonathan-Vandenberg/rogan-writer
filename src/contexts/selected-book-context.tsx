"use client"

import * as React from "react"

interface SelectedBookContextType {
  selectedBookId: string | null
  setSelectedBookId: (bookId: string | null) => void
}

const SelectedBookContext = React.createContext<SelectedBookContextType | null>(null)

export function SelectedBookProvider({ children }: { children: React.ReactNode }) {
  const [selectedBookId, setSelectedBookId] = React.useState<string | null>(null)

  return (
    <SelectedBookContext.Provider value={{ selectedBookId, setSelectedBookId }}>
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