"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MapPin, Plus, Edit, Trash2, Search, Calendar, Users } from 'lucide-react'
import { useSelectedBook } from '@/contexts/selected-book-context'
import type { Location } from '@prisma/client'

// Extended type for locations with timeline event count
interface LocationWithCounts extends Location {
  _count: {
    timelineEvents: number
  }
}

interface LocationsViewProps {
  className?: string
}

export function LocationsView({ className }: LocationsViewProps) {
  const { selectedBookId } = useSelectedBook()
  const [locations, setLocations] = useState<LocationWithCounts[]>([])
  const [filteredLocations, setFilteredLocations] = useState<LocationWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal states
  const [editingLocation, setEditingLocation] = useState<LocationWithCounts | null>(null)
  const [viewingLocation, setViewingLocation] = useState<LocationWithCounts | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    geography: '',
    culture: '',
    rules: '',
    imageUrl: ''
  })

  // Fetch locations
  const fetchLocations = async () => {
    if (!selectedBookId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/books/${selectedBookId}/locations`)
      if (response.ok) {
        const data = await response.json()
        setLocations(data)
        setFilteredLocations(data)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations()
  }, [selectedBookId])

  // Search filter
  useEffect(() => {
    const filtered = locations.filter(location =>
      location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.geography?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.culture?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredLocations(filtered)
  }, [searchTerm, locations])

  // Form handlers
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      geography: '',
      culture: '',
      rules: '',
      imageUrl: ''
    })
  }

  const startEditing = (location: LocationWithCounts) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      description: location.description || '',
      geography: location.geography || '',
      culture: location.culture || '',
      rules: location.rules || '',
      imageUrl: location.imageUrl || ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBookId) return

    try {
      const url = editingLocation 
        ? `/api/locations/${editingLocation.id}`
        : `/api/books/${selectedBookId}/locations`
      
      const method = editingLocation ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchLocations()
        setEditingLocation(null)
        setShowAddDialog(false)
        resetForm()
      }
    } catch (error) {
      console.error('Error saving location:', error)
    }
  }

  const handleDeleteLocation = async (id: string) => {
    try {
      const response = await fetch(`/api/locations/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchLocations()
      }
    } catch (error) {
      console.error('Error deleting location:', error)
    }
  }

  const getLocationInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold tracking-tight">Locations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
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
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Locations</h2>
            <p className="text-muted-foreground">
              Manage the places and settings in your story
            </p>
          </div>
          <Button 
            onClick={() => {
              setEditingLocation(null)
              resetForm()
              setShowAddDialog(true)
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Location
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Locations Grid */}
        {filteredLocations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLocations.map((location) => (
              <div 
                key={location.id} 
                className="bg-card rounded-lg border border-border py-3 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setViewingLocation(location)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="text-lg line-clamp-2">{location.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {location._count.timelineEvents > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              {location._count.timelineEvents} event{location._count.timelineEvents !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(location)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Are you sure you want to delete this location?')) {
                            handleDeleteLocation(location.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {location.description && (
                    <p className="text-sm text-muted-foreground line-clamp-4">
                      {location.description}
                    </p>
                  )}
                </CardContent>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No locations yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first location to start building your story world
              </p>
              <Button 
                onClick={() => {
                  setEditingLocation(null)
                  resetForm()
                  setShowAddDialog(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Location
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Location Dialog */}
      <Dialog open={!!editingLocation || showAddDialog} onOpenChange={(open) => {
        if (!open) {
          setEditingLocation(null)
          setShowAddDialog(false)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </DialogTitle>
            <DialogDescription>
              {editingLocation ? 'Update location details' : 'Create a new location for your story'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Location name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input
                  id="imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the location"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="geography">Geography</Label>
              <Textarea
                id="geography"
                value={formData.geography}
                onChange={(e) => setFormData({ ...formData, geography: e.target.value })}
                placeholder="Physical features, climate, terrain..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="culture">Culture</Label>
              <Textarea
                id="culture"
                value={formData.culture}
                onChange={(e) => setFormData({ ...formData, culture: e.target.value })}
                placeholder="People, customs, traditions, language..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rules">Rules & Laws</Label>
              <Textarea
                id="rules"
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                placeholder="Governing rules, magic systems, social structures..."
                rows={2}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {editingLocation ? 'Update Location' : 'Create Location'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setEditingLocation(null)
                  setShowAddDialog(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Location Dialog */}
      <Dialog open={!!viewingLocation} onOpenChange={(open) => !open && setViewingLocation(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {viewingLocation?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            {viewingLocation && (
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-3">          
                  {viewingLocation.description && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                      <p className="text-sm whitespace-pre-wrap">{viewingLocation.description}</p>
                    </div>
                  )}
                </div>

                {/* Geography */}
                {viewingLocation.geography && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">Geography</h4>
                    <div className="bg-muted/30 p-3 rounded">
                      <p className="text-sm whitespace-pre-wrap">{viewingLocation.geography}</p>
                    </div>
                  </div>
                )}

                {/* Culture */}
                {viewingLocation.culture && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">Culture</h4>
                    <div className="bg-muted/30 p-3 rounded">
                      <p className="text-sm whitespace-pre-wrap">{viewingLocation.culture}</p>
                    </div>
                  </div>
                )}

                {/* Rules */}
                {viewingLocation.rules && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">Rules & Laws</h4>
                    <div className="bg-muted/30 p-3 rounded">
                      <p className="text-sm whitespace-pre-wrap">{viewingLocation.rules}</p>
                    </div>
                  </div>
                )}

                {/* Timeline Events */}
                {viewingLocation._count.timelineEvents > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">Timeline Events</h4>
                    <div className="bg-muted/30 p-3 rounded">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {viewingLocation._count.timelineEvents} event{viewingLocation._count.timelineEvents !== 1 ? 's' : ''} occur at this location
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          <div className="flex gap-2 pt-4 border-t">
            <Button 
              onClick={() => {
                setViewingLocation(null)
                if (viewingLocation) {
                  startEditing(viewingLocation)
                }
              }}
              variant="outline"
              className="flex-1"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Location
            </Button>
            <Button 
              onClick={() => {
                if (viewingLocation && confirm('Are you sure you want to delete this location?')) {
                  handleDeleteLocation(viewingLocation.id)
                  setViewingLocation(null)
                }
              }}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 