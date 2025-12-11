'use client'

import { useEffect, useMemo, useState } from "react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChecklistItem, RunnerState } from "@/types/checklist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Mode = "builder" | "runner"
type Theme = "light" | "dark"

const STORAGE_KEY = "smart-checklist-items-v1"
const RUNNER_KEY = "smart-checklist-runner-v1"
const THEME_KEY = "smart-checklist-theme-v1"

function createEmptyItem(): ChecklistItem {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    dependsOn: [],
    createdAt: new Date().toISOString()
  }
}

function sanitizeChecklistItems(raw: unknown[]): { items: ChecklistItem[]; messages: string[] } {
  const messages: string[] = []
  const seen = new Set<string>()

  const items: ChecklistItem[] = raw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        messages.push(`Skipped entry ${index}: not an object`)
        return null
      }

      const candidateId = typeof (entry as any).id === "string" && (entry as any).id.trim()
      let id = candidateId || crypto.randomUUID()
      if (seen.has(id)) {
        const newId = `${id}-${crypto.randomUUID().slice(0, 8)}`
        messages.push(`Duplicate id "${id}" at index ${index} replaced with "${newId}"`)
        id = newId
      }
      seen.add(id)

      const rawTitle = typeof (entry as any).title === "string" ? (entry as any).title.trim() : ""
      const title = rawTitle || "Untitled step"
      const description = typeof (entry as any).description === "string" ? (entry as any).description : undefined

      const rawDependsOn = (entry as any).dependsOn
      const dependsOn = Array.isArray(rawDependsOn)
        ? Array.from(
            new Set(
              rawDependsOn
                .filter((d: any) => typeof d === "string")
                .map((d: string) => d.trim())
                .filter(Boolean)
                .filter(dep => dep !== id)
            )
          )
        : []
      if (rawDependsOn && !Array.isArray(rawDependsOn)) {
        messages.push(`Entry "${title}" had invalid dependsOn; reset to []`)
      }

      const rawCreatedAt = typeof (entry as any).createdAt === "string" ? (entry as any).createdAt : ""
      const createdAt = Number.isNaN(Date.parse(rawCreatedAt)) ? new Date().toISOString() : rawCreatedAt

      return {
        id,
        title,
        description,
        dependsOn,
        aiGenerated: Boolean((entry as any).aiGenerated),
        createdAt
      } satisfies ChecklistItem
    })
    .filter(Boolean) as ChecklistItem[]

  return { items, messages }
}

function SortableItem({ 
  item, 
  onChangeTitle, 
  onChangeDescription, 
  allItems, 
  onChangeDependencies,
  onDelete 
}: {
  item: ChecklistItem
  allItems: ChecklistItem[]
  onChangeTitle: (v: string) => void
  onChangeDescription: (v: string) => void
  onChangeDependencies: (deps: string[]) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [showDependencies, setShowDependencies] = useState(false)
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const otherItems = allItems.filter(i => i.id !== item.id)

  return (
    <div ref={setNodeRef} style={style} className="group" data-item-id={item.id}>
      <Card className={cn(
        "mb-3 border-[color:var(--border)] hover:border-[color:var(--border-strong)] transition-all",
        item.aiGenerated && "border-l-4 border-l-[color:var(--accent)]"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <button
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
              className="mt-2 cursor-grab active:cursor-grabbing text-[color:var(--text-dim)] hover:text-[color:var(--text)] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="11" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="11" cy="12" r="1.5" fill="currentColor"/>
              </svg>
            </button>

            {/* Content */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={item.title}
                  onChange={e => onChangeTitle(e.target.value)}
                  placeholder="Step title"
                  className="flex-1 font-medium border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {item.aiGenerated && (
                  <span className="shrink-0 text-[10px] font-medium rounded-full bg-[color:var(--accent-soft)] px-2 py-1 text-[color:var(--accent-strong)]">
                    AI
                  </span>
                )}
              </div>
              
              <Textarea
                value={item.description ?? ""}
                onChange={e => onChangeDescription(e.target.value)}
                placeholder="Add description..."
                rows={2}
                className="text-sm border-0 bg-transparent px-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />

              {/* Dependencies Toggle */}
              {otherItems.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowDependencies(!showDependencies)}
                    className="text-xs text-[color:var(--text-dim)] hover:text-[color:var(--text)] flex items-center gap-1"
                  >
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 12 12" 
                      fill="none" 
                      className={cn("transition-transform", showDependencies && "rotate-90")}
                    >
                      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {item.dependsOn.length > 0 ? `${item.dependsOn.length} dependencies` : "Add dependencies"}
                  </button>

                  {showDependencies && (
                    <div className="flex flex-wrap gap-2 pl-4">
                      {otherItems.map(target => {
                        const active = item.dependsOn.includes(target.id)
                        return (
                          <button
                            key={target.id}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? item.dependsOn.filter(id => id !== target.id)
                                : [...item.dependsOn, target.id]
                              onChangeDependencies(next)
                            }}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border transition-colors",
                              active
                                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                                : "border-[color:var(--border)] text-[color:var(--text-dim)] hover:border-[color:var(--border-strong)]"
                            )}
                          >
                            {target.title || "Untitled"}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delete Button */}
            <button
              type="button"
              onClick={onDelete}
              className="mt-1 text-[color:var(--text-dim)] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Delete step"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4h10M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1m1 0v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4h8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("builder")
  const [theme, setTheme] = useState<Theme>("dark")
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [runnerState, setRunnerState] = useState<RunnerState>({})
  const [apiKey, setApiKey] = useState("")
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [importJson, setImportJson] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [newItemId, setNewItemId] = useState<string | null>(null)
  const [prevVisibleCount, setPrevVisibleCount] = useState(0)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const { items: validated } = sanitizeChecklistItems(Array.isArray(parsed) ? parsed : [])
        setItems(validated)
      }
    } catch {}

    try {
      const storedRunner = localStorage.getItem(RUNNER_KEY)
      if (storedRunner) {
        const parsed = JSON.parse(storedRunner)
        if (typeof parsed === "object" && parsed !== null) {
          setRunnerState(parsed)
        }
      }
    } catch {}

    try {
      const storedTheme = localStorage.getItem(THEME_KEY)
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme)
        document.documentElement.dataset.theme = storedTheme
      }
    } catch {}

    try {
      const storedKey = localStorage.getItem("gemini-api-key")
      if (storedKey) setApiKey(storedKey)
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    localStorage.setItem(RUNNER_KEY, JSON.stringify(runnerState))
  }, [runnerState])

  useEffect(() => {
    if (newItemId) {
      const element = document.querySelector(`[data-item-id="${newItemId}"]`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Focus the title input
        const input = element.querySelector('input')
        if (input) {
          setTimeout(() => input.focus(), 100)
        }
      }
      setNewItemId(null)
    }
  }, [newItemId])

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id)
      const newIndex = prev.findIndex(i => i.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light"
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem(THEME_KEY, next)
  }

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your Gemini API key")
      return
    }
    if (!prompt.trim()) {
      setError("Please enter a prompt")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      localStorage.setItem("gemini-api-key", apiKey)

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are an expert onboarding assistant. Generate a detailed, step-by-step checklist in JSON format.

Requirements:
- Return ONLY valid JSON (no markdown, no explanations)
- Each step must have: id (UUID), title (string), description (string), dependsOn (array of step IDs), aiGenerated (true)
- Create 8-12 logical steps
- Use dependencies to show order (e.g., setup before config)
- Make titles clear and action-oriented
- Add helpful descriptions

User request: ${prompt}

Return JSON array of steps.`
              }]
            }]
          })
        }
      )

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error("No response from AI")

      const clean = text.replace(/```json|```/g, "").trim()
      const parsed = JSON.parse(clean)
      const { items: validated } = sanitizeChecklistItems(Array.isArray(parsed) ? parsed : [])
      
      setItems(validated)
      setShowAI(false)
      setShowImport(false)
      setPrompt("")
      setError(null)
      setToast(`✓ Generated ${validated.length} steps`)
      setTimeout(() => setToast(null), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to generate checklist")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExport = () => {
    if (items.length === 0) {
      setToast("No checklist to export")
      setTimeout(() => setToast(null), 3000)
      return
    }

    const json = JSON.stringify(items, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checklist-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    setToast("✓ Checklist downloaded")
    setTimeout(() => setToast(null), 3000)
  }

  const handleImport = () => {
    // Clear previous errors
    setError(null)
    
    // Check if JSON is empty
    if (!importJson.trim()) {
      setError("Please paste JSON content")
      return
    }
    
    try {
      const parsed = JSON.parse(importJson)
      
      // Validate that it's an array
      if (!Array.isArray(parsed)) {
        setError("Invalid format: JSON must be an array of checklist items")
        return
      }
      
      // Validate that it's not empty
      if (parsed.length === 0) {
        setError("Cannot import empty checklist")
        return
      }
      
      const { items: validated, messages } = sanitizeChecklistItems(parsed)
      
      // Check if sanitization resulted in no valid items
      if (validated.length === 0) {
        setError("No valid checklist items found in JSON")
        return
      }
      
      // Check if there are existing items and show confirmation
      if (items.length > 0 && !showImportConfirm) {
        setShowImportConfirm(true)
        return
      }
      
      setItems(validated)
      setShowImport(false)
      setShowImportConfirm(false)
      setImportJson("")
      setError(null)
      
      // Show warning if some items were skipped
      if (messages.length > 0) {
        setToast(`⚠️ Imported ${validated.length} steps (${messages.length} skipped)`)
      } else {
        setToast(`✓ Imported ${validated.length} steps`)
      }
      setTimeout(() => setToast(null), 3000)
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON format: Check for missing commas, brackets, or quotes")
      } else {
        setError(err.message || "Failed to import checklist")
      }
    }
  }

  const visibleRunnerItems = useMemo(() => {
    return items.filter(item => {
      if (item.dependsOn.length === 0) return true
      return item.dependsOn.every(depId => runnerState[depId])
    })
  }, [items, runnerState])

  const completedCount = Object.keys(runnerState).length
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0

  // Auto-scroll to newly unlocked items in Runner mode
  useEffect(() => {
    if (mode === "runner" && visibleRunnerItems.length > prevVisibleCount && prevVisibleCount > 0) {
      // New items just became visible
      const newlyUnlockedItem = visibleRunnerItems[visibleRunnerItems.length - 1]
      if (newlyUnlockedItem) {
        setTimeout(() => {
          const element = document.querySelector(`[data-runner-item-id="${newlyUnlockedItem.id}"]`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 300) // Small delay for smooth transition
      }
    }
    setPrevVisibleCount(visibleRunnerItems.length)
  }, [visibleRunnerItems.length, mode, prevVisibleCount, visibleRunnerItems])

  return (
    <main className="min-h-screen p-3 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[color:var(--text)]">Smart Checklist</h1>
            <p className="text-xs sm:text-sm text-[color:var(--text-dim)] mt-1">
              Build dynamic checklists with AI assistance
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-[color:var(--surface-hover)] text-[color:var(--text-dim)]"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v1m0 12v1m7-7h-1M4 10H3m13.66-5.66l-.71.71M5.05 14.95l-.71.71m10.31 0l-.71-.71M5.05 5.05l-.71-.71M13 10a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <Card className="p-1">
          <div className="flex gap-1">
            <button
              onClick={() => {
                if (mode === 'runner' && completedCount > 0) {
                  if (!confirm('Switch to Builder mode? Your runner progress will be preserved but hidden.')) {
                    return
                  }
                }
                setMode("builder")
              }}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all relative",
                mode === "builder"
                  ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow-md"
                  : "text-[color:var(--text-dim)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-hover)]"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 6h4M6 8h4M6 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Builder
              </div>
            </button>
            <button
              onClick={() => setMode("runner")}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all relative",
                mode === "runner"
                  ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow-md"
                  : "text-[color:var(--text-dim)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-hover)]"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="5" cy="5" r="1.5" fill="currentColor"/>
                  <circle cx="5" cy="11" r="1.5" fill="currentColor"/>
                  <path d="M8 5h5M8 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Run
                {completedCount > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    mode === "runner" 
                      ? "bg-[color:var(--accent-contrast)] text-[color:var(--accent)]" 
                      : "bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                  )}>
                    {completedCount}/{items.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </Card>

        {/* Builder Mode */}
        {mode === "builder" && (
          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setShowAI(!showAI)
                    setShowImport(false)
                    setError(null)
                  }}
                  variant={showAI ? "default" : "outline"}
                  size="sm"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-2">
                    <path d="M8 2L9.5 5.5L13 7L9.5 8.5L8 12L6.5 8.5L3 7L6.5 5.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  AI Generate
                </Button>
                <Button
                  onClick={() => {
                    const newItem = createEmptyItem()
                    setItems(prev => [...prev, newItem])
                    setNewItemId(newItem.id)
                  }}
                  variant="outline"
                  size="sm"
                >
                  + Add Step
                </Button>
                <Button
                  onClick={handleExport}
                  variant="ghost"
                  size="sm"
                >
                  Export
                </Button>
                <Button
                  onClick={() => {
                    setShowImport(!showImport)
                    setShowAI(false)
                    setError(null)
                  }}
                  variant={showImport ? "default" : "ghost"}
                  size="sm"
                >
                  Import
                </Button>
              </div>
              {items.length > 0 && (
                <span className="text-xs text-[color:var(--text-dim)]">
                  {items.length} step{items.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* AI Generation Panel */}
            {showAI && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--text)]">AI Generation</p>
                      <p className="text-xs text-[color:var(--text-dim)] mt-1">
                        Describe your workflow and let AI create the steps
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAI(false)}
                      className="text-[color:var(--text-dim)] hover:text-[color:var(--text)]"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  <Input
                    type="password"
                    placeholder="Gemini API Key (get one at ai.google.dev)"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="text-sm"
                  />
                  <Textarea
                    placeholder="Example: 'Create an onboarding checklist for new SaaS customers using our accounting platform'"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating || !apiKey || !prompt}
                      className="flex-1"
                    >
                      {isGenerating ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Generating...
                        </>
                      ) : "Generate Checklist"}
                    </Button>
                    <Button onClick={() => setShowAI(false)} variant="ghost">
                      Cancel
                    </Button>
                  </div>
                  {error && <p className="text-xs text-rose-500">{error}</p>}
                  {!error && (
                    <p className="text-xs text-[color:var(--text-dim)]">
                      💡 Tip: Be specific about your process for better results
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Import Panel */}
            {showImport && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  {showImportConfirm ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-[color:var(--text)]">⚠️ Replace existing checklist?</p>
                        <p className="text-xs text-[color:var(--text-dim)]">
                          You have {items.length} existing step{items.length !== 1 ? 's' : ''}. Importing will replace all current items. This action cannot be undone.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleImport} 
                          variant="default"
                          className="flex-1"
                        >
                          Replace Checklist
                        </Button>
                        <Button 
                          onClick={() => {
                            setShowImportConfirm(false)
                            setShowImport(false)
                            setImportJson("")
                            setError(null)
                          }} 
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-[color:var(--text)]">Import JSON</p>
                      {error && (
                        <div className="rounded-lg border border-rose-500 bg-rose-50 dark:bg-rose-950/20 px-3 py-2">
                          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                            {error}
                          </p>
                        </div>
                      )}
                      <Textarea
                        placeholder="Paste JSON here"
                        value={importJson}
                        onChange={e => {
                          setImportJson(e.target.value)
                          setError(null) // Clear error when user types
                        }}
                        rows={12}
                        className={cn(
                          "font-mono text-xs",
                          error && "border-rose-500"
                        )}
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleImport} className="flex-1" disabled={!importJson.trim()}>
                          Import Checklist
                        </Button>
                        <Button 
                          onClick={() => {
                            setShowImport(false)
                            setImportJson("")
                            setError(null)
                          }} 
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </div>
                      {items.length > 0 && !error && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          Note: This will replace your current {items.length} step{items.length !== 1 ? 's' : ''}
                        </p>
                      )}
                      {!error && (
                        <p className="text-xs text-[color:var(--text-dim)]">
                          Import a previously exported checklist
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Checklist Items */}
            {items.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto mb-4 text-[color:var(--text-dim)] opacity-50">
                    <rect x="12" y="12" width="40" height="40" rx="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M20 26l6 6 12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="20" y1="42" x2="32" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="20" y1="48" x2="28" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <h3 className="text-lg font-medium text-[color:var(--text)] mb-2">No checklist yet</h3>
                  <p className="text-sm text-[color:var(--text-dim)] mb-6 max-w-sm mx-auto">
                    Create your first checklist by generating with AI or adding steps manually
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => setShowAI(true)} size="sm">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-2">
                        <path d="M8 2L9.5 5.5L13 7L9.5 8.5L8 12L6.5 8.5L3 7L6.5 5.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Generate with AI
                    </Button>
                    <Button 
                      onClick={() => {
                        const newItem = createEmptyItem()
                        setItems(prev => [...prev, newItem])
                        setNewItemId(newItem.id)
                      }} 
                      variant="outline" 
                      size="sm"
                    >
                      Add Step Manually
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  {items.map(item => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      allItems={items}
                      onChangeTitle={v =>
                        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, title: v } : i)))
                      }
                      onChangeDescription={v =>
                        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, description: v } : i)))
                      }
                      onChangeDependencies={deps =>
                        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, dependsOn: deps } : i)))
                      }
                      onDelete={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}

        {/* Runner Mode */}
        {mode === "runner" && (
          <div className="space-y-4">
            {/* Progress Bar */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[color:var(--text)]">Progress</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[color:var(--text-dim)]">{completedCount} of {items.length}</span>
                    {completedCount === items.length && items.length > 0 && (
                      <span className="text-xs font-medium text-[color:var(--accent-strong)]">🎉 Complete!</span>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-[color:var(--progress-track)] overflow-hidden">
                  <div
                    className="h-full bg-[color:var(--accent)] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {completedCount === items.length && items.length > 0 && (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-[color:var(--accent-strong)]">
                      All tasks completed! Great work! 🎊
                    </p>
                    <Button
                      onClick={() => {
                        if (confirm("Reset all checkboxes? This will uncheck all completed items.")) {
                          setRunnerState({})
                          setToast("✓ Checklist reset")
                          setTimeout(() => setToast(null), 3000)
                        }
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      Reset
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Checklist Items */}
            {items.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4 text-[color:var(--text-dim)]">
                    <rect x="10" y="10" width="28" height="28" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M17 20l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-[color:var(--text-dim)] mb-4">No steps available</p>
                  <Button onClick={() => setMode("builder")} size="sm">
                    Go to Builder
                  </Button>
                </CardContent>
              </Card>
            ) : visibleRunnerItems.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="mb-4">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto text-[color:var(--text-dim)]">
                      <path d="M24 12v12l8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <p className="text-[color:var(--text-dim)] mb-2">Waiting on dependencies</p>
                  <p className="text-xs text-[color:var(--text-dim)]">
                    Complete previous steps to unlock more tasks
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {visibleRunnerItems.map((item, index) => {
                  const isCompleted = !!runnerState[item.id]
                  const isNewlyUnlocked = index === visibleRunnerItems.length - 1 && visibleRunnerItems.length < items.length && !isCompleted
                  
                  return (
                    <label
                      key={item.id}
                      data-runner-item-id={item.id}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                        isCompleted
                          ? "border-[color:var(--accent-soft-border)] bg-[color:var(--accent-soft)] opacity-75"
                          : "border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--border-strong)] hover:shadow-sm",
                        isNewlyUnlocked && "ring-2 ring-[color:var(--accent-soft-border)] animate-unlock"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={() => {
                          setRunnerState(prev => {
                            const next = { ...prev }
                            if (next[item.id]) {
                              delete next[item.id]
                            } else {
                              next[item.id] = true
                            }
                            return next
                          })
                        }}
                        className="mt-0.5 h-5 w-5 rounded border-[color:var(--border)] text-[color:var(--accent)]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={cn(
                            "font-medium transition-all",
                            isCompleted ? "text-[color:var(--text-dim)] line-through" : "text-[color:var(--text)]"
                          )}>
                            {item.title}
                          </p>
                          {item.aiGenerated && (
                            <span className="text-[10px] font-medium rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[color:var(--accent-strong)]">
                              AI
                            </span>
                          )}
                          {item.dependsOn.length > 0 && !isCompleted && (
                            <span className="text-[10px] text-[color:var(--text-dim)] opacity-60">
                              🔒 {item.dependsOn.length} dependencies
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className={cn(
                            "text-sm mt-1 transition-all",
                            isCompleted ? "text-[color:var(--text-dim)] opacity-50" : "text-[color:var(--text-dim)]"
                          )}>
                            {item.description}
                          </p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            
            {/* Quick Actions */}
            {items.length > 0 && (
              <div className="flex gap-2 pt-2">
                {completedCount > 0 && completedCount < items.length && (
                  <Button
                    onClick={() => {
                      if (confirm("Mark all visible steps as complete?")) {
                        setRunnerState(prev => {
                          const next = { ...prev }
                          visibleRunnerItems.forEach(item => {
                            next[item.id] = true
                          })
                          return next
                        })
                        setToast("✓ All visible steps completed")
                        setTimeout(() => setToast(null), 3000)
                      }
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Complete All Visible
                  </Button>
                )}
                {completedCount > 0 && (
                  <Button
                    onClick={() => {
                      if (confirm("Clear all completed items?")) {
                        setRunnerState({})
                        setToast("✓ Progress reset")
                        setTimeout(() => setToast(null), 3000)
                      }
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    Reset Progress
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 shadow-lg backdrop-blur-sm">
            <p className="text-sm font-medium text-[color:var(--text)]">{toast}</p>
          </div>
        </div>
      )}
    </main>
  )
}