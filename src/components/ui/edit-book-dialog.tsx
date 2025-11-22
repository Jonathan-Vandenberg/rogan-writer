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
import { ORGANIZED_GENRES } from "@/lib/genres"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { cn } from "@/lib/utils"
import { BookOpen, Settings, Loader2, Trash2, Image as ImageIcon, Upload, Sparkles, Replace } from "lucide-react"

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
  onBookDeleted?: () => void
}

// Genres are now imported from @/lib/genres for better organization and research targeting

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

export function EditBookDialog({ book, open, onOpenChange, onBookUpdated, onBookDeleted }: EditBookDialogProps) {
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isGeneratingCover, setIsGeneratingCover] = React.useState(false)
  const [isUploadingCover, setIsUploadingCover] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [showDeleteCoverConfirm, setShowDeleteCoverConfirm] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("basic")
  const [coverTab, setCoverTab] = React.useState<"upload" | "generate">("upload")
  const [coverPrompt, setCoverPrompt] = React.useState("")
  const [dragOver, setDragOver] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
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

  const handleUploadCover = async (file: File) => {
    setIsUploadingCover(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/books/${book.id}/upload-cover`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload cover image')
      }

      const data = await response.json()
      // Update form data with new cover image URL
      setFormData(prev => ({
        ...prev,
        coverImageUrl: data.book.coverImageUrl || "",
      }))
      // Notify parent component
      if (onBookUpdated) {
        onBookUpdated({
          ...book,
          coverImageUrl: data.book.coverImageUrl,
        })
      }
    } catch (error) {
      console.error('Error uploading cover image:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload cover image')
    } finally {
      setIsUploadingCover(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleUploadCover(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDeleteCoverClick = () => {
    setShowDeleteCoverConfirm(true)
  }

  const handleDeleteCover = async () => {
    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImageUrl: null }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete cover image')
      }

      const updatedBook = await response.json()
      
      // Update form data
      setFormData(prev => ({
        ...prev,
        coverImageUrl: "",
      }))
      
      // Notify parent component
      if (onBookUpdated) {
        onBookUpdated({
          ...book,
          coverImageUrl: null,
        })
      }

      setShowDeleteCoverConfirm(false)
    } catch (error) {
      console.error('Error deleting cover image:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete cover image')
    }
  }

  const handleGenerateCover = async () => {
    setIsGeneratingCover(true)
    
    try {
      const response = await fetch(`/api/books/${book.id}/generate-cover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: coverPrompt.trim() || null, // Send null if empty to use auto-generation
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update form data with new cover image URL
        setFormData(prev => ({
          ...prev,
          coverImageUrl: data.book.coverImageUrl || "",
        }))
        // Notify parent component
        if (onBookUpdated) {
          onBookUpdated({
            ...book,
            coverImageUrl: data.book.coverImageUrl,
          })
        }
      } else {
        const error = await response.json()
        setErrors({ submit: error.error || 'Failed to generate cover art' })
      }
    } catch (error) {
      console.error('Error generating cover art:', error)
      setErrors({ submit: 'Failed to generate cover art. Please try again.' })
    } finally {
      setIsGeneratingCover(false)
    }
  }

  const handleDeleteBook = async () => {
    setIsDeleting(true)
    
    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('bookDeleted', { detail: { bookId: book.id } }))
        onBookDeleted?.()
        onOpenChange(false)
        setShowDeleteConfirm(false)
      } else {
        const error = await response.json()
        setErrors({ submit: error.error || 'Failed to delete book' })
      }
    } catch (error) {
      console.error('Error deleting book:', error)
      setErrors({ submit: 'Failed to delete book. Please try again.' })
    } finally {
      setIsDeleting(false)
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
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor="coverImage">Cover Image</Label>
                  {formData.coverImageUrl && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setCoverTab("upload")}
                        title="Replace cover image"
                      >
                        <Replace className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={handleDeleteCoverClick}
                        title="Delete cover image"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                {formData.coverImageUrl && (
                  <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden border border-border mb-2">
                    <img
                      src={formData.coverImageUrl}
                      alt="Book cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <Tabs value={coverTab} onValueChange={(value) => setCoverTab(value as "upload" | "generate")} className="w-full">
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
                        dragOver 
                          ? "border-primary bg-primary/5" 
                          : "border-muted-foreground/25 hover:border-muted-foreground/50"
                      )}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                    >
                      <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium mb-1">Drag and drop an image here</p>
                      <p className="text-xs text-muted-foreground mb-4">or</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleUploadCover(file)
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingCover || isUpdating}
                      >
                        {isUploadingCover ? (
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
                <div className="space-y-2">
                  <Label htmlFor="coverPrompt" className="text-sm">
                    Cover Art Prompt (Optional)
                  </Label>
                  <Textarea
                    id="coverPrompt"
                    value={coverPrompt}
                    onChange={(e) => setCoverPrompt(e.target.value)}
                    placeholder="Describe what you want the cover to look like... (Leave empty to auto-generate from title and description)"
                    rows={4}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {coverPrompt.trim() 
                      ? "Your custom prompt will be used for image generation."
                      : "If left empty, a prompt will be automatically generated from your book's title and description."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateCover}
                  disabled={isGeneratingCover || isUpdating}
                  className="w-full"
                >
                  {isGeneratingCover ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Cover Art...
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

            <div className="flex justify-between items-center pt-4 border-t">
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isUpdating || isDeleting}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Book
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={isUpdating || isDeleting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating || isDeleting}>
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
            </div>
          </form>
        </Tabs>
      </DialogContent>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Book
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{book.title}"? This action cannot be undone and will permanently remove:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>All chapters and content</li>
              <li>All characters and locations</li>
              <li>All timeline events and plot points</li>
              <li>All scene cards and brainstorming notes</li>
              <li>All research items and collaborators</li>
              <li>All writing sessions and export history</li>
            </ul>
            
            <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
              <p className="text-sm font-medium text-destructive">
                ⚠️ This action is permanent and cannot be reversed
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteBook}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Forever
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Cover Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteCoverConfirm}
        onOpenChange={setShowDeleteCoverConfirm}
        title="Delete Cover Image"
        description="Are you sure you want to remove the cover image? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteCover}
      />
    </Dialog>
  )
} 