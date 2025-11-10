"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  BookOpen, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Globe,
  GraduationCap,
  Newspaper,
  Quote,
  Shield,
  TrendingUp,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isNonFictionGenre, getGenreLabel } from "@/lib/genres"
import { ResearchSearch } from "@/components/research/research-search"
import { CitationManager } from "@/components/research/citation-manager"
import { FactCheckDashboard } from "@/components/research/fact-check-dashboard"

interface ResearchModalProps {
  bookId: string;
  bookGenre?: string | null;
  className?: string;
}

interface ResearchStats {
  researchResults: number;
  citations: number;
  factChecks: number;
  verifiedClaims: number;
}

export function ResearchModal({ bookId, bookGenre, className = '' }: ResearchModalProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('factcheck')
  const [stats, setStats] = React.useState<ResearchStats>({
    researchResults: 0,
    citations: 0,
    factChecks: 0,
    verifiedClaims: 0
  })
  const [loading, setLoading] = React.useState(false)

  const isNonFiction = isNonFictionGenre(bookGenre)

  const fetchResearchStats = React.useCallback(async () => {
    if (!isNonFiction) return
    
    setLoading(true)
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
  }, [bookId, isNonFiction])

  // Fetch stats when modal opens
  React.useEffect(() => {
    if (isOpen && isNonFiction) {
      fetchResearchStats()
    }
  }, [isOpen, isNonFiction, fetchResearchStats])

  // Don't show button for fiction books
  if (!isNonFiction) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className={cn("h-8 px-3", className)}
          onClick={() => setIsOpen(true)}
        >
          <Search className="h-4 w-4 mr-2" />
          Fact Check
          {bookGenre && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {getGenreLabel(bookGenre)}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="!max-w-none w-[70vw] h-[90vh] max-h-[900px] !p-0 gap-0 overflow-hidden flex flex-col" style={{ width: '70vw', height: '90vh', maxWidth: 'none' }}>
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Search className="h-5 w-5" />
                Research & Fact-Checking
                {bookGenre && (
                  <Badge variant="secondary" className="ml-2">
                    {getGenreLabel(bookGenre)}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-2">
                Factual research, citations, and verification tools for non-fiction writing
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Research Statistics Bar */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium">{stats.researchResults}</span>
              <span className="text-xs text-muted-foreground">Research Results</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium">{stats.citations}</span>
              <span className="text-xs text-muted-foreground">Citations</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-sm font-medium">{stats.factChecks}</span>
              <span className="text-xs text-muted-foreground">Fact Checks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-sm font-medium">{stats.verifiedClaims}</span>
              <span className="text-xs text-muted-foreground">Verified Claims</span>
            </div>
            {stats.factChecks > 0 && (
              <div className="ml-auto">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">
                    {stats.factChecks > 0 ? Math.round((stats.verifiedClaims / stats.factChecks) * 100) : 0}% Accuracy
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 grid w-fit grid-cols-3 mb-4">
              <TabsTrigger value="factcheck" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Fact Check
              </TabsTrigger>
              <TabsTrigger value="research" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Research
              </TabsTrigger>
              <TabsTrigger value="citations" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Citations
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <TabsContent value="factcheck" className="mt-0 h-full">
                <div className="h-full">
                  <FactCheckDashboard 
                    bookId={bookId}
                    onFactCheckUpdate={fetchResearchStats}
                  />
                </div>
              </TabsContent>

              <TabsContent value="research" className="mt-0 h-full">
                <div className="h-full">
                  <ResearchSearch 
                    bookId={bookId}
                    onResearchComplete={fetchResearchStats}
                  />
                </div>
              </TabsContent>

              <TabsContent value="citations" className="mt-0 h-full">
                <div className="h-full">
                  <CitationManager 
                    bookId={bookId}
                    bookGenre={bookGenre}
                    onCitationUpdate={fetchResearchStats}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Help Section */}
        <div className="border-t px-6 py-3 bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Wikipedia
              </span>
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                Scholarly Articles
              </span>
              <span className="flex items-center gap-1">
                <Newspaper className="h-3 w-3" />
                News Sources
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>Real-time fact verification</span>
              <span>•</span>
              <span>Academic-grade citations</span>
              <span>•</span>
              <span>Source credibility scoring</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ResearchModal
