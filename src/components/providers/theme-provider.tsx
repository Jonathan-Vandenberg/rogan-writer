"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Color theme context
type ColorTheme = 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'rose'

interface ColorThemeContextType {
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: string
  defaultTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

const ColorThemeContext = React.createContext<ColorThemeContextType | undefined>(undefined)

export function useColorTheme() {
  const context = React.useContext(ColorThemeContext)
  if (context === undefined) {
    throw new Error('useColorTheme must be used within a ThemeProvider')
  }
  return context
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [colorTheme, setColorTheme] = React.useState<ColorTheme>('default')

  // Apply color theme to document
  React.useEffect(() => {
    const root = document.documentElement
    
    // Remove all theme classes
    root.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-orange', 'theme-rose')
    
    // Add new theme class (except for default)
    if (colorTheme !== 'default') {
      root.classList.add(`theme-${colorTheme}`)
    }
    
    // Save to localStorage
    localStorage.setItem('color-theme', colorTheme)
  }, [colorTheme])

  // Load color theme from localStorage
  React.useEffect(() => {
    const savedColorTheme = localStorage.getItem('color-theme') as ColorTheme
    if (savedColorTheme && savedColorTheme !== colorTheme) {
      setColorTheme(savedColorTheme)
    }
  }, [])

  return (
    <NextThemesProvider 
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
        {children}
      </ColorThemeContext.Provider>
    </NextThemesProvider>
  )
} 