import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { llmService } from '@/services/llm.service'

interface AnalysisResult {
  characters: Array<{
    name: string
    description?: string
    appearance?: string
    personality?: string
    backstory?: string
    role: 'PROTAGONIST' | 'ANTAGONIST' | 'MAJOR' | 'MINOR' | 'CAMEO'
  }>
  locations: Array<{
    name: string
    description?: string
    geography?: string
    culture?: string
    rules?: string
  }>
  timelineEvents: Array<{
    title: string
    description?: string
    eventDate?: string
    startTime: number
    endTime: number
    characterName?: string
    locationName?: string
  }>
  plotPoints: Array<{
    type: 'HOOK' | 'PLOT_TURN_1' | 'PINCH_1' | 'MIDPOINT' | 'PINCH_2' | 'PLOT_TURN_2' | 'RESOLUTION'
    title: string
    description?: string
    subplot?: string
  }>
  sceneCards: Array<{
    title: string
    description?: string
    purpose?: string
    conflict?: string
    outcome?: string
  }>
  researchItems: Array<{
    title: string
    content?: string
    tags: string[]
    itemType: 'NOTE' | 'LINK' | 'IMAGE' | 'DOCUMENT' | 'VIDEO'
  }>
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const resolvedParams = await params
    const { content, options = {} } = await request.json()
    
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Define the AI prompt for content analysis
    const systemPrompt = `You are an expert literary analyst. Analyze the provided book content and extract the following elements in JSON format:

1. **Characters**: Extract all mentioned characters with their descriptions, physical appearance, personality traits, and backstory. Classify their role as PROTAGONIST, ANTAGONIST, MAJOR, MINOR, or CAMEO.

2. **Locations**: Extract all settings, places, and locations mentioned. Include geographical details, cultural aspects, and any special rules or characteristics.

3. **Timeline Events**: Extract key events in chronological order. Assign start and end times as integers (1-100 representing story progression). Include which characters and locations are involved.

4. **Plot Points**: Identify major plot structure elements according to the 7-point story structure (HOOK, PLOT_TURN_1, PINCH_1, MIDPOINT, PINCH_2, PLOT_TURN_2, RESOLUTION).

5. **Scene Cards**: Break down scenes with their purpose, conflict, and outcome.

6. **Research Items**: Extract any references to real-world facts, historical elements, scientific concepts, or other research-worthy topics.

Return your analysis in this exact JSON structure:
{
  "characters": [{"name": "string", "description": "string", "appearance": "string", "personality": "string", "backstory": "string", "role": "PROTAGONIST|ANTAGONIST|MAJOR|MINOR|CAMEO"}],
  "locations": [{"name": "string", "description": "string", "geography": "string", "culture": "string", "rules": "string"}],
  "timelineEvents": [{"title": "string", "description": "string", "eventDate": "string", "startTime": number, "endTime": number, "characterName": "string", "locationName": "string"}],
  "plotPoints": [{"type": "HOOK|PLOT_TURN_1|PINCH_1|MIDPOINT|PINCH_2|PLOT_TURN_2|RESOLUTION", "title": "string", "description": "string", "subplot": "string"}],
  "sceneCards": [{"title": "string", "description": "string", "purpose": "string", "conflict": "string", "outcome": "string"}],
  "researchItems": [{"title": "string", "content": "string", "tags": ["string"], "itemType": "NOTE|LINK|IMAGE|DOCUMENT|VIDEO"}]
}

Only include elements that are clearly present in the content. Be thorough but accurate.`

    try {
      // Call LLM service for content analysis
      const completion = await llmService.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this book content:\n\n${content}` }
        ],
        {
          model: process.env.NODE_ENV === 'development' ? undefined : 'gpt-4-turbo-preview', // Use default model in dev
          temperature: 0.3,
          max_tokens: 2000
        }
      )

      const analysisText = completion.content
      if (!analysisText) {
        throw new Error('No analysis returned from LLM')
      }

      // Parse the JSON response (handle markdown code blocks)
      let analysis: AnalysisResult
      try {
        // Remove markdown code blocks if present
        let cleanedText = analysisText.trim()
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '')
        }
        
        analysis = JSON.parse(cleanedText)
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', analysisText)
        console.error('Parse error:', parseError)
        throw new Error('Failed to parse AI analysis result')
      }

      // Validate the structure
      const requiredKeys = ['characters', 'locations', 'timelineEvents', 'plotPoints', 'sceneCards', 'researchItems']
      for (const key of requiredKeys) {
        if (!analysis[key as keyof AnalysisResult] || !Array.isArray(analysis[key as keyof AnalysisResult])) {
          analysis[key as keyof AnalysisResult] = [] as any
        }
      }

      return NextResponse.json({
        success: true,
        analysis,
        bookId: resolvedParams.bookId,
        metadata: {
          contentLength: content.length,
          charactersFound: analysis.characters?.length || 0,
          locationsFound: analysis.locations?.length || 0,
          timelineEventsFound: analysis.timelineEvents?.length || 0,
          plotPointsFound: analysis.plotPoints?.length || 0,
          sceneCardsFound: analysis.sceneCards?.length || 0,
          researchItemsFound: analysis.researchItems?.length || 0
        }
      })

    } catch (aiError) {
      console.error('OpenAI API error:', aiError)
      
      if (aiError instanceof Error) {
        if (aiError.message.includes('API key')) {
          return NextResponse.json({ error: 'Invalid OpenAI API key' }, { status: 401 })
        }
        if (aiError.message.includes('quota')) {
          return NextResponse.json({ error: 'OpenAI API quota exceeded' }, { status: 429 })
        }
        if (aiError.message.includes('rate limit')) {
          return NextResponse.json({ error: 'OpenAI API rate limit exceeded' }, { status: 429 })
        }
      }
      
      return NextResponse.json({ 
        error: 'AI analysis failed', 
        details: process.env.NODE_ENV === 'development' ? aiError : undefined 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error analyzing content:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error as any)?.message : undefined
    }, { status: 500 })
  }
}