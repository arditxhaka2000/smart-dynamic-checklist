# Smart Dynamic Checklist with AI Suggestions

This project implements the **Smart Dynamic Checklist** take‑home assignment using **Next.js, TypeScript, Tailwind, shadcn‑style UI primitives, dnd‑kit, and Cypress**.

It is written as if I joined your team as a **senior frontend engineer**: the focus is on clear state architecture, predictable UX, and clean integration with the Gemini API.

## Tech Stack

- **Next.js 14 (App Router, TypeScript)**
- **React 18**
- **Tailwind CSS** for rapid, consistent styling
- **shadcn‑style UI primitives** (`Button`, `Input`, `Textarea`, `Card`) implemented locally
- **dnd‑kit** for accessible drag‑and‑drop
- **Cypress** for basic end‑to‑end coverage
- **Google Gemini** (`gemini-1.5-flash-latest`) via the official REST API

---

## Domain Context

The UX is tuned for **ops / accounting teams** who onboard customers into an ERP or accounting product:

- Steps are fine‑grained and composable, suitable for flows like **chart of accounts setup, VAT configuration, bank feed connection, and EHF/Peppol enablement**.
- Simple **dependency logic** reflects real‑world ordering, e.g. “Activate e‑invoicing” depends on “Customer master data created” and “VAT codes configured”.
- A small **analytics panel** gives an implementation lead instant feedback on where a customer is blocked.

---

## Core Features

### 1. Checklist Builder

- Create, edit, and reorder items.
- Drag‑and‑drop ordering implemented with `@dnd-kit/core` (keyboard friendly, minimal footprint).
- Each item has:
  - `title`
  - optional `description` (acceptance criteria / notes)
  - `dependsOn` array of other item IDs
  - `aiGenerated` flag (for Gemini suggestions)
- Dependencies are managed through **inline pill toggles** – easy to scan, no modal overhead.

Builder state is **autosaved to `localStorage`** under `smart-checklist-items-v1`.

### 2. Runner Mode

- Separate **Runner Mode** with its own `RunnerState` (`Record<string, boolean>`).
- Only items whose dependencies are all marked complete are visible:

  ```ts
  const visibleRunnerItems = items.filter(item =>
    item.dependsOn.every(depId => runnerState[depId])
  )
  ```

- Runner state is also **persisted** (`smart-checklist-runner-v1`) so progress survives refreshes.
- The “Reset progress” action clears runner state without mutating the underlying checklist.

This strict separation between “structure” and “execution” mirrors how you would design a production workflow engine.

### 3. AI Task Generation (Google Gemini)

- The UI exposes two fields:

  - **Gemini API key input** (required)
  - **Prompt textarea** (pre‑filled with an example SaaS accounting onboarding prompt)

- On “Generate tasks”:

  1. The browser calls `POST /api/generate` with `{ apikey, prompt, existing }`.
  2. The API route forwards the request to Gemini using the official REST API:

     ```ts
     const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apikey}`
     ```

  3. The prompt instructs Gemini to return **5–8 bullet‑style steps**.
  4. The response is parsed, cleaned, and deduplicated:

     - Strips bullets/numbering.
     - Trims whitespace.
     - Filters out empty lines.
     - Removes items that already exist in the checklist.

  5. The final list (up to 8 items) is converted into `ChecklistItem`s with `aiGenerated: true` and appended to the builder.

- **No mocks**: the code performs a real API call; you can plug in your own Gemini key to test end‑to‑end.

### 4. Autosave

- Builder and runner states are synchronized to `localStorage` on change, with defensive JSON parsing on load.
- This keeps the UX forgiving during experimentation and browser refreshes.

### 5. Export / Import

- **Export JSON**: serializes `ChecklistItem[]` as prettified JSON, downloads it as `checklist-export.json`, and mirrors it into a textarea for visibility.
- **Import from JSON**: pastes JSON into the textarea and overwrites the current builder state after validation.

This allows an implementation lead to version and share checklists across environments or customers.

### 6. Analytics Panel

A small analytics card summarizes the current run:

- Total steps
- Completed steps
- Hidden steps (due to unsatisfied dependencies)
- A subtle progress bar to visualize completion

Text copy explains that **runner state is isolated** from the builder, which is important for audits and historical runs.

---

## Dependency Modeling

Each `ChecklistItem` has:

```ts
type ChecklistItem = {
  id: string
  title: string
  description?: string
  dependsOn: string[]
  aiGenerated?: boolean
  createdAt: string
}
```

**Visibility in Runner Mode** is defined as:

> An item is visible if *all* items in `dependsOn` are completed.

This is a simple AND‑based dependency model that maps well to most onboarding flows and avoids the complexity of a full rule engine. In a production system we could evolve this to support OR groups or conditional expressions, but for the exercise I kept it intentionally predictable.

---

## Gemini API Usage

The server route lives at `src/app/api/generate/route.ts` and:

1. Accepts `{ apikey, prompt, existing }` in the request body.
2. Calls the official Gemini REST endpoint using `fetch`.
3. Extracts `candidates[0].content.parts[0].text` as the raw model output.
4. Normalizes output lines and removes bullet markers (`-`, `*`, `•`).
5. De‑duplicates and filters out any task already present in `existing`.
6. Returns at most 8 items in `{ items: string[] }`.

Because the API key is provided via **UI input**, you can test the same build locally, in staging, or in your internal environment without changing configuration.

---

## Visual Design Notes

- Dark theme with a **subtle radial background gradient** to keep the focus on content.
- Layout is responsive with a **primary work area** (builder/runner) and a **side rail** (analytics + domain notes).
- shadcn‑style primitives give consistent spacing, typography, and hover / focus states.
- Drag handles, dependency pills, and AI badges are intentionally minimal so they work well in dense enterprise UIs.

---

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

To run Cypress e2e tests:

```bash
npm run dev  # in one terminal
npm run cypress  # in another terminal
```

---

## Trade‑offs & Possible Extensions

- **Single list only.** For the assignment, everything lives in one checklist. In a real product we would add multi‑checklist support, template libraries, and customer‑specific instances.
- **Simple dependency logic.** Only AND dependencies are supported; more complex rules could be expressed via a small DSL or rule builder UI.
- **Client‑side Gemini key.** For a real system we would route Gemini calls through a backend that handles secrets, quota, and observability.

Even with these constraints, the current implementation demonstrates:

- Clean separation of builder vs runner state
- Robust parsing and normalization of LLM output
- Production‑style UX for an accounting/ERP onboarding context
