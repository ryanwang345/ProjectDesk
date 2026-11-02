import { useCallback, useState } from 'react'
import {
  createProject,
  loadProjects,
  sampleProjects,
  saveProjects,
  withUpdate,
  type Project,
  type ProjectInput,
  type StorageProblem,
} from '@/lib/projects'

function readDesk(): { projects: Project[]; problem: StorageProblem | null } {
  const loaded = loadProjects()
  return { projects: loaded.projects, problem: loaded.problem }
}

export function useProjects() {
  const [desk, setDesk] = useState(readDesk)
  const { projects, problem } = desk

  const commit = useCallback((recipe: (current: Project[]) => Project[]) => {
    setDesk((current) => {
      const next = recipe(current.projects)
      const saved = saveProjects(next)
      return {
        projects: next,
        problem: saved ? null : current.problem === 'unavailable' ? 'unavailable' : 'write-failed',
      }
    })
  }, [])

  const addProject = useCallback(
    (input: ProjectInput) => {
      commit((current) => [createProject(input), ...current])
    },
    [commit],
  )

  const updateProject = useCallback(
    (id: string, patch: Partial<ProjectInput>) => {
      commit((current) =>
        current.map((project) => (project.id === id ? withUpdate(project, patch) : project)),
      )
    },
    [commit],
  )

  const removeProject = useCallback(
    (id: string) => {
      commit((current) => current.filter((project) => project.id !== id))
    },
    [commit],
  )

  const useSamples = useCallback(() => {
    commit(() => sampleProjects())
  }, [commit])

  const clearProjects = useCallback(() => {
    commit(() => [])
  }, [commit])

  return {
    projects,
    problem,
    addProject,
    updateProject,
    removeProject,
    useSamples,
    clearProjects,
  }
}
