import { defineStore } from 'pinia'
import { ref } from 'vue'
import { workersApi } from '@/api'

export interface Worker {
  id: string
  name: string
  phone: string
  idCard?: string
  workerType?: string
  skillLevel?: string
  dailyWage: number
  overtimeWage?: number
  joinDate: string
  status: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export const useWorkerStore = defineStore('workers', () => {
  const workers = ref<Worker[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchWorkers(params?: { status?: string; search?: string }) {
    loading.value = true
    error.value = null
    try {
      const response = await workersApi.getAll(params)
      workers.value = response.data
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createWorker(worker: Partial<Worker>) {
    try {
      const response = await workersApi.create(worker)
      workers.value.unshift(response.data)
      return response.data
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateWorker(id: string, worker: Partial<Worker>) {
    try {
      const response = await workersApi.update(id, worker)
      const index = workers.value.findIndex(w => w.id === id)
      if (index !== -1) {
        workers.value[index] = response.data
      }
      return response.data
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function deleteWorker(id: string) {
    try {
      await workersApi.delete(id)
      workers.value = workers.value.filter(w => w.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return { workers, loading, error, fetchWorkers, createWorker, updateWorker, deleteWorker }
})