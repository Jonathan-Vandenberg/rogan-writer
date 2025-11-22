"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Mic, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function GlobalMicrophoneButton() {
  const [isRecording, setIsRecording] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const activeElementRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const cursorPositionRef = React.useRef<{ start: number; end: number } | null>(null)

  // Ensure we're mounted before rendering portal
  React.useEffect(() => {
    setIsMounted(true)
    
    // Create container and append to body, ensuring it's always last
    const container = document.createElement('div')
    container.setAttribute('data-microphone-button', 'true')
    container.style.cssText = 'position: fixed; bottom: 1rem; right: 1rem; z-index: 2147483647; pointer-events: auto;'
    
    containerRef.current = container
    document.body.appendChild(container)
    
    // Global click handler to prevent modal from closing when clicking microphone
    // Use bubbling phase (not capture) so button's onClick fires first
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Check if click is on the microphone button or its children
      if (target && target.closest('[data-microphone-button]')) {
        // Stop propagation to prevent modal from closing
        // This runs after the button's onClick handler
        e.stopPropagation()
      }
    }
    
    // Use bubbling phase so button handlers run first
    document.addEventListener('click', handleGlobalClick, false)
    document.addEventListener('pointerdown', handleGlobalClick, false)
    
    // Use MutationObserver to ensure container stays at the end of body
    const observer = new MutationObserver(() => {
      if (containerRef.current && document.body.contains(containerRef.current) && containerRef.current !== document.body.lastElementChild) {
        document.body.appendChild(containerRef.current)
      }
    })
    
    observer.observe(document.body, { childList: true })
    
    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleGlobalClick, false)
      document.removeEventListener('pointerdown', handleGlobalClick, false)
      if (containerRef.current && document.body.contains(containerRef.current)) {
        document.body.removeChild(containerRef.current)
      }
    }
  }, [])

  // Track active element and cursor position
  React.useEffect(() => {
    const handleFocus = () => {
      const activeElement = document.activeElement
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        activeElementRef.current = activeElement
        cursorPositionRef.current = {
          start: activeElement.selectionStart || 0,
          end: activeElement.selectionEnd || 0,
        }
      }
    }

    const handleSelectionChange = () => {
      const activeElement = document.activeElement
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        activeElementRef.current = activeElement
        cursorPositionRef.current = {
          start: activeElement.selectionStart || 0,
          end: activeElement.selectionEnd || 0,
        }
      }
    }

    document.addEventListener('focusin', handleFocus)
    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [])

  const insertTextAtCursor = React.useCallback((text: string) => {
    let element = activeElementRef.current
    if (!element) {
      // Try to find any focused input/textarea
      const activeElement = document.activeElement
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        element = activeElement
      } else {
        return
      }
    }

    const position = cursorPositionRef.current || {
      start: element.selectionStart || 0,
      end: element.selectionEnd || 0,
    }

    const start = position.start
    const end = position.end
    const value = element.value || ''
    const textBefore = value.substring(0, start)
    const textAfter = value.substring(end)
    const newValue = textBefore + text + (start === end ? ' ' : '') + textAfter

    // Update the value and trigger React onChange for controlled components
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set

    if (element instanceof HTMLInputElement && nativeInputValueSetter) {
      nativeInputValueSetter.call(element, newValue)
      // Trigger React onChange event
      const inputEvent = new Event('input', { bubbles: true })
      element.dispatchEvent(inputEvent)
      // Also trigger change event
      const changeEvent = new Event('change', { bubbles: true })
      element.dispatchEvent(changeEvent)
    } else if (element instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(element, newValue)
      // Trigger React onChange event
      const inputEvent = new Event('input', { bubbles: true })
      element.dispatchEvent(inputEvent)
      // Also trigger change event
      const changeEvent = new Event('change', { bubbles: true })
      element.dispatchEvent(changeEvent)
    } else {
      // Fallback for older browsers
      element.value = newValue
      const inputEvent = new Event('input', { bubbles: true })
      element.dispatchEvent(inputEvent)
    }

    // Set cursor position after inserted text
    setTimeout(() => {
      const newPosition = start + text.length + (start === end ? 1 : 0)
      element.setSelectionRange(newPosition, newPosition)
      element.focus()
    }, 0)
  }, [])

  const handleMicrophoneClick = React.useCallback(async (e: React.MouseEvent) => {
    // Prevent event from bubbling to modal overlay
    e.stopPropagation()
    e.preventDefault()
    
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
      setIsRecording(false)
      // Restore focus after stopping
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (activeElementRef.current) {
            activeElementRef.current.focus()
            const pos = cursorPositionRef.current
            if (pos) {
              try {
                activeElementRef.current.setSelectionRange(pos.start, pos.end)
              } catch (err) {
                // Ignore selection range errors
              }
            }
          }
        }, 50)
      })
      return
    }

    // Check for active text input - must have cursor focus before recording
    // Use the saved reference first (from focus tracking)
    let activeElement = activeElementRef.current
    
    // If no saved reference, check if current active element is an input/textarea
    // (Note: when button is clicked, document.activeElement will be the button, not the input)
    if (!activeElement) {
      // Try to find any focused input/textarea in the document
      const allInputs = document.querySelectorAll('input, textarea')
      for (const input of allInputs) {
        if (input === document.activeElement || (input as HTMLElement).matches(':focus')) {
          if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
            activeElement = input
            break
          }
        }
      }
    }
    
    // Strict check: must have a valid input/textarea element
    // Verify the element is still in the DOM and is a valid input/textarea
    if (
      !activeElement ||
      !document.body.contains(activeElement) ||
      (!(activeElement instanceof HTMLInputElement) &&
       !(activeElement instanceof HTMLTextAreaElement))
    ) {
      toast.info('Where do you want to insert the text?', {
        description: 'Click in a text field to record',
        duration: 4000,
      })
      return // Exit early - do not request microphone access or start recording
    }

    // Ensure we have the latest cursor position
    if (!cursorPositionRef.current) {
      cursorPositionRef.current = {
        start: activeElement.selectionStart || 0,
        end: activeElement.selectionEnd || 0,
      }
    }
    
    // Save reference
    activeElementRef.current = activeElement

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const options: MediaRecorderOptions = {}
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4'
      }
      
      const mediaRecorder = new MediaRecorder(stream, options)

      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = () => {
        setIsRecording(false)
        setIsProcessing(false)
        alert('Recording error occurred. Please try again.')
      }

      mediaRecorder.onstop = async () => {
        setIsProcessing(true)
        try {
          const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })

          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')
          formData.append('language', 'en')

          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || 'Failed to transcribe audio')
          }

          const { transcript } = await response.json()

          if (transcript && transcript.trim()) {
            insertTextAtCursor(transcript.trim())
          }
        } catch (error) {
          alert(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
          setIsProcessing(false)
          chunksRef.current = []
        }
      }

      mediaRecorderRef.current = mediaRecorder
      
      // Start recording with timeslice for better data collection
      mediaRecorder.start(1000) // Collect data every second
      
      // Use a small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 50))
      setIsRecording(true)
      
      // Restore focus to the input after starting recording
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (activeElementRef.current) {
            activeElementRef.current.focus()
            const pos = cursorPositionRef.current
            if (pos) {
              try {
                activeElementRef.current.setSelectionRange(pos.start, pos.end)
              } catch (err) {
                // Ignore selection range errors
              }
            }
          }
        }, 150)
      })
    } catch (error) {
      setIsRecording(false)
      alert(`Microphone access denied: ${error instanceof Error ? error.message : 'Unknown error'}. Please allow microphone access to use dictation.`)
    }
  }, [isRecording, insertTextAtCursor])

  if (!isMounted || !containerRef.current) {
    return null
  }

  return createPortal(
    <div
      data-microphone-button="true"
      style={{ pointerEvents: 'auto' }}
      onMouseDown={(e) => {
        // Stop propagation to prevent modal from closing, but don't prevent button click
        const target = e.target as HTMLElement
        if (target.tagName !== 'BUTTON') {
          e.stopPropagation()
        }
      }}
    >
      <Button
        onMouseDown={(e) => {
          // Stop propagation to prevent modal from closing
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          handleMicrophoneClick(e)
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
        type="button"
        disabled={isProcessing}
        className={cn(
          "h-10 w-10 rounded-full shadow-md",
          "bg-muted/80 hover:bg-muted border border-border/50 backdrop-blur-sm",
          "text-muted-foreground hover:text-foreground",
          "transition-all duration-200",
          isRecording && "bg-red-500/90 hover:bg-red-600/90 text-white border-red-600 animate-pulse",
          isProcessing && "opacity-75 cursor-not-allowed"
        )}
        size="icon"
        variant="ghost"
        title={isRecording ? "Stop recording" : isProcessing ? "Processing..." : "Start dictation"}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>,
    containerRef.current
  )
}

