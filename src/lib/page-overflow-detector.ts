/**
 * Page Overflow Detector
 * 
 * Simple, reliable text overflow detection that works with existing pagination system
 */

interface PageOverflowConfig {
  pageWidth: number;
  pageHeight: number;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  chapterTitleHeight?: number;
}

class PageOverflowDetector {
  private measurementDiv: HTMLDivElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.createMeasurementDiv();
    }
  }

  /**
   * Create invisible div for text measurement
   */
  private createMeasurementDiv() {
    this.measurementDiv = document.createElement('div');
    this.measurementDiv.style.position = 'absolute';
    this.measurementDiv.style.visibility = 'hidden';
    this.measurementDiv.style.height = 'auto';
    this.measurementDiv.style.width = 'auto';
    this.measurementDiv.style.whiteSpace = 'pre-wrap';
    this.measurementDiv.style.wordWrap = 'break-word';
    this.measurementDiv.style.top = '-9999px';
    this.measurementDiv.style.left = '-9999px';
    document.body.appendChild(this.measurementDiv);
  }

  /**
   * Check if text content overflows the page boundaries
   */
  checkOverflow(content: string, config: PageOverflowConfig): {
    overflows: boolean;
    overflowText: string;
    pageContent: string;
    estimatedPages: number;
  } {
    if (!this.measurementDiv || !content.trim()) {
      return {
        overflows: false,
        overflowText: '',
        pageContent: content,
        estimatedPages: 1,
      };
    }

    const DPI = 96;
    const availableWidth = (config.pageWidth * DPI) - (config.marginLeft * DPI) - (config.marginRight * DPI);
    const availableHeight = (config.pageHeight * DPI) - (config.marginTop * DPI) - (config.marginBottom * DPI) - (config.chapterTitleHeight || 0);

    // Configure measurement div to match page styling
    this.measurementDiv.style.fontSize = `${config.fontSize}px`;
    this.measurementDiv.style.fontFamily = config.fontFamily;
    this.measurementDiv.style.lineHeight = config.lineHeight.toString();
    this.measurementDiv.style.width = `${availableWidth}px`;
    this.measurementDiv.style.height = 'auto';
    this.measurementDiv.style.maxHeight = 'none';

    // Set content and measure
    this.measurementDiv.textContent = content;
    const actualHeight = this.measurementDiv.scrollHeight;

    // Check if content overflows
    const overflows = actualHeight > availableHeight;

    if (!overflows) {
      return {
        overflows: false,
        overflowText: '',
        pageContent: content,
        estimatedPages: 1,
      };
    }

    // Binary search to find the maximum content that fits
    let low = 0;
    let high = content.length;
    let bestFit = '';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const testContent = content.substring(0, mid);
      
      this.measurementDiv.textContent = testContent;
      const testHeight = this.measurementDiv.scrollHeight;

      if (testHeight <= availableHeight) {
        bestFit = testContent;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Find a good break point (prefer word boundaries)
    const pageContent = this.findGoodBreakPoint(content, bestFit);
    const overflowText = content.substring(pageContent.length);

    // Estimate total pages needed
    const estimatedPages = Math.ceil(actualHeight / availableHeight);

    return {
      overflows: true,
      overflowText,
      pageContent,
      estimatedPages,
    };
  }

  /**
   * Find a good break point preferring word boundaries
   */
  private findGoodBreakPoint(fullContent: string, maxContent: string): string {
    if (!maxContent || maxContent === fullContent) {
      return maxContent;
    }

    // Try to break at word boundary
    const lastSpaceIndex = maxContent.lastIndexOf(' ');
    const lastNewlineIndex = maxContent.lastIndexOf('\n');
    
    // Prefer newline over space
    if (lastNewlineIndex > lastSpaceIndex - 50) { // Within 50 chars
      return maxContent.substring(0, lastNewlineIndex + 1);
    }
    
    // Use space if it's not too far back
    if (lastSpaceIndex > maxContent.length - 100) { // Within 100 chars
      return maxContent.substring(0, lastSpaceIndex + 1);
    }

    // Otherwise use the max content
    return maxContent;
  }

  /**
   * Quick estimation if content will likely overflow
   */
  estimateWillOverflow(content: string, config: PageOverflowConfig): boolean {
    if (!content.trim()) return false;

    // Quick character-based estimation
    const DPI = 96;
    const availableWidth = (config.pageWidth * DPI) - (config.marginLeft * DPI) - (config.marginRight * DPI);
    const availableHeight = (config.pageHeight * DPI) - (config.marginTop * DPI) - (config.marginBottom * DPI) - (config.chapterTitleHeight || 0);

    // Rough estimates
    const avgCharWidth = config.fontSize * 0.6; // Rough average
    const lineHeight = config.fontSize * config.lineHeight;
    
    const charsPerLine = Math.floor(availableWidth / avgCharWidth);
    const linesPerPage = Math.floor(availableHeight / lineHeight);
    const roughCapacity = charsPerLine * linesPerPage;

    return content.length > roughCapacity;
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.measurementDiv && document.body.contains(this.measurementDiv)) {
      document.body.removeChild(this.measurementDiv);
      this.measurementDiv = null;
    }
  }
}

// Export singleton
export const pageOverflowDetector = new PageOverflowDetector();

export type { PageOverflowConfig };
