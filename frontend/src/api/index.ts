import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// 农历年份名称工具
const ZODIAC_ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

export function getGanzhi(yearNumber: number): string {
  const stem = HEAVENLY_STEMS[(yearNumber - 4) % 10]
  const branch = EARTHLY_BRANCHES[(yearNumber - 4) % 12]
  return `${stem}${branch}`
}

export function getZodiacName(yearNumber: number): string {
  return ZODIAC_ANIMALS[(yearNumber - 4) % 12] + '年'
}

export function getZodiacLabel(yearNumber: number): string {
  return `${getZodiacName(yearNumber)}(${yearNumber})`
}

export function getLunarYearName(yearNumber: number): string {
  return `${getGanzhi(yearNumber)}${ZODIAC_ANIMALS[(yearNumber - 4) % 12]}年`
}

export function getLunarYearLabel(yearNumber: number): string {
  return `${getLunarYearName(yearNumber)}(${yearNumber})`
}

// Workers API
export const workersApi = {
  getAll: (params?: { status?: string; search?: string }) => 
    api.get('/workers', { params }),
  getById: (id: string) => api.get(`/workers/${id}`),
  create: (data: any) => api.post('/workers', data),
  update: (id: string, data: any) => api.put(`/workers/${id}`, data),
  delete: (id: string) => api.delete(`/workers/${id}`)
}

// Attendance API
export const attendanceApi = {
  getAll: () => api.get('/attendance'),
  getByWorker: (workerId: string) => api.get(`/attendance/worker/${workerId}`),
  getByDate: (date: string) => api.get(`/attendance/date/${date}`),
  getByRange: (start: string, end: string) => 
    api.get('/attendance/range', { params: { start, end } }),
  create: (data: any) => api.post('/attendance', data),
  batchUpsert: (records: any[]) => api.post('/attendance/batch-upsert', { records }),
  update: (id: string, data: any) => api.put(`/attendance/${id}`, data),
  delete: (id: string) => api.delete(`/attendance/${id}`),
  getTodayStats: () => api.get('/attendance/today-stats'),
  getTrend: (start: string, end: string) => 
    api.get('/attendance/trend', { params: { start, end } })
}

// Settings API
export const settingsApi = {
  getAll: () => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
  getStats: () => api.get('/settings/stats'),
  exportBackup: () => api.get('/settings/backup/export', { responseType: 'blob' }),
  importBackup: (fileBuffer: ArrayBuffer) =>
    api.post('/settings/backup/import', fileBuffer, {
      headers: { 'Content-Type': 'application/octet-stream' }
    })
}

export const salaryApi = {
  calculate: (year: number, month: number) => 
    api.get('/salary/calculate', { params: { year, month } }),
  yearly: () => 
    api.get('/salary/yearly'),
  annualSummaryWithPayments: (year?: number) =>
    api.get('/salary/annual-summary-with-payments', { params: { year } })
}

export const salaryPaymentApi = {
  getAll: (params?: { workerId?: string; startDate?: string; endDate?: string }) => 
    api.get('/salary/payments', { params }),
  getById: (id: string) => api.get(`/salary/payments/${id}`),
  create: (data: any) => api.post('/salary/payments', data),
  update: (id: string, data: any) => api.put(`/salary/payments/${id}`, data),
  updateRemarks: (id: string, remarks: string) => 
    api.put(`/salary/payments/${id}/remarks`, { remarks }),
  delete: (id: string) => api.delete(`/salary/payments/${id}`)
}

export const dashboardApi = {
  getToday: () => api.get('/dashboard/today'),
  getMonth: () => api.get('/dashboard/month'),
  getYear: () => api.get('/dashboard/year'),
  getYearByNumber: (year: number) => api.get('/dashboard/year', { params: { year } })
}

// Years API
export const yearsApi = {
  getAll: () => api.get('/years'),
  getById: (id: string) => api.get(`/years/${id}`),
  getMaxYear: () => api.get('/years/max'),
  create: (data: any) => api.post('/years', data),
  update: (id: string, data: any) => api.put(`/years/${id}`, data),
  delete: (id: string) => api.delete(`/years/${id}`)
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  check: () =>
    api.get('/auth/check')
}

// Users API
export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`)
}

// Roles API
export const rolesApi = {
  getAll: () => api.get('/roles'),
  create: (data: any) => api.post('/roles', data),
  update: (id: string, data: any) => api.put(`/roles/${id}`, data),
  delete: (id: string) => api.delete(`/roles/${id}`)
}

export default api