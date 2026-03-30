import { defineStore } from 'pinia'
import { ref } from 'vue'
import { attendanceApi } from '@/api'

export interface Attendance {
  id: string
  workerId: string
  date: string
  clockInTime?: string
  clockOutTime?: string
  status: string
  overtimeHours?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export const useAttendanceStore = defineStore('attendance', () => {
  const records = ref<Attendance[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAttendance() {
    loading.value = true
    error.value = null
    try {
      const response = await attendanceApi.getAll()
      records.value = response.data
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createAttendance(attendance: Partial<Attendance>) {
    try {
      const response = await attendanceApi.create(attendance)
      records.value.unshift(response.data)
      return response.data
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateAttendance(id: string, attendance: Partial<Attendance>) {
    try {
      const response = await attendanceApi.update(id, attendance)
      const index = records.value.findIndex(r => r.id === id)
      if (index !== -1) {
        records.value[index] = response.data
      }
      return response.data
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function deleteAttendance(id: string) {
    try {
      await attendanceApi.delete(id)
      records.value = records.value.filter(r => r.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return { records, loading, error, fetchAttendance, createAttendance, updateAttendance, deleteAttendance }
})