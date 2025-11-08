/**
 * Auto-Pagination Manager
 * 
 * Handles automatic page creation, content splitting, and pagination logic
 * for the writing interface.
 */

import { textMeasurement, type PageDimensions } from './text-measurement';

interface PageContent {
  id: string;
  content: string;
  pageNumber: number;
  isFirstPageOfChapter?: boolean;
  chapterTitle?: string;
}

interface PaginationConfig {
  pageWidth: number;
  pageHeight: number;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  chapterTitle?: string;
  chapterTitleFontSize?: number;
  chapterTitlePadding?: number;
  showChapterTitle?: boolean;
}

interface PaginationState {
  pages: PageContent[];
  currentPageIndex: number;
  totalPages: number;
  isRecalculating: boolean;
}

class AutoPaginationManager {
  private pages: PageContent[] = [];
  private config: PaginationConfig | null = null;
  private listeners: Set<(state: PaginationState) => void> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;
  private isRecalculating = false;

  /**
   * Initialize pagination with configuration
   */
  initialize(config: PaginationConfig, initialContent: string = ''): void {
    this.config = config;
    this.recalculatePages(initialContent);
  }

  /**
   * Update configuration and recalculate
   */
  updateConfig(newConfig: Partial<PaginationConfig>): void {
    if (!this.config) return;
    
    this.config = { ...this.config, ...newConfig };
    const allContent = this.getAllContent();
    this.recalculatePages(allContent);
  }

  /**
   * Get all content as a single string
   */
  getAllContent(): string {
    return this.pages.map(page => page.content).join('');
  }

  /**
   * Get current pagination state
   */
  getState(): PaginationState {
    return {
      pages: [...this.pages],
      currentPageIndex: this.getCurrentPageIndex(),
      totalPages: this.pages.length,
      isRecalculating: this.isRecalculating,
    };
  }

  /**
   * Get current page index (find first non-empty page or return 0)
   */
  private getCurrentPageIndex(): number {
    const nonEmptyIndex = this.pages.findIndex(page => page.content.trim());
    return nonEmptyIndex >= 0 ? nonEmptyIndex : 0;
  }

  /**
   * Update content and trigger repagination
   */
  updateContent(content: string, debounce: boolean = true): void {
    if (debounce) {
      this.debouncedRecalculate(content);
    } else {
      this.recalculatePages(content);
    }
  }

  /**
   * Debounced recalculation to avoid excessive updates during typing
   */
  private debouncedRecalculate(content: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.recalculatePages(content);
    }, 150); // 150ms debounce
  }

  /**
   * Recalculate pages based on content
   */
  private recalculatePages(content: string): void {
    if (!this.config) return;

    this.isRecalculating = true;
    this.notifyListeners();

    try {
      const pageDimensions: PageDimensions = {
        width: this.config.pageWidth,
        height: this.config.pageHeight,
        marginTop: this.config.marginTop,
        marginBottom: this.config.marginBottom,
        marginLeft: this.config.marginLeft,
        marginRight: this.config.marginRight,
      };

      // Calculate chapter title height for first page
      let chapterTitleHeight = 0;
      if (this.config.showChapterTitle && this.config.chapterTitle?.trim()) {
        const titleFontSize = this.config.chapterTitleFontSize || 26;
        const titlePadding = this.config.chapterTitlePadding || 65;
        chapterTitleHeight = titleFontSize + titlePadding;
      }

      // Paginate the content
      const pageTexts = textMeasurement.paginateText(
        content,
        pageDimensions,
        this.config.fontSize,
        this.config.fontFamily,
        this.config.lineHeight,
        chapterTitleHeight
      );

      // Create page objects
      const newPages: PageContent[] = pageTexts.map((text, index) => ({
        id: `page-${index + 1}`,
        content: text,
        pageNumber: index + 1,
        isFirstPageOfChapter: index === 0,
        chapterTitle: index === 0 ? this.config!.chapterTitle : undefined,
      }));

      this.pages = newPages;
    } catch (error) {
      console.error('Error recalculating pages:', error);
      // Fallback: create single page with all content
      this.pages = [{
        id: 'page-1',
        content,
        pageNumber: 1,
        isFirstPageOfChapter: true,
        chapterTitle: this.config.chapterTitle,
      }];
    } finally {
      this.isRecalculating = false;
      this.notifyListeners();
    }
  }

  /**
   * Get a specific page
   */
  getPage(pageIndex: number): PageContent | null {
    return this.pages[pageIndex] || null;
  }

  /**
   * Get page by page number
   */
  getPageByNumber(pageNumber: number): PageContent | null {
    return this.pages.find(page => page.pageNumber === pageNumber) || null;
  }

  /**
   * Update specific page content
   */
  updatePageContent(pageIndex: number, content: string): void {
    if (pageIndex < 0 || pageIndex >= this.pages.length) return;

    // Update the page
    this.pages[pageIndex].content = content;

    // Recalculate from this page onwards
    const allContentUpToPage = this.pages
      .slice(0, pageIndex)
      .map(page => page.content)
      .join('');
    
    const contentFromThisPage = this.pages
      .slice(pageIndex)
      .map(page => page.content)
      .join('');

    const newTotalContent = allContentUpToPage + contentFromThisPage;
    this.debouncedRecalculate(newTotalContent);
  }

  /**
   * Find which page contains a specific character position
   */
  findPageForPosition(position: number): { pageIndex: number; localPosition: number } {
    let currentPosition = 0;

    for (let i = 0; i < this.pages.length; i++) {
      const pageContent = this.pages[i].content;
      const pageLength = pageContent.length;

      if (position <= currentPosition + pageLength) {
        return {
          pageIndex: i,
          localPosition: position - currentPosition,
        };
      }

      currentPosition += pageLength;
    }

    // Position is beyond all content, return last page
    return {
      pageIndex: Math.max(0, this.pages.length - 1),
      localPosition: this.pages[this.pages.length - 1]?.content.length || 0,
    };
  }

  /**
   * Get global position from page position
   */
  getGlobalPosition(pageIndex: number, localPosition: number): number {
    let globalPosition = 0;

    for (let i = 0; i < pageIndex && i < this.pages.length; i++) {
      globalPosition += this.pages[i].content.length;
    }

    return globalPosition + localPosition;
  }

  /**
   * Estimate if content will fit on current pages
   */
  willContentFit(additionalContent: string): boolean {
    if (!this.config) return true;

    const currentContent = this.getAllContent();
    const totalContent = currentContent + additionalContent;

    const pageDimensions: PageDimensions = {
      width: this.config.pageWidth,
      height: this.config.pageHeight,
      marginTop: this.config.marginTop,
      marginBottom: this.config.marginBottom,
      marginLeft: this.config.marginLeft,
      marginRight: this.config.marginRight,
    };

    let chapterTitleHeight = 0;
    if (this.config.showChapterTitle && this.config.chapterTitle?.trim()) {
      const titleFontSize = this.config.chapterTitleFontSize || 26;
      const titlePadding = this.config.chapterTitlePadding || 65;
      chapterTitleHeight = titleFontSize + titlePadding;
    }

    const requiredPages = textMeasurement.paginateText(
      totalContent,
      pageDimensions,
      this.config.fontSize,
      this.config.fontFamily,
      this.config.lineHeight,
      chapterTitleHeight
    );

    return requiredPages.length <= this.pages.length;
  }

  /**
   * Subscribe to pagination state changes
   */
  subscribe(listener: (state: PaginationState) => void): () => void {
    this.listeners.add(listener);
    
    // Send initial state
    listener(this.getState());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in pagination listener:', error);
      }
    });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.listeners.clear();
    this.pages = [];
  }
}

// Export singleton instance
export const autoPagination = new AutoPaginationManager();

// Export types
export type { PageContent, PaginationConfig, PaginationState };
