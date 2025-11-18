"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Upload, Save, Loader2, ArrowLeft, Lightbulb, Layout } from "lucide-react"
import { useSelectedBook } from "@/contexts/selected-book-context"
import { BrainstormingNotes } from "@/components/brainstorming/brainstorming-notes"

// Import Excalidraw CSS
import "@excalidraw/excalidraw/index.css"

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
)

type ExcalidrawImperativeAPI = {
  getSceneElements: () => any[]
  getAppState: () => any
  getFiles: () => any
  updateScene: (data: any) => void
  addFiles: (files: any[]) => void
}

export default function BrainstormingPage() {
  const router = useRouter()
  const { selectedBookId } = useSelectedBook()
  const [activeTab, setActiveTab] = React.useState<"cards" | "whiteboard">("cards")
  const [excalidrawAPI, setExcalidrawAPI] = React.useState<ExcalidrawImperativeAPI | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const hasLoadedData = React.useRef<string | null>(null) // Track which bookId we've loaded
  const excalidrawRef = React.useRef<any>(null)
  const isSavingRef = React.useRef(false) // Prevent concurrent saves
  const lastSavedElementsHash = React.useRef<string | null>(null) // Track what we last saved to avoid duplicate saves

  const loadWorkspaceData = React.useCallback(async () => {
    const api = excalidrawAPI || excalidrawRef.current
    // Only load if we haven't loaded data for this bookId yet
    if (!selectedBookId || !api || hasLoadedData.current === selectedBookId) {
      console.log("Skipping load:", { 
        selectedBookId: !!selectedBookId, 
        api: !!api, 
        hasLoadedForBook: hasLoadedData.current === selectedBookId 
      })
      if (api && hasLoadedData.current === selectedBookId) {
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    try {
      console.log("Loading workspace data for book:", selectedBookId)
      const response = await fetch(`/api/books/${selectedBookId}/brainstorming/workspace`)
      if (response.ok) {
        const result = await response.json()
        if (result.data) {
          try {
            const parsed = JSON.parse(result.data)
            
            // Normalize appState to ensure required fields are in correct format
            if (parsed.appState) {
              // Ensure collaborators is an array (required by Excalidraw)
              if (!Array.isArray(parsed.appState.collaborators)) {
                parsed.appState.collaborators = []
              }
              // Ensure selectedElementIds is an object (not array)
              if (parsed.appState.selectedElementIds && Array.isArray(parsed.appState.selectedElementIds)) {
                parsed.appState.selectedElementIds = {}
              }
              // Remove any invalid fields that might cause issues
              if (parsed.appState.collaborators && typeof parsed.appState.collaborators.forEach !== 'function') {
                parsed.appState.collaborators = []
              }
            } else {
              // If no appState, create a minimal one
              parsed.appState = {
                collaborators: [],
              }
            }
            
            // Ensure elements is an array
            if (!Array.isArray(parsed.elements)) {
              parsed.elements = []
            }
            
            // Ensure files is an object
            if (!parsed.files || typeof parsed.files !== 'object' || Array.isArray(parsed.files)) {
              parsed.files = {}
            }
            
            const loadedFiles = parsed.files && typeof parsed.files === 'object' && !Array.isArray(parsed.files) ? parsed.files : {}
            const loadedFileIds = Object.keys(loadedFiles)
            
            console.log("Loading normalized data:", {
              elementsCount: parsed.elements?.length || 0,
              filesCount: loadedFileIds.length,
              hasAppState: !!parsed.appState,
              collaboratorsIsArray: Array.isArray(parsed.appState?.collaborators),
              fileIds: loadedFileIds.slice(0, 5), // Show first 5
            })
            
            // Only update scene if we're not currently saving
            if (!isSavingRef.current) {
              // First, restore files to Excalidraw's file system
              if (loadedFileIds.length > 0) {
                const filesToAdd = []
                for (const fileId of loadedFileIds) {
                  const fileData = loadedFiles[fileId]
                  if (fileData) {
                    let dataURL = fileData.dataURL
                    
                    // If no dataURL but we have an s3Url, fetch it and convert to dataURL
                    if (!dataURL && fileData.s3Url) {
                      try {
                        console.log("Fetching image from S3:", fileData.s3Url)
                        const imageResponse = await fetch(fileData.s3Url)
                        if (imageResponse.ok) {
                          const blob = await imageResponse.blob()
                          dataURL = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader()
                            reader.onload = () => resolve(reader.result as string)
                            reader.onerror = reject
                            reader.readAsDataURL(blob)
                          })
                          console.log("✅ Fetched image from S3 and converted to dataURL")
                        }
                      } catch (error) {
                        console.error("Error fetching image from S3:", error)
                      }
                    }
                    
                    if (dataURL) {
                      const fileEntry = {
                        id: fileId,
                        mimeType: fileData.mimeType || 'image/png',
                        dataURL: dataURL,
                        created: fileData.created || Date.now(),
                        lastRetrieved: Date.now(),
                      }
                      filesToAdd.push(fileEntry)
                    } else {
                      console.warn("No dataURL or s3Url for file:", fileId)
                    }
                  }
                }
                
                if (filesToAdd.length > 0) {
                  console.log("Restoring files to Excalidraw:", filesToAdd.length)
                  api.addFiles(filesToAdd)
                  // Small delay to let Excalidraw process the files
                  await new Promise(resolve => setTimeout(resolve, 200))
                }
              }
              
              // Then update the scene (this will restore elements and appState)
              api.updateScene(parsed)
              hasLoadedData.current = selectedBookId
              
              // Reset the saved hash to match what we just loaded
              const loadedElements = Array.isArray(parsed.elements) ? parsed.elements : []
              const loadedHash = JSON.stringify(loadedElements.map((el: any) => ({
                id: el.id,
                type: el.type,
                versionNonce: el.versionNonce
              })))
              lastSavedElementsHash.current = loadedHash
              
              console.log("✅ Loaded workspace data for book:", selectedBookId, `(${loadedElements.length} elements, ${loadedFileIds.length} files)`)
            }
          } catch (error) {
            console.error("Error parsing workspace data:", error)
          }
        } else {
          console.log("No workspace data found, starting fresh")
          hasLoadedData.current = selectedBookId
          // Reset hash for fresh canvas
          lastSavedElementsHash.current = null
        }
      }
    } catch (error) {
      console.error("Error loading workspace data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedBookId, excalidrawAPI, excalidrawRef])

  // Reset loaded data flag when bookId changes
  React.useEffect(() => {
    if (hasLoadedData.current !== selectedBookId) {
      hasLoadedData.current = null
      lastSavedElementsHash.current = null // Reset hash for new book
      setIsLoading(true)
    }
  }, [selectedBookId])

  // Load saved workspace data when API is ready
  React.useEffect(() => {
    const api = excalidrawAPI || excalidrawRef.current
    if (selectedBookId && api && hasLoadedData.current !== selectedBookId) {
      // Small delay to ensure Excalidraw is fully initialized
      const timer = setTimeout(() => {
        loadWorkspaceData()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [selectedBookId, excalidrawAPI, excalidrawRef, loadWorkspaceData])

  const saveWorkspaceData = async () => {
    const api = excalidrawAPI || excalidrawRef.current
    if (!selectedBookId || !api) {
      console.warn("Cannot save: missing bookId or excalidrawAPI", {
        selectedBookId: !!selectedBookId,
        excalidrawAPI: !!excalidrawAPI,
        ref: !!excalidrawRef.current
      })
      return
    }

    // Prevent concurrent saves
    if (isSavingRef.current) {
      console.log("Save already in progress, skipping...")
      return
    }

    isSavingRef.current = true
    setIsSaving(true)
    try {
      // Small delay to ensure Excalidraw has processed all changes
      await new Promise(resolve => setTimeout(resolve, 100))

      const elements = api.getSceneElements()
      const appState = api.getAppState()
      const files = api.getFiles()

      // Filter out deleted elements only (don't filter by status - it might not exist or be reliable)
      const savedElements = Array.isArray(elements) 
        ? elements.filter(el => !el.isDeleted)
        : []

      // Normalize appState before saving to ensure valid structure
      const normalizedAppState = {
        ...appState,
        collaborators: Array.isArray(appState.collaborators) ? appState.collaborators : [],
      }

      // Log files info for debugging
      const filesToSave = files && typeof files === 'object' && !Array.isArray(files) ? files : {}
      const fileIds = Object.keys(filesToSave)
      
      const data = JSON.stringify({
        elements: savedElements,
        appState: normalizedAppState,
        files: filesToSave,
      })

      console.log("Saving workspace data...", { 
        elementsCount: savedElements.length,
        filesCount: fileIds.length,
        bookId: selectedBookId,
        timestamp: new Date().toISOString()
      })

      const response = await fetch(`/api/books/${selectedBookId}/brainstorming/workspace`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to save: ${errorText}`)
      }

      const result = await response.json()
      // Update the hash to reflect what we just saved
      const elementsHash = JSON.stringify(savedElements.map(el => ({
        id: el.id,
        type: el.type,
        versionNonce: el.versionNonce
      })))
      lastSavedElementsHash.current = elementsHash
      setLastSaved(new Date())
      console.log("✅ Workspace saved successfully at", new Date().toISOString(), `(${savedElements.length} elements)`)
    } catch (error) {
      console.error("Error saving workspace data:", error)
      alert(`Failed to save workspace: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
      isSavingRef.current = false
    }
  }

  // Auto-save with debouncing - only when on whiteboard tab
  const handleChange = React.useCallback(() => {
    // Only save if we're on the whiteboard tab
    if (activeTab !== "whiteboard") {
      return
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save (4 seconds after last change to ensure drawing is complete)
    saveTimeoutRef.current = setTimeout(async () => {
      // Double-check we're still on whiteboard tab
      if (activeTab !== "whiteboard") {
        return
      }

      // Skip if manual save is in progress
      if (isSavingRef.current) {
        return
      }

      const api = excalidrawAPI || excalidrawRef.current
      if (!selectedBookId || !api) {
        return
      }

      // Prevent concurrent saves
      if (isSavingRef.current) return
      isSavingRef.current = true

      try {
        // Delay to ensure Excalidraw has processed all changes (especially during active drawing)
        await new Promise(resolve => setTimeout(resolve, 300))

        const elements = api.getSceneElements()
        const appState = api.getAppState()
        const files = api.getFiles()

        // Filter out deleted elements only (don't filter by status - it might not exist or be reliable)
        const savedElements = Array.isArray(elements) 
          ? elements.filter(el => !el.isDeleted)
          : []

        console.log("Elements before save:", {
          total: elements?.length || 0,
          saved: savedElements.length,
          sample: savedElements.length > 0 ? {
            id: savedElements[0].id,
            type: savedElements[0].type,
            status: savedElements[0].status,
            isDeleted: savedElements[0].isDeleted
          } : null
        })

        // Create a hash of the current state to avoid saving duplicates
        const elementsHash = JSON.stringify(savedElements.map(el => ({
          id: el.id,
          type: el.type,
          versionNonce: el.versionNonce
        })))

        // Skip if nothing has changed
        if (elementsHash === lastSavedElementsHash.current) {
          console.log("No changes detected, skipping save", {
            currentHash: elementsHash.substring(0, 50),
            lastHash: lastSavedElementsHash.current?.substring(0, 50)
          })
          isSavingRef.current = false
          return
        }

        // Normalize appState before saving
        const normalizedAppState = {
          ...appState,
          collaborators: Array.isArray(appState.collaborators) ? appState.collaborators : [],
        }

        // Log files info for debugging
        const filesToSave = files && typeof files === 'object' && !Array.isArray(files) ? files : {}
        const fileIds = Object.keys(filesToSave)
        console.log("Files to save:", {
          count: fileIds.length,
          fileIds: fileIds.slice(0, 5), // Show first 5
        })

        const data = JSON.stringify({
          elements: savedElements,
          appState: normalizedAppState,
          files: filesToSave,
        })

        console.log("Auto-saving workspace...", {
          elementsCount: savedElements.length,
          filesCount: fileIds.length,
          bookId: selectedBookId,
        })

        const response = await fetch(`/api/books/${selectedBookId}/brainstorming/workspace`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data }),
        })

        if (response.ok) {
          const result = await response.json()
          lastSavedElementsHash.current = elementsHash
          setLastSaved(new Date())
          console.log("✅ Auto-saved workspace at", new Date().toISOString(), `(${savedElements.length} elements)`)
        } else {
          const errorText = await response.text()
          console.error("Auto-save failed:", response.status, errorText)
        }
      } catch (error) {
        console.error("Error auto-saving workspace:", error)
      } finally {
        isSavingRef.current = false
      }
    }, 4000) // 4 second debounce
  }, [selectedBookId, excalidrawAPI, excalidrawRef, activeTab])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const api = excalidrawAPI || excalidrawRef.current
    if (!file || !selectedBookId || !api) return

    setIsUploading(true)
    try {
      // Convert file to data URL for Excalidraw
      const reader = new FileReader()
      const dataURL = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Upload to S3
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`/api/books/${selectedBookId}/brainstorming/images`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload image")
      }

      const { url, signedUrl, s3Key } = await response.json()

      // Create file ID
      const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(7)}`

      console.log("Image uploaded to S3:", { url, s3Key, fileId })

      // Add the image file to Excalidraw with S3 URL
      // Store both dataURL (for immediate display) and the S3 URL (for persistence)
      api.addFiles([
        {
          id: fileId,
          mimeType: file.type,
          dataURL: dataURL, // For immediate display
          created: Date.now(),
          lastRetrieved: Date.now(),
          // Store S3 URL for persistence
          s3Url: url,
          s3Key: s3Key,
        },
      ])

      // Get current viewport center for placing the image
      const appState = api.getAppState()
      const viewportCenterX = appState.scrollX + appState.width / 2
      const viewportCenterY = appState.scrollY + appState.height / 2

      // Create image element
      const imageElement = {
        type: "image" as const,
        id: `image-${Date.now()}`,
        x: viewportCenterX - 100,
        y: viewportCenterY - 100,
        width: 200,
        height: 200,
        angle: 0,
        strokeColor: "#000000",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Date.now(),
        versionNonce: Date.now(),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        status: "saved" as const,
        fileId: fileId,
        scale: [1, 1] as [number, number],
      }

      // Add the image element to the scene
      const currentElements = api.getSceneElements()
      api.updateScene({
        elements: [...currentElements, imageElement],
      })

      // Trigger a save after adding the image to ensure it's persisted
      // Small delay to let Excalidraw process the new element
      setTimeout(() => {
        handleChange()
      }, 500)
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Failed to upload image. Please try again.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Clear save timeout when switching away from whiteboard tab
  React.useEffect(() => {
    if (activeTab !== "whiteboard" && saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
      console.log("Cleared save timeout - switched away from whiteboard")
    }
  }, [activeTab])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  if (!selectedBookId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please select a book first</p>
          <Button onClick={() => router.push("/write")}>Go to Write Page</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/write")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Writing
            </Button>
            <h1 className="text-xl font-semibold">Brainstorming Workspace</h1>
          </div>
          {activeTab === "whiteboard" && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const api = excalidrawAPI || excalidrawRef.current
                  if (api) {
                    // Temporarily set API if we have it in ref but not state
                    if (!excalidrawAPI) {
                      setExcalidrawAPI(api)
                    }
                    saveWorkspaceData()
                  } else {
                    console.error("No Excalidraw API available")
                    alert("Excalidraw is not ready yet. Please wait a moment and try again.")
                  }
                }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
              {isLoading && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              )}
              {!isLoading && lastSaved && (
                <span className="text-sm text-muted-foreground">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs 
        value={activeTab} 
        onValueChange={async (value) => {
          // Save whiteboard data before switching away
          if (activeTab === "whiteboard" && value !== "whiteboard") {
            const api = excalidrawAPI || excalidrawRef.current
            if (api && selectedBookId) {
              // Clear any pending auto-save
              if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
                saveTimeoutRef.current = null
              }
              // Force immediate save
              await saveWorkspaceData()
            }
          }
          setActiveTab(value as "cards" | "whiteboard")
        }} 
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b bg-white dark:bg-gray-800 px-6">
          <TabsList>
            <TabsTrigger value="cards" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="whiteboard" className="gap-2">
              <Layout className="h-4 w-4" />
              Whiteboard
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 relative overflow-hidden">
          {/* Cards Tab - conditionally rendered */}
          {activeTab === "cards" && (
            <div className="absolute inset-0 p-6 overflow-y-auto">
              {selectedBookId ? (
                <BrainstormingNotes bookId={selectedBookId} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">Please select a book first</p>
                    <Button onClick={() => router.push("/write")}>Go to Write Page</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Whiteboard Tab - always mounted but hidden when not active */}
          <div className={`absolute inset-0 ${activeTab === "whiteboard" ? "block" : "hidden"}`}>
            <Excalidraw
              excalidrawAPI={(api: any) => {
                console.log("Excalidraw API callback called with:", api ? "API object" : "null/undefined")
                excalidrawRef.current = api
                if (api) {
                  console.log("Excalidraw API available:", {
                    hasGetSceneElements: typeof api.getSceneElements === 'function',
                    hasGetAppState: typeof api.getAppState === 'function',
                    hasGetFiles: typeof api.getFiles === 'function',
                    hasUpdateScene: typeof api.updateScene === 'function',
                  })
                  setExcalidrawAPI(api)
                  // Trigger load if we haven't loaded data for this book yet
                  if (selectedBookId && hasLoadedData.current !== selectedBookId) {
                    setTimeout(() => {
                      loadWorkspaceData()
                    }, 200)
                  }
                } else {
                  console.warn("Excalidraw API callback received null/undefined")
                }
              }}
              onChange={(elements, appState, files) => {
                // Only trigger save if we're on the whiteboard tab
                if (activeTab === "whiteboard") {
                  handleChange()
                }
              }}
              UIOptions={{
                canvasActions: {
                  saveToActiveFile: false,
                  loadScene: false,
                  export: false,
                  toggleTheme: true,
                },
              }}
            />
          </div>
        </div>
      </Tabs>
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && activeTab === "whiteboard" && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded">
          API: {excalidrawAPI ? '✅' : '❌'} | Book: {selectedBookId ? '✅' : '❌'}
        </div>
      )}
    </div>
  )
}

