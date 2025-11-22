"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

import { Plus, Target, Edit, Trash2, CheckCircle, Circle, MoreHorizontal, Sparkles } from 'lucide-react'
import { AIPlotSuggestions } from './ai-plot-suggestions'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { PlotPoint, PlotPointType } from '@prisma/client'

// Plot point types in the correct order from the article
const PLOT_POINT_TYPES: { type: PlotPointType; label: string; description: string }[] = [
  { type: 'HOOK', label: 'Hook', description: 'Hero in opposite state to their end state' },
  { type: 'PLOT_TURN_1', label: 'Plot Turn 1', description: 'Hero\'s world changes from status quo' },
  { type: 'PINCH_1', label: 'Pinch 1', description: 'Something goes wrong, forces hero into action' },
  { type: 'MIDPOINT', label: 'Midpoint', description: 'Hero shifts from reaction to action' },
  { type: 'PINCH_2', label: 'Pinch 2', description: 'Something fails, seems hopeless' },
  { type: 'PLOT_TURN_2', label: 'Plot Turn 2', description: 'Hero gets final thing needed to resolve conflict' },
  { type: 'RESOLUTION', label: 'Resolution', description: 'Hero follows through, story concludes' },
]

interface PlotStructureMatrixProps {
  bookId: string
}

interface PlotPointWithSubplot extends PlotPoint {
  subplot: string
}

export function PlotStructureMatrix({ bookId }: PlotStructureMatrixProps) {
  const [plotPoints, setPlotPoints] = useState<PlotPointWithSubplot[]>([])
  const [subplots, setSubplots] = useState<string[]>(['main'])
  const [isLoading, setIsLoading] = useState(true)
  const [editingPoint, setEditingPoint] = useState<PlotPointWithSubplot | null>(null)
  const [viewingPoint, setViewingPoint] = useState<PlotPointWithSubplot | null>(null)
  const [isAddSubplotOpen, setIsAddSubplotOpen] = useState(false)
  const [isAIPlotOpen, setIsAIPlotOpen] = useState(false)
  const [newSubplotName, setNewSubplotName] = useState('')

  // Form state for editing plot points
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    completed: false
  })

  const fetchPlotPoints = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/books/${bookId}/plot-points`)
      if (response.ok) {
        const data = await response.json()
        setPlotPoints(data)
        
                         // Extract unique subplots and sort by creation date
        const subplotGroups = data.reduce((acc: Record<string, Date>, plotPoint: PlotPoint) => {
          const subplot = plotPoint.subplot || 'main'
          const createdAt = new Date(plotPoint.createdAt)
          
          if (!acc[subplot] || createdAt < acc[subplot]) {
            acc[subplot] = createdAt
          }
          return acc
        }, {})

        // Sort subplots by earliest creation date, keeping 'main' first
        const sortedSubplots = Object.entries(subplotGroups)
          .sort(([subplotA, dateA], [subplotB, dateB]) => {
            // Always keep 'main' first
            if (subplotA === 'main') return -1
            if (subplotB === 'main') return 1
            // Sort others by creation date
            return (dateA as Date).getTime() - (dateB as Date).getTime()
          })
          .map(([subplot]) => subplot)

        const newSubplots = sortedSubplots.length > 0 ? sortedSubplots : ['main']
        
        // Only update subplots if they actually changed (prevents unnecessary re-renders)
        if (JSON.stringify(newSubplots) !== JSON.stringify(subplots)) {
          console.log('📋 Parent: setSubplots called')
          setSubplots(newSubplots)
        }
      }
    } catch (error) {
      console.error('Error fetching plot points:', error)
    } finally {
      setIsLoading(false)
    }
  }, [bookId, subplots])

  // Silent version that doesn't trigger loading state
  const fetchPlotPointsSilently = useCallback(async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/plot-points`)
      if (response.ok) {
        const data = await response.json()
        setPlotPoints(data)
        
        // Extract unique subplots and sort by creation date
        const subplotGroups = data.reduce((acc: Record<string, Date>, plotPoint: PlotPoint) => {
          const subplot = plotPoint.subplot || 'main'
          const createdAt = new Date(plotPoint.createdAt)
          
          if (!acc[subplot] || createdAt < acc[subplot]) {
            acc[subplot] = createdAt
          }
          return acc
        }, {})

        // Sort subplots by earliest creation date, keeping 'main' first
        const sortedSubplots = Object.entries(subplotGroups)
          .sort(([subplotA, dateA], [subplotB, dateB]) => {
            // Always keep 'main' first
            if (subplotA === 'main') return -1
            if (subplotB === 'main') return 1
            // Sort others by creation date
            return (dateA as Date).getTime() - (dateB as Date).getTime()
          })
          .map(([subplot]) => subplot)

        const newSubplots = sortedSubplots.length > 0 ? sortedSubplots : ['main']
        
        // Only update subplots if they actually changed (prevents unnecessary re-renders)
        if (JSON.stringify(newSubplots) !== JSON.stringify(subplots)) {
          console.log('📋 Parent: setSubplots called')
          setSubplots(newSubplots)
        }
      }
    } catch (error) {
      console.error('Error fetching plot points:', error)
    }
    // No setIsLoading - this prevents the loading skeleton that unmounts components
  }, [bookId, subplots])

  // Memoized callback to prevent unnecessary re-renders of AIPlotSuggestions  
  const handleSuggestionAccepted = useCallback(() => {
    console.log('🔄 Parent: fetchPlotPoints called (silent refresh)')
    // Silent refresh - don't show loading to prevent unmounting AIPlotSuggestions
    fetchPlotPointsSilently()
  }, [fetchPlotPointsSilently])

  useEffect(() => {
    fetchPlotPoints()
  }, [fetchPlotPoints])

  // Refresh when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('📋 Page visible, refreshing plot points...')
        fetchPlotPointsSilently()
      }
    }

    // Refresh when window regains focus (user switches back to tab/window)
    const handleFocus = () => {
      console.log('📋 Window focused, refreshing plot points...')
      fetchPlotPointsSilently()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    // Also listen for custom refresh events (e.g., from comprehensive analysis)
    const handleRefreshEvent = () => {
      console.log('📋 Refresh event received, refreshing plot points...')
      fetchPlotPointsSilently()
    }
    window.addEventListener('plot-points-updated', handleRefreshEvent)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('plot-points-updated', handleRefreshEvent)
    }
  }, [fetchPlotPointsSilently])

  const getPlotPointForSubplot = (subplot: string, type: PlotPointType): PlotPointWithSubplot | null => {
    return plotPoints.find(p => (p.subplot || 'main') === subplot && p.type === type) || null
  }

  const handleCreatePlotPoint = async (subplot: string, type: PlotPointType) => {
    const defaultPoint = PLOT_POINT_TYPES.find(p => p.type === type)
    if (!defaultPoint) return

    try {
      const response = await fetch(`/api/books/${bookId}/plot-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: defaultPoint.label,
          description: defaultPoint.description,
          subplot: subplot === 'main' ? null : subplot,
          orderIndex: PLOT_POINT_TYPES.findIndex(p => p.type === type) + 1
        })
      })

      if (response.ok) {
        const newPlotPoint = await response.json()
        setPlotPoints(prev => [...prev, { ...newPlotPoint, subplot: newPlotPoint.subplot || 'main' }])
      }
    } catch (error) {
      console.error('Error creating plot point:', error)
    }
  }

  const handleUpdatePlotPoint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPoint) return

    try {
      const response = await fetch(`/api/books/${bookId}/plot-points/${editingPoint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const updatedPlotPoint = await response.json()
        setPlotPoints(prev => prev.map(p => 
          p.id === editingPoint.id 
            ? { ...updatedPlotPoint, subplot: updatedPlotPoint.subplot || 'main' }
            : p
        ))
        setEditingPoint(null)
        setFormData({ title: '', description: '', completed: false })
      }
    } catch (error) {
      console.error('Error updating plot point:', error)
    }
  }

  const handleDeletePlotPoint = async (plotPoint: PlotPointWithSubplot) => {
    if (!confirm('Are you sure you want to delete this plot point?')) return

    try {
      const response = await fetch(`/api/books/${bookId}/plot-points/${plotPoint.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setPlotPoints(prev => prev.filter(p => p.id !== plotPoint.id))
      }
    } catch (error) {
      console.error('Error deleting plot point:', error)
    }
  }

  const handleToggleComplete = async (plotPoint: PlotPointWithSubplot) => {
    try {
      // Optimistically update the UI first
      setPlotPoints(prev => prev.map(p => 
        p.id === plotPoint.id 
          ? { ...p, completed: !p.completed }
          : p
      ))

      const response = await fetch(`/api/books/${bookId}/plot-points/${plotPoint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !plotPoint.completed })
      })

      if (!response.ok) {
        // Revert the optimistic update if the API call failed
        setPlotPoints(prev => prev.map(p => 
          p.id === plotPoint.id 
            ? { ...p, completed: plotPoint.completed }
            : p
        ))
      }
    } catch (error) {
      console.error('Error toggling plot point:', error)
      // Revert the optimistic update on error
      setPlotPoints(prev => prev.map(p => 
        p.id === plotPoint.id 
          ? { ...p, completed: plotPoint.completed }
          : p
      ))
    }
  }

  const startEditing = (plotPoint: PlotPointWithSubplot) => {
    setEditingPoint(plotPoint)
    setFormData({
      title: plotPoint.title,
      description: plotPoint.description || '',
      completed: plotPoint.completed
    })
  }

  const addSubplot = async () => {
    if (!newSubplotName.trim() || subplots.includes(newSubplotName.trim())) return

    const newSubplot = newSubplotName.trim()
    setNewSubplotName('')
    setIsAddSubplotOpen(false)

    // Initialize all 7 plot points for the new subplot
    for (const plotType of PLOT_POINT_TYPES) {
      await handleCreatePlotPoint(newSubplot, plotType.type)
    }
    
    // Fetch plot points to re-sort subplots by creation date
    fetchPlotPoints()
  }

  const removeSubplot = async (subplot: string) => {
    if (subplot === 'main') return // Can't remove main subplot
    if (!confirm(`Are you sure you want to remove the "${subplot}" subplot and all its plot points?`)) return

    // Delete all plot points for this subplot
    const subplotPoints = plotPoints.filter(p => (p.subplot || 'main') === subplot)
    for (const point of subplotPoints) {
      await handleDeletePlotPoint(point)
    }

    setSubplots(subplots.filter(s => s !== subplot))
  }

  const initializeSubplot = async (subplot: string) => {
    // Create all 7 plot points for a subplot if they don't exist
    for (const plotType of PLOT_POINT_TYPES) {
      const existingPoint = getPlotPointForSubplot(subplot, plotType.type)
      if (!existingPoint) {
        await handleCreatePlotPoint(subplot, plotType.type)
      }
    }
  }

  const getCompletionStats = () => {
    const totalPoints = plotPoints.length
    const completedPoints = plotPoints.filter(p => p.completed).length
    return { total: totalPoints, completed: completedPoints, percentage: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0 }
  }

  const stats = getCompletionStats()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-64 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {[...Array(14)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
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
            <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Plot Structure
          </h1>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              {stats.completed}/{stats.total} Points Complete ({stats.percentage}%)
            </Badge>
            <Badge variant="secondary">
              {subplots.length} Subplot{subplots.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
        
        <div className="flex gap-2">     
          {/* Manual Subplot Creation Modal */}
          <Dialog open={isAddSubplotOpen} onOpenChange={setIsAddSubplotOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Subplot
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Subplot</DialogTitle>
                <DialogDescription>
                  Create a new storyline manually or use AI
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subplot-name">Subplot Name</Label>
                  <Input
                    id="subplot-name"
                    value={newSubplotName}
                    onChange={(e) => setNewSubplotName(e.target.value)}
                    placeholder="e.g., romance, betrayal, character development"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addSubplot} disabled={!newSubplotName.trim()}>
                    Create Subplot
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddSubplotOpen(false)}>
                    Cancel
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => {
                    setIsAddSubplotOpen(false)
                    setIsAIPlotOpen(true)
                  }}
                >
                  <Target className="h-4 w-4" />
                  Generate with AI
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* AI Plot Suggestions Button */}
          <AIPlotSuggestions
            bookId={bookId}
            onPlotAccepted={handleSuggestionAccepted}
            isOpen={isAIPlotOpen}
            onOpenChange={setIsAIPlotOpen}
            triggerButton={
              <Button variant="outline" size="lg" className="gap-2">
                <Sparkles className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>

      {/* Plot Structure Matrix */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Header Row */}
          <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `200px repeat(${subplots.length}, 300px)` }}>
            <div className="font-semibold text-lg">Plot Points</div>
            {subplots.map((subplot) => (
              <div key={subplot} className="flex items-center justify-between bg-muted p-3 rounded-lg">
                <span className="font-semibold capitalize">
                  {subplot === 'main' ? 'Main Plot' : subplot}
                </span>
                {subplot !== 'main' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => initializeSubplot(subplot)}>
                        Fill Missing Points
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => removeSubplot(subplot)}
                        className="text-destructive"
                      >
                        Remove Subplot
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>

          {/* Plot Points Grid */}
          {PLOT_POINT_TYPES.map((plotType) => (
            <div 
              key={plotType.type} 
              className="grid gap-2 mb-2" 
              style={{ gridTemplateColumns: `200px repeat(${subplots.length}, 300px)` }}
            >
              {/* Plot Point Label */}
              <div className="flex flex-col justify-center bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                <div className="font-semibold">{plotType.label}</div>
                <div className="text-xs text-muted-foreground">{plotType.description}</div>
              </div>

              {/* Plot Point Cells for each subplot */}
              {subplots.map((subplot) => {
                const plotPoint = getPlotPointForSubplot(subplot, plotType.type)
                
                return (
                  <PlotPointCell
                    key={`${subplot}-${plotType.type}`}
                    plotPoint={plotPoint}
                    subplot={subplot}
                    plotType={plotType.type}
                    onEdit={startEditing}
                    onDelete={handleDeletePlotPoint}
                    onToggleComplete={handleToggleComplete}
                    onView={setViewingPoint}
                    onCreate={() => handleCreatePlotPoint(subplot, plotType.type)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPoint} onOpenChange={(open) => !open && setEditingPoint(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Plot Point</DialogTitle>
            <DialogDescription>
              Modify the details of this plot point in your story structure
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePlotPoint} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Plot point title..."
                required
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what happens in this plot point..."
                rows={4}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="completed"
                checked={formData.completed}
                onChange={(e) => setFormData(prev => ({ ...prev, completed: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="completed">Mark as completed</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                Update Plot Point
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingPoint(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Plot Point Dialog */}
      <Dialog open={!!viewingPoint} onOpenChange={(open) => !open && setViewingPoint(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <DialogTitle className="text-xl">{viewingPoint?.title}</DialogTitle>
                <DialogDescription>
                  {viewingPoint && PLOT_POINT_TYPES.find(p => p.type === viewingPoint.type)?.label} - {viewingPoint?.subplot === null ? 'Main Plot' : viewingPoint?.subplot}
                </DialogDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (viewingPoint) {
                      startEditing(viewingPoint)
                      setViewingPoint(null)
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
                    if (viewingPoint) {
                      setViewingPoint(null)
                      await handleDeletePlotPoint(viewingPoint)
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 py-4 pr-4 scrollbar-none">
            <div className="space-y-6">
              {/* Plot Point Type Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Plot Point Type</h4>
                <div className="bg-muted/30 p-3 rounded">
                  <div className="font-medium">{viewingPoint && PLOT_POINT_TYPES.find(p => p.type === viewingPoint.type)?.label}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {viewingPoint && PLOT_POINT_TYPES.find(p => p.type === viewingPoint.type)?.description}
                  </div>
                </div>
              </div>

              {/* Subplot Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Subplot</h4>
                <div className="text-sm font-medium">
                  {viewingPoint?.subplot === null ? 'Main Plot' : viewingPoint?.subplot}
                </div>
              </div>

              {/* Description */}
              {viewingPoint?.description && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Description</h4>
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {viewingPoint.description}
                    </div>
                  </div>
                </div>
              )}

              {/* Completion Status */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                <div className="flex items-center gap-2">
                  {viewingPoint?.completed ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-600 dark:text-green-400">Completed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Not completed</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Individual plot point cell component
interface PlotPointCellProps {
  plotPoint: PlotPointWithSubplot | null
  subplot: string
  plotType: PlotPointType
  onEdit: (plotPoint: PlotPointWithSubplot) => void
  onDelete: (plotPoint: PlotPointWithSubplot) => void
  onToggleComplete: (plotPoint: PlotPointWithSubplot) => void
  onView: (plotPoint: PlotPointWithSubplot) => void
  onCreate: () => void
}

function PlotPointCell({ 
  plotPoint, 
  subplot, 
  plotType, 
  onEdit, 
  onDelete, 
  onToggleComplete, 
  onView, 
  onCreate 
}: PlotPointCellProps) {
  if (!plotPoint) {
    return (
      <Card className="h-32 border-dashed border-2 border-muted-foreground/25 hover:border-primary/50 transition-colors">
        <CardContent className="h-full flex items-center justify-center p-2">
          <Button 
            variant="ghost" 
            onClick={onCreate}
            className="h-full w-full text-muted-foreground hover:text-primary"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div 
      className={`rounded-md bg-card border h-32 hover:shadow-md transition-shadow cursor-pointer ${plotPoint.completed ? 'bg-green-50 dark:bg-green-900/10 border-green-200' : ''}`}
      onClick={() => onView(plotPoint)}
    >
      <div className="p-2 pb-1">
        <div className="flex items-start justify-between">
          <div className="text-sm line-clamp-2 flex-1 mr-2">
            {plotPoint.title}
          </div>
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onToggleComplete(plotPoint)
              }}
              className="h-6 w-6 p-0"
            >
              {plotPoint.completed ? (
                <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(plotPoint)
              }}
              className="h-6 w-6 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(plotPoint)
              }}
              className="h-6 w-6 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-2 pt-0">
        <p className="text-xs text-muted-foreground line-clamp-4">
          {plotPoint.description || 'No description yet'}
        </p>
      </div>
    </div>
  )
} 