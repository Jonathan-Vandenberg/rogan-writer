"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Download, 
  FileText, 
  BookOpen, 
  Settings, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Upload,
  Eye,
  Trash2
} from "lucide-react"
import { useSelectedBook } from "@/contexts/selected-book-context"
import { cn } from "@/lib/utils"

interface ExportSettings {
  includeChapterNumbers: boolean
  includePageNumbers: boolean
  includeCover: boolean
  includeTableOfContents: boolean
  manuscriptFormat: boolean
  customCoverImage: File | null
  paperSize: string
  margins: string
  fontSize: number
  fontFamily: string
  lineSpacing: number
}

interface ExportRequest {
  id: string
  format: string
  fileName: string
  status: string
  fileUrl: string | null
  bookTitle: string
  createdAt: string
}

interface ExportStats {
  total: number
  byStatus: {
    processing: number
    completed: number
    failed: number
  }
  byFormat: {
    pdf: number
    txt: number
    html: number
  }
  recentExports: ExportRequest[]
  successRate: number
}

export default function ExportPage() {
  const { selectedBookId } = useSelectedBook()
  const [selectedFormat, setSelectedFormat] = React.useState<string>("")
  const [exportSettings, setExportSettings] = React.useState<ExportSettings>({
    includeChapterNumbers: true,
    includePageNumbers: true,
    includeCover: true,
    includeTableOfContents: true,
    manuscriptFormat: false,
    customCoverImage: null,
    paperSize: "letter",
    margins: "standard",
    fontSize: 12,
    fontFamily: "Times New Roman",
    lineSpacing: 2
  })
  const [exportStats, setExportStats] = React.useState<ExportStats | null>(null)
  const [isExporting, setIsExporting] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Fetch export stats and recent exports
  React.useEffect(() => {
    async function fetchExportData() {
      try {
        console.log('Fetching export stats...')
        const response = await fetch('/api/exports')
        if (response.ok) {
          const stats = await response.json()
          console.log('Export stats received:', stats)
          setExportStats(stats)
        } else {
          console.error('Failed to fetch export stats:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Error fetching export data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchExportData()
  }, [])

  const handleProcessExport = async (exportId: string) => {
    try {
      console.log('Processing export:', exportId)
      const response = await fetch(`/api/exports/${exportId}/process`, {
        method: 'POST',
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Export processed successfully:', result)
        alert('Export processed successfully!')
        
        // Refresh export stats
        const statsResponse = await fetch('/api/exports')
        if (statsResponse.ok) {
          const stats = await statsResponse.json()
          console.log('Refreshed export stats:', stats)
          setExportStats(stats)
        }
      } else {
        console.error('Processing failed:', response.status, response.statusText)
        alert('Processing failed. Please try again.')
      }
    } catch (error) {
      console.error('Processing error:', error)
      alert('Processing failed. Please try again.')
    }
  }

  const handleExport = async (format: string) => {
    if (!selectedBookId) {
      alert('Please select a book to export')
      return
    }

    console.log('Starting export:', { format, bookId: selectedBookId, settings: exportSettings })
    setIsExporting(true)
    
    try {
      // Create export request
      const response = await fetch('/api/exports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId: selectedBookId,
          format: format.toUpperCase(),
          settings: exportSettings
        }),
      })

      if (response.ok) {
        const exportRequest = await response.json()
        console.log('Export request created:', exportRequest)
        
        // Immediately trigger processing
        console.log('Starting processing for export:', exportRequest.id)
        const processResponse = await fetch(`/api/exports/${exportRequest.id}/process`, {
          method: 'POST',
        })

        if (processResponse.ok) {
          const result = await processResponse.json()
          console.log('Export processing completed:', result)
          alert(`Export completed! File is ready for download.`)
        } else {
          console.error('Processing failed:', processResponse.status, processResponse.statusText)
          alert(`Export created but processing failed. You can retry processing later.`)
        }
        
        // Refresh export stats
        console.log('Refreshing export stats after export...')
        const statsResponse = await fetch('/api/exports')
        if (statsResponse.ok) {
          const stats = await statsResponse.json()
          console.log('Refreshed export stats after export:', stats)
          setExportStats(stats)
        }
      } else {
        const errorText = await response.text()
        console.error('Export creation failed:', response.status, response.statusText, errorText)
        throw new Error('Export failed')
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleCoverImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setExportSettings(prev => ({
        ...prev,
        customCoverImage: file
      }))
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'PROCESSING': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'FAILED': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Export</h1>
          <p className="text-muted-foreground">Loading export options...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          Export your book in multiple formats for publishing and sharing
        </p>
      </div>

      {!selectedBookId && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="text-yellow-800">Please select a book from the dropdown above to enable export options.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export Formats */}
        <Card>
          <CardHeader>
            <CardTitle>Export Formats</CardTitle>
            <CardDescription>
              Choose from multiple formats optimized for different purposes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Button
                onClick={() => handleExport('pdf')}
                disabled={!selectedBookId || isExporting}
                className="justify-start h-auto p-4"
                variant="outline"
              >
                <div className="flex items-center gap-3 w-full">
                  <FileText className="h-6 w-6 text-red-500" />
                  <div className="text-left">
                    <div className="font-medium">PDF</div>
                    <div className="text-sm text-muted-foreground">Perfect for print and digital distribution</div>
                  </div>
                </div>
              </Button>

              <Button
                onClick={() => handleExport('txt')}
                disabled={!selectedBookId || isExporting}
                className="justify-start h-auto p-4"
                variant="outline"
              >
                <div className="flex items-center gap-3 w-full">
                  <FileText className="h-6 w-6 text-gray-500" />
                  <div className="text-left">
                    <div className="font-medium">TXT</div>
                    <div className="text-sm text-muted-foreground">Plain text format</div>
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

      {/* Recent Exports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Exports</CardTitle>
          <CardDescription>
            Your latest export history and downloads
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading exports...</div>
          ) : exportStats && exportStats.recentExports.length > 0 ? (
            <div className="space-y-3">
              {exportStats.recentExports.map((exportItem) => (
                <div key={exportItem.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(exportItem.status)}
                    <div>
                      <div className="font-medium">{exportItem.fileName}</div>
                      <div className="text-sm text-muted-foreground">
                        {exportItem.bookTitle} • {exportItem.format} • {new Date(exportItem.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={exportItem.status === 'COMPLETED' ? 'default' : 'secondary'}>
                      {formatStatus(exportItem.status)}
                    </Badge>
                    {exportItem.status === 'COMPLETED' && exportItem.fileUrl && (
                      <Button asChild size="sm" variant="outline">
                        <a href={exportItem.fileUrl} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {exportItem.status === 'FAILED' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleProcessExport(exportItem.id)}
                      >
                        Retry Process
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No exports yet</p>
              <p className="text-sm">Create your first export using the buttons above</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
} 