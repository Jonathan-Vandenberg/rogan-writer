"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Palette, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"

const predefinedColors = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#FFB347", // Orange
  "#98D8C8", // Mint
  "#F7DC6F", // Light Yellow
  "#BB8FCE", // Lavender
  "#85C1E9", // Light Blue
  "#F8C471", // Peach
]

interface MoodSettings {
  color: string
  opacity: number
  enabled: boolean
}

interface MoodOverlayProps {
  showText?: boolean
}

export function MoodOverlay({ showText = true }: MoodOverlayProps = {}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [moodSettings, setMoodSettings] = React.useState<MoodSettings>({
    color: "#4ECDC4",
    opacity: 3,
    enabled: false
  })
  const [isMounted, setIsMounted] = React.useState(false)
  const [hasLoaded, setHasLoaded] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const cardRef = React.useRef<HTMLDivElement>(null)

  // Ensure component is mounted (for SSR compatibility)
  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Handle click outside to close
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        cardRef.current && 
        !cardRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Load settings from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('mood-settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setMoodSettings(parsed)
      } catch (error) {
        console.error('Failed to load mood settings:', error)
      }
    }
    setHasLoaded(true)
  }, [])

  // Save settings to localStorage whenever they change (but only after initial load)
  React.useEffect(() => {
    if (hasLoaded) {
      localStorage.setItem('mood-settings', JSON.stringify(moodSettings))
    }
  }, [moodSettings, hasLoaded])

  const handleColorChange = (color: string) => {
    setMoodSettings(prev => ({ ...prev, color }))
  }

  const handleOpacityChange = (value: number[]) => {
    setMoodSettings(prev => ({ ...prev, opacity: value[0] }))
  }

  const toggleMood = () => {
    setMoodSettings(prev => ({ ...prev, enabled: !prev.enabled }))
  }

  const resetMood = () => {
    const defaultSettings = { color: "#4ECDC4", opacity: 3, enabled: false }
    setMoodSettings(defaultSettings)
    localStorage.setItem('mood-settings', JSON.stringify(defaultSettings))
  }

  // Render overlay using portal for consistent z-index behavior
  const renderOverlay = () => {
    if (!isMounted || !moodSettings.enabled) return null
    
    return createPortal(
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundColor: moodSettings.color,
          opacity: moodSettings.opacity / 100,
          zIndex: 2147483647, // Maximum safe z-index value
        }}
      />,
      document.body
    )
  }

  return (
    <div className="relative">
      {/* Global Mood Overlay - Rendered via Portal */}
      {renderOverlay()}

      {/* Mood Button */}
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className={`gap-2 ${moodSettings.enabled ? 'text-primary' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Palette className="h-4 w-4" />
        {showText && <span className="sr-only sm:not-sr-only">Mood</span>}
      </Button>

      {/* Floating Mood Control Card */}
      {isOpen && (
        <Card 
          ref={cardRef}
          className="absolute bottom-full mb-2 left-0 w-80 shadow-lg border z-50"
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Overlay
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Enable Overlay</Label>
              <Button
                variant={moodSettings.enabled ? "default" : "outline"}
                size="sm"
                onClick={toggleMood}
                className="h-7 px-3 text-xs"
              >
                {moodSettings.enabled ? "Enabled" : "Disabled"}
              </Button>
            </div>

            {/* Color Palette */}
            <div className="space-y-2">
              <Label className="text-sm">Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {predefinedColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                      moodSettings.color === color
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              
              {/* Custom Color Input */}
              <div className="flex items-center gap-2 text-xs mt-6">
                <Label htmlFor="custom-color" className="text-xs">Custom:</Label>
                <input
                  id="custom-color"
                  type="color"
                  value={moodSettings.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-6 h-6 rounded border border-gray-300 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground font-mono">
                  {moodSettings.color}
                </span>
              </div>
            </div>

            {/* Opacity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Transparency</Label>
                <span className="text-xs text-muted-foreground">
                  {moodSettings.opacity}%
                </span>
              </div>
              <Slider
                value={[moodSettings.opacity]}
                onValueChange={handleOpacityChange}
                max={20}
                min={1}
                step={1}
                className="w-full"
              />
            </div>

            {/* Reset Button */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={resetMood} className="h-7 px-3 text-xs">
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 