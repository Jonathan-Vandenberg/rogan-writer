"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FileText, 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  BookOpen,
  User,
  MapPin,
  Calendar,
  Zap,
  Lightbulb,
  Eye,
  Download,
  PenTool,
  HelpCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STYLE_PROMPTS, getStylePromptsByCategory, type StylePrompt } from "@/lib/style-prompts"

interface DraftGeneratorProps {
  bookId: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface PlanningContent {
  plotPoints: number;
  characters: number;
  locations: number;
  sceneCards: number;
  brainstorming: number;
  timeline: number;
  total: number;
}

interface DraftStatus {
  bookTitle: string;
  hasExistingChapters: boolean;
  existingChaptersCount: number;
  totalExistingWords: number;
  planningContent: PlanningContent;
  canGenerateDraft: boolean;
  recommendedAction: 'preview' | 'generate' | 'add_planning';
}

interface GeneratedChapter {
  title: string;
  description: string;
  content: string;
  wordCount: number;
  orderIndex: number;
}

interface DraftPreview {
  chapters: GeneratedChapter[];
  totalWordCount: number;
  structure: string;
  summary: string;
}

const DraftGenerator: React.FC<DraftGeneratorProps> = ({ bookId, className, open: controlledOpen, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draftStatus, setDraftStatus] = React.useState<DraftStatus | null>(null);
  const [draftPreview, setDraftPreview] = React.useState<DraftPreview | null>(null);
  const [showConfirmation, setShowConfirmation] = React.useState(false);
  const [selectedChapters, setSelectedChapters] = React.useState<Set<number>>(new Set());
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [writingStylePrompt, setWritingStylePrompt] = React.useState("");

  // Load draft status when modal opens
  React.useEffect(() => {
    if (isOpen && !draftStatus) {
      loadDraftStatus();
    }
  }, [isOpen]);

  const loadDraftStatus = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/books/${bookId}/generate-draft`);
      if (response.ok) {
        const data = await response.json();
        setDraftStatus(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load draft status');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/books/${bookId}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          preview: true,
          writingStylePrompt: writingStylePrompt.trim() || undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setDraftPreview(data.draft);
        // Auto-select all chapters initially
        const allChapterIndices = new Set<number>(data.draft.chapters.map((_: any, index: number) => index));
        setSelectedChapters(allChapterIndices);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Preview generation failed');
      }
    } catch (err) {
      setError('Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleChapterSelection = (chapterIndex: number) => {
    setSelectedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterIndex)) {
        newSet.delete(chapterIndex);
      } else {
        newSet.add(chapterIndex);
      }
      return newSet;
    });
  };

  const selectAllChapters = () => {
    if (draftPreview) {
      const allIndices = new Set(draftPreview.chapters.map((_, index) => index));
      setSelectedChapters(allIndices);
    }
  };

  const deselectAllChapters = () => {
    setSelectedChapters(new Set());
  };

  const handleAcceptSelected = async () => {
    if (!draftPreview || selectedChapters.size === 0) return;
    
    setIsAccepting(true);
    setError(null);
    
    try {
      // Get the actual chapter data for selected chapters
      const selectedChapterData = Array.from(selectedChapters).map(index => ({
        ...draftPreview.chapters[index],
        originalIndex: index
      }));
      
      const response = await fetch(`/api/books/${bookId}/save-selected-chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chapters: selectedChapterData,
          replaceExisting: draftStatus?.hasExistingChapters || false,
          draftSummary: draftPreview.summary,
          draftStructure: draftPreview.structure
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`Success! Created ${data.chaptersCreated} chapters with ${data.totalWordCount} words.`);
        setIsOpen(false);
        // Refresh the page to show new chapters
        window.location.reload();
      } else {
        const errorData = await response.json();
        if (response.status === 409 && errorData.requiresConfirmation) {
          setShowConfirmation(true);
        } else {
          setError(errorData.error || 'Failed to accept chapters');
        }
      }
    } catch (err) {
      setError('Failed to accept selected chapters');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleGenerate = async (replaceExisting = false) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/books/${bookId}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          replaceExisting,
          writingStylePrompt: writingStylePrompt.trim() || undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`Success! Generated ${data.chaptersCreated} chapters with ${data.totalWordCount} words.`);
        setIsOpen(false);
        // Refresh the page to show new chapters
        window.location.reload();
      } else {
        const errorData = await response.json();
        if (response.status === 409 && errorData.requiresConfirmation) {
          setShowConfirmation(true);
        } else {
          setError(errorData.error || 'Generation failed');
        }
      }
    } catch (err) {
      setError('Failed to generate draft');
    } finally {
      setIsGenerating(false);
    }
  };

  const getPlanningIcon = (type: string) => {
    switch (type) {
      case 'plotPoints': return Zap;
      case 'characters': return User;
      case 'locations': return MapPin;
      case 'sceneCards': return BookOpen;
      case 'brainstorming': return Lightbulb;
      case 'timeline': return Calendar;
      default: return FileText;
    }
  };

  const getPlanningLabel = (type: string) => {
    switch (type) {
      case 'plotPoints': return 'Plot Points';
      case 'characters': return 'Characters';
      case 'locations': return 'Locations';
      case 'sceneCards': return 'Scene Cards';
      case 'brainstorming': return 'Ideas';
      case 'timeline': return 'Timeline';
      default: return type;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" className={cn("gap-2", className)}>
            <FileText className="h-4 w-4" />
            Draft from Planning
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Draft from Planning
          </DialogTitle>
          <DialogDescription>
            Generate book content from your planning materials (characters, plot, scenes, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2">Checking planning content...</span>
            </div>
          ) : error ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : draftStatus ? (
            <div className="space-y-6">
              {/* Writing Style Instructions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PenTool className="h-5 w-5 text-purple-600" />
                    Writing Style & Instructions
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        <p className="text-sm mb-2">Provide specific instructions about writing style, tone, and other book-related directions.</p>
                        <p className="text-xs text-muted-foreground">
                          Examples: "Write in a lyrical, poetic style with rich metaphors", "Use short, punchy sentences", "Include detailed sensory descriptions", "Maintain a dark, suspenseful tone throughout"
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <CardDescription>
                    Guide the AI on how you want your book written
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="style-template">Choose a Writing Style Template (Optional)</Label>
                      <Select
                        value=""
                        onValueChange={(value) => {
                          if (value) {
                            const prompt = STYLE_PROMPTS.find(p => p.id === value);
                            if (prompt) {
                              setWritingStylePrompt(prompt.prompt);
                            }
                          }
                        }}
                      >
                        <SelectTrigger id="style-template">
                          <SelectValue placeholder="Select a writing style template..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                          {Object.entries(getStylePromptsByCategory()).map(([category, prompts]) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {category}
                              </div>
                              {prompts.map((prompt) => (
                                <SelectItem key={prompt.id} value={prompt.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{prompt.name}</span>
                                    <span className="text-xs text-muted-foreground">{prompt.description}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select a template to auto-fill the instructions below, or write your own custom instructions.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="writing-style">Writing Style Instructions</Label>
                      <Textarea
                        id="writing-style"
                        placeholder="Select a template above or write custom instructions...&#10;&#10;Examples:&#10;- Write in third person limited perspective&#10;- Use vivid, descriptive language with rich metaphors&#10;- Include detailed sensory descriptions&#10;- Maintain a suspenseful, dark tone&#10;- Keep dialogue natural and realistic"
                        value={writingStylePrompt}
                        onChange={(e) => setWritingStylePrompt(e.target.value)}
                        rows={8}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        These instructions will be applied to all generated chapters. Leave blank to use default writing guidelines.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Planning Content Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Planning Content Available</CardTitle>
                  <CardDescription>
                    {draftStatus.bookTitle} • {draftStatus.planningContent.total} planning items
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(draftStatus.planningContent).map(([key, count]) => {
                      if (key === 'total') return null;
                      const Icon = getPlanningIcon(key);
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{getPlanningLabel(key)}</span>
                          <Badge variant={count > 0 ? "default" : "secondary"} className="text-xs">
                            {count}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                  
                  {draftStatus.hasExistingChapters && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Existing Content</span>
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        This book already has {draftStatus.existingChaptersCount} chapters 
                        ({draftStatus.totalExistingWords} words). Generating a new draft will replace them.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Draft Preview */}
              {draftPreview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Draft Preview</span>
                      <div className="flex items-center gap-2 text-sm font-normal">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={selectAllChapters}
                          className="h-6 text-xs"
                        >
                          Select All
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={deselectAllChapters}
                          className="h-6 text-xs"
                        >
                          Deselect All
                        </Button>
                        <Badge variant="secondary" className="text-xs">
                          {selectedChapters.size} selected
                        </Badge>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      {draftPreview.chapters.length} chapters • {draftPreview.totalWordCount} words • Select chapters to create
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{draftPreview.summary}</p>
                    
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {draftPreview.chapters.map((chapter, index) => {
                        const isSelected = selectedChapters.has(index);
                        return (
                          <div 
                            key={index} 
                            className={cn(
                              "border rounded-lg p-3 cursor-pointer transition-colors",
                              isSelected ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20" : "hover:bg-muted/50"
                            )}
                            onClick={() => toggleChapterSelection(index)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleChapterSelection(index)}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-medium">{chapter.title}</h4>
                                    <p className="text-xs text-muted-foreground mb-2">{chapter.description}</p>
                                    <div className="text-sm text-muted-foreground">
                                      {(() => {
                                        const previewLength = 300;
                                        const shouldTruncate = chapter.content.length > previewLength;
                                        const preview = shouldTruncate ? chapter.content.substring(0, previewLength) + '...' : chapter.content;
                                        
                                        return (
                                          <>
                                            <p className="whitespace-pre-wrap">{preview}</p>
                                            {shouldTruncate && (
                                              <p className="text-xs text-blue-600 mt-1 font-medium">
                                                ({chapter.content.length - previewLength} more characters)
                                              </p>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className="text-xs ml-2">
                                    {chapter.wordCount} words
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Confirmation Dialog */}
              {showConfirmation && (
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Replace Existing Content?
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will permanently delete your existing {draftStatus.existingChaptersCount} chapters 
                      and replace them with AI-generated content. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive" 
                        onClick={async () => {
                          // If we have a preview, use selected chapters approach
                          if (draftPreview && selectedChapters.size > 0) {
                            setShowConfirmation(false);
                            // Retry the accept with replace confirmation
                            const selectedChapterData = Array.from(selectedChapters).map(index => ({
                              ...draftPreview.chapters[index],
                              originalIndex: index
                            }));
                            
                            setIsAccepting(true);
                            try {
                              const response = await fetch(`/api/books/${bookId}/save-selected-chapters`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  chapters: selectedChapterData,
                                  replaceExisting: true,
                                  draftSummary: draftPreview.summary,
                                  draftStructure: draftPreview.structure,
                                  writingStylePrompt: writingStylePrompt.trim() || undefined
                                })
                              });
                              
                              if (response.ok) {
                                const data = await response.json();
                                alert(`Success! Created ${data.chaptersCreated} chapters with ${data.totalWordCount} words.`);
                                setIsOpen(false);
                                window.location.reload();
                              } else {
                                const errorData = await response.json();
                                setError(errorData.error || 'Failed to replace content');
                              }
                            } catch (err) {
                              setError('Failed to replace content');
                            } finally {
                              setIsAccepting(false);
                            }
                          } else {
                            // Fallback to generate approach
                            handleGenerate(true);
                            setShowConfirmation(false);
                          }
                        }}
                        disabled={isGenerating || isAccepting}
                      >
                        {(isGenerating || isAccepting) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Replace Content
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowConfirmation(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              {!showConfirmation && (
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                  
                  {draftStatus.canGenerateDraft && !draftPreview && (
                    <Button 
                      variant="outline"
                      onClick={handlePreview}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                      Preview Draft
                    </Button>
                  )}
                  
                  {draftPreview && (
                    <Button 
                      onClick={handleAcceptSelected}
                      disabled={isAccepting || selectedChapters.size === 0}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isAccepting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Accept Selected ({selectedChapters.size})
                    </Button>
                  )}
                  
                  {draftStatus.canGenerateDraft && !draftPreview && (
                    <Button 
                      onClick={() => handleGenerate(false)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Generate All
                    </Button>
                  )}
                  
                  {!draftStatus.canGenerateDraft && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Add some planning content (characters, plot points, or scenes) before generating a draft.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DraftGenerator;
