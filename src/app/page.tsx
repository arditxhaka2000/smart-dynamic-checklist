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
    title: "New step",
    description: "",
    dependsOn: [],
    createdAt: new Date().toISOString()
  }
}

function SortableItem({ item, onChangeTitle, onChangeDescription, allItems, onChangeDependencies }: {
  item: ChecklistItem
  allItems: ChecklistItem[]
  onChangeTitle: (v: string) => void
  onChangeDescription: (v: string) => void
  onChangeDependencies: (deps: string[]) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={cn("mb-2 border-[color:var(--border)]", item.aiGenerated && "border-[color:var(--accent-soft-border)] shadow-[0_0_0_1px_var(--accent-soft-border)]")}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <button
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
              className="cursor-grab text-[color:var(--text-dim)] hover:text-[color:var(--text)] text-xs px-1 py-1 rounded-md border border-[color:var(--border)] bg-[color:var(--card-soft)]"
            >
              ::
            </button>
            <CardTitle className="text-xs uppercase tracking-wide text-[color:var(--text-dim)]">
              {item.aiGenerated ? "AI suggestion" : "Manual step"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={item.title}
            onChange={e => onChangeTitle(e.target.value)}
            className="font-medium"
          />
          <Textarea
            value={item.description ?? ""}
            onChange={e => onChangeDescription(e.target.value)}
            placeholder="Optional description or acceptance criteria"
            rows={2}
          />

          <div className="space-y-1">
            <p className="text-xs font-medium text-[color:var(--text-dim)]">Depends on</p>
            <div className="flex flex-wrap gap-1">
              {allItems
                .filter(i => i.id !== item.id)
                .map(target => {
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
                        "text-[11px] px-2 py-1 rounded-full border transition-colors",
                        active
                          ? "border-[color:var(--accent-soft-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                          : "border-[color:var(--border)] bg-[color:var(--card-soft)] text-[color:var(--text-dim)] hover:border-[color:var(--border-strong)]"
                      )}
                    >
                      {target.title || "Untitled step"}
                    </button>
                  )
                })}
              {allItems.length <= 1 && (
                <span className="text-[11px] text-[color:var(--text-dim)] italic">
                  Add more steps to define dependencies
                </span>
              )}
            </div>
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
  const [prompt, setPrompt] = useState("Create an onboarding checklist for a small SaaS accounting customer.")
  const [isGenerating, setIsGenerating] = useState(false)
  const [exportJson, setExportJson] = useState("")
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    const storedTheme = window.localStorage.getItem(THEME_KEY) as Theme | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initialTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : (prefersDark ? "dark" : "light")
    setTheme(initialTheme)
    document.documentElement.dataset.theme = initialTheme

    const raw = window.localStorage.getItem(STORAGE_KEY)
    const rawRunner = window.localStorage.getItem(RUNNER_KEY)
    if (raw) {
      try {
        setItems(JSON.parse(raw))
      } catch {
        // ignore
      }
    }
    if (rawRunner) {
      try {
        setRunnerState(JSON.parse(rawRunner))
      } catch {
        // ignore
      }
    }
  }, [])

  // Autosave builder
  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  // Autosave runner
  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(RUNNER_KEY, JSON.stringify(runnerState))
  }, [runnerState])

  // Persist theme choice
  useEffect(() => {
    if (typeof window === "undefined") return
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const completedCount = useMemo(
    () => Object.values(runnerState).filter(Boolean).length,
    [runnerState]
  )

  const visibleRunnerItems = useMemo(() => {
    return items.filter(item =>
      item.dependsOn.every(depId => runnerState[depId])
    )
  }, [items, runnerState])

  const hiddenCount = items.length - visibleRunnerItems.length

  async function handleGenerateTasks() {
    setError(null)
    if (!apiKey) {
      setError("Please paste a Gemini API key. It is never sent to any backend other than Google.")
      return
    }
    setIsGenerating(true)
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: apiKey,
          prompt,
          existing: items.map(i => i.title)
        })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Gemini request failed")
      }

      const json = await res.json()
      const generated: string[] = json.items ?? []

      if (!generated.length) {
        setError("Gemini responded but I could not extract tasks. Try a slightly different prompt.")
        return
      }

      const newItems: ChecklistItem[] = generated.map(title => ({
        ...createEmptyItem(),
        title,
        aiGenerated: true
      }))

      setItems(prev => [...prev, ...newItems])
    } catch (e: any) {
      console.error(e)
      setError(e.message || "Something went wrong while calling Gemini")
    } finally {
      setIsGenerating(false)
    }
  }

  function handleResetRunner() {
    setRunnerState({})
  }

  function handleExport() {
    const payload = JSON.stringify(items, null, 2)
    setExportJson(payload)
    const blob = new Blob([payload], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "checklist-export.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFromText() {
    try {
      const parsed: ChecklistItem[] = JSON.parse(exportJson)
      if (!Array.isArray(parsed)) throw new Error("Invalid JSON format")
      setItems(parsed)
      setError(null)
    } catch (e: any) {
      setError("Import failed: " + (e.message ?? "Invalid JSON"))
    }
  }

  function toggleRunner(id: string) {
    setRunnerState(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  function toggleThemeMode() {
    setTheme(prev => (prev === "dark" ? "light" : "dark"))
  }

  function onDragEnd(event: any) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    setItems(items => arrayMove(items, oldIndex, newIndex))
  }

  const toggleClasses = "text-xs rounded-full border px-3 py-1.5 flex items-center gap-2 bg-[color:var(--card-soft)] border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--border-strong)]"

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-soft-border)] bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] text-[color:var(--accent-strong)] shadow-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--accent-strong)] animate-pulse" />
            Gemini-powered onboarding checklist
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-[color:var(--text)]">
            Smart Dynamic Checklist
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-dim)]">
            Designed for ops and accounting teams who onboard new customers every day. Define checklists,
            enforce dependencies, and let Gemini suggest missing steps -- without losing control of the system.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            className={cn(toggleClasses, theme === "light" && "border-[color:var(--accent-soft-border)] text-[color:var(--accent-strong)] bg-[color:var(--accent-soft)]")}
            onClick={toggleThemeMode}
            aria-label="Toggle light and dark theme"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--accent-strong)]" />
            {theme === "dark" ? "Dark" : "Light"} theme
          </button>
          <button
            type="button"
            className={cn(
              toggleClasses,
              mode === "builder" && "border-[color:var(--accent-soft-border)] text-[color:var(--accent-strong)] bg-[color:var(--accent-soft)]"
            )}
            onClick={() => setMode("builder")}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Builder mode
          </button>
          <button
            type="button"
            className={cn(
              toggleClasses,
              mode === "runner" && "border-[color:var(--accent-soft-border)] text-[color:var(--accent-strong)] bg-[color:var(--accent-soft)]"
            )}
            onClick={() => setMode("runner")}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
            Runner mode
          </button>
        </div>
      </header>

      <section className="grid lg:grid-cols-[minmax(0,3fr)_minmax(260px,1.2fr)] gap-5 items-start">
        <Card className="border-[color:var(--border-strong)]">
          <CardHeader>
            <div>
              <CardTitle>
                {mode === "builder" ? "Checklist builder" : "Checklist runner"}
              </CardTitle>
              <CardDescription>
                {mode === "builder"
                  ? "Shape the checklist structure, dependencies, and AI suggestions."
                  : "Run through a live instance -- only dependency-satisfied items appear."}
              </CardDescription>
            </div>
            {mode === "runner" && (
              <Button variant="outline" size="sm" onClick={handleResetRunner}>
                Reset progress
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "builder" && (
              <>
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                  <Input
                    placeholder="Paste Gemini API key (not stored, used only client-side)"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTasks}
                    disabled={isGenerating}
                    className="whitespace-nowrap"
                  >
                    {isGenerating ? "Calling Gemini..." : "Generate tasks"}
                  </Button>
                </div>
                <Textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={3}
                  className="text-sm"
                />

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={items.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card-soft)] px-4 py-6 text-center text-xs text-[color:var(--text-dim)]">
                        Start by adding a step manually or generating suggestions from Gemini.
                      </div>
                    )}
                    {items.map(item => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        allItems={items}
                        onChangeTitle={v =>
                          setItems(prev =>
                            prev.map(i => (i.id === item.id ? { ...i, title: v } : i))
                          )
                        }
                        onChangeDescription={v =>
                          setItems(prev =>
                            prev.map(i => (i.id === item.id ? { ...i, description: v } : i))
                          )
                        }
                        onChangeDependencies={deps =>
                          setItems(prev =>
                            prev.map(i => (i.id === item.id ? { ...i, dependsOn: deps } : i))
                          )
                        }
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="subtle"
                    onClick={() => setItems(prev => [...prev, createEmptyItem()])}
                  >
                    + Add step
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleExport}
                  >
                    Export JSON
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-medium text-[color:var(--text-dim)] flex items-center gap-2">
                    Import checklist from JSON
                  </p>
                  <Textarea
                    value={exportJson}
                    onChange={e => setExportJson(e.target.value)}
                    rows={4}
                    placeholder="Paste JSON and click 'Import from JSON' to overwrite the current checklist."
                    className="text-xs font-mono"
                  />
                  <div className="flex justify-between items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleImportFromText}
                    >
                      Import from JSON
                    </Button>
                    <p className="text-[11px] text-[color:var(--text-dim)]">
                      This is useful for sharing checklists across environments or teams.
                    </p>
                  </div>
                </div>
              </>
            )}

            {mode === "runner" && (
              <div className="space-y-3">
                {visibleRunnerItems.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card-soft)] px-4 py-6 text-center text-xs text-[color:var(--text-dim)]">
                    No visible steps yet. Complete dependency steps or go back to Builder mode to add items.
                  </div>
                )}
                {visibleRunnerItems.map(item => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--card-soft)] px-4 py-3 cursor-pointer hover:border-[color:var(--accent-soft-border)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!runnerState[item.id]}
                      onChange={() => toggleRunner(item.id)}
                      className="mt-1 h-4 w-4 rounded border-[color:var(--border)] bg-[color:var(--card-soft)] text-[color:var(--accent-strong)]"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[color:var(--text)]">
                          {item.title}
                        </p>
                        {item.aiGenerated && (
                          <span className="text-[10px] rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[color:var(--accent-strong)]">
                            AI
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-[color:var(--text-dim)]">
                          {item.description}
                        </p>
                      )}
                      {item.dependsOn.length > 0 && (
                        <p className="text-[11px] text-[color:var(--text-dim)]">
                          Depends on:{" "}
                          {item.dependsOn
                            .map(id => items.find(i => i.id === id)?.title)
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {error && (
              <p className="pt-2 text-xs text-rose-500">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Checklist analytics</CardTitle>
              <CardDescription>
                A quick snapshot of how this run is progressing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--card-soft)] px-3 py-3">
                  <p className="text-[11px] text-[color:var(--text-dim)]">Total steps</p>
                  <p className="mt-1 text-lg font-semibold text-[color:var(--text)]">{items.length}</p>
                </div>
                <div className="rounded-xl border border-[color:var(--accent-soft-border)] bg-[color:var(--accent-soft)] px-3 py-3">
                  <p className="text-[11px] text-[color:var(--accent-strong)]">Completed</p>
                  <p className="mt-1 text-lg font-semibold text-[color:var(--accent-strong)]">
                    {completedCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--card-soft)] px-3 py-3">
                  <p className="text-[11px] text-[color:var(--text-dim)]">Hidden (dependencies)</p>
                  <p className="mt-1 text-lg font-semibold text-[color:var(--text)]">{hiddenCount}</p>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-[color:var(--progress-track)] overflow-hidden">
                <div
                  className="h-full bg-[color:var(--accent)] transition-all"
                  style={{
                    width: items.length === 0 ? "0%" : `${Math.min(100, (completedCount / items.length) * 100)}%`
                  }}
                />
              </div>
              <p className="text-[11px] text-[color:var(--text-dim)]">
                Runner state is isolated from the builder. You can safely experiment with new structures
                without impacting historical runs.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Design notes</CardTitle>
              <CardDescription>
                How this aligns with accounting / ERP onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] text-[color:var(--text-dim)]">
              <p>
                - Steps are intentionally small and composable to map cleanly to accounting concepts
                like COA setup, VAT configuration, and integration checks.
              </p>
              <p>
                - Dependencies model real-world constraints (for example, you cannot activate EHF/Peppol
                flows before core master data is in place).
              </p>
              <p>
                - The analytics panel helps an implementation lead quickly understand where a customer
                is blocked during onboarding.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
