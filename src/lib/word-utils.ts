/**
 * Utility functions for word counting and text analysis
 */

/**
 * Count words in a text string
 * Handles common edge cases and provides accurate word counting
 */
export function countWords(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0
  }

  // Remove HTML tags if present
  const cleanText = text.replace(/<[^>]*>/g, ' ')
  
  // Trim whitespace and normalize spaces
  const normalizedText = cleanText.trim().replace(/\s+/g, ' ')
  
  if (!normalizedText) {
    return 0
  }

  // Split by whitespace and filter out empty strings
  const words = normalizedText.split(' ').filter(word => word.length > 0)
  
  return words.length
}

/**
 * Count characters (including spaces)
 */
export function countCharacters(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0
  }
  return text.length
}

/**
 * Count characters (excluding spaces)
 */
export function countCharactersNoSpaces(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0
  }
  return text.replace(/\s/g, '').length
}

/**
 * Estimate reading time in minutes (average 200 words per minute)
 */
export function estimateReadingTime(wordCount: number): number {
  const wordsPerMinute = 200
  return Math.ceil(wordCount / wordsPerMinute)
}

/**
 * Format word count for display (e.g., 1,234 words)
 */
export function formatWordCount(count: number): string {
  return `${count.toLocaleString()} word${count !== 1 ? 's' : ''}`
}

/**
 * Calculate words per page estimate (typical book page)
 */
export function estimatePages(wordCount: number, wordsPerPage: number = 250): number {
  if (wordCount === 0) return 0
  return Math.max(1, Math.ceil(wordCount / wordsPerPage))
}