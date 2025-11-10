import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { researchApiService } from '@/services/research-api.service'
import { isNonFictionBook, requiresFactChecking } from '@/lib/genre-utils'
import { llmService } from '@/services/llm.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const { content, chapterId } = await request.json()

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required for fact-checking' }, { status: 400 })
    }

    // Verify book ownership and check if it requires fact-checking
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        genre: true
      }
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    if (!isNonFictionBook(book.genre) || !requiresFactChecking(book.genre || '')) {
      return NextResponse.json({ 
        error: 'Fact-checking is only available for non-fiction books that require verification',
        suggestion: 'This feature is available for genres like science, history, biography, etc.'
      }, { status: 403 })
    }

    console.log(`🔍 Fact-checking request for "${book.title}"`)

    // Extract factual claims from content using AI
    const factualClaims = await extractFactualClaims(content)
    
    if (factualClaims.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No factual claims detected that require verification',
        claims: [],
        factChecks: []
      })
    }

    console.log(`📝 Found ${factualClaims.length} claims to verify`)

    // Verify each claim
    const factCheckResults = await Promise.all(
      factualClaims.slice(0, 5).map(async (claim) => { // Limit to 5 claims to avoid API overuse
        try {
          return await verifyClaim(claim, book.title)
        } catch (error) {
          console.error(`Failed to verify claim: "${claim}"`, error)
          return {
            claim,
            status: 'REQUIRES_REVIEW' as const,
            confidenceScore: 0,
            verificationSources: [],
            conflictingSources: [],
            recommendations: 'Manual review required due to verification error',
            researchResults: []
          }
        }
      })
    )

    // Store fact-check results in database
    const storedFactChecks = await Promise.all(
      factCheckResults.map(async (result) => {
        try {
          return await prisma.factCheck.create({
            data: {
              bookId: book.id,
              chapterId: chapterId || null,
              claim: result.claim,
              status: result.status,
              confidenceScore: result.confidenceScore,
              verificationSources: result.verificationSources,
              conflictingSources: result.conflictingSources || [],
              recommendations: result.recommendations,
              verifiedBy: 'AI Assistant'
            }
          })
        } catch (error) {
          console.error('Failed to store fact check:', error)
          return null
        }
      })
    )

    console.log(`✅ Fact-checking complete: ${factCheckResults.length} claims verified`)

    return NextResponse.json({
      success: true,
      bookTitle: book.title,
      claimsAnalyzed: factualClaims.length,
      factChecks: factCheckResults,
      storedCount: storedFactChecks.filter(Boolean).length
    })

  } catch (error) {
    console.error('Fact-check API error:', error)
    return NextResponse.json({ 
      error: 'Failed to perform fact-checking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get stored fact-check results for a book
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const chapterId = searchParams.get('chapterId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const offset = parseInt(searchParams.get('offset') ?? '0')

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
      select: { id: true, title: true }
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Build query conditions
    const whereConditions: any = { bookId }
    if (chapterId) whereConditions.chapterId = chapterId
    if (status && ['VERIFIED', 'DISPUTED', 'UNCERTAIN', 'REQUIRES_REVIEW'].includes(status)) {
      whereConditions.status = status
    }

    // Get fact-check results
    const factChecks = await prisma.factCheck.findMany({
      where: whereConditions,
      orderBy: [
        { status: 'asc' }, // Show disputed/uncertain first
        { confidenceScore: 'asc' }, // Then low confidence
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset,
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
            orderIndex: true
          }
        },
        researchResult: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            credibilityScore: true
          }
        }
      }
    })

    // Get total count for pagination
    const totalCount = await prisma.factCheck.count({
      where: whereConditions
    })

    // Get summary statistics
    const statusCounts = await prisma.factCheck.groupBy({
      by: ['status'],
      where: { bookId },
      _count: { status: true }
    })

    const summary = {
      total: totalCount,
      verified: statusCounts.find((s: any) => s.status === 'VERIFIED')?._count.status || 0,
      disputed: statusCounts.find((s: any) => s.status === 'DISPUTED')?._count.status || 0,
      uncertain: statusCounts.find((s: any) => s.status === 'UNCERTAIN')?._count.status || 0,
      needsReview: statusCounts.find((s: any) => s.status === 'REQUIRES_REVIEW')?._count.status || 0,
    }

    return NextResponse.json({
      success: true,
      factChecks,
      summary,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (error) {
    console.error('Get fact-checks error:', error)
    return NextResponse.json({ 
      error: 'Failed to get fact-check results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Helper functions for fact-checking
 */

async function extractFactualClaims(content: string): Promise<string[]> {
  try {
    const prompt = `
      Extract factual claims from this text that can be verified against reliable sources.
      Focus on:
      - Statistical claims (numbers, percentages, dates)
      - Historical facts
      - Scientific statements
      - Names, places, and events
      - Quotes or attributions
      
      Ignore:
      - Opinions and subjective statements
      - Future predictions
      - Hypothetical scenarios
      - Personal anecdotes
      
      Text to analyze:
      ${content}
      
      Return only the factual claims as a JSON array of strings. If no verifiable claims are found, return an empty array.
      
      Example format: ["The population of Tokyo is 14 million", "Einstein published his theory of relativity in 1905"]
    `

    const response = await llmService.chatCompletion(
      [{ role: 'user', content: prompt }],
      {
        model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-3.5-turbo', // Use default model in dev
        temperature: 0.1, // Low temperature for factual extraction
        max_tokens: 500
      }
    )

    const responseText = response.content?.trim() || '[]'
    
    // Clean and parse JSON
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const claims = JSON.parse(cleanedResponse)
    return Array.isArray(claims) ? claims.slice(0, 10) : [] // Limit to 10 claims
    
  } catch (error) {
    console.error('Failed to extract factual claims:', error)
    return []
  }
}

async function verifyClaim(claim: string, bookTitle: string): Promise<{
  claim: string
  status: 'VERIFIED' | 'DISPUTED' | 'UNCERTAIN' | 'REQUIRES_REVIEW'
  confidenceScore: number
  verificationSources: any[]
  conflictingSources?: any[]
  recommendations: string
  researchResults: any[]
}> {
  try {
    // Search for information about the claim
    const researchResults = await researchApiService.performComprehensiveResearch(
      claim,
      ['wikipedia', 'scholarly', 'news']
    )

    if (researchResults.length === 0) {
      return {
        claim,
        status: 'REQUIRES_REVIEW',
        confidenceScore: 0,
        verificationSources: [],
        recommendations: 'No sources found to verify this claim. Manual research recommended.',
        researchResults: []
      }
    }

    // Use AI to analyze the consistency of sources
    const verificationPrompt = `
      Analyze the following claim against these research sources and determine its accuracy:
      
      CLAIM: "${claim}"
      
      SOURCES:
      ${researchResults.map((result, i) => 
        `${i + 1}. ${result.source.toUpperCase()} (${result.credibilityScore}% credible): "${result.title}"
           ${result.summary}`
      ).join('\n\n')}
      
      Based on these sources, provide a JSON response with this exact structure:
      {
        "status": "VERIFIED|DISPUTED|UNCERTAIN|REQUIRES_REVIEW",
        "confidence": 0-100,
        "reasoning": "Brief explanation of the verification result",
        "supportingSources": [0, 1, 2], // Array of source indices that support the claim
        "conflictingSources": [3, 4], // Array of source indices that contradict the claim  
        "recommendations": "Specific advice for the author"
      }
      
      Guidelines:
      - VERIFIED: Multiple credible sources confirm the claim (confidence 80-100)
      - DISPUTED: Credible sources contradict the claim (confidence 20-80)
      - UNCERTAIN: Mixed or insufficient evidence (confidence 30-70)
      - REQUIRES_REVIEW: No reliable sources or unclear (confidence 0-30)
    `

    const verificationResponse = await llmService.chatCompletion(
      [{ role: 'user', content: verificationPrompt }],
      {
        model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-3.5-turbo', // Use default model in dev
        temperature: 0.1,
        max_tokens: 400
      }
    )

    const responseText = verificationResponse.content?.trim() || '{}'
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const analysis = JSON.parse(cleanedResponse)

    // Build source arrays
    const supportingSources = (analysis.supportingSources || [])
      .map((i: number) => researchResults[i])
      .filter(Boolean)

    const conflictingSources = (analysis.conflictingSources || [])
      .map((i: number) => researchResults[i])
      .filter(Boolean)

    return {
      claim,
      status: analysis.status || 'REQUIRES_REVIEW',
      confidenceScore: Math.max(0, Math.min(100, analysis.confidence || 0)),
      verificationSources: supportingSources.map((s: any) => ({
        title: s.title,
        source: s.source,
        url: s.url,
        credibilityScore: s.credibilityScore
      })),
      conflictingSources: conflictingSources.map((s: any) => ({
        title: s.title,
        source: s.source,
        url: s.url,
        credibilityScore: s.credibilityScore
      })),
      recommendations: analysis.recommendations || analysis.reasoning || 'Additional verification recommended',
      researchResults: researchResults.slice(0, 3) // Include top 3 results
    }

  } catch (error) {
    console.error('Claim verification failed:', error)
    return {
      claim,
      status: 'REQUIRES_REVIEW',
      confidenceScore: 0,
      verificationSources: [],
      recommendations: 'Verification failed due to technical error. Manual review required.',
      researchResults: []
    }
  }
}

// Delete a fact check
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = await params
    const { searchParams } = new URL(request.url)
    const factCheckId = searchParams.get('factCheckId')

    if (!factCheckId) {
      return NextResponse.json({ error: 'Fact check ID is required' }, { status: 400 })
    }

    // Verify book ownership and fact check exists
    const existingFactCheck = await prisma.factCheck.findFirst({
      where: {
        id: factCheckId,
        bookId: bookId,
        book: {
          userId: session.user.id
        }
      }
    })

    if (!existingFactCheck) {
      return NextResponse.json({ error: 'Fact check not found' }, { status: 404 })
    }

    // Delete fact check
    await prisma.factCheck.delete({
      where: { id: factCheckId }
    })

    console.log(`🗑️ Deleted fact check for: ${existingFactCheck.claim}`)

    return NextResponse.json({
      success: true,
      message: 'Fact check deleted successfully'
    })

  } catch (error) {
    console.error('Delete fact check error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete fact check',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
