import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { editorAgent } from '@/services/ai-agents/editor-agent';

interface EditorChatRequest {
  message: string;
  conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  loadedChapterIds?: string[];
  includePlanningData?: boolean;
  editorModel?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const body: EditorChatRequest = await request.json();
    let { message, conversationHistory, loadedChapterIds, includePlanningData = false, editorModel } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Verify book ownership
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
        userId: session.user.id,
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // If no model specified, check user's preferred editor model from settings
    if (!editorModel) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { openRouterEditorModel: true },
        });
        
        if (user?.openRouterEditorModel) {
          editorModel = user.openRouterEditorModel;
          console.log(`✅ Using user's preferred editor model: ${editorModel}`);
        } else {
          editorModel = 'openai/gpt-4'; // Default fallback
        }
      } catch (error) {
        console.error('Error loading user editor model preference:', error);
        editorModel = 'openai/gpt-4'; // Default fallback
      }
    }

    // Load chapters if IDs are provided
    console.log('📥 Received loadedChapterIds:', loadedChapterIds);
    let loadedChapters: any[] | undefined;
    if (loadedChapterIds && loadedChapterIds.length > 0) {
      console.log('✅ Loading chapters with IDs:', loadedChapterIds);
      loadedChapters = await prisma.chapter.findMany({
        where: {
          id: { in: loadedChapterIds },
          bookId,
        },
        orderBy: { orderIndex: 'asc' },
      });
      console.log(`✅ Loaded ${loadedChapters.length} chapters from database`);
    } else {
      console.log('⚠️ No chapter IDs provided or empty array');
    }

    // Ensure editorModel is set (should be set above, but TypeScript needs this)
    if (!editorModel) {
      editorModel = 'openai/gpt-4';
    }

    // Use streaming for models that support it (check if model name suggests streaming support)
    // For now, use non-streaming by default - can be enhanced later
    const useStreaming = false; // Can be made configurable per model later
    
    if (useStreaming) {
      // Return streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let fullContent = '';
          try {
            await editorAgent.processEditRequestStreaming(
              bookId,
              message,
              conversationHistory,
              loadedChapters,
              includePlanningData,
              editorModel,
              (chunk) => {
                fullContent += chunk;
                // Send chunk as SSE
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
              }
            );
            
            // Try to parse the complete response for structured data
            console.log('🔍 Parsing complete streamed response for structured data...');
            try {
              // Try to extract JSON from the response
              const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsedData = JSON.parse(jsonMatch[0]);
                
                // Generate diffs for edits if present
                if (parsedData.edits && parsedData.edits.length > 0) {
                  const editsWithDiffs = parsedData.edits.map((edit: any) => ({
                    ...edit,
                    diff: editorAgent.generateDiff(edit.originalContent, edit.editedContent),
                  }));
                  parsedData.edits = editsWithDiffs;
                }
                
                // Send parsed data with edits
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ parsedData })}\n\n`));
                console.log('✅ Sent parsed data with edits');
              }
            } catch (parseError) {
              console.error('Error parsing streamed response:', parseError);
            }
            
            // Send done signal
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming response (default)
    const response = await editorAgent.processEditRequest(
      bookId,
      message,
      conversationHistory,
      loadedChapters,
      includePlanningData,
      editorModel
    );

    // Generate diffs for edits if present
    if (response.edits && response.edits.length > 0) {
      const editsWithDiffs = response.edits.map(edit => ({
        ...edit,
        diff: editorAgent.generateDiff(edit.originalContent, edit.editedContent),
      }));

      return NextResponse.json({
        ...response,
        edits: editsWithDiffs,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Editor agent error:', error);
    return NextResponse.json(
      { error: 'Failed to process editing request' },
      { status: 500 }
    );
  }
}

