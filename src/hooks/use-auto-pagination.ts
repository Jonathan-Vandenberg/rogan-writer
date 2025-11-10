/**
 * Auto-Pagination Hook
 * 
 * Integrates with existing pagination system to automatically advance pages
 * when content overflows.
 */

import { useEffect, useCallback, useRef } from 'react';
import { pageOverflowDetector, type PageOverflowConfig } from '@/lib/page-overflow-detector';

interface AutoPaginationOptions {
  content: string;
  pageConfig: PageOverflowConfig;
  currentPageIndex: number;
  totalPages: number;
  onPageChange: (pageIndex: number) => void;
  onContentOverflow?: (overflowText: string, estimatedPages: number) => void;
  enabled?: boolean;
  debounceMs?: number;
}

export function useAutoPagination({
  content,
  pageConfig,
  currentPageIndex,
  totalPages,
  onPageChange,
  onContentOverflow,
  enabled = true,
  debounceMs = 300,
}: AutoPaginationOptions) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>('');
  const processingRef = useRef<boolean>(false);

  const checkAndHandleOverflow = useCallback(async () => {
    if (!enabled || processingRef.current || content === lastContentRef.current) {
      return;
    }

    processingRef.current = true;
    lastContentRef.current = content;

    try {
      // Quick estimation first
      if (!pageOverflowDetector.estimateWillOverflow(content, pageConfig)) {
        processingRef.current = false;
        return;
      }

      // Detailed overflow check
      const result = pageOverflowDetector.checkOverflow(content, pageConfig);

      if (result.overflows) {
        console.log('Content overflow detected:', {
          currentPage: currentPageIndex,
          totalPages,
          overflowLength: result.overflowText.length,
          estimatedPages: result.estimatedPages,
        });

        // Notify about overflow
        onContentOverflow?.(result.overflowText, result.estimatedPages);

        // Auto-advance to next page if available
        const nextPageIndex = currentPageIndex + 1;
        if (nextPageIndex <= totalPages) {
          console.log(`Auto-advancing to page ${nextPageIndex}`);
          onPageChange(nextPageIndex);
        } else {
          console.log('Need to create new page - at end of existing pages');
          // Could trigger page creation here if you have that functionality
        }
      }
    } catch (error) {
      console.error('Error in auto-pagination check:', error);
    } finally {
      processingRef.current = false;
    }
  }, [content, pageConfig, currentPageIndex, totalPages, onPageChange, onContentOverflow, enabled]);

  // Debounced overflow checking
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      checkAndHandleOverflow();
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [checkAndHandleOverflow, debounceMs]);

  // Immediate check for significant content changes (like paste)
  const handleImmediateCheck = useCallback(() => {
    if (Math.abs(content.length - lastContentRef.current.length) > 100) {
      // Large change, check immediately
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      checkAndHandleOverflow();
    }
  }, [content, checkAndHandleOverflow]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    checkOverflow: handleImmediateCheck,
    isProcessing: processingRef.current,
  };
}
