import { useCallback, useEffect, useState } from 'react'
import {
  clearProjects as clearProjectsRequest,
  createProject as createProjectRequest,
  deleteProject,
  listProjects,
  loadSampleProjects,
  updateProject as updateProjectRequest,
} from '@/lib/api'
import type { Project, ProjectInput, StorageProblem } from '@/lib/projects'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [ready, setReady] = useState(false)
  const [problem, setProblem] = useState<StorageProblem | null>(null)

  const load = useCallback(async () => {
    try {
      const next = await listProjects()
      setProjects(next)
      setProblem(null)
    } catch {
      setProjects([])
      setProblem('unavailable')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const addProject = useCallback(async (input: ProjectInput) => {
    try {
      const created = await createProjectRequest(input)
      setProjects((current) => [created, ...current])
      setProblem(null)
    } catch (error) {
      setProblem('write-failed')
      throw error
    }
  }, [])

  const updateProject = useCallback(async (id: string, input: ProjectInput) => {
    try {
      const saved = await updateProjectRequest(id, input)
      setProjects((current) =>
        current.map((project) => (project.id === id ? saved : project)),
      )
      setProblem(null)
    } catch (error) {
      setProblem('write-failed')
      throw error
    }
  }, [])

  const removeProject = useCallback(async (id: string) => {
    const previous = projects
    setProjects((current) => current.filter((project) => project.id !== id))
    try {
      await deleteProject(id)
      setProblem(null)
    } catch (error) {
      setProjects(previous)
      setProblem('write-failed')
      throw error
    }
  }, [projects])

  const useSamples = useCallback(async () => {
    try {
      const next = await loadSampleProjects()
      setProjects(next)
      setProblem(null)
    } catch (error) {
      setProblem('write-failed')
      throw error
    }
  }, [])

  const clearProjects = useCallback(async () => {
    const previous = projects
    setProjects([])
    try {
      await clearProjectsRequest()
      setProblem(null)
    } catch (error) {
      setProjects(previous)
      setProblem('write-failed')
      throw error
    }
  }, [projects])

  return {
    projects,
    ready,
    problem,
    addProject,
    updateProject,
    removeProject,
    useSamples,
    clearProjects,
  }
}
