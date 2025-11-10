'use client'

import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, BookOpen, CheckCircle, AlertTriangle, Clock, Globe } from 'lucide-react'
import { ResearchSearch } from './research-search'
import { CitationManager } from './citation-manager'
import { FactCheckDashboard } from './fact-check-dashboard'
import { isNonFictionGenre } from '@/lib/genres'

interface ResearchPanelProps {
  bookId: string
  bookGenre?: string | null
  className?: string
}

export function ResearchPanel({ bookId, bookGenre, className = '' }: ResearchPanelProps) {
  const [isNonFiction, setIsNonFiction] = useState(false)
  const [stats, setStats] = useState({
    researchResults: 0,
    citations: 0,
    factChecks: 0,
    verifiedClaims: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkNonFiction = isNonFictionGenre(bookGenre)
    setIsNonFiction(checkNonFiction)
    
    if (checkNonFiction) {
      fetchResearchStats()
    } else {
      setLoading(false)
    }
  }, [bookGenre, bookId])

  const fetchResearchStats = async () => {
    try {
      // Fetch research statistics from multiple endpoints
      const [researchRes, citationsRes, factCheckRes] = await Promise.all([
        fetch(`/api/books/${bookId}/research`),
        fetch(`/api/books/${bookId}/citations`),
        fetch(`/api/books/${bookId}/fact-check`)
      ])

      const [researchData, citationsData, factCheckData] = await Promise.all([
        researchRes.ok ? researchRes.json() : { results: [] },
        citationsRes.ok ? citationsRes.json() : { citations: [] },
        factCheckRes.ok ? factCheckRes.json() : { factChecks: [], summary: {} }
      ])

      setStats({
        researchResults: researchData.results?.length || 0,
        citations: citationsData.citations?.length || 0,
        factChecks: factCheckData.summary?.total || 0,
        verifiedClaims: factCheckData.summary?.verified || 0
      })
    } catch (error) {
      console.error('Failed to fetch research stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Show upgrade message for fiction books
  if (!isNonFiction) {
    return (
      <Card className={`research-panel ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            Research & Fact-Checking
          </CardTitle>
          <CardDescription>
            Advanced research tools for factual accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Globe className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Research features are available for non-fiction books</strong></p>
                <p className="text-sm text-muted-foreground">
                  Change your book's genre to unlock Wikipedia research, fact-checking, and citation management for genres like:
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {['Biography', 'History', 'Science', 'Business', 'Health', 'Politics'].map(genre => (
                    <Badge key={genre} variant="outline" className="text-xs">
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className={`research-panel ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Research & Fact-Checking
            <Badge variant="secondary" className="ml-auto">
              {bookGenre}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`research-panel ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Research & Fact-Checking
          <Badge variant="secondary" className="ml-auto">
            {bookGenre}
          </Badge>
        </CardTitle>
        <CardDescription>
          Factual research, citations, and verification tools
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Research Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.researchResults}</div>
            <div className="text-xs text-muted-foreground">Research Results</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.citations}</div>
            <div className="text-xs text-muted-foreground">Citations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.factChecks}</div>
            <div className="text-xs text-muted-foreground">Fact Checks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.verifiedClaims}</div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </div>
        </div>

        {/* Research Tools Tabs */}
        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Research
            </TabsTrigger>
            <TabsTrigger value="citations" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Citations
            </TabsTrigger>
            <TabsTrigger value="factcheck" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Fact Check
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-4">
            <ResearchSearch 
              bookId={bookId}
              onResearchComplete={fetchResearchStats}
            />
          </TabsContent>

          <TabsContent value="citations" className="mt-4">
            <CitationManager 
              bookId={bookId}
              bookGenre={bookGenre}
              onCitationUpdate={fetchResearchStats}
            />
          </TabsContent>

          <TabsContent value="factcheck" className="mt-4">
            <FactCheckDashboard 
              bookId={bookId}
              onFactCheckUpdate={fetchResearchStats}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default ResearchPanel
