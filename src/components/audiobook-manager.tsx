"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AudioPlayer } from '@/components/ui/audio-player'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Volume2, Loader2, CheckCircle, XCircle, Trash2, MoreVertical, RefreshCw } from 'lucide-react'

interface ChapterAudioStatus {
  id: string
  title: string
  orderIndex: number
  audioStatus: 'not_generated' | 'generating' | 'completed' | 'failed'
  audioDuration?: number
  audioGenerated?: string
  audioError?: string
  signedUrl?: string
}

interface AudiobookManagerProps {
  bookId: string
}

export default function AudiobookManager({ bookId }: AudiobookManagerProps) {
  const [chapters, setChapters] = useState<ChapterAudioStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [summary, setSummary] = useState({
    total: 0,
    not_generated: 0,
    generating: 0,
    completed: 0,
    failed: 0,
    totalDurationFormatted: '0s',
  })
  
  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false)
  const [selectedChapter, setSelectedChapter] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    fetchAudioStatus()
    
    // Poll for updates every 5 seconds if any chapter is generating
    const interval = setInterval(() => {
      if (chapters.some(ch => ch.audioStatus === 'generating')) {
        fetchAudioStatus()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [bookId])

  const fetchAudioStatus = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/audiobook/generate`)
      const data = await response.json()

      if (data.success) {
        // Fetch signed URLs for completed chapters
        const chaptersWithUrls = await Promise.all(
          data.chapters.map(async (chapter: ChapterAudioStatus) => {
            if (chapter.audioStatus === 'completed') {
              try {
                const urlResponse = await fetch(`/api/books/${bookId}/chapters/${chapter.id}/audio`)
                const urlData = await urlResponse.json()
                if (urlData.success && urlData.chapter.signedUrl) {
                  return { ...chapter, signedUrl: urlData.chapter.signedUrl }
                }
              } catch (error) {
                console.error(`Error fetching URL for chapter ${chapter.id}:`, error)
              }
            }
            return chapter
          })
        )
        
        setChapters(chaptersWithUrls)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error fetching audio status:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateAllAudio = async () => {
    setGenerating(true)
    
    try {
      const response = await fetch(`/api/books/${bookId}/audiobook/generate`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        alert(`✅ Audio generation started for ${data.chaptersToGenerate} chapters`)
        fetchAudioStatus()
      } else {
        throw new Error(data.error || 'Failed to start generation')
      }
    } catch (error) {
      alert(`❌ Generation Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGenerating(false)
    }
  }

  const generateChapterAudio = async (chapterId: string, chapterTitle: string) => {
    try {
      const response = await fetch(`/api/books/${bookId}/chapters/${chapterId}/audio`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        alert(`✅ Audio generation started for "${chapterTitle}"`)
        fetchAudioStatus()
      } else {
        throw new Error(data.error || 'Failed to generate audio')
      }
    } catch (error) {
      alert(`❌ Generation Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const openDeleteModal = (chapterId: string, chapterTitle: string) => {
    setSelectedChapter({ id: chapterId, title: chapterTitle })
    setDeleteModalOpen(true)
  }

  const openRegenerateModal = (chapterId: string, chapterTitle: string) => {
    setSelectedChapter({ id: chapterId, title: chapterTitle })
    setRegenerateModalOpen(true)
  }

  const confirmDeleteAudio = async () => {
    if (!selectedChapter) return

    try {
      const response = await fetch(`/api/books/${bookId}/chapters/${selectedChapter.id}/audio`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        alert(`✅ Audio deleted for "${selectedChapter.title}"`)
        fetchAudioStatus()
      } else {
        throw new Error(data.error || 'Failed to delete audio')
      }
    } catch (error) {
      alert(`❌ Deletion Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDeleteModalOpen(false)
      setSelectedChapter(null)
    }
  }

  const confirmRegenerateAudio = async () => {
    if (!selectedChapter) return

    try {
      // First delete the old audio
      await fetch(`/api/books/${bookId}/chapters/${selectedChapter.id}/audio`, {
        method: 'DELETE',
      })

      // Then generate new audio
      const response = await fetch(`/api/books/${bookId}/chapters/${selectedChapter.id}/audio`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        alert(`✅ Audio regeneration started for "${selectedChapter.title}"`)
        fetchAudioStatus()
      } else {
        throw new Error(data.error || 'Failed to regenerate audio')
      }
    } catch (error) {
      alert(`❌ Regeneration Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setRegenerateModalOpen(false)
      setSelectedChapter(null)
    }
  }


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'generating':
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      default:
        return <Badge variant="outline">Not Generated</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Audiobook Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Total Chapters</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summary.generating}</div>
              <div className="text-xs text-muted-foreground">Generating</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{summary.totalDurationFormatted}</div>
              <div className="text-xs text-muted-foreground">Total Duration</div>
            </div>
          </div>

          <Button 
            onClick={generateAllAudio} 
            disabled={generating || summary.not_generated === 0}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Generation...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 mr-2" />
                Generate Audiobook ({summary.not_generated + summary.failed} Chapters)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Chapters List */}
      <Card>
        <CardHeader>
          <CardTitle>Chapters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {chapters.map((chapter) => (
              <div
                key={chapter.id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors space-y-3"
              >
                {/* Chapter Header */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">Chapter {chapter.orderIndex + 1}</span>
                      <span className="text-muted-foreground">{chapter.title}</span>
                      {getStatusBadge(chapter.audioStatus)}
                    </div>
                    {chapter.audioDuration && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Duration: {Math.floor(chapter.audioDuration / 60)}m {Math.floor(chapter.audioDuration % 60)}s
                      </div>
                    )}
                    {chapter.audioError && (
                      <div className="text-sm text-red-600 mt-1">
                        Error: {chapter.audioError}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {chapter.audioStatus === 'completed' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openRegenerateModal(chapter.id, chapter.title)}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Regenerate Audio
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                            onClick={() => openDeleteModal(chapter.id, chapter.title)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Audio
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {(chapter.audioStatus === 'not_generated' || chapter.audioStatus === 'failed') && (
                      <Button
                        size="sm"
                        onClick={() => generateChapterAudio(chapter.id, chapter.title)}
                      >
                        <Volume2 className="w-4 h-4 mr-1" />
                        Generate
                      </Button>
                    )}
                    {chapter.audioStatus === 'generating' && (
                      <Button size="sm" disabled>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Generating...
                      </Button>
                    )}
                  </div>
                </div>

                {/* Audio Player */}
                {chapter.audioStatus === 'completed' && chapter.signedUrl && (
                  <AudioPlayer 
                    audioUrl={chapter.signedUrl} 
                    compact 
                    className="border-t pt-3"
                  />
                )}
              </div>
            ))}

            {chapters.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No chapters with content found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Audio</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the audio for "{selectedChapter?.title}"?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteAudio}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Audio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Confirmation Modal */}
      <Dialog open={regenerateModalOpen} onOpenChange={setRegenerateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Audio</DialogTitle>
            <DialogDescription>
              Are you sure you want to regenerate the audio for "{selectedChapter?.title}"?
              This will delete the current recording and create a new one. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegenerateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRegenerateAudio}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate Audio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

