"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Bookmark, Search, Edit, Trash2, GripVertical, Target, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { SceneCard, SceneStatus, Chapter } from '@prisma/client'

// Scene status configurations
const SCENE_STATUSES: { 
  status: SceneStatus
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
}[] = [
  { status: 'PLANNED', label: 'Planned', icon: CheckCircle, color: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700', description: 'Scene idea mapped out' },
  { status: 'DRAFT', label: 'Draft', icon: CheckCircle, color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800', description: 'First draft written' },
  { status: 'REVISED', label: 'Revised', icon: CheckCircle, color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800', description: 'Undergoing revisions' },
  { status: 'COMPLETE', label: 'Complete', icon: CheckCircle, color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800', description: 'Scene finished' },
]

interface SceneCardWithChapter extends SceneCard {
  chapter?: Chapter | null
}

interface SceneCardBoardProps {
  bookId: string
}

export function SceneCardBoard({ bookId }: SceneCardBoardProps) {
  const [sceneCards, setSceneCards] = useState<SceneCardWithChapter[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<SceneCardWithChapter | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    purpose: '',
    conflict: '',
    outcome: '',
    chapterId: 'none'
  })

  useEffect(() => {
    fetchSceneCards()
    fetchChapters()
  }, [bookId])

  const fetchSceneCards = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/books/${bookId}/scene-cards`)
      if (response.ok) {
        const data = await response.json()
        setSceneCards(data)
      }
    } catch (error) {
      console.error('Error fetching scene cards:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchChapters = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/chapters`)
      if (response.ok) {
        const data = await response.json()
        setChapters(data)
      }
    } catch (error) {
      console.error('Error fetching chapters:', error)
    }
  }

  const handleCreateSceneCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    try {
      const response = await fetch(`/api/books/${bookId}/scene-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          chapterId: formData.chapterId === 'none' ? null : formData.chapterId
        })
      })

      if (response.ok) {
        resetForm()
        setIsCreateDialogOpen(false)
        fetchSceneCards()
      }
    } catch (error) {
      console.error('Error creating scene card:', error)
    }
  }

  const handleUpdateSceneCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCard || !formData.title.trim()) return

    try {
      const response = await fetch(`/api/books/${bookId}/scene-cards/${editingCard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          chapterId: formData.chapterId === 'none' ? null : formData.chapterId
        })
      })

      if (response.ok) {
        setEditingCard(null)
        resetForm()
        fetchSceneCards()
      }
    } catch (error) {
      console.error('Error updating scene card:', error)
    }
  }

  const handleDeleteSceneCard = async (cardId: string) => {
    if (!confirm('Are you sure you want to delete this scene card?')) return

    try {
      const response = await fetch(`/api/books/${bookId}/scene-cards/${cardId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchSceneCards()
      }
    } catch (error) {
      console.error('Error deleting scene card:', error)
    }
  }

  const handleStatusChange = async (cardId: string, newStatus: SceneStatus) => {
    try {
      const response = await fetch(`/api/books/${bookId}/scene-cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        fetchSceneCards()
      }
    } catch (error) {
      console.error('Error updating scene status:', error)
    }
  }

  const startEditing = (card: SceneCardWithChapter) => {
    setEditingCard(card)
    setFormData({
      title: card.title,
      description: card.description || '',
      purpose: card.purpose || '',
      conflict: card.conflict || '',
      outcome: card.outcome || '',
      chapterId: card.chapterId || 'none'
    })
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      purpose: '',
      conflict: '',
      outcome: '',
      chapterId: 'none'
    })
    setEditingCard(null)
  }

  const getScenesByStatus = (status: SceneStatus) => {
    return sceneCards.filter(card => card.status === status)
      .filter(card => 
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.purpose?.toLowerCase().includes(searchQuery.toLowerCase())
      )
  }

  const getSceneStats = () => {
    const total = sceneCards.length
    const byStatus = SCENE_STATUSES.reduce((acc, statusConfig) => {
      acc[statusConfig.status] = getScenesByStatus(statusConfig.status).length
      return acc
    }, {} as Record<SceneStatus, number>)

    return { total, byStatus }
  }

  const stats = getSceneStats()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-64 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="h-6 bg-muted rounded w-24 animate-pulse"></div>
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-32 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bookmark className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            Scene Cards
          </h1>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              {stats.total} Scene{stats.total !== 1 ? 's' : ''}
            </Badge>
            {SCENE_STATUSES.map((statusConfig) => (
              <Badge key={statusConfig.status} variant="secondary" className={statusConfig.color}>
                {stats.byStatus[statusConfig.status]} {statusConfig.label}
              </Badge>
            ))}
          </div>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Scene
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Scene</DialogTitle>
              <DialogDescription>
                Plan a new scene for your story
              </DialogDescription>
            </DialogHeader>
            <SceneCardForm
              formData={formData}
              setFormData={setFormData}
              chapters={chapters}
              onSubmit={handleCreateSceneCard}
              submitLabel="Create Scene"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search scenes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {SCENE_STATUSES.map((statusConfig) => {
          const scenesInStatus = getScenesByStatus(statusConfig.status)
          const StatusIcon = statusConfig.icon

          return (
            <div key={statusConfig.status} className="space-y-4">
              {/* Column Header */}
              <div className={`p-4 rounded-lg border-2 ${statusConfig.color}`}>
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-5 w-5" />
                  <h3 className="font-semibold">{statusConfig.label}</h3>
                  <Badge variant="outline" className="ml-auto">
                    {scenesInStatus.length}
                  </Badge>
                </div>
                <p className="text-xs mt-1">{statusConfig.description}</p>
              </div>

              {/* Scene Cards */}
              <div className="space-y-3 min-h-[400px]">
                {scenesInStatus.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    No scenes in {statusConfig.label.toLowerCase()}
                  </div>
                ) : (
                  scenesInStatus.map((card) => (
                    <SceneCardItem
                      key={card.id}
                      card={card}
                      onEdit={startEditing}
                      onDelete={handleDeleteSceneCard}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Scene</DialogTitle>
            <DialogDescription>
              Modify your scene details
            </DialogDescription>
          </DialogHeader>
          <SceneCardForm
            formData={formData}
            setFormData={setFormData}
            chapters={chapters}
            onSubmit={handleUpdateSceneCard}
            submitLabel="Update Scene"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Individual scene card component
interface SceneCardItemProps {
  card: SceneCardWithChapter
  onEdit: (card: SceneCardWithChapter) => void
  onDelete: (cardId: string) => void
  onStatusChange: (cardId: string, status: SceneStatus) => void
}

function SceneCardItem({ card, onEdit, onDelete, onStatusChange }: SceneCardItemProps) {
  const statusConfig = SCENE_STATUSES.find(s => s.status === card.status) || SCENE_STATUSES[0]
  const StatusIcon = statusConfig.icon

  return (
    <Card className="hover:shadow-md transition-shadow cursor-move">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold line-clamp-2">
              {card.title}
            </CardTitle>
            {card.chapter && (
              <CardDescription className="text-xs">
                {card.chapter.title}
              </CardDescription>
            )}
          </div>
          <div className="flex gap-1 ml-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <StatusIcon className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {SCENE_STATUSES.map((status) => (
                  <DropdownMenuItem
                    key={status.status}
                    onClick={() => onStatusChange(card.id, status.status)}
                    className={card.status === status.status ? 'bg-muted' : ''}
                  >
                    <status.icon className="h-3 w-3 mr-2" />
                    {status.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(card)}
              className="h-6 w-6 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(card.id)}
              className="h-6 w-6 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        {card.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {card.description}
          </p>
        )}
        
        {(card.purpose || card.conflict || card.outcome) && (
          <div className="space-y-1">
            {card.purpose && (
              <div className="text-xs">
                <span className="font-medium text-blue-600 dark:text-blue-400">Purpose:</span> {card.purpose}
              </div>
            )}
            {card.conflict && (
              <div className="text-xs">
                <span className="font-medium text-red-600 dark:text-red-400">Conflict:</span> {card.conflict}
              </div>
            )}
            {card.outcome && (
              <div className="text-xs">
                <span className="font-medium text-green-600 dark:text-green-400">Outcome:</span> {card.outcome}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>#{card.orderIndex + 1}</span>
          {card.wordCount > 0 && <span>{card.wordCount} words</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// Scene card form component
interface SceneCardFormProps {
  formData: {
    title: string
    description: string
    purpose: string
    conflict: string
    outcome: string
    chapterId: string
  }
  setFormData: React.Dispatch<React.SetStateAction<{
    title: string
    description: string
    purpose: string
    conflict: string
    outcome: string
    chapterId: string
  }>>
  chapters: Chapter[]
  onSubmit: (e: React.FormEvent) => void
  submitLabel: string
}

function SceneCardForm({ formData, setFormData, chapters, onSubmit, submitLabel }: SceneCardFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Scene Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Scene title..."
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="chapter">Chapter (optional)</Label>
          <Select 
            value={formData.chapterId} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, chapterId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select chapter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No chapter</SelectItem>
              {chapters.map((chapter) => (
                <SelectItem key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="What happens in this scene..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="purpose">Purpose</Label>
        <Textarea
          id="purpose"
          value={formData.purpose}
          onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
          placeholder="What is this scene's purpose in the story..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="conflict">Conflict</Label>
        <Textarea
          id="conflict"
          value={formData.conflict}
          onChange={(e) => setFormData(prev => ({ ...prev, conflict: e.target.value }))}
          placeholder="What conflict or tension drives this scene..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="outcome">Outcome</Label>
        <Textarea
          id="outcome"
          value={formData.outcome}
          onChange={(e) => setFormData(prev => ({ ...prev, outcome: e.target.value }))}
          placeholder="How does this scene end or what changes..."
          rows={2}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
} 