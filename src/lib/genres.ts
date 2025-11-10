/**
 * Comprehensive genre categories for book creation and research targeting
 */

// Fiction genres
export const FICTION_GENRES = [
  'fiction',
  'fantasy',
  'science-fiction',
  'mystery',
  'thriller',
  'romance',
  'horror',
  'literary-fiction',
  'historical-fiction',
  'contemporary-fiction',
  'adventure',
  'crime',
  'dystopian',
  'urban-fantasy',
  'paranormal',
  'western',
  'young-adult-fiction',
  'children-fiction',
  'poetry',
  'drama',
  'comedy'
] as const

// Non-fiction genres (from our research system)
export const NON_FICTION_GENRES = [
  // Biography & Life Stories
  'biography',
  'memoir', 
  'autobiography',
  
  // Academic & Educational
  'history',
  'science',
  'technology',
  'academic',
  'textbook',
  'reference',
  'education',
  
  // Health & Wellness
  'health',
  'fitness',
  'diet',
  'self-help',
  'psychology',
  
  // Business & Professional
  'business',
  'economics',
  'politics',
  'journalism',
  
  // Culture & Society
  'philosophy',
  'religion',
  'spirituality',
  'sociology',
  'anthropology',
  
  // Practical & Lifestyle
  'cookbook',
  'travel',
  'guide',
  'how-to',
  'manual',
  
  // Specialized Non-Fiction
  'true-crime',
  'sports',
  'essay',
  'documentary'
] as const

// Combined type for all genres
export type Genre = typeof FICTION_GENRES[number] | typeof NON_FICTION_GENRES[number]

// Organized genre list for UI dropdowns
export const ORGANIZED_GENRES = [
  {
    category: 'Fiction',
    genres: [
      { value: 'fiction', label: 'General Fiction' },
      { value: 'literary-fiction', label: 'Literary Fiction' },
      { value: 'historical-fiction', label: 'Historical Fiction' },
      { value: 'contemporary-fiction', label: 'Contemporary Fiction' },
      { value: 'science-fiction', label: 'Science Fiction' },
      { value: 'fantasy', label: 'Fantasy' },
      { value: 'urban-fantasy', label: 'Urban Fantasy' },
      { value: 'mystery', label: 'Mystery' },
      { value: 'thriller', label: 'Thriller' },
      { value: 'crime', label: 'Crime' },
      { value: 'romance', label: 'Romance' },
      { value: 'horror', label: 'Horror' },
      { value: 'paranormal', label: 'Paranormal' },
      { value: 'adventure', label: 'Adventure' },
      { value: 'western', label: 'Western' },
      { value: 'dystopian', label: 'Dystopian' },
      { value: 'young-adult-fiction', label: 'Young Adult Fiction' },
      { value: 'children-fiction', label: 'Children\'s Fiction' }
    ]
  },
  {
    category: 'Biography & Life Stories',
    genres: [
      { value: 'biography', label: 'Biography' },
      { value: 'autobiography', label: 'Autobiography' },
      { value: 'memoir', label: 'Memoir' }
    ]
  },
  {
    category: 'Academic & Educational',
    genres: [
      { value: 'history', label: 'History' },
      { value: 'science', label: 'Science' },
      { value: 'technology', label: 'Technology' },
      { value: 'academic', label: 'Academic' },
      { value: 'textbook', label: 'Textbook' },
      { value: 'reference', label: 'Reference' },
      { value: 'education', label: 'Education' }
    ]
  },
  {
    category: 'Health & Wellness',
    genres: [
      { value: 'health', label: 'Health' },
      { value: 'fitness', label: 'Fitness' },
      { value: 'diet', label: 'Diet & Nutrition' },
      { value: 'self-help', label: 'Self-Help' },
      { value: 'psychology', label: 'Psychology' }
    ]
  },
  {
    category: 'Business & Professional',
    genres: [
      { value: 'business', label: 'Business' },
      { value: 'economics', label: 'Economics' },
      { value: 'politics', label: 'Politics' },
      { value: 'journalism', label: 'Journalism' }
    ]
  },
  {
    category: 'Culture & Society',
    genres: [
      { value: 'philosophy', label: 'Philosophy' },
      { value: 'religion', label: 'Religion' },
      { value: 'spirituality', label: 'Spirituality' },
      { value: 'sociology', label: 'Sociology' },
      { value: 'anthropology', label: 'Anthropology' }
    ]
  },
  {
    category: 'Practical & Lifestyle',
    genres: [
      { value: 'cookbook', label: 'Cookbook' },
      { value: 'travel', label: 'Travel' },
      { value: 'guide', label: 'Guide' },
      { value: 'how-to', label: 'How-To' },
      { value: 'manual', label: 'Manual' }
    ]
  },
  {
    category: 'Creative & Other',
    genres: [
      { value: 'poetry', label: 'Poetry' },
      { value: 'drama', label: 'Drama' },
      { value: 'comedy', label: 'Comedy' },
      { value: 'essay', label: 'Essay' },
      { value: 'true-crime', label: 'True Crime' },
      { value: 'sports', label: 'Sports' },
      { value: 'documentary', label: 'Documentary' }
    ]
  }
] as const

// Flat list for simple dropdowns (backward compatibility)
export const ALL_GENRES = ORGANIZED_GENRES.flatMap(category => 
  category.genres.map(genre => ({
    value: genre.value,
    label: genre.label,
    category: category.category
  }))
)

// Helper functions
export function isNonFictionGenre(genre: string | null | undefined): boolean {
  if (!genre) return false
  return NON_FICTION_GENRES.includes(genre as any)
}

export function isFictionGenre(genre: string | null | undefined): boolean {
  if (!genre) return false
  return FICTION_GENRES.includes(genre as any)
}

export function getGenreCategory(genre: string): string | null {
  const genreData = ALL_GENRES.find(g => g.value === genre)
  return genreData?.category || null
}

export function getGenreLabel(genre: string): string {
  const genreData = ALL_GENRES.find(g => g.value === genre)
  return genreData?.label || genre
}

