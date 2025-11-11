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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Users, Search, Edit, Trash2, User, Crown, Star, Eye, Camera } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AICharacterSuggestions } from './ai-character-suggestions'
import type { Character, CharacterRole } from '@prisma/client'

// Character role configurations
const CHARACTER_ROLES: { 
  role: CharacterRole
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
}[] = [
  { role: 'PROTAGONIST', label: 'Protagonist', icon: Crown, color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30', description: 'Main hero of the story' },
  { role: 'ANTAGONIST', label: 'Antagonist', icon: User, color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30', description: 'Primary opposition' },
  { role: 'MAJOR', label: 'Major', icon: Star, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30', description: 'Important supporting character' },
  { role: 'MINOR', label: 'Minor', icon: User, color: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800/50', description: 'Secondary character' },
  { role: 'CAMEO', label: 'Cameo', icon: Eye, color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30', description: 'Brief appearance' },
]

interface CharacterWithStats extends Character {
  _count?: {
    timelineEvents: number
    relationships: number
    relatedTo: number
  }
}

interface CharacterManagementProps {
  bookId: string
}

export function CharacterManagement({ bookId }: CharacterManagementProps) {
  const [characters, setCharacters] = useState<CharacterWithStats[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<CharacterRole | 'ALL'>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<CharacterWithStats | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    appearance: '',
    personality: '',
    backstory: '',
    role: 'MINOR' as CharacterRole,
    imageUrl: ''
  })

  useEffect(() => {
    fetchCharacters()
  }, [bookId])

  const fetchCharacters = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/books/${bookId}/characters`)
      if (response.ok) {
        const data = await response.json()
        setCharacters(data)
      }
    } catch (error) {
      console.error('Error fetching characters:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    try {
      const response = await fetch(`/api/books/${bookId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setFormData({
          name: '',
          description: '',
          appearance: '',
          personality: '',
          backstory: '',
          role: 'MINOR',
          imageUrl: ''
        })
        setIsCreateDialogOpen(false)
        fetchCharacters()
      }
    } catch (error) {
      console.error('Error creating character:', error)
    }
  }

  const handleUpdateCharacter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCharacter || !formData.name.trim()) return

    try {
      const response = await fetch(`/api/characters/${editingCharacter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setEditingCharacter(null)
        setFormData({
          name: '',
          description: '',
          appearance: '',
          personality: '',
          backstory: '',
          role: 'MINOR',
          imageUrl: ''
        })
        fetchCharacters()
      }
    } catch (error) {
      console.error('Error updating character:', error)
    }
  }

  const handleDeleteCharacter = async (characterId: string) => {
    if (!confirm('Are you sure you want to delete this character?')) return

    try {
      const response = await fetch(`/api/characters/${characterId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchCharacters()
      }
    } catch (error) {
      console.error('Error deleting character:', error)
    }
  }

  const startEditing = (character: CharacterWithStats) => {
    setEditingCharacter(character)
    setFormData({
      name: character.name,
      description: character.description || '',
      appearance: character.appearance || '',
      personality: character.personality || '',
      backstory: character.backstory || '',
      role: character.role,
      imageUrl: character.imageUrl || ''
    })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      appearance: '',
      personality: '',
      backstory: '',
      role: 'MINOR',
      imageUrl: ''
    })
    setEditingCharacter(null)
  }

  const getRoleConfig = (role: CharacterRole) => {
    return CHARACTER_ROLES.find(r => r.role === role) || CHARACTER_ROLES[3] // Default to MINOR
  }

  const getCharacterInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const filteredCharacters = characters.filter(character => {
    const matchesSearch = character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         character.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = selectedRole === 'ALL' || character.role === selectedRole
    return matchesSearch && matchesRole
  })

  const getCharactersByRole = (role: CharacterRole) => {
    return characters.filter(c => c.role === role)
  }

  const getCharacterStats = () => {
    const stats = CHARACTER_ROLES.map(roleConfig => ({
      ...roleConfig,
      count: getCharactersByRole(roleConfig.role).length
    }))
    return stats
  }

  const stats = getCharacterStats()
  const totalCharacters = characters.length

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-64 animate-pulse"></div>
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            Characters
          </h1>
          <div className="flex items-center gap-4">
            <Badge variant="outline">
              {totalCharacters} Character{totalCharacters !== 1 ? 's' : ''}
            </Badge>
            {stats.filter(s => s.count > 0).map((stat) => (
              <Badge key={stat.role} variant="secondary" className={stat.color}>
                {stat.count} {stat.label}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2">
          <AICharacterSuggestions 
            bookId={bookId} 
            onSuggestionAccepted={() => fetchCharacters()} 
          />
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                New Character
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Character</DialogTitle>
                <DialogDescription>
                  Add a new character to your story
                </DialogDescription>
              </DialogHeader>
              <CharacterForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleCreateCharacter}
                submitLabel="Create Character"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search characters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as CharacterRole | 'ALL')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            {CHARACTER_ROLES.map((roleConfig) => (
              <SelectItem key={roleConfig.role} value={roleConfig.role}>
                {roleConfig.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Character Organization Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid grid-cols-6 w-full max-w-2xl">
          <TabsTrigger value="all">All ({totalCharacters})</TabsTrigger>
          {CHARACTER_ROLES.map((roleConfig) => (
            <TabsTrigger key={roleConfig.role} value={roleConfig.role}>
              {roleConfig.label} ({getCharactersByRole(roleConfig.role).length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <CharacterGrid 
            characters={filteredCharacters}
            onEdit={startEditing}
            onDelete={handleDeleteCharacter}
          />
        </TabsContent>

        {CHARACTER_ROLES.map((roleConfig) => (
          <TabsContent key={roleConfig.role} value={roleConfig.role} className="mt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <roleConfig.icon className="h-5 w-5" />
                {roleConfig.label} Characters
              </h3>
              <p className="text-sm text-muted-foreground">{roleConfig.description}</p>
            </div>
            <CharacterGrid 
              characters={getCharactersByRole(roleConfig.role)}
              onEdit={startEditing}
              onDelete={handleDeleteCharacter}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingCharacter} onOpenChange={(open) => !open && setEditingCharacter(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Character</DialogTitle>
            <DialogDescription>
              Make changes to your character
            </DialogDescription>
          </DialogHeader>
          <CharacterForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdateCharacter}
            submitLabel="Update Character"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Character grid component
interface CharacterGridProps {
  characters: CharacterWithStats[]
  onEdit: (character: CharacterWithStats) => void
  onDelete: (characterId: string) => void
}

function CharacterGrid({ characters, onEdit, onDelete }: CharacterGridProps) {
  if (characters.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Characters Yet</h3>
          <p className="text-muted-foreground">
            Start building your cast by creating your first character
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// Individual character card component
interface CharacterCardProps {
  character: CharacterWithStats
  onEdit: (character: CharacterWithStats) => void
  onDelete: (characterId: string) => void
}

function CharacterCard({ character, onEdit, onDelete }: CharacterCardProps) {
  const roleConfig = CHARACTER_ROLES.find(r => r.role === character.role) || CHARACTER_ROLES[3]
  const RoleIcon = roleConfig.icon

  const getCharacterInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-lg">{character.name}</CardTitle>
              <Badge variant="secondary" className={`${roleConfig.color} text-xs`}>
                <RoleIcon className="h-3 w-3 mr-1" />
                {roleConfig.label}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(character)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(character.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {character.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {character.description}
          </p>
        )}
        
        {/* Character stats */}
        <div className="flex gap-2 text-xs text-muted-foreground">
          {character._count && (
            <>
              <span>{character._count.timelineEvents} events</span>
              <span>•</span>
              <span>{(character._count.relationships + character._count.relatedTo)} connections</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Character form component
interface CharacterFormProps {
  formData: {
    name: string
    description: string
    appearance: string
    personality: string
    backstory: string
    role: CharacterRole
    imageUrl: string
  }
  setFormData: React.Dispatch<React.SetStateAction<{
    name: string
    description: string
    appearance: string
    personality: string
    backstory: string
    role: CharacterRole
    imageUrl: string
  }>>
  onSubmit: (e: React.FormEvent) => void
  submitLabel: string
}

function CharacterForm({ formData, setFormData, onSubmit, submitLabel }: CharacterFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Character name..."
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select 
            value={formData.role} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as CharacterRole }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {CHARACTER_ROLES.map((roleConfig) => (
                <SelectItem key={roleConfig.role} value={roleConfig.role}>
                  {roleConfig.label}
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
          placeholder="Brief description of the character..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="appearance">Appearance</Label>
        <Textarea
          id="appearance"
          value={formData.appearance}
          onChange={(e) => setFormData(prev => ({ ...prev, appearance: e.target.value }))}
          placeholder="Physical description..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="personality">Personality</Label>
        <Textarea
          id="personality"
          value={formData.personality}
          onChange={(e) => setFormData(prev => ({ ...prev, personality: e.target.value }))}
          placeholder="Character traits, motivations..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="backstory">Backstory</Label>
        <Textarea
          id="backstory"
          value={formData.backstory}
          onChange={(e) => setFormData(prev => ({ ...prev, backstory: e.target.value }))}
          placeholder="Character's history and background..."
          rows={3}
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