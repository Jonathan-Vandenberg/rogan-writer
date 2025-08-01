"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Search, Edit, Trash2, Lightbulb } from 'lucide-react'
import type { BrainstormingNote } from '@prisma/client'

interface BrainstormingNotesProps {
  bookId: string
}

export function BrainstormingNotes({ bookId }: BrainstormingNotesProps) {
  const [notes, setNotes] = useState<BrainstormingNote[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<BrainstormingNote | null>(null)
  const [viewingNote, setViewingNote] = useState<BrainstormingNote | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: [] as string[]
  })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    fetchNotes()
  }, [bookId, searchQuery])

  const fetchNotes = async () => {
    try {
      setIsLoading(true)
      const url = searchQuery 
        ? `/api/books/${bookId}/brainstorming?search=${encodeURIComponent(searchQuery)}`
        : `/api/books/${bookId}/brainstorming`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setNotes(data)
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.content.trim()) return

    try {
      const response = await fetch(`/api/books/${bookId}/brainstorming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setFormData({ title: '', content: '', tags: [] })
        setIsCreateDialogOpen(false)
        fetchNotes()
      }
    } catch (error) {
      console.error('Error creating note:', error)
    }
  }

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingNote || !formData.title.trim() || !formData.content.trim()) return

    try {
      const response = await fetch(`/api/books/${bookId}/brainstorming/${editingNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setEditingNote(null)
        setFormData({ title: '', content: '', tags: [] })
        fetchNotes()
      }
    } catch (error) {
      console.error('Error updating note:', error)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    try {
      const response = await fetch(`/api/books/${bookId}/brainstorming/${noteId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchNotes()
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const startEditing = (note: BrainstormingNote) => {
    setEditingNote(note)
    setFormData({
      title: note.title,
      content: note.content,
      tags: note.tags
    })
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const resetForm = () => {
    setFormData({ title: '', content: '', tags: [] })
    setTagInput('')
    setEditingNote(null)
    setViewingNote(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className='space-y-2'>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-yellow-500" />
            Brainstorming
          </h1>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Note</DialogTitle>
              <DialogDescription>
                Add a new brainstorming note to capture your ideas
              </DialogDescription>
            </DialogHeader>
            <NoteForm
              formData={formData}
              setFormData={setFormData}
              tagInput={tagInput}
              setTagInput={setTagInput}
              onSubmit={handleCreateNote}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              submitLabel="Create Note"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Notes List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Notes Yet</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? `No notes found for "${searchQuery}"`
                : "Start brainstorming by creating your first note"
              }
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Note
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card 
              key={note.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setViewingNote(note)}
            >
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">{note.title}</CardTitle>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(note)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {new Date(note.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {note.content}
                </p>
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Make changes to your brainstorming note
            </DialogDescription>
          </DialogHeader>
          <NoteForm
            formData={formData}
            setFormData={setFormData}
            tagInput={tagInput}
            setTagInput={setTagInput}
            onSubmit={handleUpdateNote}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            submitLabel="Update Note"
          />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => !open && setViewingNote(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl pr-8">{viewingNote?.title}</DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>Created {viewingNote && new Date(viewingNote.createdAt).toLocaleDateString()}</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (viewingNote) {
                      startEditing(viewingNote)
                      setViewingNote(null)
                    }
                  }}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (viewingNote) {
                      setViewingNote(null)
                      await handleDeleteNote(viewingNote.id)
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div 
            className="flex-1 overflow-y-scroll min-h-0 py-4 pr-4 modal-scrollbar"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 #f1f5f9'
            }}
          >
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {viewingNote?.content}
              </div>
            </div>
          </div>

          {viewingNote?.tags && viewingNote.tags.length > 0 && (
            <div className="flex-shrink-0 pt-4 border-t">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-muted-foreground">Tags:</span>
                {viewingNote.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
                 </DialogContent>
       </Dialog>
    </div>
  )
}

// Separate form component to avoid duplication
interface NoteFormProps {
  formData: { title: string; content: string; tags: string[] }
  setFormData: React.Dispatch<React.SetStateAction<{ title: string; content: string; tags: string[] }>>
  tagInput: string
  setTagInput: React.Dispatch<React.SetStateAction<string>>
  onSubmit: (e: React.FormEvent) => void
  onAddTag: () => void
  onRemoveTag: (tag: string) => void
  submitLabel: string
}

function NoteForm({
  formData,
  setFormData,
  tagInput,
  setTagInput,
  onSubmit,
  onAddTag,
  onRemoveTag,
  submitLabel
}: NoteFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className='space-y-2'>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter note title..."
          required
        />
      </div>
      
      <div className='space-y-2'>
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Write your ideas here..."
          rows={8}
          required
          className='h-96'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor="tags">Tags</Label>
        <div className="flex gap-2">
          <Input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add a tag..."
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), onAddTag())}
          />
          <Button type="button" variant="outline" onClick={onAddTag}>
            Add
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {formData.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => onRemoveTag(tag)}>
                {tag} ×
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
} 