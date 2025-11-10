# Qwen3-14B Optimal Parameters Configuration

## Overview
This document describes the optimal sampling parameters configured for the Qwen3-14B quantized model (Q5_K_M) used in development mode with Ollama.

## Model Information
- **Model**: `dengcao/Qwen3-14B:Q5_K_M`
- **Endpoint**: Ollama (`http://127.0.0.1:11434`)
- **Environment**: Development only (`NODE_ENV=development`)

## Parameter Settings

### Thinking Mode (`thinking_mode: true`)
Used for complex reasoning tasks requiring deeper analysis:

| Parameter | Value | Description |
|-----------|-------|-------------|
| Temperature | 0.6 | Lower temperature for more focused, deterministic outputs |
| TopP | 0.95 | Nucleus sampling - considers tokens with 95% cumulative probability |
| TopK | 20 | Only consider top 20 most likely tokens |
| MinP | 0 | Minimum probability threshold (disabled) |
| PresencePenalty | 1.5 | Strong penalty to suppress repetitive outputs |

**⚠️ Important**: DO NOT use greedy decoding (temperature=0), as it can lead to performance degradation and endless repetitions.

### Non-Thinking Mode (`thinking_mode: false`)
Used for standard responses and content generation:

| Parameter | Value | Description |
|-----------|-------|-------------|
| Temperature | 0.7 | Slightly higher temperature for more creative outputs |
| TopP | 0.8 | Nucleus sampling - considers tokens with 80% cumulative probability |
| TopK | 20 | Only consider top 20 most likely tokens |
| MinP | 0 | Minimum probability threshold (disabled) |
| PresencePenalty | 1.5 | Strong penalty to suppress repetitive outputs |

## Implementation

The parameters are automatically applied in `src/services/llm.service.ts` when using Ollama:

```typescript
// Enable thinking mode for complex tasks
const response = await llmService.chatCompletion(
  messages,
  {
    model: 'dengcao/Qwen3-14B:Q5_K_M',
    thinking_mode: true, // Use optimal thinking mode params
    temperature: 0.7, // Can override if needed
    max_tokens: 2000
  }
);
```

## Usage Guidelines

### When to Use Thinking Mode
- Complex reasoning tasks
- Technical analysis
- Problem-solving requiring step-by-step logic
- Code generation and refactoring
- Mathematical computations

### When to Use Non-Thinking Mode
- Creative writing and content generation
- Conversational responses
- Summarization
- Translation
- General Q&A

## Ollama Mapping

Ollama parameter names differ from OpenAI:

| Standard | Ollama Equivalent |
|----------|------------------|
| `presence_penalty` | `repeat_penalty` |
| `min_p` | `mirostat` (0 to disable) |
| `max_tokens` | `num_predict` |

## Performance Notes

- **Presence Penalty**: Set to 1.5 for quantized models to suppress repetitive outputs. Can be adjusted between 0 and 2. Higher values may occasionally lead to:
  - Language mixing
  - Slight reduction in model performance
  
- **Greedy Decoding**: Avoid using temperature=0 or greedy decoding with this model, as it significantly degrades performance and can cause infinite loops.

## Environment Variables

Ensure these are set in your `.env` file:

```bash
NODE_ENV=development
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=dengcao/Qwen3-14B:Q5_K_M
```

## Testing

To verify the parameters are working:

1. Start Ollama: `ollama serve`
2. Pull the model: `ollama pull dengcao/Qwen3-14B:Q5_K_M`
3. Run your application in development mode
4. Check the console logs for: `🦙 LLM Service: Using local Ollama`
5. Monitor responses for quality and lack of repetition

## Troubleshooting

### Model Repeating Itself
- Ensure `repeat_penalty` is set to 1.5
- Verify you're not using greedy decoding (temp > 0)
- Try increasing presence penalty to 1.8 (max 2.0)

### Responses Too Conservative
- Switch to non-thinking mode
- Slightly increase temperature (0.7 → 0.8)
- Increase TopP (0.8 → 0.9)

### Language Mixing
- Reduce presence penalty (1.5 → 1.2)
- Add explicit language instruction in system prompt

## References

- [Qwen3 Official Documentation](https://github.com/QwenLM/Qwen)
- [Ollama Parameters Guide](https://github.com/ollama/ollama/blob/main/docs/modelfile.md#parameter)
- Model Card: `dengcao/Qwen3-14B:Q5_K_M` on Ollama


