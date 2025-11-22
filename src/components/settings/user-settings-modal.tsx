"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Slider } from "@/components/ui/slider"
import { ModelCombobox } from "@/components/ui/model-combobox"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CheckCircle, AlertCircle, Key, Sparkles, HelpCircle, Lightbulb, Mic } from "lucide-react"

interface UserSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface OpenRouterSettings {
  openRouterApiKey: string | null
  openRouterEmbeddingModel: string | null
  openRouterEditorModel: string | null
  openRouterResearchModel: string | null
  openRouterSuggestionsModel: string | null
  openRouterChatModel: string | null
  openRouterTTSModel: string | null
  openRouterSTTModel: string | null
  openRouterImageModel: string | null
  isConfigured: boolean
  // Temperature settings (0-1, where 0.7 is default)
  editorModelTemperature?: number
  researchModelTemperature?: number
  suggestionsModelTemperature?: number
  chatModelTemperature?: number
  // TTS settings
  ttsVoice?: string
  ttsModel?: string
  // Model preferences per agent
  modelPreferences?: Record<string, Record<string, { thinking?: boolean; temperature?: number }>>
}

interface OpenRouterModel {
  id: string
  name: string
  description?: string
}

interface ModelOptions {
  supportsThinking: boolean
  supportsTemperature: boolean
  supportsTopP: boolean
  supportsMaxTokens: boolean
}

interface ModelDetails {
  model: OpenRouterModel & { context_length?: number }
  options: ModelOptions
}

interface ModelOptionsDisplayProps {
  agentType: string
  modelId: string
  modelDetailsCache: Record<string, Record<string, ModelDetails>>
  loadingModelDetails: Record<string, boolean>
  loadModelDetails: (agentType: string, modelId: string) => Promise<void>
  getModelPreference: (agentType: string, modelId: string, key: string) => any
  updateModelPreference: (agentType: string, modelId: string, key: string, value: any) => void
  defaultTemperature: number
}

function ModelOptionsDisplay({
  agentType,
  modelId,
  modelDetailsCache,
  loadingModelDetails,
  loadModelDetails,
  getModelPreference,
  updateModelPreference,
  defaultTemperature,
}: ModelOptionsDisplayProps) {
  const details = modelDetailsCache[agentType]?.[modelId]
  const isLoading = loadingModelDetails[`${agentType}-${modelId}`]
  const thinkingEnabled = getModelPreference(agentType, modelId, 'thinking') ?? false

  // Load details if not cached and not loading
  React.useEffect(() => {
    if (!details && !isLoading && modelId) {
      loadModelDetails(agentType, modelId)
    }
  }, [agentType, modelId, details, isLoading])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading model options...
      </div>
    )
  }

  if (!details) {
    return null
  }

  return (
    <div className="space-y-3 pt-2 border-t">
      {details.options.supportsThinking && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`${agentType}-thinking`}
            checked={thinkingEnabled}
            onCheckedChange={(checked) =>
              updateModelPreference(agentType, modelId, 'thinking', checked)
            }
          />
          <Label htmlFor={`${agentType}-thinking`} className="text-sm font-normal cursor-pointer">
            Enable thinking mode
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Thinking mode enables deeper reasoning for complex tasks. May increase response time and token usage.</p>
              </TooltipContent>
            </Tooltip>
          </Label>
        </div>
      )}
      {details.options.supportsTemperature && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Temperature (Creativity)</span>
            <span className="font-medium">
              {Math.round((getModelPreference(agentType, modelId, 'temperature') ?? defaultTemperature) * 100)}%
            </span>
          </div>
          <Slider
            value={[getModelPreference(agentType, modelId, 'temperature') ?? defaultTemperature]}
            onValueChange={([value]) => updateModelPreference(agentType, modelId, 'temperature', value)}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Override default temperature for this model. Lower (0-0.5): More factual. Higher (0.7-1.0): More creative.
          </p>
        </div>
      )}
    </div>
  )
}

export function UserSettingsModal({ open, onOpenChange }: UserSettingsModalProps) {
  const [settings, setSettings] = React.useState<OpenRouterSettings>({
    openRouterApiKey: null,
    openRouterEmbeddingModel: null,
    openRouterEditorModel: null,
    openRouterResearchModel: null,
    openRouterSuggestionsModel: null,
    openRouterChatModel: null,
    openRouterTTSModel: null,
    openRouterSTTModel: null,
    openRouterImageModel: null,
    isConfigured: false,
    editorModelTemperature: 0.7,
    researchModelTemperature: 0.3,
    suggestionsModelTemperature: 0.8,
    chatModelTemperature: 0.7,
    ttsVoice: 'alloy',
    ttsModel: 'tts-1',
  })

  const [apiKeyInput, setApiKeyInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTestingKey, setIsTestingKey] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null)
  const [chatModels, setChatModels] = React.useState<OpenRouterModel[]>([])
  const [embeddingModels, setEmbeddingModels] = React.useState<OpenRouterModel[]>([])
  const [imageModels, setImageModels] = React.useState<OpenRouterModel[]>([])
  const [sttModels, setSttModels] = React.useState<OpenRouterModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = React.useState(false)
  const [imageModelsError, setImageModelsError] = React.useState<string | null>(null)
  const [sttModelsError, setSttModelsError] = React.useState<string | null>(null)
  // Model details cache: agentType -> modelId -> ModelDetails
  const [modelDetailsCache, setModelDetailsCache] = React.useState<Record<string, Record<string, ModelDetails>>>({})
  const [loadingModelDetails, setLoadingModelDetails] = React.useState<Record<string, boolean>>({})
  
  // TTS voices cache: model -> voices[]
  const [ttsVoicesCache, setTtsVoicesCache] = React.useState<Record<string, Array<{ value: string; label: string; description?: string }>>>({})
  const [loadingTtsVoices, setLoadingTtsVoices] = React.useState(false)

  // Load settings when modal opens
  React.useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/user/settings')
      if (response.ok) {
        const data = await response.json()
        console.log('Loaded settings:', { isConfigured: data.isConfigured, hasApiKey: !!data.openRouterApiKey })
        setSettings({
          ...data,
          editorModelTemperature: data.editorModelTemperature ?? 0.7,
          researchModelTemperature: data.researchModelTemperature ?? 0.3,
          suggestionsModelTemperature: data.suggestionsModelTemperature ?? 0.8,
          chatModelTemperature: data.chatModelTemperature ?? 0.7,
          ttsVoice: data.ttsVoice ?? 'alloy',
          ttsModel: data.ttsModel ?? 'tts-1',
          openRouterTTSModel: data.openRouterTTSModel || data.ttsModel || null,
          openRouterSTTModel: data.openRouterSTTModel || null,
          openRouterImageModel: data.openRouterImageModel || null,
          modelPreferences: data.modelPreferences || {},
        })
        // Always start with empty input - user can enter new key to update
        setApiKeyInput("")
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadModelDetails = async (agentType: string, modelId: string) => {
    if (!modelId || loadingModelDetails[`${agentType}-${modelId}`]) {
      return
    }

    // Check cache first
    if (modelDetailsCache[agentType]?.[modelId]) {
      return
    }

    setLoadingModelDetails(prev => ({ ...prev, [`${agentType}-${modelId}`]: true }))
    try {
      const response = await fetch(`/api/user/settings/model-details?modelId=${encodeURIComponent(modelId)}`)
      if (response.ok) {
        const data: ModelDetails = await response.json()
        setModelDetailsCache(prev => ({
          ...prev,
          [agentType]: {
            ...prev[agentType],
            [modelId]: data,
          },
        }))
      }
    } catch (error) {
      console.error('Error loading model details:', error)
    } finally {
      setLoadingModelDetails(prev => {
        const newState = { ...prev }
        delete newState[`${agentType}-${modelId}`]
        return newState
      })
    }
  }

  const updateModelPreference = (agentType: string, modelId: string, key: string, value: any) => {
    if (!modelId) return

    setSettings(prev => {
      const preferences = prev.modelPreferences || {}
      const agentPrefs = preferences[agentType] || {}
      const modelPrefs = agentPrefs[modelId] || {}

      return {
        ...prev,
        modelPreferences: {
          ...preferences,
          [agentType]: {
            ...agentPrefs,
            [modelId]: {
              ...modelPrefs,
              [key]: value,
            },
          },
        },
      }
    })
  }

  const getModelPreference = (agentType: string, modelId: string, key: string): any => {
    if (!modelId || !settings.modelPreferences) return undefined
    const agentPrefs = settings.modelPreferences[agentType]
    if (!agentPrefs) return undefined
    const modelPrefs = agentPrefs[modelId]
    if (!modelPrefs) return undefined
    return (modelPrefs as Record<string, any>)[key]
  }

  const loadTTSVoices = async (model: string) => {
    if (!model || loadingTtsVoices || ttsVoicesCache[model]) {
      return
    }

    setLoadingTtsVoices(true)
    try {
      const response = await fetch(`/api/user/settings/tts-voices?model=${encodeURIComponent(model)}`)
      if (response.ok) {
        const data = await response.json()
        setTtsVoicesCache(prev => ({
          ...prev,
          [model]: data.voices || [],
        }))
      }
    } catch (error) {
      console.error('Error loading TTS voices:', error)
    } finally {
      setLoadingTtsVoices(false)
    }
  }

  // Load voices when TTS model changes
  React.useEffect(() => {
    const ttsModel = settings.openRouterTTSModel || settings.ttsModel
    if (ttsModel) {
      loadTTSVoices(ttsModel)
    }
  }, [settings.openRouterTTSModel, settings.ttsModel])

  const loadModels = async () => {
    const keyToUse = apiKeyInput.trim()
    if (!keyToUse && !settings.isConfigured) {
      console.log('No API key available to load models')
      return
    }

    setIsLoadingModels(true)
    try {
      // Build query params - include API key if testing, otherwise use saved key
      const params = new URLSearchParams()
      params.append('type', 'chat')
      if (keyToUse) {
        params.append('apiKey', keyToUse)
      }

      // Fetch chat models
      const chatResponse = await fetch(`/api/user/settings/models?${params.toString()}`)
      if (chatResponse.ok) {
        const chatData = await chatResponse.json()
        console.log('Chat models loaded:', chatData.models?.length || 0)
        setChatModels(chatData.models || [])
      } else {
        const errorData = await chatResponse.json().catch(() => ({}))
        console.error('Failed to load chat models:', errorData)
      }

      // Fetch embedding models
      params.set('type', 'embeddings')
      const embedResponse = await fetch(`/api/user/settings/models?${params.toString()}`)
      if (embedResponse.ok) {
        const embedData = await embedResponse.json()
        console.log('Embedding models loaded:', embedData.models?.length || 0)
        setEmbeddingModels(embedData.models || [])
      } else {
        const errorData = await embedResponse.json().catch(() => ({}))
        console.error('Failed to load embedding models:', errorData)
      }

      // Fetch image models
      params.set('type', 'images')
      setImageModelsError(null) // Clear previous error
      const imageResponse = await fetch(`/api/user/settings/models?${params.toString()}`)
      if (imageResponse.ok) {
        const imageData = await imageResponse.json()
        console.log('Image models loaded:', imageData.models?.length || 0)
        const models = imageData.models || []
        setImageModels(models)
        if (models.length === 0) {
          setImageModelsError('No image generation models found. OpenRouter may not have any image models available, or they may not be properly tagged. You can still manually enter a model ID if you know one.')
        }
      } else {
        const errorData = await imageResponse.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || 'Failed to load image models'
        console.error('Failed to load image models:', errorData)
        setImageModelsError(errorMessage)
        setImageModels([]) // Clear models on error
      }

      // Fetch all models for STT (user will select manually)
      params.set('type', 'all')
      setSttModelsError(null) // Clear previous error
      const sttResponse = await fetch(`/api/user/settings/models?${params.toString()}`)
      if (sttResponse.ok) {
        const sttData = await sttResponse.json()
        console.log('All models loaded for STT selection:', sttData.models?.length || 0)
        const models = sttData.models || []
        setSttModels(models)
        if (models.length === 0) {
          setSttModelsError('No models found. Please check your API key and try again.')
        }
      } else {
        const errorData = await sttResponse.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || 'Failed to load models'
        console.error('Failed to load models:', errorData)
        setSttModelsError(errorMessage)
        setSttModels([]) // Clear models on error
      }
    } catch (error) {
      console.error('Error loading models:', error)
    } finally {
      setIsLoadingModels(false)
    }
  }

  // Load models when API key is configured or entered
  React.useEffect(() => {
    if (open && settings.isConfigured && !isLoading) {
      // Load models if API key is already configured (after settings have loaded)
      console.log('Auto-loading models because API key is configured')
      loadModels()
    }
    // Note: We don't auto-load when typing API key - user should click "Test" first
  }, [open, settings.isConfigured, isLoading])

  // Auto-load models when modal opens if API key is configured
  React.useEffect(() => {
    if (open && settings.isConfigured && chatModels.length === 0 && !isLoadingModels) {
      console.log('Auto-loading models on modal open')
      loadModels()
    }
  }, [open, settings.isConfigured])

  const testApiKey = async () => {
    if (!apiKeyInput.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key first' })
      return
    }

    setIsTestingKey(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/user/settings/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      })

      const data = await response.json()
      if (data.valid) {
        setTestResult({ success: true, message: 'API key is valid! Loading models...' })
        // Reload models after successful test
        await loadModels()
      } else {
        setTestResult({ success: false, message: data.error || 'Invalid API key' })
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to test API key' })
    } finally {
      setIsTestingKey(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Only include API key in request if user entered a new one
      // If empty, don't send it so the API preserves the existing key
      const requestBody: any = {
        openRouterEmbeddingModel: settings.openRouterEmbeddingModel,
        openRouterEditorModel: settings.openRouterEditorModel,
        openRouterResearchModel: settings.openRouterResearchModel,
        openRouterSuggestionsModel: settings.openRouterSuggestionsModel,
        openRouterChatModel: settings.openRouterChatModel,
        openRouterTTSModel: settings.openRouterTTSModel,
        openRouterSTTModel: settings.openRouterSTTModel,
        openRouterImageModel: settings.openRouterImageModel,
        editorModelTemperature: settings.editorModelTemperature,
        researchModelTemperature: settings.researchModelTemperature,
        suggestionsModelTemperature: settings.suggestionsModelTemperature,
        chatModelTemperature: settings.chatModelTemperature,
        ttsVoice: settings.ttsVoice,
        ttsModel: settings.ttsModel,
        modelPreferences: settings.modelPreferences || {},
      }
      
      // Only include API key if user entered something new
      if (apiKeyInput.trim()) {
        requestBody.openRouterApiKey = apiKeyInput.trim()
      }
      // If empty and user wants to clear it, they can explicitly set it to null
      // Otherwise, we don't send it and the API preserves the existing key
      
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings({
          ...data,
          modelPreferences: data.modelPreferences || {},
        })
        setApiKeyInput("")
        setTestResult(null)
        // Close modal immediately - Radix Dialog handles cleanup
        onOpenChange(false)
      } else {
        const error = await response.json()
        setTestResult({ success: false, message: error.error || 'Failed to save settings' })
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to save settings' })
    } finally {
      setIsSaving(false)
    }
  }


  return (
    <>
      {open && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent 
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
          >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            OpenRouter API Settings
          </DialogTitle>
          <DialogDescription>
            Configure your OpenRouter API key to use custom AI models for embeddings, research, and suggestions.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* API Key Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">OpenRouter API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type="password"
                    placeholder={settings.isConfigured ? "Enter new API key (leave blank to keep current)" : "sk-or-v1-..."}
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value)
                      setTestResult(null)
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testApiKey}
                    disabled={isTestingKey || !apiKeyInput.trim()}
                  >
                    {isTestingKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Test"
                    )}
                  </Button>
                </div>
                {settings.isConfigured && (
                  <p className="text-xs text-muted-foreground">
                    API key is configured. Enter a new key to update it.
                  </p>
                )}
                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{testResult.message}</AlertDescription>
                  </Alert>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Get your API key from{" "}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    openrouter.ai/keys
                  </a>
                  . Your API key is encrypted and stored securely.
                </AlertDescription>
              </Alert>
            </div>

            {/* Model Selection Section */}
            {/* Always show - user can configure models even if they haven't entered an API key yet */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4" />
                    Model Preferences
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadModels}
                    disabled={isLoadingModels || (!apiKeyInput.trim() && !settings.isConfigured)}
                  >
                    {isLoadingModels ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Refresh Models"
                    )}
                  </Button>
                </div>

                {/* AI Agents Section */}
                <div className="space-y-8 border-t pt-4">
                  <h3 className="text-sm font-semibold mb-4">AI Agents</h3>

                  {/* Editor Agent Model */}
                  <div className="space-y-2 border-l-3 border-l-blue-500 pl-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="editor-model" className="font-semibold">Editor Agent - LLM Model</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Used for the AI editor agent that helps edit your book chapters. Select any available chat model from OpenRouter.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <ModelCombobox
                      id="editor-model"
                      models={chatModels}
                      value={settings.openRouterEditorModel || ""}
                      onValueChange={(value) => {
                        setSettings({ ...settings, openRouterEditorModel: value })
                        if (value) {
                          loadModelDetails('editor', value)
                        }
                      }}
                      placeholder={chatModels.length === 0 ? (isLoadingModels ? "Loading models..." : "Click to load models") : "Select LLM model"}
                      disabled={isLoadingModels}
                      emptyMessage={isLoadingModels ? "Loading models..." : chatModels.length === 0 ? "Click 'Refresh Models' button above to load available models" : "No models available"}
                      showFreeFilter={true}
                    />
                    {chatModels.length === 0 && !isLoadingModels && settings.isConfigured && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Click the "Refresh Models" button above to load available LLM models.
                      </p>
                    )}
                    {settings.openRouterEditorModel && (
                      <ModelOptionsDisplay
                        agentType="editor"
                        modelId={settings.openRouterEditorModel}
                        modelDetailsCache={modelDetailsCache}
                        loadingModelDetails={loadingModelDetails}
                        loadModelDetails={loadModelDetails}
                        getModelPreference={getModelPreference}
                        updateModelPreference={updateModelPreference}
                        defaultTemperature={settings.editorModelTemperature ?? 0.7}
                      />
                    )}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Default Temperature</span>
                        <span className="font-medium">{Math.round((settings.editorModelTemperature || 0.7) * 100)}%</span>
                      </div>
                      <Slider
                        value={[settings.editorModelTemperature || 0.7]}
                        onValueChange={([value]) => setSettings({ ...settings, editorModelTemperature: value })}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Research Model */}
                  <div className="space-y-2 border-l-3 border-l-green-500 pl-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="research-model" className="font-semibold">Research Agent - LLM Model</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Used for factual research, fact-checking, and information retrieval. Choose a model with strong reasoning like GPT-4 or Claude. Lower temperature recommended for accuracy.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <ModelCombobox
                      id="research-model"
                      models={chatModels}
                      value={settings.openRouterResearchModel || ""}
                      onValueChange={(value) => {
                        setSettings({ ...settings, openRouterResearchModel: value })
                        if (value) {
                          loadModelDetails('research', value)
                        }
                      }}
                      placeholder={chatModels.length === 0 ? (isLoadingModels ? "Loading models..." : "Click to load models") : "Select LLM model"}
                      disabled={isLoadingModels}
                      emptyMessage={isLoadingModels ? "Loading models..." : chatModels.length === 0 ? "Click 'Refresh Models' button above to load available models" : "No models available"}
                      showFreeFilter={true}
                    />
                    {settings.openRouterResearchModel && (
                      <ModelOptionsDisplay
                        agentType="research"
                        modelId={settings.openRouterResearchModel}
                        modelDetailsCache={modelDetailsCache}
                        loadingModelDetails={loadingModelDetails}
                        loadModelDetails={loadModelDetails}
                        getModelPreference={getModelPreference}
                        updateModelPreference={updateModelPreference}
                        defaultTemperature={settings.researchModelTemperature ?? 0.3}
                      />
                    )}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Default Temperature</span>
                        <span className="font-medium">{Math.round((settings.researchModelTemperature || 0.3) * 100)}%</span>
                      </div>
                      <Slider
                        value={[settings.researchModelTemperature || 0.3]}
                        onValueChange={([value]) => setSettings({ ...settings, researchModelTemperature: value })}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Suggestions Model */}
                  <div className="space-y-2 border-l-3 border-l-yellow-500 pl-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="suggestions-model" className="font-semibold">Suggestions Agent - LLM Model</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Used for creative suggestions: character ideas, plot points, locations, brainstorming. Choose a creative model like GPT-4 or Claude Sonnet. Higher temperature recommended for more diverse ideas.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <ModelCombobox
                      id="suggestions-model"
                      models={chatModels}
                      value={settings.openRouterSuggestionsModel || ""}
                      onValueChange={(value) => {
                        setSettings({ ...settings, openRouterSuggestionsModel: value })
                        if (value) {
                          loadModelDetails('suggestions', value)
                        }
                      }}
                      placeholder={chatModels.length === 0 ? (isLoadingModels ? "Loading models..." : "Click to load models") : "Select LLM model"}
                      disabled={isLoadingModels}
                      emptyMessage={isLoadingModels ? "Loading models..." : chatModels.length === 0 ? "Click 'Refresh Models' button above to load available models" : "No models available"}
                      showFreeFilter={true}
                    />
                    {settings.openRouterSuggestionsModel && (
                      <ModelOptionsDisplay
                        agentType="suggestions"
                        modelId={settings.openRouterSuggestionsModel}
                        modelDetailsCache={modelDetailsCache}
                        loadingModelDetails={loadingModelDetails}
                        loadModelDetails={loadModelDetails}
                        getModelPreference={getModelPreference}
                        updateModelPreference={updateModelPreference}
                        defaultTemperature={settings.suggestionsModelTemperature ?? 0.8}
                      />
                    )}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Default Temperature</span>
                        <span className="font-medium">{Math.round((settings.suggestionsModelTemperature || 0.8) * 100)}%</span>
                      </div>
                      <Slider
                        value={[settings.suggestionsModelTemperature || 0.8]}
                        onValueChange={([value]) => setSettings({ ...settings, suggestionsModelTemperature: value })}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* AI Chat Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-semibold mb-4">AI Chat</h3>
                  
                  <div className="space-y-2 border-l-3 border-l-orange-500 pl-4">
                  <div className="flex items-center gap-2">
                      <Label htmlFor="chat-model" className="font-semibold">AI Chat - LLM Model</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Used for general AI chat, book Q&A, and content analysis. Choose a balanced model like GPT-4 or Claude for accuracy and reasoning.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <ModelCombobox
                      id="chat-model"
                    models={chatModels}
                      value={settings.openRouterChatModel || ""}
                      onValueChange={(value) => {
                        setSettings({ ...settings, openRouterChatModel: value })
                        if (value) {
                          loadModelDetails('chat', value)
                        }
                      }}
                      placeholder={chatModels.length === 0 ? (isLoadingModels ? "Loading models..." : "Click to load models") : "Select LLM model"}
                    disabled={isLoadingModels}
                      emptyMessage={isLoadingModels ? "Loading models..." : chatModels.length === 0 ? "Click 'Refresh Models' button above to load available models" : "No models available"}
                      showFreeFilter={true}
                    />
                    {settings.openRouterChatModel && (
                      <ModelOptionsDisplay
                        agentType="chat"
                        modelId={settings.openRouterChatModel}
                        modelDetailsCache={modelDetailsCache}
                        loadingModelDetails={loadingModelDetails}
                        loadModelDetails={loadModelDetails}
                        getModelPreference={getModelPreference}
                        updateModelPreference={updateModelPreference}
                        defaultTemperature={settings.chatModelTemperature ?? 0.7}
                      />
                    )}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Default Temperature</span>
                        <span className="font-medium">{Math.round((settings.chatModelTemperature || 0.7) * 100)}%</span>
                    </div>
                    <Slider
                        value={[settings.chatModelTemperature || 0.7]}
                        onValueChange={([value]) => setSettings({ ...settings, chatModelTemperature: value })}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                    </div>
                  </div>
                </div>

                {/* Embeddings Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-semibold mb-4">Embeddings</h3>
                  
                    <div className="space-y-2 border-l-3 border-l-gray-500 pl-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="embedding-model">Embeddings Model</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Converts text into numerical vectors for semantic search. Use specialized embedding models like text-embedding-ada-002. Temperature doesn't apply here.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <ModelCombobox
                    id="embedding-model"
                    models={embeddingModels}
                    value={settings.openRouterEmbeddingModel || ""}
                    onValueChange={(value) =>
                      setSettings({ ...settings, openRouterEmbeddingModel: value })
                    }
                    placeholder="Select embeddings model"
                    disabled={isLoadingModels}
                    emptyMessage={isLoadingModels ? "Loading models..." : "No embedding models available"}
                  />
                  <Alert className="mt-2">
                    <Lightbulb className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Embeddings don't use temperature. Choose a model optimized for semantic understanding.
                    </AlertDescription>
                  </Alert>
                  </div>
                </div>

                {/* Audiobooks / TTS Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-semibold mb-4">Audiobooks & Text-to-Speech</h3>

                  <div className="space-y-2 border-l-3 border-l-pink-500 pl-4">
                  <div className="flex items-center gap-2">
                      <Label htmlFor="tts-model" className="font-semibold">TTS Model</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                          <p>Text-to-speech model for generating audiobook narration. Options: tts-1 (cheaper) or tts-1-hd (higher quality, 2x cost).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                    <Select
                      value={settings.openRouterTTSModel || settings.ttsModel || 'tts-1'}
                      onValueChange={(value) => {
                        // Store in both fields for backward compatibility
                        setSettings({ 
                          ...settings, 
                          openRouterTTSModel: value,
                          ttsModel: value // Keep for backward compatibility
                        })
                        // Load voices for the selected model
                        if (value) {
                          loadTTSVoices(value)
                          // Reset voice if current voice is not available for new model
                          if (ttsVoicesCache[value]) {
                            const availableVoices = ttsVoicesCache[value].map(v => v.value)
                            if (settings.ttsVoice && !availableVoices.includes(settings.ttsVoice)) {
                              setSettings(prev => ({ 
                                ...prev, 
                                openRouterTTSModel: value,
                                ttsModel: value,
                                ttsVoice: availableVoices[0] || 'alloy' 
                              }))
                            }
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select TTS model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tts-1">tts-1 (Standard - $0.015/1K chars)</SelectItem>
                        <SelectItem value="tts-1-hd">tts-1-hd (HD Quality - $0.030/1K chars)</SelectItem>
                      </SelectContent>
                    </Select>
                    
                  <div className="space-y-2 pt-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="tts-voice">Voice / Speaker</Label>
                        {loadingTtsVoices && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {(() => {
                        const currentModel = settings.openRouterTTSModel || settings.ttsModel || 'tts-1'
                        const availableVoices = ttsVoicesCache[currentModel] || []
                        const currentVoice = settings.ttsVoice || 'alloy'
                        
                        // If voices haven't loaded yet, show default list
                        if (availableVoices.length === 0 && !loadingTtsVoices) {
                          return (
                            <>
                              <Select
                                value={currentVoice}
                                onValueChange={(value) => setSettings({ ...settings, ttsVoice: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select voice" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                                  <SelectItem value="echo">Echo (Male)</SelectItem>
                                  <SelectItem value="fable">Fable (Male)</SelectItem>
                                  <SelectItem value="onyx">Onyx (Male)</SelectItem>
                                  <SelectItem value="nova">Nova (Female)</SelectItem>
                                  <SelectItem value="shimmer">Shimmer (Female)</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {currentModel ? `Loading available voices for ${currentModel}...` : 'Select a TTS model above to see available voices'}
                              </p>
                            </>
                          )
                        }
                        
                        return (
                          <>
                            <Select
                              value={availableVoices.find(v => v.value === currentVoice) ? currentVoice : availableVoices[0]?.value || 'alloy'}
                              onValueChange={(value) => setSettings({ ...settings, ttsVoice: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select voice" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableVoices.map((voice) => (
                                  <SelectItem key={voice.value} value={voice.value}>
                                    {voice.label}
                                    {voice.description && ` - ${voice.description}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Available voices for {currentModel}. Each voice has a unique character and tone.
                            </p>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Speech-to-Text / Dictation Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-semibold mb-4">Speech-to-Text & Dictation</h3>

                  <div className="space-y-2 border-l-3 border-l-cyan-500 pl-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="stt-model" className="font-semibold">STT Model</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Speech-to-text model for dictation. Select any model that supports audio transcription (e.g., openai/whisper-1, openai/whisper-large-v3). Requires OpenRouter API key.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <ModelCombobox
                      id="stt-model"
                      models={sttModels}
                      value={settings.openRouterSTTModel || "openai/whisper-1"}
                      onValueChange={(value) => {
                        setSettings({ ...settings, openRouterSTTModel: value })
                      }}
                      placeholder={sttModels.length === 0 ? (isLoadingModels ? "Loading models..." : "Click to load models") : "Select STT model (all models shown)"}
                      disabled={isLoadingModels}
                      emptyMessage={isLoadingModels ? "Loading models..." : sttModels.length === 0 ? "Click 'Refresh Models' button above to load available models" : "No models available"}
                      showFreeFilter={true}
                    />
                    {sttModelsError && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {sttModelsError}
                        </AlertDescription>
                      </Alert>
                    )}
                    {!sttModelsError && sttModels.length === 0 && !isLoadingModels && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          No models found. Click "Refresh Models" above to load all available models from OpenRouter.
                        </AlertDescription>
                      </Alert>
                    )}
                    <Alert className="mt-2">
                      <Mic className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Right-click on any page in the editor and select "Dictate" to start voice input. The model will transcribe your speech and insert it at the cursor position.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>

                {/* Image Generation / Cover Art Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-semibold mb-4">Image Generation & Cover Art</h3>

                  <div className="space-y-2 border-l-3 border-l-purple-500 pl-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="image-model" className="font-semibold">Image Generation Model</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Model for generating book cover art. Options: DALL-E 3 (high quality), DALL-E 2, or other image generation models available through OpenRouter.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <ModelCombobox
                      id="image-model"
                      models={imageModels}
                      value={settings.openRouterImageModel || ""}
                      onValueChange={(value) => {
                        setSettings({ ...settings, openRouterImageModel: value })
                      }}
                      placeholder={imageModels.length === 0 ? (isLoadingModels ? "Loading models..." : "Click to load models") : "Select image generation model"}
                      disabled={isLoadingModels}
                      emptyMessage={isLoadingModels ? "Loading models..." : imageModels.length === 0 ? "Click 'Refresh Models' button above to load available models" : "No models available"}
                      showFreeFilter={true}
                    />
                    {imageModelsError && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {imageModelsError}
                        </AlertDescription>
                      </Alert>
                    )}
                    {!imageModelsError && imageModels.length === 0 && !isLoadingModels && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          No image models found. Click "Refresh Models" above to load available image generation models from OpenRouter.
                        </AlertDescription>
                      </Alert>
                    )}
                    {imageModels.length > 0 && (
                      <Alert className="mt-2">
                        <Lightbulb className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Image generation models create cover art for your books. Popular options include Flux, Stable Diffusion, and DALL-E (via OpenAI API).
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>

                {isLoadingModels && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading available models...
                  </div>
                )}
                
                {!settings.isConfigured && !apiKeyInput.trim() && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Enter and test your API key above to load available models. You can still configure model preferences below.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

            {/* Save Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

