"use client"

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  CheckCheck, 
  XCircle,
  FileEdit,
  FilePlus
} from 'lucide-react';
import { DiffViewer } from './diff-viewer';
import { EditorChange, NewChapter } from '@/hooks/use-editor-changes';
import { cn } from '@/lib/utils';

interface ChangeReviewProps {
  changes: EditorChange[];
  newChapters: NewChapter[];
  currentChangeIndex: number;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onAcceptNewChapter: (chapterId: string) => void;
  onRejectNewChapter: (chapterId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onNextChange: () => void;
  onPreviousChange: () => void;
  pendingCount: number;
  acceptedCount: number;
  pendingNewChaptersCount: number;
}

export function ChangeReview({
  changes,
  newChapters,
  currentChangeIndex,
  onAcceptChange,
  onRejectChange,
  onAcceptNewChapter,
  onRejectNewChapter,
  onAcceptAll,
  onRejectAll,
  onNextChange,
  onPreviousChange,
  pendingCount,
  acceptedCount,
  pendingNewChaptersCount,
}: ChangeReviewProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to current change
  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentChangeIndex]);

  if (changes.length === 0 && newChapters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FileEdit className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No changes to review yet.</p>
          <p className="text-sm">Ask the AI to edit your chapters to see suggested changes here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with controls */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {pendingCount} Pending
            </Badge>
            <Badge variant="default" className="text-sm bg-green-500">
              {acceptedCount} Accepted
            </Badge>
            {pendingNewChaptersCount > 0 && (
              <Badge variant="outline" className="text-sm">
                <FilePlus className="h-3 w-3 mr-1" />
                {pendingNewChaptersCount} New Chapters
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onAcceptAll}
            disabled={pendingCount === 0 && pendingNewChaptersCount === 0}
            className="gap-1"
          >
            <CheckCheck className="h-4 w-4" />
            Accept All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRejectAll}
            disabled={pendingCount === 0 && pendingNewChaptersCount === 0}
            className="gap-1"
          >
            <XCircle className="h-4 w-4" />
            Reject All
          </Button>
        </div>
      </div>

      {/* Changes list */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
          {/* Chapter edits */}
          {changes.map((change, index) => (
            <Card
              key={change.id}
              ref={index === currentChangeIndex ? scrollRef : null}
              className={cn(
                "transition-all",
                index === currentChangeIndex && "ring-2 ring-primary",
                change.status === 'accepted' && "border-green-500 bg-green-50 dark:bg-green-950/20",
                change.status === 'rejected' && "border-red-500 bg-red-50 dark:bg-red-950/20 opacity-60"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileEdit className="h-4 w-4" />
                      <CardTitle className="text-lg">
                        {change.chapterTitle}
                      </CardTitle>
                      <Badge variant={
                        change.status === 'pending' ? 'secondary' :
                        change.status === 'accepted' ? 'default' : 'destructive'
                      } className="text-xs">
                        {change.status}
                      </Badge>
                    </div>
                    <CardDescription>{change.description}</CardDescription>
                  </div>
                  
                  {change.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAcceptChange(change.id)}
                        className="gap-1 border-green-500 text-green-600 hover:bg-green-50"
                      >
                        <Check className="h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRejectChange(change.id)}
                        className="gap-1 border-red-500 text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-background">
                  <DiffViewer
                    original={change.originalContent}
                    edited={change.editedContent}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {/* New chapters */}
          {newChapters.map((chapter) => (
            <Card
              key={chapter.id}
              className={cn(
                "transition-all",
                chapter.status === 'accepted' && "border-green-500 bg-green-50 dark:bg-green-950/20",
                chapter.status === 'rejected' && "border-red-500 bg-red-50 dark:bg-red-950/20 opacity-60"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FilePlus className="h-4 w-4" />
                      <CardTitle className="text-lg">
                        New Chapter: {chapter.title}
                      </CardTitle>
                      <Badge variant={
                        chapter.status === 'pending' ? 'secondary' :
                        chapter.status === 'accepted' ? 'default' : 'destructive'
                      } className="text-xs">
                        {chapter.status}
                      </Badge>
                    </div>
                    <CardDescription>{chapter.description}</CardDescription>
                  </div>
                  
                  {chapter.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAcceptNewChapter(chapter.id)}
                        className="gap-1 border-green-500 text-green-600 hover:bg-green-50"
                      >
                        <Check className="h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRejectNewChapter(chapter.id)}
                        className="gap-1 border-red-500 text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-background max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {chapter.content}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </ScrollArea>
      </div>

      {/* Navigation footer */}
      {changes.length > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground">
            Change {currentChangeIndex + 1} of {changes.length}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousChange}
              disabled={pendingCount === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextChange}
              disabled={pendingCount === 0}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

