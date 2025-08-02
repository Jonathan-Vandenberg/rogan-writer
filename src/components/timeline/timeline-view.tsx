"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Calendar, Search, Edit, Trash2, MapPin, User, Clock } from 'lucide-react'
import type { TimelineEvent, Character, Location } from '@prisma/client'

interface TimelineEventWithRelations extends TimelineEvent {
  character?: Character | null
  location?: Location | null
}

interface TimelineViewProps {
  bookId: string
}

export function TimelineView({ bookId }: TimelineViewProps) {
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventWithRelations[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCharacterId, setFilterCharacterId] = useState<string>('ALL')
  const [filterLocationId, setFilterLocationId] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<TimelineEventWithRelations | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [viewingEvent, setViewingEvent] = useState<TimelineEventWithRelations | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: '',
    startTime: 1, // Allow 0 for temporary empty state
    endTime: 1,   // Allow 0 for temporary empty state
    characterId: 'none',
    locationId: 'none'
  })

  useEffect(() => {
    fetchTimelineEvents()
    fetchCharacters()
    fetchLocations()
  }, [bookId])

  // Handle clicks outside timeline to deselect
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timelineRef.current && !timelineRef.current.contains(event.target as Node)) {
        setSelectedEventId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchTimelineEvents = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/books/${bookId}/timeline-events`)
      if (response.ok) {
        const data = await response.json()
        setTimelineEvents(data)
      }
    } catch (error) {
      console.error('Error fetching timeline events:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCharacters = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/characters`)
      if (response.ok) {
        const data = await response.json()
        setCharacters(data)
      }
    } catch (error) {
      console.error('Error fetching characters:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/locations`)
      if (response.ok) {
        const data = await response.json()
        setLocations(data)
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    // Validate time values
    const startTime = Math.max(1, formData.startTime || 1)
    const endTime = Math.max(startTime, formData.endTime || 1)

    try {
      const response = await fetch(`/api/books/${bookId}/timeline-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startTime,
          endTime,
          characterId: formData.characterId === 'none' ? null : formData.characterId,
          locationId: formData.locationId === 'none' ? null : formData.locationId
        })
      })

      if (response.ok) {
        resetForm()
        setIsCreateDialogOpen(false)
        fetchTimelineEvents()
      }
    } catch (error) {
      console.error('Error creating timeline event:', error)
    }
  }

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvent || !formData.title.trim()) return

    // Validate time values
    const startTime = Math.max(1, formData.startTime || 1)
    const endTime = Math.max(startTime, formData.endTime || 1)

    try {
      const response = await fetch(`/api/books/${bookId}/timeline-events/${editingEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startTime,
          endTime,
          characterId: formData.characterId === 'none' ? null : formData.characterId,
          locationId: formData.locationId === 'none' ? null : formData.locationId
        })
      })

      if (response.ok) {
        setEditingEvent(null)
        resetForm()
        fetchTimelineEvents()
      }
    } catch (error) {
      console.error('Error updating timeline event:', error)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this timeline event?')) return

    try {
      const response = await fetch(`/api/books/${bookId}/timeline-events/${eventId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchTimelineEvents()
      }
    } catch (error) {
      console.error('Error deleting timeline event:', error)
    }
  }

  const startEditing = (event: TimelineEventWithRelations) => {
    setEditingEvent(event)
    setFormData({
      title: event.title,
      description: event.description || '',
      eventDate: event.eventDate || '',
      startTime: event.startTime || 1,
      endTime: event.endTime || 1,
      characterId: event.characterId || 'none',
      locationId: event.locationId || 'none'
    })
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      eventDate: '',
      startTime: 1,
      endTime: 1,
      characterId: 'none',
      locationId: 'none'
    })
    setEditingEvent(null)
  }

  const getCharacterInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const filteredEvents = timelineEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCharacter = filterCharacterId === 'ALL' || event.characterId === filterCharacterId
    const matchesLocation = filterLocationId === 'ALL' || event.locationId === filterLocationId
    
    return matchesSearch && matchesCharacter && matchesLocation
  })

  // Get time range and generate columns
  const getTimeColumns = () => {
    if (filteredEvents.length === 0) return [1, 2, 3, 4, 5] // Default columns when no events
    
    const minTime = Math.min(...filteredEvents.map(event => event.startTime || 1))
    const maxTime = Math.max(...filteredEvents.map(event => event.endTime || 1))
    
    const columns = []
    for (let i = minTime; i <= maxTime; i++) {
      columns.push(i)
    }
    return columns.length > 0 ? columns : [1, 2, 3, 4, 5] // Fallback columns
  }

  const timeColumns = getTimeColumns()

  const getTimelineStats = () => {
    const total = timelineEvents.length
    const withCharacters = timelineEvents.filter(e => e.characterId).length
    const withLocations = timelineEvents.filter(e => e.locationId).length
    const withDates = timelineEvents.filter(e => e.eventDate).length
    
    return { total, withCharacters, withLocations, withDates }
  }

  const stats = getTimelineStats()

  const getEventColor = (event: TimelineEventWithRelations, index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500', 
      'bg-green-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500'
    ]
    
    if (event.character) {
      // Use character-based color
      const charIndex = characters.findIndex(c => c.id === event.characterId)
      return colors[charIndex % colors.length]
    }
    
    return colors[index % colors.length]
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-64 animate-pulse"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-12 w-48 bg-muted rounded animate-pulse"></div>
              <div className="flex-1 h-12 bg-muted rounded animate-pulse"></div>
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
            <Calendar className="h-8 w-8 text-green-600" />
            Timeline Roadmap
          </h1>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              {stats.total} Event{stats.total !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary">
              {stats.withCharacters} with Characters
            </Badge>
            <Badge variant="secondary">
              {stats.withLocations} with Locations
            </Badge>
            <Badge variant="secondary">
              {stats.withDates} with Dates
            </Badge>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filterCharacterId} onValueChange={setFilterCharacterId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by character" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Characters</SelectItem>
            {characters.map((character) => (
              <SelectItem key={character.id} value={character.id}>
                {character.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterLocationId} onValueChange={setFilterLocationId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Timeline Event</DialogTitle>
              <DialogDescription>
                Add a new event to your story timeline
              </DialogDescription>
            </DialogHeader>
            <TimelineEventForm
              formData={formData}
              setFormData={setFormData}
              characters={characters}
              locations={locations}
              onSubmit={handleCreateEvent}
              submitLabel="Create Event"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Timeline Roadmap */}
      {filteredEvents.length > 0 ? (
        <Card ref={timelineRef}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Timeline Roadmap</CardTitle>
                <CardDescription>
                  Visual timeline showing when events occur in your story
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto scrollbar-none">
              {/* Timeline Grid Container */}
              <div className="grid" style={{ 
                gridTemplateColumns: `320px repeat(${timeColumns.length}, 96px)`,
                minWidth: `${320 + (timeColumns.length * 96)}px`
              }}>
                {/* Timeline Header */}
                <div className="p-3 border border-r-0 bg-muted/30 font-medium">Event Details</div>
                {timeColumns.map((timeUnit) => (
                  <div key={timeUnit} className="border border-l-0 text-center font-medium py-3 bg-muted/30">
                    Time {timeUnit}
                  </div>
                ))}

                {/* Timeline Events */}
                {filteredEvents.map((event, eventIndex) => (
                  <TimelineRoadmapRow
                    key={event.id}
                    event={event}
                    eventIndex={eventIndex}
                    timeColumns={timeColumns}
                    color={getEventColor(event, eventIndex)}
                    onEdit={startEditing}
                    onDelete={handleDeleteEvent}
                    selectedEventId={selectedEventId}
                    setSelectedEventId={setSelectedEventId}
                    setViewingEvent={setViewingEvent}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Timeline Roadmap</CardTitle>
            <CardDescription>
              Visual timeline showing when events occur in your story
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No timeline events yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first timeline event to start visualizing your story's progression.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Event
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Timeline Event</DialogTitle>
            <DialogDescription>
              Modify your timeline event
            </DialogDescription>
          </DialogHeader>
          <TimelineEventForm
            formData={formData}
            setFormData={setFormData}
            characters={characters}
            locations={locations}
            onSubmit={handleUpdateEvent}
            submitLabel="Update Event"
          />
        </DialogContent>
      </Dialog>

      {/* View Timeline Event Dialog */}
      <Dialog open={!!viewingEvent} onOpenChange={(open) => !open && setViewingEvent(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewingEvent?.title}</DialogTitle>
            <DialogDescription>
              Timeline Event Details
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 py-4 pr-4 scrollbar-none">
            {viewingEvent && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">Title</h4>
                    <p className="text-sm">{viewingEvent.title}</p>
                  </div>
                  
                  {viewingEvent.description && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                      <p className="text-sm whitespace-pre-wrap">{viewingEvent.description}</p>
                    </div>
                  )}
                  
                  {viewingEvent.eventDate && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Date in Story</h4>
                      <p className="text-sm font-mono">{viewingEvent.eventDate}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Start Time</h4>
                      <p className="text-sm">{viewingEvent.startTime}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">End Time</h4>
                      <p className="text-sm">{viewingEvent.endTime}</p>
                    </div>
                  </div>
                </div>

                {/* Character & Location */}
                {(viewingEvent.character || viewingEvent.location) && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">Associated With</h4>
                    <div className="space-y-2">
                      {viewingEvent.character && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            {viewingEvent.character.imageUrl ? (
                              <AvatarImage src={viewingEvent.character.imageUrl} alt={viewingEvent.character.name} />
                            ) : (
                              <AvatarFallback className="text-xs">
                                {viewingEvent.character.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <span className="text-sm text-blue-600">{viewingEvent.character.name}</span>
                          <Badge variant="outline" className="text-xs">Character</Badge>
                        </div>
                      )}
                      {viewingEvent.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">{viewingEvent.location.name}</span>
                          <Badge variant="outline" className="text-xs">Location</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-4 border-t">
            <Button 
              onClick={() => {
                setViewingEvent(null)
                if (viewingEvent) {
                  setEditingEvent(viewingEvent)
                  setFormData({
                    title: viewingEvent.title,
                    description: viewingEvent.description || '',
                    eventDate: viewingEvent.eventDate || '',
                    startTime: viewingEvent.startTime || 1,
                    endTime: viewingEvent.endTime || 1,
                    characterId: viewingEvent.characterId || 'none',
                    locationId: viewingEvent.locationId || 'none'
                  })
                }
              }}
              variant="outline"
              className="flex-1"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Event
            </Button>
            <Button 
              onClick={() => {
                if (viewingEvent && confirm('Are you sure you want to delete this timeline event?')) {
                  handleDeleteEvent(viewingEvent.id)
                  setViewingEvent(null)
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

// Timeline roadmap row component
interface TimelineRoadmapRowProps {
  event: TimelineEventWithRelations
  eventIndex: number
  timeColumns: number[]
  color: string
  onEdit: (event: TimelineEventWithRelations) => void
  onDelete: (eventId: string) => void
  selectedEventId: string | null
  setSelectedEventId: (id: string | null) => void
  setViewingEvent: (event: TimelineEventWithRelations) => void
}

function TimelineRoadmapRow({ event, eventIndex, timeColumns, color, onEdit, onDelete, selectedEventId, setSelectedEventId, setViewingEvent }: TimelineRoadmapRowProps) {
  const getCharacterInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const isSelected = selectedEventId === event.id

  return (
    <>
      {/* Event Info Cell */}
      <div 
        className={`p-3 border border-r-0 border-t-0 flex items-center cursor-pointer transition-colors group ${
          isSelected ? 'bg-blue-100 hover:bg-blue-100 dark:bg-blue-900/50 dark:hover:bg-blue-900/50' : 'hover:bg-muted/30'
        }`}
        onClick={() => setSelectedEventId(isSelected ? null : event.id)}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{event.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              {event.character && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-blue-600">{event.character.name}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <MapPin className="h-3 w-3" />
                  {event.location.name}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(event)
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
                onDelete(event.id)
              }}
              className="h-6 w-6 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline Cells */}
      {timeColumns.map((timeUnit) => {
        const eventStartTime = event.startTime || 1
        const eventEndTime = event.endTime || 1
        const isEventActive = timeUnit >= eventStartTime && timeUnit <= eventEndTime
        const isEventStart = timeUnit === eventStartTime
        const isEventEnd = timeUnit === eventEndTime
        
        return (
          <div 
            key={timeUnit} 
            className={`border border-l-0 border-t-0 flex items-center justify-center cursor-pointer transition-colors ${
              isSelected ? 'bg-blue-100 hover:bg-blue-100 dark:bg-blue-900/50 dark:hover:bg-blue-900/50' : 'hover:bg-muted/30'
            }`}
            onClick={() => setSelectedEventId(isSelected ? null : event.id)}
          >
            {isEventActive && (
              <div 
                className={`${color} w-full h-8 cursor-pointer ${
                  isEventStart && isEventEnd 
                    ? 'rounded' 
                    : isEventStart 
                      ? 'rounded-l' 
                      : isEventEnd 
                        ? 'rounded-r' 
                        : ''
                }`}
                title={event.description || event.title}
                onClick={(e) => {
                  e.stopPropagation()
                  setViewingEvent(event)
                }}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

// Timeline event form component (unchanged)
interface TimelineEventFormProps {
  formData: {
    title: string
    description: string
    eventDate: string
    startTime: number
    endTime: number
    characterId: string
    locationId: string
  }
  setFormData: React.Dispatch<React.SetStateAction<{
    title: string
    description: string
    eventDate: string
    startTime: number
    endTime: number
    characterId: string
    locationId: string
  }>>
  characters: Character[]
  locations: Location[]
  onSubmit: (e: React.FormEvent) => void
  submitLabel: string
}

function TimelineEventForm({ formData, setFormData, characters, locations, onSubmit, submitLabel }: TimelineEventFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Event Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Event Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="What happens in this event..."
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Detailed description of the event..."
          rows={2}
        />
      </div>

      {/* Date in Story */}
      <div className="space-y-2">
        <Label htmlFor="eventDate">Date in Story</Label>
        <Input
          id="eventDate"
          value={formData.eventDate}
          onChange={(e) => setFormData(prev => ({ ...prev, eventDate: e.target.value }))}
          placeholder="e.g., May 8, Day 3, Chapter 2..."
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground mt-1">
          When this happens in your story
        </p>
      </div>

      {/* Time Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Time Range</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startTime" className="text-sm">Start Time</Label>
            <Input
              id="startTime"
              type="number"
              value={formData.startTime === 0 ? '' : formData.startTime}
              onChange={(e) => {
                const value = e.target.value
                if (value === '') {
                  setFormData(prev => ({ ...prev, startTime: 0 }))
                } else {
                  const startTime = Math.max(1, parseInt(value) || 1)
                  setFormData(prev => ({ 
                    ...prev, 
                    startTime,
                    endTime: Math.max(startTime, prev.endTime) // Ensure end >= start
                  }))
                }
              }}
              onBlur={(e) => {
                // Ensure we have a valid value when user leaves the field
                if (formData.startTime === 0) {
                  setFormData(prev => ({ ...prev, startTime: 1 }))
                }
              }}
              min="1"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              When event begins
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="endTime" className="text-sm">End Time</Label>
            <Input
              id="endTime"
              type="number"
              value={formData.endTime === 0 ? '' : formData.endTime}
              onChange={(e) => {
                const value = e.target.value
                if (value === '') {
                  setFormData(prev => ({ ...prev, endTime: 0 }))
                } else {
                  const endTime = Math.max(1, parseInt(value) || 1)
                  const minEndTime = Math.max(1, formData.startTime)
                  setFormData(prev => ({ 
                    ...prev, 
                    endTime: Math.max(endTime, minEndTime) // Ensure end >= start
                  }))
                }
              }}
              onBlur={(e) => {
                // Ensure we have a valid value when user leaves the field
                if (formData.endTime === 0) {
                  const minEndTime = Math.max(1, formData.startTime)
                  setFormData(prev => ({ ...prev, endTime: minEndTime }))
                }
              }}
              min={formData.startTime || 1}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              When event ends
            </p>
          </div>
        </div>
      </div>

      {/* Associations */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Associations</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="character" className="text-sm">Character</Label>
            <Select 
              value={formData.characterId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, characterId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select character" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No character</SelectItem>
                {characters.map((character) => (
                  <SelectItem key={character.id} value={character.id}>
                    {character.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm">Location</Label>
            <Select 
              value={formData.locationId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, locationId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No location</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
} 