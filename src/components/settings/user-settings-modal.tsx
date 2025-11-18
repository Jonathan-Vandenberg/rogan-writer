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
import { Loader2, CheckCircle, AlertCircle, Key, Sparkles, HelpCircle, Lightbulb } from "lucide-react"

interface UserSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface OpenRouterSettings {
  openRouterApiKey: string | null
  openRouterEmbeddingModel: string | null
  openRouterResearchModel: string | null
  openRouterSuggestionsModel: string | null
  openRouterDefaultModel: string | null
  isConfigured: boolean
  // Temperature settings (0-1, where 0.7 is default)
  defaultModelTemperature?: number
  researchModelTemperature?: number
  suggestionsModelTemperature?: number
}

interface OpenRouterModel {
  id: string
  name: string
  description?: string
}

export function UserSettingsModal({ open, onOpenChange }: UserSettingsModalProps) {
  const [settings, setSettings] = React.useState<OpenRouterSettings>({
    openRouterApiKey: null,
    openRouterEmbeddingModel: null,
    openRouterResearchModel: null,
    openRouterSuggestionsModel: null,
    openRouterDefaultModel: null,
    isConfigured: false,
    defaultModelTemperature: 0.7,
    researchModelTemperature: 0.3,
    suggestionsModelTemperature: 0.8,
  })

  const [apiKeyInput, setApiKeyInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTestingKey, setIsTestingKey] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null)
  const [chatModels, setChatModels] = React.useState<OpenRouterModel[]>([])
  const [embeddingModels, setEmbeddingModels] = React.useState<OpenRouterModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = React.useState(false)

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
          defaultModelTemperature: data.defaultModelTemperature ?? 0.7,
          researchModelTemperature: data.researchModelTemperature ?? 0.3,
          suggestionsModelTemperature: data.suggestionsModelTemperature ?? 0.8,
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
        openRouterResearchModel: settings.openRouterResearchModel,
        openRouterSuggestionsModel: settings.openRouterSuggestionsModel,
        openRouterDefaultModel: settings.openRouterDefaultModel,
        defaultModelTemperature: settings.defaultModelTemperature,
        researchModelTemperature: settings.researchModelTemperature,
        suggestionsModelTemperature: settings.suggestionsModelTemperature,
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
        setSettings(data)
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
            {/* Show if user has configured API key OR if they've typed something in the input */}
            {(settings.isConfigured || apiKeyInput.trim()) && (
              <div className="space-y-4">
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

                {/* Default LLM Model */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="default-model">Default LLM Model</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Used for general AI chat, book Q&A, and content analysis. Choose a balanced model like GPT-4 or Claude for accuracy and reasoning.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={settings.openRouterDefaultModel || ""}
                    onValueChange={(value) =>
                      setSettings({ ...settings, openRouterDefaultModel: value })
                    }
                    disabled={isLoadingModels}
                  >
                    <SelectTrigger id="default-model">
                      <SelectValue placeholder="Select default model" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {isLoadingModels ? "Loading models..." : "No models available"}
                        </div>
                      ) : (
                        chatModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name || model.id}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Temperature (Creativity)</span>
                      <span className="font-medium">{Math.round((settings.defaultModelTemperature || 0.7) * 100)}%</span>
                    </div>
                    <Slider
                      value={[settings.defaultModelTemperature || 0.7]}
                      onValueChange={([value]) => setSettings({ ...settings, defaultModelTemperature: value })}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower (0-0.5): More factual and consistent. Higher (0.7-1.0): More creative and varied.
                    </p>
                  </div>
                </div>

                {/* Embeddings Model */}
                <div className="space-y-2">
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
                  <Select
                    value={settings.openRouterEmbeddingModel || ""}
                    onValueChange={(value) =>
                      setSettings({ ...settings, openRouterEmbeddingModel: value })
                    }
                    disabled={isLoadingModels}
                  >
                    <SelectTrigger id="embedding-model">
                      <SelectValue placeholder="Select embeddings model" />
                    </SelectTrigger>
                    <SelectContent>
                      {embeddingModels.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {isLoadingModels ? "Loading models..." : "No embedding models available"}
                        </div>
                      ) : (
                        embeddingModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name || model.id}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Alert className="mt-2">
                    <Lightbulb className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Embeddings don't use temperature. Choose a model optimized for semantic understanding.
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Research Model */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="research-model">Research Model</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Used for factual research, fact-checking, and information retrieval. Choose a model with strong reasoning like GPT-4 or Claude. Lower temperature recommended for accuracy.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={settings.openRouterResearchModel || ""}
                    onValueChange={(value) =>
                      setSettings({ ...settings, openRouterResearchModel: value })
                    }
                    disabled={isLoadingModels}
                  >
                    <SelectTrigger id="research-model">
                      <SelectValue placeholder="Select research model" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {isLoadingModels ? "Loading models..." : "No models available"}
                        </div>
                      ) : (
                        chatModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name || model.id}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Temperature (Creativity)</span>
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
                    <p className="text-xs text-muted-foreground">
                      Lower temperature (0.2-0.4) recommended for factual accuracy and consistency.
                    </p>
                  </div>
                </div>

                {/* Suggestions Model */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="suggestions-model">Suggestions Model</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Used for creative suggestions: character ideas, plot points, locations, brainstorming. Choose a creative model like GPT-4 or Claude Sonnet. Higher temperature recommended for more diverse ideas.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={settings.openRouterSuggestionsModel || ""}
                    onValueChange={(value) =>
                      setSettings({ ...settings, openRouterSuggestionsModel: value })
                    }
                    disabled={isLoadingModels}
                  >
                    <SelectTrigger id="suggestions-model">
                      <SelectValue placeholder="Select suggestions model" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatModels.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {isLoadingModels ? "Loading models..." : "No models available"}
                        </div>
                      ) : (
                        chatModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name || model.id}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Temperature (Creativity)</span>
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
                    <p className="text-xs text-muted-foreground">
                      Higher temperature (0.7-1.0) recommended for more creative and diverse suggestions.
                    </p>
                  </div>
                </div>

                {isLoadingModels && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading available models...
                  </div>
                )}
              </div>
            )}

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

