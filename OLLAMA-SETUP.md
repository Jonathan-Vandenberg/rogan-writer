# 🦙 Local LLM Setup with Ollama

This document explains how to set up local LLM development using Ollama instead of OpenAI.

## 🎯 Overview

When `NODE_ENV=development`, the application will automatically switch from OpenAI to your local Ollama instance for all AI operations including:

- ✅ **AI Agents** (Character, Plot, Location, Timeline, Scene, Brainstorming)
- ✅ **Draft Generation** (Book content creation)
- ✅ **AI Chat** (Book Q&A assistant)
- ✅ **Comprehensive Analysis** (Cross-module suggestions)

**Note**: Embeddings still use OpenAI even in development mode for consistency and quality.

## 🚀 Setup Instructions

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Or download from https://ollama.com
```

### 2. Start Ollama Server

```bash
ollama serve
```

You should see output like:
```
time=2025-11-09T11:55:13.155+07:00 level=INFO source=routes.go:1528 msg="Listening on 127.0.0.1:11434 (version 0.12.3)"
```

### 3. Pull a Model (Recommended)

```bash
# Download Llama 3.1 8B (default model)
ollama pull llama3.1:8b

# Or other good options:
ollama pull llama3.1:70b    # Larger, better quality (requires more RAM)
ollama pull qwen2.5:7b      # Fast alternative
ollama pull mistral:7b      # Another good option
```

### 4. Environment Variables

Add these to your `.env.local`:

```bash
# Development mode (enables Ollama)
NODE_ENV=development

# Ollama configuration (optional - these are defaults)
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b

# Keep your OpenAI key for embeddings
OPENAI_API_KEY=your_openai_key_here
```

## 📋 Available Models

List your installed models:
```bash
ollama list
```

Popular models for creative writing:
- **`llama3.1:8b`** - Balanced performance/quality ⭐
- **`llama3.1:70b`** - Best quality (requires 40GB+ RAM)
- **`qwen2.5:7b`** - Fast and good for coding
- **`mistral:7b`** - Good alternative, faster
- **`codellama:7b`** - If you need code generation

## 🧪 Testing Setup

### Test API Endpoint

**GET** `/api/llm/test` - Check service status:
```bash
curl http://localhost:3000/api/llm/test
```

**POST** `/api/llm/test` - Test chat completion:
```bash
curl -X POST http://localhost:3000/api/llm/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, are you working?"}'
```

### Expected Response (Development)
```json
{
  "success": true,
  "message": "Local Ollama is running and available!",
  "serviceInfo": {
    "isLocal": true,
    "endpoint": "http://127.0.0.1:11434",
    "defaultModel": "llama3.1:8b",
    "environment": "development"
  },
  "availableModels": ["llama3.1:8b", "qwen2.5:7b"],
  "ollamaStatus": "connected"
}
```

## 🔄 Switching Between OpenAI and Ollama

The system automatically switches based on `NODE_ENV`:

- **Development** (`NODE_ENV=development`) → Ollama
- **Production** (`NODE_ENV=production`) → OpenAI

## 📊 Performance Comparison

| Model | Speed | Quality | RAM Usage | Use Case |
|-------|-------|---------|-----------|----------|
| llama3.1:8b | ⭐⭐⭐ | ⭐⭐⭐⭐ | ~8GB | **Recommended** |
| llama3.1:70b | ⭐ | ⭐⭐⭐⭐⭐ | ~40GB | High quality |
| qwen2.5:7b | ⭐⭐⭐⭐ | ⭐⭐⭐ | ~6GB | Fast development |
| mistral:7b | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ~6GB | Good alternative |

## 🛠️ Troubleshooting

### Ollama Not Found
```bash
# Check if Ollama is running
curl http://127.0.0.1:11434/api/tags

# If not running, start it
ollama serve
```

### Model Not Found
```bash
# List available models
ollama list

# Pull the default model
ollama pull llama3.1:8b
```

### Memory Issues
```bash
# Use smaller model
ollama pull qwen2.5:7b

# Set in environment
OLLAMA_MODEL=qwen2.5:7b
```

### Port Conflicts
```bash
# Change Ollama port
OLLAMA_HOST=http://127.0.0.1:11435 ollama serve

# Update environment
OLLAMA_BASE_URL=http://127.0.0.1:11435
```

## 💡 Development Tips

1. **Keep Ollama Running**: Start `ollama serve` before running your dev server
2. **Model Selection**: Use `llama3.1:8b` for the best balance of speed/quality
3. **Test Endpoint**: Use `/api/llm/test` to verify everything is working
4. **Monitor Logs**: Watch console for LLM service initialization messages
5. **Fallback**: If Ollama fails, set `NODE_ENV=production` to use OpenAI

## 🔍 Logs to Watch For

When starting your app, you should see:
```
🦙 LLM Service: Using local Ollama at http://127.0.0.1:11434
🎯 Default model: llama3.1:8b
🤖 CharacterAgent: Using Ollama (llama3.1:8b)
🤖 DraftAgent: Using Ollama (llama3.1:8b)
🤖 AIAnalysisService: Using Ollama (llama3.1:8b)
```

## ⚠️ Important Notes

- **Embeddings**: Always use OpenAI embeddings (even in dev) for consistency
- **API Keys**: You still need `OPENAI_API_KEY` for embeddings
- **Performance**: Local models may be slower than OpenAI API
- **Quality**: Results may vary between models
- **RAM**: Ensure you have enough RAM for your chosen model

## 🎉 Benefits

- ✅ **No API Costs** during development
- ✅ **Offline Development** capability  
- ✅ **Privacy** - data stays local
- ✅ **Experimentation** with different models
- ✅ **Consistent Environment** switching
