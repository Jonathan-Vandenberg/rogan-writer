/**
 * Research API Service - Integrates with multiple factual data sources
 */

export interface ResearchResult {
  id: string;
  title: string;
  summary: string;
  content?: string;
  source: 'wikipedia' | 'scholarly' | 'news' | 'government' | 'books';
  url: string;
  credibilityScore: number; // 0-100
  lastUpdated: Date;
  authors?: string[];
  tags?: string[];
  imageUrl?: string;
}

export interface Citation {
  format: 'apa' | 'mla' | 'chicago';
  text: string;
  bibEntry: string;
}

export interface WikipediaResult extends ResearchResult {
  source: 'wikipedia';
  pageId: number;
  extract: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
}

export interface ScholarlyResult extends ResearchResult {
  source: 'scholarly';
  doi?: string;
  publishedDate: Date;
  journal?: string;
  citationCount?: number;
  abstractText?: string;
}

export interface NewsResult extends ResearchResult {
  source: 'news';
  publishedAt: Date;
  publisher: string;
  category?: string;
}

export class ResearchAPIService {
  
  /**
   * Search Wikipedia for factual information
   */
  async searchWikipedia(query: string, limit: number = 5): Promise<WikipediaResult[]> {
    try {
      console.log(`📚 Researching Wikipedia: "${query}"`);
      
      // Try multiple search strategies for better results
      const searchStrategies = [
        // Strategy 1: Direct search with fuzzy matching
        () => this.wikipediaSearchStrategy1(query, limit),
        // Strategy 2: Preprocessed query (fix common typos)
        () => this.wikipediaSearchStrategy1(this.preprocessQuery(query), limit),
        // Strategy 3: OpenSearch API
        () => this.wikipediaSearchStrategy2(query, limit)
      ];
      
      for (const strategy of searchStrategies) {
        const results = await strategy();
        if (results.length > 0) {
          console.log(`📚 Found ${results.length} Wikipedia results for "${query}"`);
          return results;
        }
      }
      
      console.log(`📚 No Wikipedia results found for "${query}"`);
      return [];
      
    } catch (error) {
      console.error('Wikipedia search error:', error);
      return [];
    }
  }

  /**
   * Strategy 1: Use search API with fuzzy matching
   */
  private async wikipediaSearchStrategy1(query: string, limit: number): Promise<WikipediaResult[]> {
    const searchResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json`,
      {
        headers: {
          'User-Agent': 'RoganWriter/1.0 (https://roganwriter.com; support@roganwriter.com)'
        }
      }
    );
    
    if (!searchResponse.ok) {
      return [];
    }
    
    const searchData = await searchResponse.json();
    const pages = searchData?.query?.search;
    
    if (!pages || !Array.isArray(pages)) {
      return [];
    }
    
    return await this.processWikipediaResults(pages.slice(0, limit));
  }

  /**
   * Strategy 2: Use opensearch API
   */
  private async wikipediaSearchStrategy2(query: string, limit: number): Promise<WikipediaResult[]> {
    const searchResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json`,
      {
        headers: {
          'User-Agent': 'RoganWriter/1.0 (https://roganwriter.com; support@roganwriter.com)'
        }
      }
    );
    
    if (!searchResponse.ok) {
      return [];
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData || !Array.isArray(searchData) || searchData.length < 4) {
      return [];
    }
    
    const [, titles, descriptions, urls] = searchData;
    
    if (!titles || !Array.isArray(titles)) {
      return [];
    }
    
    // Convert opensearch format to search format for processing
    const pages = titles.map((title: string, i: number) => ({
      pageid: i,
      title,
      snippet: descriptions?.[i] || '',
      size: 0,
      wordcount: 0,
      timestamp: new Date().toISOString()
    }));
    
    return await this.processWikipediaResults(pages);
  }

  /**
   * Preprocess query to fix common typos
   */
  private preprocessQuery(query: string): string {
    const corrections: Record<string, string> = {
      // Common misspellings of famous people
      'elbert einstein': 'albert einstein',
      'einsteen': 'einstein',
      'einsten': 'einstein',
      'shakespear': 'shakespeare',
      'shakespere': 'shakespeare',
      'ghandi': 'gandhi',
      'leonardo da vinci': 'leonardo da vinci',
      'van gogh': 'vincent van gogh',
      'newtn': 'newton',
      'napolean': 'napoleon',
      'ceasar': 'caesar',
      // Common scientific terms
      'relatvity': 'relativity',
      'quantom': 'quantum',
      'quantem': 'quantum',
      'evloution': 'evolution',
      'evoltion': 'evolution',
      // Common historical terms
      'world war': 'world war',
      'civl war': 'civil war',
      'renaisance': 'renaissance',
      'rennaissance': 'renaissance'
    };

    const lowercaseQuery = query.toLowerCase();
    
    // Check for exact matches first
    for (const [typo, correction] of Object.entries(corrections)) {
      if (lowercaseQuery === typo) {
        console.log(`🔧 Fixed typo: "${query}" -> "${correction}"`);
        return correction;
      }
    }
    
    // Check for partial matches (contains)
    for (const [typo, correction] of Object.entries(corrections)) {
      if (lowercaseQuery.includes(typo)) {
        const corrected = query.toLowerCase().replace(typo, correction);
        console.log(`🔧 Fixed partial typo: "${query}" -> "${corrected}"`);
        return corrected;
      }
    }

    return query;
  }

  /**
   * Process Wikipedia search results into standardized format
   */
  private async processWikipediaResults(pages: any[]): Promise<WikipediaResult[]> {
    const results: WikipediaResult[] = [];
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      if (!page.title) continue;
      
      try {
        // Get page summary using the title  
        const summaryResponse = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`,
          {
            headers: {
              'User-Agent': 'RoganWriter/1.0 (https://roganwriter.com; support@roganwriter.com)'
            }
          }
        );
        
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          
          results.push({
            id: `wikipedia_${summaryData.pageid || page.pageid || Date.now()}_${i}`,
            title: summaryData.title || page.title,
            summary: summaryData.extract || page.snippet || '',
            extract: summaryData.extract || page.snippet || '',
            content: summaryData.extract || page.snippet,
            source: 'wikipedia',
            url: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
            credibilityScore: this.calculateWikipediaCredibility(summaryData),
            lastUpdated: summaryData.timestamp ? new Date(summaryData.timestamp) : new Date(),
            pageId: summaryData.pageid || page.pageid || 0,
            imageUrl: summaryData.thumbnail?.source,
            coordinates: summaryData.coordinates ? {
              lat: summaryData.coordinates.lat,
              lon: summaryData.coordinates.lon
            } : undefined,
            tags: ['encyclopedia', 'collaborative']
          });
        }
      } catch (error) {
        console.warn(`Failed to get summary for Wikipedia page "${page.title}":`, error);
        // Still add basic result even if detailed fetch fails
        results.push({
          id: `wikipedia_basic_${Date.now()}_${i}`,
          title: page.title,
          summary: page.snippet || `Wikipedia article about ${page.title}`,
          extract: page.snippet || '',
          content: page.snippet,
          source: 'wikipedia',
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
          credibilityScore: 75, // Default score
          lastUpdated: new Date(),
          pageId: page.pageid || 0,
          tags: ['encyclopedia', 'collaborative']
        });
      }
    }
    
    return results;
  }
  
  /**
   * Search for scholarly articles (using CORE API as example)
   */
  async searchScholarlyArticles(query: string, limit: number = 3): Promise<ScholarlyResult[]> {
    try {
      console.log(`🎓 Researching scholarly articles: "${query}"`);
      
      // This would integrate with CORE API, arXiv, or PubMed
      // For now, using a mock implementation
      
      // Example using CORE API (requires API key)
      if (process.env.CORE_API_KEY) {
        const response = await fetch(
          `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=${limit}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.CORE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          return data.results.map((article: any, index: number): ScholarlyResult => ({
            id: `scholarly_${article.id || index}`,
            title: article.title || 'Untitled Article',
            summary: article.abstract || article.description || '',
            abstractText: article.abstract,
            content: article.abstract,
            source: 'scholarly',
            url: article.downloadUrl || article.sourceFulltextUrls?.[0] || '#',
            credibilityScore: this.calculateScholarlyCredibility(article),
            lastUpdated: article.publishedDate ? new Date(article.publishedDate) : new Date(),
            publishedDate: article.publishedDate ? new Date(article.publishedDate) : new Date(),
            authors: article.authors?.map((a: any) => a.name) || [],
            doi: article.doi,
            journal: article.journals?.[0]?.title,
            citationCount: article.citationCount,
            tags: ['peer-reviewed', 'academic']
          }));
        }
      }
      
      // No API key available - return empty results
      console.warn('No CORE_API_KEY configured for scholarly search');
      return [];
      
    } catch (error) {
      console.error('Scholarly search error:', error);
      return [];
    }
  }
  
  /**
   * Search current news and events
   */
  async searchCurrentEvents(query: string, limit: number = 3): Promise<NewsResult[]> {
    try {
      console.log(`📰 Researching news: "${query}"`);
      
      // This would integrate with NewsAPI
      if (process.env.NEWS_API_KEY) {
        const response = await fetch(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=relevancy&pageSize=${limit}&language=en`,
          {
            headers: {
              'X-API-Key': process.env.NEWS_API_KEY
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          
          return data.articles.map((article: any, index: number): NewsResult => ({
            id: `news_${index}_${Date.now()}`,
            title: article.title,
            summary: article.description || '',
            content: article.content,
            source: 'news',
            url: article.url,
            credibilityScore: this.calculateNewsCredibility(article),
            lastUpdated: new Date(article.publishedAt),
            publishedAt: new Date(article.publishedAt),
            publisher: article.source.name,
            authors: article.author ? [article.author] : [],
            imageUrl: article.urlToImage,
            tags: ['current-events', 'journalism']
          }));
        }
      }
      
      // No API key available - return empty results
      console.warn('No NEWS_API_KEY configured for news search');
      return [];
      
    } catch (error) {
      console.error('News search error:', error);
      return [];
    }
  }
  
  /**
   * Perform comprehensive multi-source research
   */
  async performComprehensiveResearch(
    query: string,
    sources: Array<'wikipedia' | 'scholarly' | 'news'> = ['wikipedia', 'scholarly', 'news']
  ): Promise<ResearchResult[]> {
    console.log(`🔍 Performing comprehensive research: "${query}"`);
    
    const searchPromises: Promise<ResearchResult[]>[] = [];
    
    if (sources.includes('wikipedia')) {
      searchPromises.push(this.searchWikipedia(query, 3));
    }
    
    if (sources.includes('scholarly')) {
      searchPromises.push(this.searchScholarlyArticles(query, 2));
    }
    
    if (sources.includes('news')) {
      searchPromises.push(this.searchCurrentEvents(query, 2));
    }
    
    const results = await Promise.all(searchPromises);
    const flatResults = results.flat();
    
    // Sort by credibility score
    flatResults.sort((a, b) => b.credibilityScore - a.credibilityScore);
    
    console.log(`🔍 Comprehensive research complete: ${flatResults.length} total results`);
    return flatResults;
  }
  
  /**
   * Generate citation for a research result
   */
  generateCitation(result: ResearchResult, format: 'apa' | 'mla' | 'chicago'): Citation {
    const currentDate = new Date().toISOString().split('T')[0];
    
    switch (result.source) {
      case 'wikipedia':
        return this.generateWikipediaCitation(result as WikipediaResult, format);
      case 'scholarly':
        return this.generateScholarlyArticleCitation(result as ScholarlyResult, format);
      case 'news':
        return this.generateNewsCitation(result as NewsResult, format);
      default:
        return this.generateGenericCitation(result, format);
    }
  }
  
  /**
   * Private helper methods
   */
  
  private calculateWikipediaCredibility(data: any): number {
    // Base credibility for Wikipedia
    let score = 75;
    
    // Boost for recent updates
    if (data.timestamp) {
      const daysSinceUpdate = (Date.now() - new Date(data.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) score += 10;
      else if (daysSinceUpdate < 90) score += 5;
    }
    
    // Boost for articles with coordinates (usually well-documented)
    if (data.coordinates) score += 5;
    
    // Boost for longer articles (more comprehensive)
    if (data.extract && data.extract.length > 500) score += 5;
    
    return Math.min(score, 95); // Wikipedia rarely gets perfect score due to collaborative nature
  }
  
  private calculateScholarlyCredibility(article: any): number {
    let score = 85; // High base score for peer-reviewed content
    
    // Boost for citation count
    if (article.citationCount > 100) score += 10;
    else if (article.citationCount > 10) score += 5;
    
    // Boost for recent publications
    if (article.publishedDate) {
      const yearsSincePublished = (Date.now() - new Date(article.publishedDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (yearsSincePublished < 2) score += 5;
    }
    
    // Boost for DOI (more credible)
    if (article.doi) score += 5;
    
    return Math.min(score, 100);
  }
  
  private calculateNewsCredibility(article: any): number {
    let score = 60; // Moderate base score for news
    
    // Boost for reputable sources
    const reputableSources = ['Reuters', 'Associated Press', 'BBC', 'NPR', 'The Guardian', 'Washington Post', 'New York Times'];
    if (reputableSources.some(source => article.source?.name?.includes(source))) {
      score += 20;
    }
    
    // Boost for recent articles
    if (article.publishedAt) {
      const daysSincePublished = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublished < 7) score += 10;
      else if (daysSincePublished < 30) score += 5;
    }
    
    // Boost for articles with author attribution
    if (article.author) score += 5;
    
    return Math.min(score, 85); // News rarely gets perfect score due to potential bias
  }
  
  private generateWikipediaCitation(result: WikipediaResult, format: 'apa' | 'mla' | 'chicago'): Citation {
    const accessDate = new Date().toLocaleDateString();
    const year = result.lastUpdated.getFullYear();
    
    switch (format) {
      case 'apa':
        return {
          format: 'apa',
          text: `"${result.title}." (${year}). Wikipedia. Retrieved ${accessDate}, from ${result.url}`,
          bibEntry: `${result.title}. (${year}). In Wikipedia. ${result.url}`
        };
      case 'mla':
        return {
          format: 'mla',
          text: `"${result.title}." Wikipedia, ${result.lastUpdated.toLocaleDateString()}, ${result.url}.`,
          bibEntry: `"${result.title}." Wikipedia, ${result.lastUpdated.toLocaleDateString()}, ${result.url}.`
        };
      case 'chicago':
        return {
          format: 'chicago',
          text: `"${result.title}," Wikipedia, last modified ${result.lastUpdated.toLocaleDateString()}, ${result.url}.`,
          bibEntry: `"${result.title}." Wikipedia. Last modified ${result.lastUpdated.toLocaleDateString()}. ${result.url}.`
        };
    }
  }
  
  private generateScholarlyArticleCitation(result: ScholarlyResult, format: 'apa' | 'mla' | 'chicago'): Citation {
    const authors = result.authors?.join(', ') || 'Unknown Author';
    const year = result.publishedDate.getFullYear();
    
    switch (format) {
      case 'apa':
        return {
          format: 'apa',
          text: `${authors} (${year}). ${result.title}. ${result.journal || 'Academic Source'}. ${result.url}`,
          bibEntry: `${authors} (${year}). ${result.title}. ${result.journal || 'Academic Source'}. ${result.url}`
        };
      case 'mla':
        return {
          format: 'mla',
          text: `${authors}. "${result.title}." ${result.journal || 'Academic Source'}, ${year}, ${result.url}.`,
          bibEntry: `${authors}. "${result.title}." ${result.journal || 'Academic Source'}, ${year}, ${result.url}.`
        };
      case 'chicago':
        return {
          format: 'chicago',
          text: `${authors}. "${result.title}." ${result.journal || 'Academic Source'} (${year}). ${result.url}.`,
          bibEntry: `${authors}. "${result.title}." ${result.journal || 'Academic Source'} (${year}). ${result.url}.`
        };
    }
  }
  
  private generateNewsCitation(result: NewsResult, format: 'apa' | 'mla' | 'chicago'): Citation {
    const authors = result.authors?.join(', ') || result.publisher;
    const year = result.publishedAt.getFullYear();
    const date = result.publishedAt.toLocaleDateString();
    
    switch (format) {
      case 'apa':
        return {
          format: 'apa',
          text: `${authors} (${year}). ${result.title}. ${result.publisher}. ${result.url}`,
          bibEntry: `${authors} (${year}). ${result.title}. ${result.publisher}. ${result.url}`
        };
      case 'mla':
        return {
          format: 'mla',
          text: `${authors}. "${result.title}." ${result.publisher}, ${date}, ${result.url}.`,
          bibEntry: `${authors}. "${result.title}." ${result.publisher}, ${date}, ${result.url}.`
        };
      case 'chicago':
        return {
          format: 'chicago',
          text: `${authors}. "${result.title}." ${result.publisher}, ${date}. ${result.url}.`,
          bibEntry: `${authors}. "${result.title}." ${result.publisher}, ${date}. ${result.url}.`
        };
    }
  }
  
  private generateGenericCitation(result: ResearchResult, format: 'apa' | 'mla' | 'chicago'): Citation {
    const authors = result.authors?.join(', ') || 'Unknown Author';
    const year = result.lastUpdated.getFullYear();
    
    const citation = `${authors} (${year}). ${result.title}. Retrieved from ${result.url}`;
    
    return {
      format,
      text: citation,
      bibEntry: citation
    };
  }
  
  // Mock methods removed - using real data only
}

// Export singleton instance
export const researchApiService = new ResearchAPIService();
