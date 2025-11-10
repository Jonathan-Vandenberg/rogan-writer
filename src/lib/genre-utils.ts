/**
 * Genre-based utilities for determining book types and AI routing
 */

import { NON_FICTION_GENRES } from './genres'

export type NonFictionGenre = typeof NON_FICTION_GENRES[number];

/**
 * Check if a book genre requires factual research and citations
 */
export function isNonFictionBook(genre: string | null | undefined): boolean {
  if (!genre) return false;
  
  const normalizedGenre = genre.toLowerCase().trim();
  
  // Direct match
  if (NON_FICTION_GENRES.includes(normalizedGenre as NonFictionGenre)) {
    return true;
  }
  
  // Partial matches for compound genres like "business-memoir" or "science-fiction"
  // Only match if non-fiction term comes first to avoid "science-fiction" matching "science"
  const genreWords = normalizedGenre.split(/[-_\s]+/);
  
  if (genreWords.length > 1) {
    const firstWord = genreWords[0];
    return NON_FICTION_GENRES.includes(firstWord as NonFictionGenre);
  }
  
  return false;
}

/**
 * Get the primary research focus areas for a non-fiction genre
 */
export function getResearchFocus(genre: string): string[] {
  const normalizedGenre = genre.toLowerCase().trim();
  
  const focusMap: Record<string, string[]> = {
    'biography': ['biographical information', 'historical context', 'timeline accuracy', 'primary sources'],
    'memoir': ['personal verification', 'historical context', 'factual accuracy'],
    'history': ['historical facts', 'primary sources', 'timeline accuracy', 'archaeological evidence'],
    'science': ['scientific research', 'peer-reviewed studies', 'statistical data', 'expert consensus'],
    'technology': ['technical specifications', 'industry reports', 'patent information', 'market data'],
    'business': ['market research', 'financial data', 'case studies', 'industry statistics'],
    'health': ['medical research', 'clinical studies', 'FDA approvals', 'peer-reviewed journals'],
    'politics': ['voting records', 'policy documents', 'government sources', 'political analysis'],
    'travel': ['current information', 'cultural accuracy', 'practical details', 'safety updates'],
    'true-crime': ['court records', 'police reports', 'investigative journalism', 'legal documents']
  };
  
  return focusMap[normalizedGenre] || ['factual verification', 'credible sources', 'current information'];
}

/**
 * Determine the appropriate research intensity level
 */
export function getResearchIntensity(genre: string): 'low' | 'medium' | 'high' {
  const normalizedGenre = genre.toLowerCase().trim();
  
  const highIntensityGenres = ['science', 'technology', 'academic', 'textbook', 'history', 'biography'];
  const mediumIntensityGenres = ['business', 'health', 'politics', 'true-crime', 'journalism'];
  
  if (highIntensityGenres.some(g => normalizedGenre.includes(g))) {
    return 'high';
  }
  
  if (mediumIntensityGenres.some(g => normalizedGenre.includes(g))) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Get suggested citation formats for a genre
 */
export function getPreferredCitationFormats(genre: string): Array<'apa' | 'mla' | 'chicago'> {
  const normalizedGenre = genre.toLowerCase().trim();
  
  // Academic and scientific fields prefer APA
  if (['science', 'technology', 'psychology', 'business', 'health'].some(g => normalizedGenre.includes(g))) {
    return ['apa', 'chicago', 'mla'];
  }
  
  // Humanities prefer MLA
  if (['history', 'philosophy', 'religion', 'memoir', 'biography'].some(g => normalizedGenre.includes(g))) {
    return ['mla', 'chicago', 'apa'];
  }
  
  // General non-fiction - Chicago first as it's versatile
  return ['chicago', 'apa', 'mla'];
}

/**
 * Check if a genre requires real-time fact checking
 */
export function requiresFactChecking(genre: string): boolean {
  const normalizedGenre = genre.toLowerCase().trim();
  
  const factCheckGenres = [
    'science', 'technology', 'health', 'politics', 'history', 
    'biography', 'journalism', 'true-crime', 'business'
  ];
  
  return factCheckGenres.some(g => normalizedGenre.includes(g));
}

/**
 * Get research source priorities for a genre
 */
export function getSourcePriorities(genre: string): Array<'wikipedia' | 'scholarly' | 'news' | 'government' | 'books'> {
  const normalizedGenre = genre.toLowerCase().trim();
  
  if (['science', 'technology', 'health', 'academic'].some(g => normalizedGenre.includes(g))) {
    return ['scholarly', 'government', 'wikipedia', 'books', 'news'];
  }
  
  if (['politics', 'journalism', 'true-crime'].some(g => normalizedGenre.includes(g))) {
    return ['news', 'government', 'scholarly', 'wikipedia', 'books'];
  }
  
  if (['history', 'biography'].some(g => normalizedGenre.includes(g))) {
    return ['scholarly', 'books', 'wikipedia', 'government', 'news'];
  }
  
  // General non-fiction
  return ['wikipedia', 'scholarly', 'books', 'government', 'news'];
}
