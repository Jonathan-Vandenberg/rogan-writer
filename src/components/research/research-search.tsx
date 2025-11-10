'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { SimplePagination } from '@/components/ui/pagination'
import { Search, Loader, ExternalLink, Globe, GraduationCap, Newspaper, Quote, Clock, Trash2 } from 'lucide-react'

interface ResearchResult {
  id: string
  title: string
  summary: string
  sourceType: string
  url: string
  credibilityScore: number
  lastUpdated: Date
  authors?: string[]
  tags?: string[]
  imageUrl?: string
}

interface ResearchSearchProps {
  bookId: string
  onResearchComplete?: () => void
}

export function ResearchSearch({ bookId, onResearchComplete }: ResearchSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSources, setSelectedSources] = useState({
    wikipedia: true,
    scholarly: true,
    news: true
  })
  const [error, setError] = useState<string | null>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const resultsPerPage = 5

  // Load existing research results on component mount
  useEffect(() => {
    fetchExistingResults()
  }, [bookId])

  const fetchExistingResults = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/books/${bookId}/research`)
      
      if (response.ok) {
        const data = await response.json()
        setResults(data.results || [])
      }
    } catch (err) {
      console.error('Error fetching existing research:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setCurrentPage(1) // Reset to first page on new search
    
    try {
      const sources = Object.entries(selectedSources)
        .filter(([_, enabled]) => enabled)
        .map(([source, _]) => source)

      const response = await fetch(`/api/books/${bookId}/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          sources: sources
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Research failed')
      }

      // After new search, refresh all results from the database to show everything
      await fetchExistingResults()
      onResearchComplete?.()
      
    } catch (err) {
      console.error('Research error:', err)
      setError(err instanceof Error ? err.message : 'Failed to perform research')
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch()
    }
  }

  const deleteResearchResult = async (resultId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) return

    try {
      const response = await fetch(`/api/books/${bookId}/research?resultId=${resultId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Refresh results to show updated list
        await fetchExistingResults()
        onResearchComplete?.()
      } else {
        const data = await response.json()
        alert(`Failed to delete research result: ${data.error}`)
      }
    } catch (err) {
      console.error('Delete research result error:', err)
      alert('Failed to delete research result')
    }
  }

  const getSourceIcon = (source: string) => {
    if (!source) return <Search className="h-4 w-4" />
    
    switch (source.toLowerCase()) {
      case 'wikipedia':
        return <Globe className="h-4 w-4" />
      case 'scholarly':
        return <GraduationCap className="h-4 w-4" />
      case 'news':
        return <Newspaper className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  const getCredibilityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const createCitation = async (result: ResearchResult) => {
    try {
      const response = await fetch(`/api/books/${bookId}/citations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          researchResultId: result.id,
          format: 'apa' // Default to APA, user can change later
        })
      })

      if (response.ok) {
        alert('Citation created successfully!')
        onResearchComplete?.()
      } else {
        const data = await response.json()
        alert(`Failed to create citation: ${data.error}`)
      }
    } catch (error) {
      console.error('Citation creation failed:', error)
      alert('Failed to create citation')
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search for factual information (e.g., 'population of Tokyo', 'Einstein theory of relativity')..."
          className="flex-1"
          disabled={loading}
        />
        <Button 
          onClick={handleSearch} 
          disabled={loading || !query.trim()}
          className="min-w-[100px]"
        >
          {loading ? (
            <>
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Searching
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Research
            </>
          )}
        </Button>
      </div>

      {/* Source Selection */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium">Sources:</span>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="wikipedia"
            checked={selectedSources.wikipedia}
            onCheckedChange={(checked) => 
              setSelectedSources(prev => ({ ...prev, wikipedia: !!checked }))
            }
          />
          <label htmlFor="wikipedia" className="flex items-center gap-1 cursor-pointer">
            <Globe className="h-3 w-3" />
            Wikipedia
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="scholarly"
            checked={selectedSources.scholarly}
            onCheckedChange={(checked) => 
              setSelectedSources(prev => ({ ...prev, scholarly: !!checked }))
            }
          />
          <label htmlFor="scholarly" className="flex items-center gap-1 cursor-pointer">
            <GraduationCap className="h-3 w-3" />
            Scholarly
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="news"
            checked={selectedSources.news}
            onCheckedChange={(checked) => 
              setSelectedSources(prev => ({ ...prev, news: !!checked }))
            }
          />
          <label htmlFor="news" className="flex items-center gap-1 cursor-pointer">
            <Newspaper className="h-3 w-3" />
            News
          </label>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* No Results Message */}
      {!loading && results.length === 0 && !error && (
        <Alert>
          <Search className="h-4 w-4" />
          <AlertDescription>
            {query 
              ? `No results found for "${query}". Try rephrasing your search or using more specific terms.`
              : "No research results yet. Search for factual information using the form above to get started."
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Research Results */}
      <div className="space-y-4">
        {(() => {
          // Pagination calculations
          const totalPages = Math.ceil(results.length / resultsPerPage)
          const startIndex = (currentPage - 1) * resultsPerPage
          const endIndex = startIndex + resultsPerPage
          const currentResults = results.slice(startIndex, endIndex)
          
          return (
            <>
              {/* Results header and count */}
              {results.length > 0 && (
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Research Results</h3>
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, results.length)} of {results.length} results
                  </div>
                </div>
              )}
              
              {currentResults.map((result) => (
          <Card key={result.id} className="research-result">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {getSourceIcon(result.sourceType)}
                    <span className="truncate">{result.title}</span>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getCredibilityColor(result.credibilityScore)}`}
                    >
                      {result.credibilityScore}% credible
                    </Badge>
                    <Badge variant="secondary" className="text-xs uppercase">
                      {result.sourceType}
                    </Badge>
                    {result.authors && result.authors.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        by {result.authors.join(', ')}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createCitation(result)}
                    className="text-xs"
                  >
                    <Quote className="h-3 w-3 mr-1" />
                    Cite
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(result.url, '_blank')}
                    className="text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Source
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteResearchResult(result.id, result.title)}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Research Image */}
              {result.imageUrl && (
                <div className="mb-4">
                  <img 
                    src={result.imageUrl} 
                    alt={result.title}
                    className="w-full max-w-sm h-auto rounded-md border border-border object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                    loading="lazy"
                  />
                </div>
              )}
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.summary}
              </p>
              
              {result.tags && result.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-3">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(result.lastUpdated).toLocaleDateString()}
                  </span>
                  <div className="flex flex-wrap gap-1 ml-auto">
                    {result.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {/* Pagination */}
        {results.length > resultsPerPage && (
          <div className="mt-6">
            <SimplePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </>
    )
  })()}
</div>

      {/* Research Tips */}
      {!query && (
        <Alert>
          <Search className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Research Tips:</strong></p>
              <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                <li>Use specific terms: "population of Tokyo 2023" vs "Tokyo"</li>
                <li>Include context: "Einstein theory of relativity" vs "Einstein"</li>
                <li>Ask questions: "When was the Berlin Wall built?"</li>
                <li>Check multiple sources for controversial topics</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default ResearchSearch
