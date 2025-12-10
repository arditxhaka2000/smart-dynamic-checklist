export type ChecklistItem = {
  id: string
  title: string
  description?: string
  dependsOn: string[]
  aiGenerated?: boolean
  createdAt: string
}

export type RunnerState = Record<string, boolean>
