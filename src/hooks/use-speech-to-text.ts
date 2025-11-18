"use client"

import { useState, useRef, useCallback, useEffect } from 'react'

export type SpeechToTextProvider = 'webspeech' | 'openai-whisper'

interface SpeechToTextSettings {
  provider: SpeechToTextProvider
  language: string
  autoInsert: boolean
  prompt?: string // Optional prompt to guide transcription (helps with proper nouns, technical terms)
  temperature?: number // Optional temperature (0.0-1.0), default 0.2
}

interface UseSpeechToTextProps {
  settings: SpeechToTextSettings
  onTextReceived?: (text: string, cursorPosition?: number) => void
  isTextareaFocused?: boolean
}

interface SpeechToTextState {
  isRecording: boolean
  isProcessing: boolean
  transcript: string
  error: string | null
  isSupported: boolean
}

export function useSpeechToText({
  settings,
  onTextReceived,
  isTextareaFocused = false
}: UseSpeechToTextProps) {
  const [state, setState] = useState<SpeechToTextState>({
    isRecording: false,
    isProcessing: false,
    transcript: '',
    error: null,
    isSupported: typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  })

  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Initialize WebSpeech API
  const initializeWebSpeech = useCallback(() => {
    if (typeof window === 'undefined') return null

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = settings.language

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isRecording: true, error: null }))
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      setState(prev => ({ 
        ...prev, 
        transcript: finalTranscript || interimTranscript 
      }))

      if (finalTranscript && settings.autoInsert) {
        onTextReceived?.(finalTranscript)
      }
    }

    recognition.onerror = (event: any) => {
      setState(prev => ({ 
        ...prev, 
        error: `Speech recognition error: ${event.error}`,
        isRecording: false 
      }))
    }

    recognition.onend = () => {
      setState(prev => ({ ...prev, isRecording: false }))
    }

    return recognition
  }, [settings.language, settings.autoInsert, onTextReceived])

  // Initialize MediaRecorder for OpenAI Whisper
  const initializeMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        setState(prev => ({ ...prev, isProcessing: true }))
        
        try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' })
          chunksRef.current = []

          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')
          formData.append('language', settings.language)
          
          // Add optional prompt if provided
          if (settings.prompt) {
            formData.append('prompt', settings.prompt)
          }
          
          // Add optional temperature if provided
          if (settings.temperature !== undefined) {
            formData.append('temperature', settings.temperature.toString())
          }

          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error('Failed to transcribe audio')
          }

          const { transcript } = await response.json()
          setState(prev => ({ ...prev, transcript }))

          if (transcript && settings.autoInsert) {
            onTextReceived?.(transcript)
          }
        } catch (error: any) {
          setState(prev => ({ 
            ...prev, 
            error: error instanceof Error ? error.message : 'Transcription failed'
          }))
        } finally {
          setState(prev => ({ ...prev, isProcessing: false }))
        }
      }

      return mediaRecorder
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        error: 'Microphone access denied or not available'
      }))
      return null
    }
  }, [settings.language, settings.autoInsert, onTextReceived])

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isTextareaFocused) {
      setState(prev => ({ 
        ...prev, 
        error: 'Please click in the text area first to position your cursor'
      }))
      return
    }

    setState(prev => ({ ...prev, error: null, transcript: '' }))

    if (settings.provider === 'webspeech') {
      if (!recognitionRef.current) {
        recognitionRef.current = initializeWebSpeech()
      }
      
      if (recognitionRef.current) {
        recognitionRef.current.start()
      } else {
        setState(prev => ({ 
          ...prev, 
          error: 'Speech recognition not supported in this browser'
        }))
      }
    } else {
      const mediaRecorder = await initializeMediaRecorder()
      if (mediaRecorder) {
        mediaRecorderRef.current = mediaRecorder
        mediaRecorder.start()
        setState(prev => ({ ...prev, isRecording: true }))
      }
    }
  }, [settings.provider, initializeWebSpeech, initializeMediaRecorder, isTextareaFocused])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (settings.provider === 'webspeech' && recognitionRef.current) {
      recognitionRef.current.stop()
    } else if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      // Stop all tracks to release microphone
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [settings.provider])

  // Insert text at cursor position
  const insertTextAtCursor = useCallback((text: string) => {
    if (!state.transcript) return
    onTextReceived?.(text)
    setState(prev => ({ ...prev, transcript: '' }))
  }, [state.transcript, onTextReceived])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // Don't disable if currently recording (to prevent interruption when clicking the button)
  const isDisabled = (!isTextareaFocused && !state.isRecording) || (!state.isSupported && settings.provider === 'webspeech')

  return {
    ...state,
    startRecording,
    stopRecording,
    insertTextAtCursor,
    isDisabled
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
} 