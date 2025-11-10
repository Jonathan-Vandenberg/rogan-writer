# Non-Fiction Research Integration Plan
## Factual AI Assistant for Research-Based Writing

### Overview

Transform Rogan Writer into a comprehensive non-fiction writing platform by integrating real-time research capabilities, fact-checking, and citation management. This system will use the existing `genre` column to detect non-fiction books and provide research-focused AI assistance.

## Technical Implementation Strategy

### 1. Genre-Based AI Routing System

#### Enhanced Genre Detection
```typescript
// Non-fiction genre categories
const NON_FICTION_GENRES = [
  'biography', 'memoir', 'history', 'science', 'technology',
  'business', 'self-help', 'health', 'politics', 'philosophy',
  'religion', 'psychology', 'education', 'reference', 'textbook',
  'cookbook', 'travel', 'true-crime', 'sports', 'academic'
];

// Check if book requires factual research
function isNonFictionBook(genre: string): boolean {
  return NON_FICTION_GENRES.includes(genre.toLowerCase());
}
```

#### AI Agent Enhancement
Modify existing AI agents to use research mode for non-fiction:

```typescript
// In ai-orchestrator.service.ts
async analyzeModule(module: string, bookId: string, options?: any) {
  const book = await prisma.book.findUnique({ 
    where: { id: bookId },
    select: { genre: true }
  });
  
  const isNonFiction = isNonFictionBook(book.genre);
  
  if (isNonFiction) {
    // Use research-enhanced agents
    return await this.researchBasedAnalysis(module, bookId, options);
  } else {
    // Use creative fiction agents
    return await this.creativeAnalysis(module, bookId, options);
  }
}
```

### 2. Research API Integration Layer

#### Primary Research Sources
```typescript
// src/services/research-api.service.ts
export class ResearchAPIService {
  
  // Wikipedia API Integration
  async searchWikipedia(query: string, limit: number = 5): Promise<WikipediaResult[]> {
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    // Implementation for Wikipedia API calls
  }
  
  // Scholarly Article Search
  async searchScholarlyArticles(query: string): Promise<ScholarlyResult[]> {
    // Integration with CORE API, arXiv, or PubMed
    const coreApiUrl = `https://api.core.ac.uk/v3/search/works`;
    // Implementation for academic paper search
  }
  
  // News & Current Events
  async searchCurrentEvents(query: string): Promise<NewsResult[]> {
    // Integration with NewsAPI or Google News
    const newsApiUrl = `https://newsapi.org/v2/everything`;
    // Implementation for news search
  }
  
  // Statistical Data Sources
  async searchStatistics(query: string): Promise<StatResult[]> {
    // Integration with government databases, World Bank, etc.
    // Implementation for statistical data
  }
  
  // Book & Publication Search
  async searchBooks(query: string): Promise<BookResult[]> {
    // Integration with Google Books API, OpenLibrary
    const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes`;
    // Implementation for book search
  }
}
```

#### Research Result Types
```typescript
interface ResearchResult {
  id: string;
  title: string;
  summary: string;
  source: 'wikipedia' | 'scholarly' | 'news' | 'government' | 'books';
  url: string;
  credibilityScore: number; // 0-100
  lastUpdated: Date;
  citations?: Citation[];
}

interface Citation {
  format: 'apa' | 'mla' | 'chicago';
  text: string;
  bibEntry: string;
}
```

### 3. Research-Enhanced AI Agents

#### Research-Aware Brainstorming Agent
```typescript
// src/services/ai-agents/research-brainstorming-agent.ts
export class ResearchBrainstormingAgent extends BrainstormingAgent {
  
  async analyze(chapters: Chapter[], bookId: string): Promise<BrainstormingSuggestion[]> {
    const book = await this.getBookWithGenre(bookId);
    
    if (isNonFictionBook(book.genre)) {
      return await this.generateResearchBasedSuggestions(chapters, bookId, book);
    }
    
    return super.analyze(chapters, bookId);
  }
  
  private async generateResearchBasedSuggestions(
    chapters: Chapter[], 
    bookId: string, 
    book: Book
  ): Promise<BrainstormingSuggestion[]> {
    
    // Extract key topics from existing content
    const keyTopics = await this.extractResearchTopics(chapters);
    
    // Search for factual information
    const researchResults = await Promise.all(
      keyTopics.map(topic => this.researchApiService.searchWikipedia(topic))
    );
    
    // Generate fact-based brainstorming suggestions
    const prompt = `
      Based on the following factual research about "${book.title}" (${book.genre}):
      
      RESEARCH FINDINGS:
      ${this.formatResearchResults(researchResults)}
      
      EXISTING CONTENT:
      ${this.combineChapterContent(chapters)}
      
      Generate brainstorming suggestions that:
      1. Are factually accurate and verifiable
      2. Suggest research directions for unexplored areas
      3. Identify potential fact-checking needs
      4. Recommend primary source investigations
      5. Highlight statistical or data opportunities
      
      Focus on research gaps and factual enhancement opportunities.
    `;
    
    // Continue with AI processing...
  }
}
```

#### Fact-Checking Character Agent
```typescript
// Enhanced character agent for non-fiction (real people)
export class ResearchCharacterAgent extends CharacterAgent {
  
  async analyze(chapters: Chapter[], bookId: string): Promise<CharacterSuggestion[]> {
    const book = await this.getBookWithGenre(bookId);
    
    if (isNonFictionBook(book.genre)) {
      return await this.generateRealPersonSuggestions(chapters, bookId, book);
    }
    
    return super.analyze(chapters, bookId);
  }
  
  private async generateRealPersonSuggestions(
    chapters: Chapter[], 
    bookId: string, 
    book: Book
  ): Promise<CharacterSuggestion[]> {
    
    // Extract mentioned people from content
    const mentionedPeople = await this.extractPersonNames(chapters);
    
    // Research biographical information
    const bioResearch = await Promise.all(
      mentionedPeople.map(person => this.researchApiService.searchWikipedia(person))
    );
    
    const prompt = `
      For this ${book.genre} book "${book.title}", analyze real people mentioned:
      
      BIOGRAPHICAL RESEARCH:
      ${this.formatBiographicalResults(bioResearch)}
      
      BOOK CONTENT:
      ${this.combineChapterContent(chapters)}
      
      Suggest:
      1. Key biographical details that should be included
      2. Important relationships and connections
      3. Historical context and timeline accuracy
      4. Fact-checking requirements for claims made
      5. Additional notable figures to research
      
      Ensure all suggestions are factually verifiable.
    `;
    
    // Process with research-aware prompt
  }
}
```

### 4. Real-Time Fact Checking System

#### Fact-Check Agent
```typescript
// src/services/ai-agents/fact-check-agent.ts
export class FactCheckAgent extends AIAgent {
  
  async verifyContent(content: string, bookId: string): Promise<FactCheckResult[]> {
    // Extract factual claims from content
    const claims = await this.extractFactualClaims(content);
    
    const verificationResults = await Promise.all(
      claims.map(claim => this.verifyClaim(claim))
    );
    
    return verificationResults;
  }
  
  private async verifyClaim(claim: string): Promise<FactCheckResult> {
    // Search multiple sources for verification
    const [wikipediaResults, scholarlyResults, newsResults] = await Promise.all([
      this.researchApi.searchWikipedia(claim),
      this.researchApi.searchScholarlyArticles(claim),
      this.researchApi.searchCurrentEvents(claim)
    ]);
    
    // Use AI to analyze consistency across sources
    const verificationPrompt = `
      Verify this claim: "${claim}"
      
      WIKIPEDIA SOURCES:
      ${this.formatResults(wikipediaResults)}
      
      SCHOLARLY SOURCES:
      ${this.formatResults(scholarlyResults)}
      
      NEWS SOURCES:
      ${this.formatResults(newsResults)}
      
      Determine:
      1. Is this claim supported by evidence? (true/false/uncertain)
      2. What is the confidence level? (0-100)
      3. Are there conflicting sources?
      4. What additional verification is needed?
      5. Provide citations for supporting evidence
    `;
    
    const aiResponse = await this.callOpenAI(verificationPrompt);
    return this.parseFactCheckResponse(aiResponse);
  }
}

interface FactCheckResult {
  claim: string;
  verified: boolean;
  confidence: number;
  sources: ResearchResult[];
  conflictingSources?: ResearchResult[];
  recommendations: string[];
  citations: Citation[];
}
```

### 5. Citation Management System

#### Citation Service
```typescript
// src/services/citation.service.ts
export class CitationService {
  
  async generateCitation(
    source: ResearchResult, 
    format: 'apa' | 'mla' | 'chicago'
  ): Promise<Citation> {
    
    switch(source.source) {
      case 'wikipedia':
        return this.generateWikipediaCitation(source, format);
      case 'scholarly':
        return this.generateScholarlyArticleCitation(source, format);
      case 'news':
        return this.generateNewsCitation(source, format);
      case 'books':
        return this.generateBookCitation(source, format);
      default:
        return this.generateGenericCitation(source, format);
    }
  }
  
  private generateWikipediaCitation(source: ResearchResult, format: string): Citation {
    const date = new Date().toISOString().split('T')[0];
    
    switch(format) {
      case 'apa':
        return {
          format: 'apa',
          text: `"${source.title}." (${source.lastUpdated.getFullYear()}). Wikipedia. Retrieved ${date}, from ${source.url}`,
          bibEntry: `${source.title}. (${source.lastUpdated.getFullYear()}). In Wikipedia. ${source.url}`
        };
      case 'mla':
        return {
          format: 'mla',
          text: `"${source.title}." Wikipedia, ${source.lastUpdated.toLocaleDateString()}, ${source.url}.`,
          bibEntry: `"${source.title}." Wikipedia, ${source.lastUpdated.toLocaleDateString()}, ${source.url}.`
        };
      // Add Chicago and other formats
    }
  }
  
  async manageBibliography(bookId: string): Promise<Bibliography> {
    const citations = await prisma.citation.findMany({
      where: { bookId },
      orderBy: { createdAt: 'asc' }
    });
    
    return {
      entries: citations,
      formatted: {
        apa: citations.map(c => c.apaFormat),
        mla: citations.map(c => c.mlaFormat),
        chicago: citations.map(c => c.chicagoFormat)
      }
    };
  }
}
```

### 6. Database Schema Extensions

#### Research & Citations Tables
```sql
-- Add research results storage
CREATE TABLE research_results (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  query VARCHAR(500) NOT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  source_type VARCHAR(50) NOT NULL, -- 'wikipedia', 'scholarly', etc.
  source_url VARCHAR(1000),
  credibility_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  embedding vector(1536), -- For semantic search
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Add citations management
CREATE TABLE citations (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  research_result_id VARCHAR(36),
  chapter_id VARCHAR(36),
  claim_text TEXT,
  apa_format TEXT,
  mla_format TEXT,
  chicago_format TEXT,
  page_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (research_result_id) REFERENCES research_results(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id)
);

-- Add fact-checking results
CREATE TABLE fact_checks (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  chapter_id VARCHAR(36),
  claim VARCHAR(1000) NOT NULL,
  verified BOOLEAN,
  confidence_score INTEGER,
  verification_sources JSON,
  conflicting_sources JSON,
  recommendations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id)
);
```

### 7. Enhanced AI Chat for Research

#### Research-Aware Chat System
Modify the existing AI chat to handle research queries:

```typescript
// In ai-chat route.ts
if (isNonFictionBook(book.genre)) {
  // Check if this is a research query
  const isResearchQuery = await this.detectResearchIntent(message);
  
  if (isResearchQuery) {
    // Perform real-time research
    const researchResults = await this.performResearch(message, bookId);
    
    // Enhance context with factual information
    relevantContext = `${relevantContext}\n\nRESEARCH FINDINGS:\n${this.formatResearchForAI(researchResults)}`;
    
    // Use research-focused system prompt
    systemPrompt = this.getResearchSystemPrompt(book.title, book.genre, relevantContext);
  }
}

private async performResearch(query: string, bookId: string): Promise<ResearchResult[]> {
  const researchApi = new ResearchAPIService();
  
  const [wikipedia, scholarly, news] = await Promise.all([
    researchApi.searchWikipedia(query, 3),
    researchApi.searchScholarlyArticles(query),
    researchApi.searchCurrentEvents(query)
  ]);
  
  // Store research results for later citation
  await this.storeResearchResults([...wikipedia, ...scholarly, ...news], bookId);
  
  return [...wikipedia, ...scholarly, ...news];
}
```

### 8. User Interface Enhancements

#### Research Panel Component
```typescript
// src/components/research-panel.tsx
export function ResearchPanel({ bookId, isNonFiction }: ResearchPanelProps) {
  if (!isNonFiction) return null;
  
  return (
    <div className="research-panel">
      <Tabs>
        <TabsList>
          <TabsTrigger value="search">Research</TabsTrigger>
          <TabsTrigger value="citations">Citations</TabsTrigger>
          <TabsTrigger value="fact-check">Fact Check</TabsTrigger>
        </TabsList>
        
        <TabsContent value="search">
          <ResearchSearch bookId={bookId} />
        </TabsContent>
        
        <TabsContent value="citations">
          <CitationManager bookId={bookId} />
        </TabsContent>
        
        <TabsContent value="fact-check">
          <FactCheckDashboard bookId={bookId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### Research Search Component
```typescript
export function ResearchSearch({ bookId }: { bookId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/books/${bookId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      setResults(data.results);
    } catch (error) {
      console.error('Research search error:', error);
    }
    setLoading(false);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for factual information..."  
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader className="animate-spin" /> : <Search />}
          Research
        </Button>
      </div>
      
      <div className="research-results">
        {results.map(result => (
          <ResearchResultCard 
            key={result.id}
            result={result}
            onCite={(result) => addCitation(result)}
            onFactCheck={(result) => factCheck(result)}
          />
        ))}
      </div>
    </div>
  );
}
```

### 9. API Endpoints for Research

#### Research API Routes
```typescript
// src/app/api/books/[bookId]/research/route.ts
export async function POST(request: NextRequest, { params }: { params: { bookId: string } }) {
  const { query } = await request.json();
  const { bookId } = params;
  
  const researchApi = new ResearchAPIService();
  
  // Perform multi-source research
  const results = await Promise.all([
    researchApi.searchWikipedia(query),
    researchApi.searchScholarlyArticles(query),
    researchApi.searchCurrentEvents(query)
  ]);
  
  const flatResults = results.flat();
  
  // Store for future reference
  await storeResearchResults(flatResults, bookId);
  
  return NextResponse.json({ results: flatResults });
}

// Fact-checking endpoint
// src/app/api/books/[bookId]/fact-check/route.ts  
export async function POST(request: NextRequest, { params }: { params: { bookId: string } }) {
  const { content } = await request.json();
  const { bookId } = params;
  
  const factCheckAgent = new FactCheckAgent();
  const verificationResults = await factCheckAgent.verifyContent(content, bookId);
  
  return NextResponse.json({ factChecks: verificationResults });
}
```

### 10. Pricing & Competitive Advantages

#### Research Feature Pricing
- **Free Plan**: 5 research queries/month
- **Author Plan ($19)**: 50 research queries/month, basic citations
- **Pro Writer Plan ($49)**: 200 research queries/month, advanced citations, fact-checking
- **Enterprise Plan ($149)**: Unlimited research, custom source integration, team fact-checking

#### Competitive Differentiation
1. **Real-time research integration** - No competitor offers this
2. **Automatic fact-checking** - Unique value for non-fiction writers
3. **Citation management** - Academic-grade references
4. **Source credibility scoring** - AI-powered reliability assessment
5. **Multi-format citations** - APA, MLA, Chicago support

## Implementation Timeline

### Phase 1 (Months 1-2): Foundation
- Research API integrations (Wikipedia, basic scholarly)
- Genre-based AI routing system
- Basic research panel UI

### Phase 2 (Months 3-4): Core Features  
- Fact-checking agent implementation
- Citation management system
- Enhanced AI chat with research

### Phase 3 (Months 5-6): Advanced Features
- Multiple citation formats
- Advanced research sources
- Fact-check dashboard

## Expected Impact

### Market Differentiation
- **First AI writing platform** with integrated research capabilities
- **Academic market capture** - appeal to textbook authors, researchers
- **Professional credibility** - fact-checked content for business writers

### Revenue Impact
- **20-30% higher conversion rates** for non-fiction users
- **Expanded addressable market** to include academic/professional writers
- **Premium pricing justification** through unique research features

This research integration would position Rogan Writer as the definitive platform for serious non-fiction authors, creating a significant competitive moat while expanding the total addressable market.
