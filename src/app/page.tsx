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

const STORAGE_KEY = "smart-checklist-items-v1"
const RUNNER_KEY = "smart-checklist-runner-v1"

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
      <Card className={cn("mb-2 border-slate-800/80", item.aiGenerated && "border-primary-500/60")}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <button
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
              className="cursor-grab text-slate-500 hover:text-slate-200 text-xs px-1 py-1 rounded-md border border-slate-700/60 bg-slate-900/80"
            >
              ↕
            </button>
            <CardTitle className="text-xs uppercase tracking-wide text-slate-400">
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
            <p className="text-xs font-medium text-slate-400">Depends on</p>
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
                          ? "border-primary-500 bg-primary-500/10 text-primary-100"
                          : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500"
                      )}
                    >
                      {target.title || "Untitled step"}
                    </button>
                  )
                })}
              {allItems.length <= 1 && (
                <span className="text-[11px] text-slate-500 italic">
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

  function onDragEnd(event: any) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    setItems(items => arrayMove(items, oldIndex, newIndex))
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-slate-950/60 px-3 py-1 text-[11px] text-primary-100 shadow-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
            Gemini-powered onboarding checklist
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-slate-50">
            Smart Dynamic Checklist
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Designed for ops and accounting teams who onboard new customers every day. Define checklists,
            enforce dependencies, and let Gemini suggest missing steps — without losing control of the system.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            className={cn(
              "text-xs rounded-full border px-3 py-1.5 flex items-center gap-2 bg-slate-950/70 border-slate-700/80",
              mode === "builder" && "border-primary-500/70 text-primary-100"
            )}
            onClick={() => setMode("builder")}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Builder mode
          </button>
          <button
            type="button"
            className={cn(
              "text-xs rounded-full border px-3 py-1.5 flex items-center gap-2 bg-slate-950/70 border-slate-700/80",
              mode === "runner" && "border-primary-500/70 text-primary-100"
            )}
            onClick={() => setMode("runner")}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
            Runner mode
          </button>
        </div>
      </header>

      <section className="grid lg:grid-cols-[minmax(0,3fr)_minmax(260px,1.2fr)] gap-5 items-start">
        <Card className="border-slate-800">
          <CardHeader>
            <div>
              <CardTitle>
                {mode === "builder" ? "Checklist builder" : "Checklist runner"}
              </CardTitle>
              <CardDescription>
                {mode === "builder"
                  ? "Shape the checklist structure, dependencies, and AI suggestions."
                  : "Run through a live instance — only dependency-satisfied items appear."}
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
                    {isGenerating ? "Calling Gemini…" : "Generate tasks"}
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
                      <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/60 px-4 py-6 text-center text-xs text-slate-500">
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
                  <p className="text-[11px] font-medium text-slate-400 flex items-center gap-2">
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
                    <p className="text-[11px] text-slate-500">
                      This is useful for sharing checklists across environments or teams.
                    </p>
                  </div>
                </div>
              </>
            )}

            {mode === "runner" && (
              <div className="space-y-3">
                {visibleRunnerItems.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/60 px-4 py-6 text-center text-xs text-slate-500">
                    No visible steps yet. Complete dependency steps or go back to Builder mode to add items.
                  </div>
                )}
                {visibleRunnerItems.map(item => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 cursor-pointer hover:border-primary-500/60 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!runnerState[item.id]}
                      onChange={() => toggleRunner(item.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-primary-500"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-100">
                          {item.title}
                        </p>
                        {item.aiGenerated && (
                          <span className="text-[10px] rounded-full bg-primary-500/15 px-2 py-0.5 text-primary-100">
                            AI
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-400">
                          {item.description}
                        </p>
                      )}
                      {item.dependsOn.length > 0 && (
                        <p className="text-[11px] text-slate-500">
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
              <p className="pt-2 text-xs text-rose-400">
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
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                  <p className="text-[11px] text-slate-400">Total steps</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">{items.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-600/60 bg-emerald-950/30 px-3 py-3">
                  <p className="text-[11px] text-emerald-300/80">Completed</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-200">
                    {completedCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                  <p className="text-[11px] text-slate-400">Hidden (dependencies)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">{hiddenCount}</p>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all"
                  style={{
                    width: items.length === 0 ? "0%" : `${Math.min(100, (completedCount / items.length) * 100)}%`
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
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
            <CardContent className="space-y-2 text-[11px] text-slate-400">
              <p>
                • Steps are intentionally small and composable to map cleanly to accounting concepts
                like COA setup, VAT configuration, and integration checks.
              </p>
              <p>
                • Dependencies model real-world constraints (for example, you cannot activate EHF/Peppol
                flows before core master data is in place).
              </p>
              <p>
                • The analytics panel helps an implementation lead quickly understand where a customer
                is blocked during onboarding.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
