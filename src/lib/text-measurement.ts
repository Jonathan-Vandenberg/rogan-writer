/**
 * Text Measurement Utilities for Auto-Pagination
 * 
 * This module provides accurate text measurement capabilities for determining
 * how much text can fit on a page with specific font and layout parameters.
 */

interface FontMetrics {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  averageCharWidth: number;
  maxCharWidth: number;
  actualLineHeight: number;
}

interface PageDimensions {
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

interface TextLayoutResult {
  lines: string[];
  totalHeight: number;
  fitsOnPage: boolean;
  overflowText: string;
}

class TextMeasurementService {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private fontMetricsCache = new Map<string, FontMetrics>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d');
    }
  }

  /**
   * Get font metrics for a specific font configuration
   */
  getFontMetrics(fontSize: number, fontFamily: string, lineHeight: number): FontMetrics {
    const cacheKey = `${fontSize}-${fontFamily}-${lineHeight}`;
    
    if (this.fontMetricsCache.has(cacheKey)) {
      return this.fontMetricsCache.get(cacheKey)!;
    }

    if (!this.context) {
      // Fallback for server-side rendering
      const metrics: FontMetrics = {
        fontSize,
        fontFamily,
        lineHeight,
        averageCharWidth: fontSize * 0.6, // Rough estimate
        maxCharWidth: fontSize * 1.2,
        actualLineHeight: fontSize * lineHeight,
      };
      return metrics;
    }

    // Set font for measurement
    this.context.font = `${fontSize}px ${fontFamily}`;

    // Measure common characters to get average width
    const sampleChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?';
    let totalWidth = 0;
    let maxWidth = 0;

    for (const char of sampleChars) {
      const width = this.context.measureText(char).width;
      totalWidth += width;
      maxWidth = Math.max(maxWidth, width);
    }

    const averageCharWidth = totalWidth / sampleChars.length;
    const actualLineHeight = fontSize * lineHeight;

    const metrics: FontMetrics = {
      fontSize,
      fontFamily,
      lineHeight,
      averageCharWidth,
      maxCharWidth: maxWidth,
      actualLineHeight,
    };

    this.fontMetricsCache.set(cacheKey, metrics);
    return metrics;
  }

  /**
   * Measure the actual width of a text string
   */
  measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
    if (!this.context) {
      // Fallback estimation
      const metrics = this.getFontMetrics(fontSize, fontFamily, 1.5);
      return text.length * metrics.averageCharWidth;
    }

    this.context.font = `${fontSize}px ${fontFamily}`;
    return this.context.measureText(text).width;
  }

  /**
   * Break text into lines that fit within the specified width
   */
  wrapText(
    text: string, 
    maxWidth: number, 
    fontSize: number, 
    fontFamily: string
  ): string[] {
    if (!text.trim()) return [''];

    const lines: string[] = [];
    const words = text.split(/(\s+)/); // Keep whitespace
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + word;
      const testWidth = this.measureTextWidth(testLine, fontSize, fontFamily);

      if (testWidth <= maxWidth || currentLine === '') {
        currentLine = testLine;
      } else {
        // Line is too long, start new line
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }

  /**
   * Calculate how much text fits on a page
   */
  calculatePageLayout(
    text: string,
    pageDimensions: PageDimensions,
    fontSize: number,
    fontFamily: string,
    lineHeight: number,
    chapterTitleHeight: number = 0
  ): TextLayoutResult {
    const DPI = 96;
    
    // Convert dimensions to pixels
    const pageWidthPx = pageDimensions.width * DPI;
    const pageHeightPx = pageDimensions.height * DPI;
    const marginTopPx = pageDimensions.marginTop * DPI;
    const marginBottomPx = pageDimensions.marginBottom * DPI;
    const marginLeftPx = pageDimensions.marginLeft * DPI;
    const marginRightPx = pageDimensions.marginRight * DPI;

    // Calculate available text area
    const availableWidth = pageWidthPx - marginLeftPx - marginRightPx;
    const availableHeight = pageHeightPx - marginTopPx - marginBottomPx - chapterTitleHeight;

    // Get font metrics
    const fontMetrics = this.getFontMetrics(fontSize, fontFamily, lineHeight);
    const maxLinesPerPage = Math.floor(availableHeight / fontMetrics.actualLineHeight);

    // Split text into paragraphs
    const paragraphs = text.split('\n');
    const allLines: string[] = [];

    // Process each paragraph
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      if (paragraph.trim() === '') {
        // Empty line
        allLines.push('');
      } else {
        // Wrap paragraph text
        const wrappedLines = this.wrapText(paragraph, availableWidth, fontSize, fontFamily);
        allLines.push(...wrappedLines);
      }
    }

    // Determine what fits on this page
    const pageLines = allLines.slice(0, maxLinesPerPage);
    const totalHeight = pageLines.length * fontMetrics.actualLineHeight;
    const fitsOnPage = allLines.length <= maxLinesPerPage;

    // Calculate overflow text
    let overflowText = '';
    if (!fitsOnPage) {
      const overflowLines = allLines.slice(maxLinesPerPage);
      overflowText = overflowLines.join('\n');
    }

    return {
      lines: pageLines,
      totalHeight,
      fitsOnPage,
      overflowText,
    };
  }

  /**
   * Split text across multiple pages
   */
  paginateText(
    text: string,
    pageDimensions: PageDimensions,
    fontSize: number,
    fontFamily: string,
    lineHeight: number,
    firstPageChapterTitleHeight: number = 0
  ): string[] {
    const pages: string[] = [];
    let remainingText = text;
    let isFirstPage = true;

    while (remainingText.trim()) {
      const chapterTitleHeight = isFirstPage ? firstPageChapterTitleHeight : 0;
      
      const layout = this.calculatePageLayout(
        remainingText,
        pageDimensions,
        fontSize,
        fontFamily,
        lineHeight,
        chapterTitleHeight
      );

      // Add this page's content
      const pageContent = layout.lines.join('\n');
      pages.push(pageContent);

      // Update remaining text
      remainingText = layout.overflowText;
      isFirstPage = false;

      // Safety check to prevent infinite loops
      if (layout.lines.length === 0 && remainingText.trim()) {
        // If we can't fit any content, force at least one character per page
        pages.push(remainingText.charAt(0));
        remainingText = remainingText.slice(1);
      }
    }

    return pages.length > 0 ? pages : [''];
  }

  /**
   * Estimate character capacity of a page (for quick calculations)
   */
  estimatePageCapacity(
    pageDimensions: PageDimensions,
    fontSize: number,
    fontFamily: string,
    lineHeight: number,
    chapterTitleHeight: number = 0
  ): {
    estimatedCharsPerLine: number;
    estimatedLinesPerPage: number;
    estimatedCharsPerPage: number;
  } {
    const DPI = 96;
    
    const pageWidthPx = pageDimensions.width * DPI;
    const pageHeightPx = pageDimensions.height * DPI;
    const marginTopPx = pageDimensions.marginTop * DPI;
    const marginBottomPx = pageDimensions.marginBottom * DPI;
    const marginLeftPx = pageDimensions.marginLeft * DPI;
    const marginRightPx = pageDimensions.marginRight * DPI;

    const availableWidth = pageWidthPx - marginLeftPx - marginRightPx;
    const availableHeight = pageHeightPx - marginTopPx - marginBottomPx - chapterTitleHeight;

    const fontMetrics = this.getFontMetrics(fontSize, fontFamily, lineHeight);
    
    const estimatedCharsPerLine = Math.floor(availableWidth / fontMetrics.averageCharWidth);
    const estimatedLinesPerPage = Math.floor(availableHeight / fontMetrics.actualLineHeight);
    const estimatedCharsPerPage = estimatedCharsPerLine * estimatedLinesPerPage;

    return {
      estimatedCharsPerLine,
      estimatedLinesPerPage,
      estimatedCharsPerPage,
    };
  }

  /**
   * Clear the font metrics cache
   */
  clearCache(): void {
    this.fontMetricsCache.clear();
  }
}

// Export singleton instance
export const textMeasurement = new TextMeasurementService();

// Export types
export type { FontMetrics, PageDimensions, TextLayoutResult };
