# Smart Dynamic Checklist with AI Suggestions

This project implements the **Smart Dynamic Checklist with AI
Suggestions** take-home assignment using **Next.js, TypeScript,
Tailwind, shadcn-style UI primitives, dnd-kit, and Cypress**.

It is written and structured as if joining the team as a **senior
frontend engineer**, with focus on:

-   Predictable, testable state architecture\
-   Human-in-the-loop AI usage (Gemini)\
-   Clear separation of concerns (Builder vs Runner)\
-   UI patterns that can scale beyond a demo\
-   Domain-aware UX for accounting / ERP onboarding

------------------------------------------------------------------------

## Live Demo (Vercel)

The project is deployed on **Vercel** and can be accessed here:

 **https://smart-dynamic-checklist.vercel.app/**

The live demo allows reviewers to: - Explore Builder and Runner modes -
Test dependency logic and progress tracking - Toggle dark/light theme -
Generate checklist steps using their own Gemini API key

No setup is required to explore the UI.

------------------------------------------------------------------------

## Tech Stack

-   **Next.js 14** (App Router, TypeScript)
-   **React 18**
-   **Tailwind CSS**
-   **shadcn-style UI primitives** implemented locally (`Button`,
    `Input`, `Textarea`, `Card`)
-   **dnd-kit** for accessible drag-and-drop sorting
-   **Cypress** for basic end-to-end tests
-   **Google Gemini API** (`gemini-2.5-flash`) via the official REST API
-   **LocalStorage** for autosave (builder + runner state)
-   **CSS variables + `data-theme`** for dark / light mode

------------------------------------------------------------------------

## High-Level Concept

The app is designed for **ops, accounting, and ERP implementation
teams** onboarding new customers and needing checklists that:

-   Vary by customer type\
-   Are easy to tweak and reuse\
-   Encode real-world dependencies\
-   Can be accelerated using AI without giving up human control

Two modes are intentionally separated:

-   **Builder Mode** → defines checklist structure\
-   **Runner Mode** → tracks execution state

This mirrors real-world onboarding and workflow systems.

------------------------------------------------------------------------

## Core Features

### 1. Checklist Builder

In Builder Mode you can:

-   Add checklist steps
-   Edit titles and descriptions inline
-   Reorder steps via drag-and-drop
-   Set dependencies using toggleable pills
-   Identify AI-generated steps

Checklist structure is autosaved to:

-   `smart-checklist-items-v1`

------------------------------------------------------------------------

### 2. Runner Mode

Runner Mode allows you to:

-   Mark steps as completed
-   See only steps whose dependencies are satisfied
-   Reset progress without modifying the checklist structure

Visibility rule:

> A step becomes visible only when all its dependencies are completed.

Runner progress state is stored separately:

-   `smart-checklist-runner-v1`

------------------------------------------------------------------------

### 3. AI Task Generation (Gemini)

The **Generate Tasks** feature provides AI-assisted checklist creation.

**Flow:**

1.  Paste a Gemini API key into the UI (never persisted)
2.  Enter or adjust the prompt
3.  Click **Generate tasks**
4.  AI-generated suggestions are cleaned, deduplicated, and appended to
    the checklist

AI improves speed and reduces omissions while keeping full human
control.\
Dependencies are **never auto-generated**.

------------------------------------------------------------------------

### 4. Export / Import via JSON

Checklist templates can be shared and reused.

-   **Export JSON** serializes the checklist to a readable JSON format
-   **Import from JSON** overwrites the current checklist from pasted
    JSON

This enables versioning, reuse, and future backend integration.

Imported checklists are sanitized on load to normalize IDs, dependencies, and missing fields, preventing malformed JSON from crashing the app.


------------------------------------------------------------------------

### 5. Analytics Panel

A lightweight analytics panel shows:

-   Total number of steps
-   Completed steps
-   Hidden steps (blocked by dependencies)
-   Overall progress

This mirrors what an implementation lead needs to monitor onboarding
status.

------------------------------------------------------------------------

### 6. Dark / Light Theme Support

The app supports dark and light themes.

-   Theme is stored in `localStorage` (`smart-checklist-theme-v1`)
-   Synced via `document.documentElement.dataset.theme`
-   CSS variables in `globals.css` define theme tokens
-   Components consume tokens instead of hard-coded colors

This keeps the UI consistent, accessible, and easy to extend.

------------------------------------------------------------------------

## Data Model & Dependency Logic

``` ts
export type ChecklistItem = {
  id: string
  title: string
  description?: string
  dependsOn: string[]
  aiGenerated?: boolean
  createdAt: string
}

export type RunnerState = Record<string, boolean>
```

Dependency logic:

``` ts
const visibleRunnerItems = items.filter(item =>
  item.dependsOn.every(depId => runnerState[depId])
)
```

This AND-based model covers real onboarding constraints while keeping
logic predictable.

------------------------------------------------------------------------

## Gemini API Integration

-   Endpoint: `/api/generate`
-   Model: `gemini-2.5-flash`
-   Real API calls (no mocks)
-   API key is provided at runtime via UI and never committed

**Note**: The app targets the `gemini-2.5-flash` model.  
If a provided API key does not have access to this model (due to region or billing),
the AI generation request will fail with a clear API error.
------------------------------------------------------------------------

## Running the Project Locally

``` bash
npm install
npm run dev
```

Open: `http://localhost:3000`

------------------------------------------------------------------------

## Summary

This project demonstrates **senior-level frontend architecture**,
responsible AI integration, and domain-aware UX for accounting and ERP
onboarding workflows.
