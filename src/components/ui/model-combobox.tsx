"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface OpenRouterModel {
  id: string
  name: string
  description?: string
  pricing?: {
    prompt: string
    completion: string
  }
}

interface ModelComboboxProps {
  models: OpenRouterModel[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  emptyMessage?: string
  id?: string
  showFreeFilter?: boolean // Show "free" filter button
}

export function ModelCombobox({
  models,
  value,
  onValueChange,
  placeholder = "Select model...",
  disabled = false,
  emptyMessage = "No models found.",
  id,
  showFreeFilter = false,
}: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [showFreeOnly, setShowFreeOnly] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selectedModel = models.find((model) => model.id === value)

  // Helper function to check if a model is free
  const isModelFree = (model: OpenRouterModel): boolean => {
    if (!model.pricing) return false
    // Parse pricing strings (e.g., "0" or "0.0" or "$0.00" or "free")
    const promptStr = model.pricing.prompt?.toLowerCase().trim() || "0"
    const completionStr = model.pricing.completion?.toLowerCase().trim() || "0"
    
    // Check if explicitly marked as free
    if (promptStr === "free" || completionStr === "free") return true
    
    // Parse numeric values (remove $ and parse)
    const prompt = parseFloat(promptStr.replace(/[^0-9.]/g, "")) || 0
    const completion = parseFloat(completionStr.replace(/[^0-9.]/g, "")) || 0
    
    return prompt === 0 && completion === 0
  }

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  // Filter models based on search and free filter
  const filteredModels = React.useMemo(() => {
    let filtered = models

    // Apply free filter if enabled
    if (showFreeOnly) {
      filtered = filtered.filter(isModelFree)
    }

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (model) =>
          model.id.toLowerCase().includes(searchLower) ||
          model.name?.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [models, search, showFreeOnly])

  return (
    <div className="relative" ref={containerRef}>
      <Button
        id={id}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {selectedModel ? (
          <span className="truncate">{selectedModel.name || selectedModel.id}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-2 space-y-2">
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {showFreeFilter && (
              <Button
                type="button"
                variant={showFreeOnly ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => setShowFreeOnly(!showFreeOnly)}
              >
                {showFreeOnly ? "✓ Showing Free Models Only" : "Show Free Models Only"}
              </Button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filteredModels.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filteredModels.map((model) => (
                <div
                  key={model.id}
                  onClick={() => {
                    onValueChange(model.id === value ? "" : model.id)
                    setOpen(false)
                    setSearch("")
                  }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    value === model.id && "bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === model.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {model.name || model.id}
                      </span>
                      {isModelFree(model) && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-medium">
                          FREE
                        </span>
                      )}
                    </div>
                    {model.description && (
                      <span className="text-xs text-muted-foreground truncate">
                        {model.description}
                      </span>
                    )}
                    {model.pricing && !isModelFree(model) && (
                      <span className="text-xs text-muted-foreground">
                        ${parseFloat(model.pricing.prompt) || 0}/1K prompt • ${parseFloat(model.pricing.completion) || 0}/1K completion
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
