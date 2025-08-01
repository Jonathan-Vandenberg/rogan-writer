"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Mic, 
  MicOff, 
  Square, 
  Loader2,
  AlertCircle 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSpeechToText, SpeechToTextProvider } from "@/hooks/use-speech-to-text"

interface MicrophoneButtonProps {
  provider: SpeechToTextProvider
  language?: string
  autoInsert?: boolean
  isTextareaFocused?: boolean
  onTextReceived?: (text: string) => void
  className?: string
  variant?: "default" | "secondary" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

export function MicrophoneButton({
  provider = 'webspeech',
  language = 'en-US',
  autoInsert = true,
  isTextareaFocused = false,
  onTextReceived,
  className,
  variant = "outline",
  size = "default"
}: MicrophoneButtonProps) {
  const {
    isRecording,
    isProcessing,
    transcript,
    error,
    isSupported,
    isDisabled,
    startRecording,
    stopRecording,
    insertTextAtCursor
  } = useSpeechToText({
    settings: {
      provider,
      language,
      autoInsert
    },
    onTextReceived,
    isTextareaFocused
  })

  const handleClick = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Prevent the button from taking focus away from textarea
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault() // Prevents focus change
  }

  const handleInsertTranscript = () => {
    if (transcript && onTextReceived) {
      insertTextAtCursor(transcript)
    }
  }

  // Get button state and styling
  const getButtonState = () => {
    if (isProcessing) return { icon: Loader2, color: "text-blue-500", spinning: true }
    if (isRecording) return { icon: Square, color: "text-red-500", spinning: false }
    if (isDisabled) return { icon: MicOff, color: "text-gray-400", spinning: false }
    return { icon: Mic, color: "text-gray-700 dark:text-gray-300", spinning: false }
  }

  const buttonState = getButtonState()
  const Icon = buttonState.icon

  const getTooltipContent = () => {
    if (!isSupported && provider === 'webspeech') {
      return "Speech recognition not supported in this browser"
    }
    if (!isTextareaFocused && !isRecording) {
      return "Click in the text area first to position your cursor"
    }
    if (isRecording) {
      return "Click to stop recording"
    }
    if (isProcessing) {
      return "Processing audio..."
    }
    return `Start voice recording (${provider === 'webspeech' ? 'Web Speech API' : 'OpenAI Whisper'})`
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            disabled={isDisabled || isProcessing}
            className={cn(
              "relative",
              isRecording && "animate-pulse border-red-500 bg-red-50 dark:bg-red-950/20",
              isProcessing && "cursor-not-allowed",
              buttonState.color
            )}
          >
            <Icon 
              className={cn(
                "h-4 w-4",
                buttonState.spinning && "animate-spin"
              )} 
            />
            {size !== "icon" && (
              <span className="ml-2">
                {isProcessing ? "Processing..." : isRecording ? "Recording" : "Voice"}
              </span>
            )}
            
            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>

      {/* Transcript display */}
      {transcript && !autoInsert && (
        <div className="max-w-xs p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex justify-between items-start gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">
              {provider === 'webspeech' ? 'Web Speech' : 'Whisper'}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleInsertTranscript}
              className="text-xs h-6 px-2"
            >
              Insert
            </Button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
            {transcript}
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Real-time transcript for WebSpeech (when auto-insert is enabled) */}
      {isRecording && provider === 'webspeech' && autoInsert && transcript && (
        <div className="max-w-xs p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
          <Badge variant="secondary" className="text-xs mb-1">Live Transcript</Badge>
          <p className="text-sm text-blue-700 dark:text-blue-300 break-words">
            {transcript}
          </p>
        </div>
      )}
    </div>
  )
} 