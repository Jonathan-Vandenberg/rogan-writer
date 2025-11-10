"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ORGANIZED_GENRES } from "@/lib/genres"

interface CreateBookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBookCreated?: (book: any) => void
}

// Genres are now imported from @/lib/genres for better organization and research targeting

export function CreateBookDialog({ open, onOpenChange, onBookCreated }: CreateBookDialogProps) {
  const [isCreating, setIsCreating] = React.useState(false)
  const [formData, setFormData] = React.useState({
    title: "",
    description: "",
    genre: "",
    targetWords: ""
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.title.trim()) {
      newErrors.title = "Title is required"
    }
    
    if (formData.targetWords && isNaN(parseInt(formData.targetWords))) {
      newErrors.targetWords = "Target words must be a number"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsCreating(true)
    
    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || undefined,
          genre: formData.genre || undefined,
          targetWords: formData.targetWords ? parseInt(formData.targetWords) : undefined,
        }),
      })

      if (response.ok) {
        const book = await response.json()
        onBookCreated?.(book)
        onOpenChange(false)
        // Reset form
        setFormData({
          title: "",
          description: "",
          genre: "",
          targetWords: ""
        })
      } else {
        const error = await response.json()
        setErrors({ submit: error.error || 'Failed to create book' })
      }
    } catch (error) {
      console.error('Error creating book:', error)
      setErrors({ submit: 'Failed to create book. Please try again.' })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Book</DialogTitle>
          <DialogDescription>
            Start your new writing project. You can always update these details later.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter your book title"
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Brief description of your book (optional)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="genre">Genre</Label>
            <Select value={formData.genre} onValueChange={(value) => handleInputChange("genre", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a genre (optional)" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {ORGANIZED_GENRES.map((category) => (
                  <div key={category.category}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                      {category.category}
                    </div>
                    {category.genres.map((genre) => (
                      <SelectItem key={genre.value} value={genre.value} className="pl-4">
                        {genre.label}
                      </SelectItem>
                    ))}
                    {category.category !== 'Creative & Other' && (
                      <div className="border-b mx-2 my-1" />
                    )}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetWords">Target Word Count</Label>
            <Input
              id="targetWords"
              type="number"
              value={formData.targetWords}
              onChange={(e) => handleInputChange("targetWords", e.target.value)}
              placeholder="50000"
              min="1"
              className={errors.targetWords ? "border-red-500" : ""}
            />
            {errors.targetWords && (
              <p className="text-sm text-red-500">{errors.targetWords}</p>
            )}
          </div>

          {errors.submit && (
            <p className="text-sm text-red-500">{errors.submit}</p>
          )}

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 