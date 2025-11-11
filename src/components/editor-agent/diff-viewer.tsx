"use client"

import React from 'react';
import * as Diff from 'diff';
import { cn } from '@/lib/utils';

interface DiffViewerProps {
  original: string;
  edited: string;
  className?: string;
}

export function DiffViewer({ original, edited, className }: DiffViewerProps) {
  const changes = React.useMemo(() => {
    return Diff.diffWords(original, edited);
  }, [original, edited]);

  return (
    <div className={cn("font-mono text-sm whitespace-pre-wrap break-words", className)}>
      {changes.map((part, index) => {
        if (part.added) {
          return (
            <span
              key={index}
              className="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100"
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={index}
              className="bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100 line-through"
            >
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
}

