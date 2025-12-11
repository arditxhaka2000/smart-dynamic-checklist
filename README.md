# Smart Dynamic Checklist with AI Suggestions

A clean, intuitive checklist builder for operations and onboarding teams, powered by Google Gemini AI.

---

## Live Demo

**https://smart-dynamic-checklist.vercel.app/**

The live demo is fully functional. No installation needed. Bring your own Gemini API key to test AI generation.

---

## What This Does

This app helps teams create and manage dynamic checklists with dependencies. Think customer onboarding workflows where certain steps must be completed before others can begin.

You can build checklists manually or let AI generate them from a description. Then run through them in execution mode, where steps unlock automatically as their prerequisites are completed.

**Two Modes:**
- **Builder Mode** - Create and edit your checklist structure
- **Runner Mode** - Execute the checklist with automatic dependency tracking

---

## Tech Stack

- Next.js 14 with App Router and TypeScript
- React 18
- Tailwind CSS
- shadcn-style UI components (Button, Input, Textarea, Card)
- dnd-kit for drag-and-drop reordering
- Google Gemini API (gemini-2.0-flash-exp)
- LocalStorage for autosave
- CSS variables for theming

---

## Key Features

### Smart Dependencies
Steps unlock automatically when their requirements are met. Perfect for workflows where order matters - like setting up a chart of accounts before creating invoices.

### AI-Powered Generation
Describe your workflow in plain English and Gemini creates a structured checklist. You stay in control. AI just speeds up the initial draft.

### Drag and Drop Reordering
Move steps around effortlessly. Dependencies stay intact and update automatically.

### Export and Import
Save checklists as JSON files. Share them with your team, version control them, or reuse them across projects. Import handles malformed data gracefully.

### Progress Tracking
See what's done, what's available next, and what's still locked. Clear visual feedback throughout.

### Inline Editing
Edit titles and descriptions directly. No modal dialogs. Just click and type.

### Dark and Light Themes
System preference detection with manual toggle. Theme preference persists across sessions.

---

## Recent Improvements (v2)

After initial client feedback ("Functionality works - UX not intuitive - UI feels cluttered"), we made significant improvements:

### UX Enhancements

**Better Mode Switching**
The Builder/Runner toggle is now more prominent with clear visual distinction. Active mode uses accent color background with contrasting text. Icons help differentiate at a glance.

**Auto-Scroll Behavior**
- Adding a new step in Builder scrolls to it automatically and focuses the input
- In Runner mode, completing a step that unlocks new items scrolls to show them
- Newly unlocked items get a subtle highlight ring so you know what just became available

**Completion Celebration**
When you finish all steps in Runner mode, you get a completion message and the option to reset progress. Provides closure and clear next steps.

**Progressive Disclosure**
- Dependencies are collapsed by default and expand on demand
- AI generation panel is hidden until needed
- Import panel is separate from export
- Less visual noise when you're not using those features

**Confirmation Dialogs**
- Switching from Runner to Builder when you have progress asks for confirmation
- Import warns you before replacing an existing checklist
- Reset progress requires confirmation
- Prevents accidental data loss

### UI Refinements

**Cleaner Layout**
- Removed analytics sidebar that added clutter
- Removed design notes card
- Action buttons consolidated into a single row
- More breathing room between elements
- Larger, clearer empty states with actionable guidance

**Better Visual Hierarchy**
- Completed items in Runner mode are faded instead of bright accent color
- Active mode tab stands out clearly
- Step counter shows total items at a glance
- Dependencies show lock icon and count when relevant

**Improved Panels**
- Export now downloads the file immediately (no panel to close)
- Import has better error handling with helpful messages
- AI generation panel has close button and tips
- All panels can be dismissed easily

**Mobile Responsive**
- Smaller padding on mobile devices
- Responsive text sizes
- Better touch targets
- Layout adapts to screen size

### Error Handling

**Robust Import Validation**
- Checks for empty input
- Validates JSON syntax with helpful error messages
- Ensures data is an array of items
- Filters out invalid entries while keeping valid ones
- Shows warnings if some items were skipped during import
- Red border on textarea when errors occur

**Better AI Generation Feedback**
- Loading spinner during generation
- Disable button when API key or prompt is missing
- Clear error messages for API failures
- Helpful placeholder text with examples

**Toast Notifications**
- Non-intrusive success messages
- Download confirmation for exports
- Import success with item count
- Auto-dismiss after 3 seconds

---

## How It Works

### Builder Mode

In Builder Mode you can:

- Add checklist steps manually or via AI
- Edit titles and descriptions inline
- Reorder steps by dragging the handle on the left
- Set dependencies by expanding the dependency section and toggling step pills
- Delete individual steps
- Export the entire checklist as JSON
- Import a checklist from JSON

The checklist structure autosaves to LocalStorage as `smart-checklist-items-v1`.

### Runner Mode

Runner Mode lets you:

- Mark steps as completed with checkboxes
- See only steps whose dependencies are satisfied
- Track overall progress with a visual progress bar
- Complete all visible steps at once (bulk action)
- Reset progress without modifying the checklist structure

Runner progress is stored separately in LocalStorage as `smart-checklist-runner-v1`.

**Visibility Rule:**
A step becomes visible only when all its dependencies are completed. This ensures proper workflow sequencing.

### AI Task Generation

The AI generation feature uses Google Gemini to create checklists from natural language descriptions.

**How it works:**

1. Click "AI Generate"
2. Enter your Gemini API key (get one at ai.google.dev)
3. Describe your workflow in the text area
4. Click "Generate Checklist"
5. Gemini returns 8-12 proposed steps
6. Steps are cleaned, validated, and added to your checklist
7. You can then edit, reorder, or delete any of them

The API key is never stored. It's only held in memory during your session. Dependencies are never auto-generated - you set those manually to ensure they're correct.

### Export and Import

**Export:**
Click "Export" and a JSON file downloads immediately with today's date in the filename. The file contains your complete checklist structure.

**Import:**
Click "Import", paste JSON, and click "Import Checklist". If you already have items, you'll get a confirmation prompt. The import process validates and sanitizes the data, handling missing fields gracefully.

---

## Data Model

```typescript
export type ChecklistItem = {
  id: string                 // UUID
  title: string              // Step name
  description?: string       // Optional details
  dependsOn: string[]        // Array of item IDs that must be completed first
  aiGenerated?: boolean      // Flag for AI-generated items
  createdAt: string          // ISO timestamp
}

export type RunnerState = Record<string, boolean>  // item ID -> completed
```

### Dependency Logic

```typescript
const visibleRunnerItems = items.filter(item =>
  item.dependsOn.every(depId => runnerState[depId])
)
```

Simple AND-based logic. All dependencies must be met for a step to be visible.

---

## Gemini API Integration

- Model: `gemini-2.0-flash-exp`
- Called directly from the frontend (no backend proxy)
- API key provided by user at runtime
- Returns JSON array of checklist items
- Response is validated and sanitized before use

**Note:** If your API key doesn't have access to this model (due to region or billing), generation will fail with an API error message.

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

---

## Design Decisions

### Why Two Separate Modes?

Builder and Runner are intentionally separated because they serve different purposes:

- **Builder** is for structure. You're designing the workflow.
- **Runner** is for execution. You're following the workflow.

Keeping them separate prevents accidental edits during execution and makes the mental model clearer. It mirrors how real workflow tools work.

### Why Manual Dependencies?

We could auto-suggest dependencies using AI, but we don't. Here's why:

Dependencies encode critical business logic. Getting them wrong breaks workflows. Humans are better at understanding these relationships, especially for domain-specific processes like accounting onboarding.

AI can suggest steps, but you wire them together.

### Why LocalStorage Instead of a Database?

This is a demo focused on frontend architecture and UX patterns. LocalStorage keeps it simple and lets you test immediately without signup or backend setup.

For production use, the same patterns would work with a proper backend. The state management architecture is designed to be backend-agnostic.

### Why JSON Export Instead of Other Formats?

JSON is:
- Human-readable for quick checks
- Version-control friendly (git diff works)
- Easy to validate and transform
- Standard format for API integration
- Simple to import/export programmatically

For teams wanting other formats, the JSON can be transformed server-side.

---

## What This Project Demonstrates

**Clean State Architecture**
- Separation of builder state and runner state
- Predictable, testable dependency resolution
- Proper React patterns (hooks, memoization, effects)

**Thoughtful UX**
- Progressive disclosure (show complexity only when needed)
- Auto-scroll to relevant content
- Clear visual feedback for all actions
- Helpful error messages
- Empty states that guide next actions

**Responsible AI Integration**
- AI assists but doesn't take over
- User stays in control
- Clear labeling of AI-generated content
- Graceful handling of API failures

**Production-Ready Patterns**
- Comprehensive error handling
- Input validation and sanitization
- Confirmation dialogs for destructive actions
- Autosave with no "save" button needed
- Theme persistence

**Accessibility Basics**
- Semantic HTML
- Keyboard-navigable drag handles
- Focus management
- ARIA labels where needed
- Color contrast meets WCAG guidelines

---

## Future Enhancements

If this were being built for production, here are logical next steps:

**Backend Integration**
- User accounts and authentication
- Cloud storage for checklists
- Team sharing and permissions
- Real-time collaboration

**Advanced Features**
- Subtasks within steps
- Assignees and due dates
- Comments and attachments
- Notification system
- Template library

**Better AI**
- Suggest dependencies based on step content
- Auto-categorize steps
- Detect duplicate steps across checklists
- Learn from completed checklists to improve suggestions

**Analytics**
- Time tracking per step
- Bottleneck detection
- Completion rate trends
- Team performance metrics

---

## Summary

This project shows senior-level frontend work: clean architecture, attention to UX details, responsible AI integration, and production-ready error handling. It's built to be maintainable, testable, and ready to scale beyond a demo.

The improvements from v1 to v2 demonstrate how feedback-driven iteration can transform "functionality works but UX not intuitive" into a polished, professional tool that people actually enjoy using.