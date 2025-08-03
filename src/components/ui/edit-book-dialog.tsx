"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Settings, Loader2 } from "lucide-react"

interface Book {
  id: string
  title: string
  description?: string | null
  genre?: string | null
  targetWords?: number | null
  status: string
  coverImageUrl?: string | null
  pageWidth: number
  pageHeight: number
  fontSize: number
  fontFamily: string
  lineHeight: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
}

interface EditBookDialogProps {
  book: Book
  open: boolean
  onOpenChange: (open: boolean) => void
  onBookUpdated?: (book: Book) => void
}

const genres = [
  "Fiction",
  "Non-Fiction", 
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Thriller",
  "Romance",
  "Horror",
  "Biography",
  "Memoir",
  "Self-Help",
  "Business",
  "History",
  "Travel",
  "Children's",
  "Young Adult",
  "Poetry",
  "Drama",
  "Comedy",
  "Other"
]

const bookStatuses = [
  { value: "DRAFT", label: "Draft" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "FIRST_DRAFT_COMPLETE", label: "First Draft Complete" },
  { value: "EDITING", label: "Editing" },
  { value: "BETA_READING", label: "Beta Reading" },
  { value: "FINAL_DRAFT", label: "Final Draft" },
  { value: "PUBLISHED", label: "Published" }
]

const fontFamilies = [
  "Verdana",
  "Minion Pro",
  "Times New Roman",
]

const pageSizes = [
  { value: "5x8", label: "5\" × 8\" (Mass Market)", width: 5.0, height: 8.0 },
  { value: "5.25x8", label: "5.25\" × 8\" (Digest)", width: 5.25, height: 8.0 },
  { value: "5.5x8.5", label: "5.5\" × 8.5\" (A5)", width: 5.5, height: 8.5 },
  { value: "6x9", label: "6\" × 9\" (Trade)", width: 6.0, height: 9.0 },
  { value: "6.14x9.21", label: "6.14\" × 9.21\" (A5)", width: 6.14, height: 9.21 },
  { value: "7x10", label: "7\" × 10\" (Royal)", width: 7.0, height: 10.0 },
  { value: "8.5x11", label: "8.5\" × 11\" (Letter)", width: 8.5, height: 11.0 },
  { value: "custom", label: "Custom Size", width: 6.0, height: 9.0 }
]

export function EditBookDialog({ book, open, onOpenChange, onBookUpdated }: EditBookDialogProps) {
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("basic")
  const [formData, setFormData] = React.useState({
    title: book.title,
    description: book.description || "",
    genre: book.genre || "",
    targetWords: book.targetWords?.toString() || "",
    status: book.status,
    coverImageUrl: book.coverImageUrl || "",
    pageWidth: book.pageWidth,
    pageHeight: book.pageHeight,
    fontSize: book.fontSize,
    fontFamily: book.fontFamily,
    lineHeight: book.lineHeight,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0.7,
    marginRight: 0.7
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Update form data when book prop changes
  React.useEffect(() => {
    if (book) {
      setFormData({
        title: book.title,
        description: book.description || "",
        genre: book.genre || "",
        targetWords: book.targetWords?.toString() || "",
        status: book.status,
        coverImageUrl: book.coverImageUrl || "",
        pageWidth: book.pageWidth,
        pageHeight: book.pageHeight,
        fontSize: book.fontSize,
        fontFamily: book.fontFamily,
        lineHeight: book.lineHeight,
        marginTop: book.marginTop,
        marginBottom: book.marginBottom,
        marginLeft: 0.7,
        marginRight: 0.7
      })
    }
  }, [book])

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const handlePageSizeChange = (value: string) => {
    const pageSize = pageSizes.find(size => size.value === value)
    if (pageSize && pageSize.value !== "custom") {
      setFormData(prev => ({
        ...prev,
        pageWidth: pageSize.width,
        pageHeight: pageSize.height
      }))
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

    if (formData.pageWidth <= 0) {
      newErrors.pageWidth = "Page width must be greater than 0"
    }

    if (formData.pageHeight <= 0) {
      newErrors.pageHeight = "Page height must be greater than 0"
    }

    if (formData.fontSize < 8 || formData.fontSize > 24) {
      newErrors.fontSize = "Font size must be between 8 and 24"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsUpdating(true)
    
    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          genre: formData.genre || null,
          targetWords: formData.targetWords ? parseInt(formData.targetWords) : null,
          status: formData.status,
          coverImageUrl: formData.coverImageUrl || null,
          pageWidth: Number(formData.pageWidth),
          pageHeight: Number(formData.pageHeight),
          fontSize: Number(formData.fontSize),
          fontFamily: formData.fontFamily,
          lineHeight: Number(formData.lineHeight),
          marginTop: Number(formData.marginTop),
          marginBottom: Number(formData.marginBottom),
          marginLeft: Number(formData.marginLeft),
          marginRight: Number(formData.marginRight)
        }),
      })

      if (response.ok) {
        const updatedBook = await response.json()
        onBookUpdated?.(updatedBook)
        onOpenChange(false)
      } else {
        const error = await response.json()
        setErrors({ submit: error.error || 'Failed to update book' })
      }
    } catch (error) {
      console.error('Error updating book:', error)
      setErrors({ submit: 'Failed to update book. Please try again.' })
    } finally {
      setIsUpdating(false)
    }
  }

  const currentPageSize = pageSizes.find(
    size => size.width === formData.pageWidth && size.height === formData.pageHeight
  )?.value || "custom"

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PUBLISHED": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "FINAL_DRAFT": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "EDITING": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "IN_PROGRESS": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Edit Book Details
          </DialogTitle>
          <DialogDescription>
            Update your book's information and formatting settings.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Basic Info
            </TabsTrigger>
            <TabsTrigger value="formatting" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Formatting
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4">
            <TabsContent value="basic" className="space-y-4 mt-4">
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
                  placeholder="Brief description of your book"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="genre">Genre</Label>
                  <Select value={formData.genre} onValueChange={(value) => handleInputChange("genre", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genre}
                        </SelectItem>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bookStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${getStatusBadgeColor(status.value)}`}>
                            {status.label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coverImageUrl">Cover Image URL</Label>
                <Input
                  id="coverImageUrl"
                  value={formData.coverImageUrl}
                  onChange={(e) => handleInputChange("coverImageUrl", e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                />
              </div>
            </TabsContent>

            <TabsContent value="formatting" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Page Size</Label>
                <Select value={currentPageSize} onValueChange={handlePageSizeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizes.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pageWidth">Page Width (inches)</Label>
                  <Input
                    id="pageWidth"
                    type="number"
                    step="0.1"
                    min="1"
                    max="20"
                    value={formData.pageWidth}
                    onChange={(e) => handleInputChange("pageWidth", parseFloat(e.target.value))}
                    className={errors.pageWidth ? "border-red-500" : ""}
                  />
                  {errors.pageWidth && (
                    <p className="text-sm text-red-500">{errors.pageWidth}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pageHeight">Page Height (inches)</Label>
                  <Input
                    id="pageHeight"
                    type="number"
                    step="0.1"
                    min="1"
                    max="20"
                    value={formData.pageHeight}
                    onChange={(e) => handleInputChange("pageHeight", parseFloat(e.target.value))}
                    className={errors.pageHeight ? "border-red-500" : ""}
                  />
                  {errors.pageHeight && (
                    <p className="text-sm text-red-500">{errors.pageHeight}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fontSize">Font Size</Label>
                  <Input
                    id="fontSize"
                    type="number"
                    min="8"
                    max="24"
                    value={formData.fontSize}
                    onChange={(e) => handleInputChange("fontSize", parseInt(e.target.value))}
                    className={errors.fontSize ? "border-red-500" : ""}
                  />
                  {errors.fontSize && (
                    <p className="text-sm text-red-500">{errors.fontSize}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Font Family</Label>
                  <Select value={formData.fontFamily} onValueChange={(value) => handleInputChange("fontFamily", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontFamilies.map((font) => (
                        <SelectItem key={font} value={font}>
                          <span style={{ fontFamily: font }}>{font}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lineHeight">Line Height</Label>
                <Input
                  id="lineHeight"
                  type="number"
                  step="0.1"
                  min="1"
                  max="3"
                  value={formData.lineHeight}
                  onChange={(e) => handleInputChange("lineHeight", parseFloat(e.target.value))}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Margins (inches)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marginTop" className="text-sm">Top</Label>
                    <Input
                      id="marginTop"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="5"
                      value={formData.marginTop}
                      onChange={(e) => handleInputChange("marginTop", parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marginBottom" className="text-sm">Bottom</Label>
                    <Input
                      id="marginBottom"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="5"
                      value={formData.marginBottom}
                      onChange={(e) => handleInputChange("marginBottom", parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marginLeft" className="text-sm">Left</Label>
                    <Input
                      id="marginLeft"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="5"
                      value={formData.marginLeft}
                      onChange={(e) => handleInputChange("marginLeft", parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marginRight" className="text-sm">Right</Label>
                    <Input
                      id="marginRight"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="5"
                      value={formData.marginRight}
                      onChange={(e) => handleInputChange("marginRight", parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {errors.submit && (
              <p className="text-sm text-red-500">{errors.submit}</p>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Book"
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
} 