import { NextRequest, NextResponse } from 'next/server';
import { llmService } from '@/services/llm.service';

export async function GET(request: NextRequest) {
  try {
    const serviceInfo = llmService.getServiceInfo();
    
    console.log('🧪 LLM Test: Service info:', serviceInfo);
    
    // Check if Ollama is available (if in dev mode)
    if (serviceInfo.isLocal) {
      const isOllamaAvailable = await llmService.checkOllamaAvailability();
      
      if (!isOllamaAvailable) {
        return NextResponse.json({
          success: false,
          error: 'Ollama server not available',
          serviceInfo,
          suggestion: 'Make sure Ollama is running with: ollama serve'
        }, { status: 503 });
      }
      
      // Get available models
      const availableModels = await llmService.getAvailableModels();
      
      return NextResponse.json({
        success: true,
        message: 'Local Ollama is running and available!',
        serviceInfo,
        availableModels,
        ollamaStatus: 'connected'
      });
    } else {
      // Production mode - just return service info
      return NextResponse.json({
        success: true,
        message: 'Using OpenAI API',
        serviceInfo,
        openaiStatus: 'configured'
      });
    }
    
  } catch (error) {
    console.error('LLM Test error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to test LLM service',
      details: error instanceof Error ? error.message : 'Unknown error',
      serviceInfo: llmService.getServiceInfo()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message = "Hello, this is a test message. Please respond briefly." } = await request.json();
    
    console.log('🧪 LLM Test: Testing chat completion...');
    
    const startTime = Date.now();
    
    const response = await llmService.chatCompletion(
      [{ role: 'user', content: message }],
      {
        system_prompt: 'You are a helpful assistant. Respond briefly and confirm you are working properly.',
        temperature: 0.7,
        max_tokens: 100,
      }
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`🧪 LLM Test: Response received in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      message: 'LLM service is working!',
      response: {
        content: response.content,
        model: response.model,
        usage: response.usage
      },
      testInfo: {
        duration: `${duration}ms`,
        serviceInfo: llmService.getServiceInfo()
      }
    });
    
  } catch (error) {
    console.error('LLM Test error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to test LLM chat completion',
      details: error instanceof Error ? error.message : 'Unknown error',
      serviceInfo: llmService.getServiceInfo()
    }, { status: 500 });
  }
}

