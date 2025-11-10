'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { SimplePagination } from '@/components/ui/pagination'
import { 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  Clock, 
  Loader, 
  Search,
  ExternalLink,
  Shield,
  TrendingUp,
  AlertCircle,
  Trash2
} from 'lucide-react'

interface FactCheck {
  id: string
  claim: string
  status: 'VERIFIED' | 'DISPUTED' | 'UNCERTAIN' | 'REQUIRES_REVIEW'
  confidenceScore: number
  verificationSources: Array<{
    title: string
    source: string
    url: string
    credibilityScore: number
  }>
  conflictingSources?: Array<{
    title: string
    source: string
    url: string
    credibilityScore: number
  }>
  recommendations: string
  verifiedBy?: string
  createdAt: string
  chapter?: {
    title: string
    orderIndex: number
  }
}

interface FactCheckSummary {
  total: number
  verified: number
  disputed: number
  uncertain: number
  needsReview: number
}

interface FactCheckDashboardProps {
  bookId: string
  onFactCheckUpdate?: () => void
}

export function FactCheckDashboard({ bookId, onFactCheckUpdate }: FactCheckDashboardProps) {
  const [factChecks, setFactChecks] = useState<FactCheck[]>([])
  const [summary, setSummary] = useState<FactCheckSummary>({
    total: 0,
    verified: 0,
    disputed: 0,
    uncertain: 0,
    needsReview: 0
  })
  const [loading, setLoading] = useState(true)
  const [checkingContent, setCheckingContent] = useState(false)
  const [contentToCheck, setContentToCheck] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const factChecksPerPage = 5

  useEffect(() => {
    fetchFactChecks()
  }, [bookId, selectedStatus])

  // Reset pagination when status filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedStatus])

  const fetchFactChecks = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedStatus !== 'all') {
        params.set('status', selectedStatus)
      }
      
      const response = await fetch(`/api/books/${bookId}/fact-check?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setFactChecks(data.factChecks || [])
        setSummary(data.summary || {
          total: 0,
          verified: 0,
          disputed: 0,
          uncertain: 0,
          needsReview: 0
        })
      }
    } catch (error) {
      console.error('Failed to fetch fact checks:', error)
    } finally {
      setLoading(false)
    }
  }

  const performFactCheck = async () => {
    if (!contentToCheck.trim()) return

    setCheckingContent(true)
    
    try {
      const response = await fetch(`/api/books/${bookId}/fact-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: contentToCheck
        })
      })

      const data = await response.json()

      if (response.ok) {
        setContentToCheck('')
        fetchFactChecks()
        onFactCheckUpdate?.()
        
        if (data.factChecks && data.factChecks.length > 0) {
          alert(`Fact-checking complete! Analyzed ${data.claimsAnalyzed} claims.`)
        } else {
          alert('No factual claims detected in the provided content.')
        }
      } else {
        alert(`Fact-checking failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Fact-checking failed:', error)
      alert('Fact-checking failed due to technical error')
    } finally {
      setCheckingContent(false)
    }
  }

  const deleteFactCheck = async (factCheckId: string, claim: string) => {
    if (!confirm(`Are you sure you want to delete this fact check for "${claim}"? This action cannot be undone.`)) return

    try {
      const response = await fetch(`/api/books/${bookId}/fact-check?factCheckId=${factCheckId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Refresh fact checks to show updated list
        await fetchFactChecks()
        onFactCheckUpdate?.()
      } else {
        const data = await response.json()
        alert(`Failed to delete fact check: ${data.error}`)
      }
    } catch (err) {
      console.error('Delete fact check error:', err)
      alert('Failed to delete fact check')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'DISPUTED':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'UNCERTAIN':
        return <HelpCircle className="h-4 w-4 text-yellow-600" />
      case 'REQUIRES_REVIEW':
        return <Clock className="h-4 w-4 text-gray-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'DISPUTED':
        return 'text-red-700 bg-red-50 border-red-200'
      case 'UNCERTAIN':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case 'REQUIRES_REVIEW':
        return 'text-gray-700 bg-gray-50 border-gray-200'
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const calculateAccuracyRate = () => {
    if (summary.total === 0) return 0
    return Math.round((summary.verified / summary.total) * 100)
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
      {/* Fact-Check Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-xs text-muted-foreground">Total Checks</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{summary.verified}</div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{summary.disputed}</div>
            <div className="text-xs text-muted-foreground">Disputed</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{summary.uncertain}</div>
            <div className="text-xs text-muted-foreground">Uncertain</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-600">{summary.needsReview}</div>
            <div className="text-xs text-muted-foreground">Need Review</div>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Rate */}
      {summary.total > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-medium">Accuracy Rate</span>
              </div>
              <span className="text-sm font-medium">{calculateAccuracyRate()}%</span>
            </div>
            <Progress value={calculateAccuracyRate()} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Based on verified claims vs total fact-checks
            </p>
          </CardContent>
        </Card>
      )}

      {/* Fact-Check Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Verify Content
          </CardTitle>
          <CardDescription>
            Paste text content to automatically fact-check claims
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="content">Content to Fact-Check</Label>
            <Textarea
              id="content"
              value={contentToCheck}
              onChange={(e) => setContentToCheck(e.target.value)}
              placeholder="Paste a paragraph or section of your book here. The AI will identify and verify any factual claims..."
              className="mt-1 min-h-[120px]"
              disabled={checkingContent}
            />
          </div>
          
          <Button 
            onClick={performFactCheck}
            disabled={!contentToCheck.trim() || checkingContent}
            className="w-full"
          >
            {checkingContent ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Fact-Checking...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Analyze Claims
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Status Filter */}
      {factChecks.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter by status:</span>
          <div className="flex gap-1">
            {[
              { key: 'all', label: 'All', count: summary.total },
              { key: 'VERIFIED', label: 'Verified', count: summary.verified },
              { key: 'DISPUTED', label: 'Disputed', count: summary.disputed },
              { key: 'UNCERTAIN', label: 'Uncertain', count: summary.uncertain },
              { key: 'REQUIRES_REVIEW', label: 'Review', count: summary.needsReview }
            ].map((filter) => (
              <Button
                key={filter.key}
                size="sm"
                variant={selectedStatus === filter.key ? "default" : "outline"}
                onClick={() => setSelectedStatus(filter.key)}
                className="text-xs"
              >
                {filter.label} ({filter.count})
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Fact-Check Results */}
      {factChecks.length === 0 ? (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>No fact-checks yet</strong></p>
              <p className="text-sm text-muted-foreground">
                Start by pasting content in the form above. The AI will:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                <li>Extract factual claims from your text</li>
                <li>Verify claims against reliable sources</li>
                <li>Highlight potential inaccuracies</li>
                <li>Provide recommendations for improvement</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {(() => {
            // Pagination calculations
            const totalPages = Math.ceil(factChecks.length / factChecksPerPage)
            const startIndex = (currentPage - 1) * factChecksPerPage
            const endIndex = startIndex + factChecksPerPage
            const currentFactChecks = factChecks.slice(startIndex, endIndex)
            
            return (
              <>
                {/* Fact checks count */}
                {factChecks.length > 0 && (
                  <div className="text-sm text-muted-foreground mb-4">
                    Showing {startIndex + 1}-{Math.min(endIndex, factChecks.length)} of {factChecks.length} fact checks
                  </div>
                )}
                
                {currentFactChecks.map((factCheck) => (
            <Card key={factCheck.id} className={`fact-check-item border-l-4 ${getStatusColor(factCheck.status)}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {getStatusIcon(factCheck.status)}
                      <span className="font-medium uppercase text-xs tracking-wide">
                        {factCheck.status.replace('_', ' ')}
                      </span>
                      <Badge 
                        variant="outline"
                        className={`text-xs ${getConfidenceColor(factCheck.confidenceScore)}`}
                      >
                        {factCheck.confidenceScore}% confidence
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {factCheck.chapter && (
                        <span className="text-xs">
                          Chapter {factCheck.chapter.orderIndex + 1}: {factCheck.chapter.title} • 
                        </span>
                      )}
                      <span className="text-xs">
                        {new Date(factCheck.createdAt).toLocaleDateString()}
                      </span>
                      {factCheck.verifiedBy && (
                        <span className="text-xs"> • Verified by {factCheck.verifiedBy}</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteFactCheck(factCheck.id, factCheck.claim)}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Claim */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Claim:</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">{factCheck.claim}</p>
                  </div>
                </div>

                {/* Verification Sources */}
                {factCheck.verificationSources.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-green-700">Supporting Sources:</h4>
                    <div className="space-y-2">
                      {factCheck.verificationSources.map((source, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded-md border border-green-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{source.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs uppercase">
                                {source.source}
                              </Badge>
                              <Badge 
                                variant="outline"
                                className={`text-xs ${getConfidenceColor(source.credibilityScore)}`}
                              >
                                {source.credibilityScore}% credible
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(source.url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicting Sources */}
                {factCheck.conflictingSources && factCheck.conflictingSources.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-red-700">Conflicting Sources:</h4>
                    <div className="space-y-2">
                      {factCheck.conflictingSources.map((source, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded-md border border-red-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{source.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs uppercase">
                                {source.source}
                              </Badge>
                              <Badge 
                                variant="outline"
                                className={`text-xs ${getConfidenceColor(source.credibilityScore)}`}
                              >
                                {source.credibilityScore}% credible
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(source.url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {factCheck.recommendations && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Recommendations:</h4>
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                      <p className="text-sm text-blue-800">{factCheck.recommendations}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          {/* Pagination */}
          {factChecks.length > factChecksPerPage && (
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
      )}

      {/* Fact-Checking Tips */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p><strong>Fact-Checking Best Practices:</strong></p>
            <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
              <li>Check statistical claims, dates, and names</li>
              <li>Verify quotes and attributions</li>
              <li>Cross-reference controversial information</li>
              <li>Update content when sources conflict</li>
              <li>Keep records of your verification process</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}

export default FactCheckDashboard
