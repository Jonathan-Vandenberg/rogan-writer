'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { SimplePagination } from '@/components/ui/pagination'
import { 
  BookOpen, 
  Copy, 
  Download, 
  Edit, 
  Trash2, 
  Plus,
  FileText,
  Quote,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react'
import { getPreferredCitationFormats } from '@/lib/genre-utils'

interface Citation {
  id: string
  claimText?: string
  format: 'APA' | 'MLA' | 'CHICAGO'
  citationText: string
  bibliographyEntry: string
  pageNumber?: number
  inlineLocation?: string
  notes?: string
  createdAt: string
  researchResult?: {
    title: string
    sourceType: string
    credibilityScore: number
    sourceUrl?: string
  }
  chapter?: {
    title: string
    orderIndex: number
  }
}

interface CitationManagerProps {
  bookId: string
  bookGenre?: string | null
  onCitationUpdate?: () => void
}

export function CitationManager({ bookId, bookGenre, onCitationUpdate }: CitationManagerProps) {
  const [citations, setCitations] = useState<Citation[]>([])
  const [selectedFormat, setSelectedFormat] = useState<'APA' | 'MLA' | 'CHICAGO'>('APA')
  const [showBibliography, setShowBibliography] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, byFormat: { apa: 0, mla: 0, chicago: 0 } })
  const [editingCitation, setEditingCitation] = useState<Citation | null>(null)
  const [newCitation, setNewCitation] = useState({
    claimText: '',
    format: 'APA' as const,
    pageNumber: '',
    inlineLocation: '',
    notes: ''
  })
  const [showNewCitationForm, setShowNewCitationForm] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const citationsPerPage = 5

  useEffect(() => {
    fetchCitations()
  }, [bookId])

  useEffect(() => {
    // Set preferred format based on genre, but only if citations haven't loaded yet
    if (bookGenre && citations.length === 0) {
      const preferredFormats = getPreferredCitationFormats(bookGenre)
      setSelectedFormat(preferredFormats[0]?.toUpperCase() as any || 'APA')
    }
  }, [bookGenre, citations.length])

  useEffect(() => {
    // Auto-select a format that has citations when data loads
    if (citations.length > 0 && stats.total > 0) {
      // Check if current format has any citations
      const currentFormatCount = citations.filter(c => c.format === selectedFormat).length
      
      if (currentFormatCount === 0) {
        // Switch to a format that has citations
        if (stats.byFormat.apa > 0) {
          setSelectedFormat('APA')
        } else if (stats.byFormat.mla > 0) {
          setSelectedFormat('MLA')
        } else if (stats.byFormat.chicago > 0) {
          setSelectedFormat('CHICAGO')
        }
      }
    }
  }, [citations, stats])

  // Reset pagination when format changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedFormat])

  const fetchCitations = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/citations`)
      const data = await response.json()
      
      if (response.ok) {
        setCitations(data.citations || [])
        setStats(data.stats || { total: 0, byFormat: { apa: 0, mla: 0, chicago: 0 } })
      }
    } catch (error) {
      console.error('Failed to fetch citations:', error)
    } finally {
      setLoading(false)
    }
  }

  const createManualCitation = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/citations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claimText: newCitation.claimText,
          format: newCitation.format.toLowerCase(),
          pageNumber: newCitation.pageNumber ? parseInt(newCitation.pageNumber) : undefined,
          inlineLocation: newCitation.inlineLocation || undefined,
          notes: newCitation.notes || undefined
        })
      })

      if (response.ok) {
        setShowNewCitationForm(false)
        setNewCitation({
          claimText: '',
          format: 'APA',
          pageNumber: '',
          inlineLocation: '',
          notes: ''
        })
        fetchCitations()
        onCitationUpdate?.()
      } else {
        const data = await response.json()
        alert(`Failed to create citation: ${data.error}`)
      }
    } catch (error) {
      console.error('Citation creation failed:', error)
      alert('Failed to create citation')
    }
  }

  const deleteCitation = async (citationId: string) => {
    if (!confirm('Are you sure you want to delete this citation?')) return

    try {
      const response = await fetch(`/api/books/${bookId}/citations?citationId=${citationId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchCitations()
        onCitationUpdate?.()
      } else {
        const data = await response.json()
        alert(`Failed to delete citation: ${data.error}`)
      }
    } catch (error) {
      console.error('Citation deletion failed:', error)
      alert('Failed to delete citation')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  const getBibliography = async () => {
    try {
      const response = await fetch(`/api/books/${bookId}/citations?bibliography=true`)
      const data = await response.json()
      
      if (response.ok) {
        const bibliography = data.bibliography[selectedFormat.toLowerCase()]
        if (bibliography && bibliography.length > 0) {
          const formattedBib = bibliography.join('\n\n')
          copyToClipboard(formattedBib)
        } else {
          alert(`No ${selectedFormat} citations found`)
        }
      }
    } catch (error) {
      console.error('Failed to get bibliography:', error)
      alert('Failed to generate bibliography')
    }
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'APA': return '🧠' // Psychology/Science
      case 'MLA': return '📚' // Literature/Humanities  
      case 'CHICAGO': return '🏛️' // History/General
      default: return '📝'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Citation Statistics & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="font-medium">{stats.total}</span> total citations
          </div>
          <div className="flex gap-2">
            {Object.entries(stats.byFormat).map(([format, count]) => (
              <Badge key={format} variant="outline" className="text-xs">
                {getFormatIcon(format.toUpperCase())} {format.toUpperCase()}: {count}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedFormat} onValueChange={(value: any) => setSelectedFormat(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="APA">APA</SelectItem>
              <SelectItem value="MLA">MLA</SelectItem>
              <SelectItem value="CHICAGO">Chicago</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={getBibliography}
            disabled={citations.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Bibliography
          </Button>
          <Button 
            size="sm" 
            onClick={() => setShowNewCitationForm(!showNewCitationForm)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Citation
          </Button>
        </div>
      </div>

      {/* New Citation Form */}
      {showNewCitationForm && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Manual Citation
            </CardTitle>
            <CardDescription>
              Create a citation for content not from research results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="claimText">Claim or Content to Cite</Label>
              <Textarea
                id="claimText"
                value={newCitation.claimText}
                onChange={(e) => setNewCitation(prev => ({ ...prev, claimText: e.target.value }))}
                placeholder="Enter the text or claim that needs citation..."
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="format">Citation Format</Label>
                <Select 
                  value={newCitation.format} 
                  onValueChange={(value: any) => setNewCitation(prev => ({ ...prev, format: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APA">APA</SelectItem>
                    <SelectItem value="MLA">MLA</SelectItem>
                    <SelectItem value="CHICAGO">Chicago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="pageNumber">Page Number</Label>
                <Input
                  id="pageNumber"
                  type="number"
                  value={newCitation.pageNumber}
                  onChange={(e) => setNewCitation(prev => ({ ...prev, pageNumber: e.target.value }))}
                  placeholder="123"
                />
              </div>
              
              <div>
                <Label htmlFor="inlineLocation">Location</Label>
                <Input
                  id="inlineLocation"
                  value={newCitation.inlineLocation}
                  onChange={(e) => setNewCitation(prev => ({ ...prev, inlineLocation: e.target.value }))}
                  placeholder="Chapter 3, para 2"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={newCitation.notes}
                onChange={(e) => setNewCitation(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this citation..."
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={createManualCitation} disabled={!newCitation.claimText.trim()}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Create Citation
              </Button>
              <Button variant="outline" onClick={() => setShowNewCitationForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Citations List */}
      {citations.length === 0 ? (
        <Alert>
          <Quote className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>No citations yet</strong></p>
              <p className="text-sm text-muted-foreground">
                Citations will appear here when you:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                <li>Use the "Cite" button on research results</li>
                <li>Create manual citations with the form above</li>
                <li>Import citations from external sources</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {(() => {
            // Filter citations by selected format
            const filteredCitations = citations.filter(citation => citation.format === selectedFormat)
            
            console.log('All citations:', citations.length, citations.map(c => ({ id: c.id, format: c.format })))
            console.log('Selected format:', selectedFormat)
            console.log('Filtered citations:', filteredCitations.length)
            
            // If no citations match selected format, show message
            if (filteredCitations.length === 0) {
              return (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No {selectedFormat} citations found. Try selecting a different citation format.
                  </AlertDescription>
                </Alert>
              )
            }
            
            // Pagination calculations
            const totalPages = Math.ceil(filteredCitations.length / citationsPerPage)
            const startIndex = (currentPage - 1) * citationsPerPage
            const endIndex = startIndex + citationsPerPage
            const currentCitations = filteredCitations.slice(startIndex, endIndex)
            
            return (
              <>
                {/* Citation count */}
                <div className="text-sm text-muted-foreground mb-4">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredCitations.length)} of {filteredCitations.length} {selectedFormat} citations
                </div>
                
                {currentCitations.map((citation) => (
              <Card key={citation.id} className="citation-item">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Citation Text */}
                      <div className="bg-muted p-3 rounded-md mb-3">
                        <p className="text-sm font-mono leading-relaxed">
                          {citation.citationText}
                        </p>
                      </div>
                      
                      {/* Citation Details */}
                      <div className="space-y-2">
                        {citation.claimText && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">CLAIM:</span>
                            <p className="text-sm mt-1">{citation.claimText}</p>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {citation.format}
                          </span>
                          
                          {citation.pageNumber && (
                            <span>Page {citation.pageNumber}</span>
                          )}
                          
                          {citation.inlineLocation && (
                            <span>{citation.inlineLocation}</span>
                          )}
                          
                          {citation.chapter && (
                            <span>Ch. {citation.chapter.orderIndex + 1}: {citation.chapter.title}</span>
                          )}
                          
                          <span>{new Date(citation.createdAt).toLocaleDateString()}</span>
                        </div>
                        
                        {citation.researchResult && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {citation.researchResult.sourceType}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${citation.researchResult.credibilityScore >= 80 
                                ? 'text-green-600 bg-green-50' 
                                : citation.researchResult.credibilityScore >= 60 
                                ? 'text-yellow-600 bg-yellow-50' 
                                : 'text-red-600 bg-red-50'}`}
                            >
                              {citation.researchResult.credibilityScore}% credible
                            </Badge>
                            {citation.researchResult.sourceUrl && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(citation.researchResult?.sourceUrl, '_blank')}
                                className="h-6 px-2 text-xs"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                        
                        {citation.notes && (
                          <p className="text-xs text-muted-foreground italic">
                            Note: {citation.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(citation.citationText)}
                        title="Copy citation"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteCitation(citation.id)}
                        title="Delete citation"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Pagination */}
            {filteredCitations.length > citationsPerPage && (
              <div className="mt-6">
                <SimplePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => {
                    setCurrentPage(page)
                    // Reset to page 1 when format changes
                  }}
                />
              </div>
            )}
          </>
        )
      })()}
    </div>
      )}

      {/* Format Guide */}
      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p><strong>Citation Format Guide:</strong></p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium">🧠 APA (American Psychological Association)</p>
                <p className="text-muted-foreground">Best for: Psychology, Science, Technology, Business</p>
              </div>
              <div>
                <p className="font-medium">📚 MLA (Modern Language Association)</p>
                <p className="text-muted-foreground">Best for: Literature, Humanities, Philosophy, History</p>
              </div>
              <div>
                <p className="font-medium">🏛️ Chicago Manual of Style</p>
                <p className="text-muted-foreground">Best for: History, General non-fiction, Journalism</p>
              </div>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}

export default CitationManager
