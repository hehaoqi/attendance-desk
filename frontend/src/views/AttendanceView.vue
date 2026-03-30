<template>
  <div class="attendance-view">
    <div v-if="isTodayView">
      <a-card title="当日打卡">
        <template #extra>
          <a-space>
            <a-date-picker v-model:value="selectedDate" @change="fetchTodayAttendance" :locale="zhCN" />
            <a-button @click="exportTodayData">导出当日数据</a-button>
          </a-space>
        </template>
        
        <div class="attendance-cards" v-if="!loading">
          <div v-for="worker in todayWorkers" :key="worker.workerId" class="check-in-card">
            <!-- 头部区域：姓名 + 日期 -->
            <div class="card-header">
              <span class="worker-name">{{ worker.workerName }}</span>
              <span class="date-badge">{{ selectedDate.format('YYYY-MM-DD') }}</span>
            </div>
            
            <!-- 核心信息行：考勤状态 + 加班时间 -->
            <div class="core-info-row">
              <div class="form-control">
                <label class="form-label">考勤状态</label>
                <a-select 
                  v-model:value="worker.status" 
                  class="status-select"
                  @change="(val: string) => handleStatusChange(worker, val)"
                  placeholder="请选择考勤状态"
                  :allowClear="false"
                >
                  <a-select-option value="">未打卡</a-select-option>
                  <a-select-option value="present">全天</a-select-option>
                  <a-select-option value="half_day">半天</a-select-option>
                  <a-select-option value="leave">请假</a-select-option>
                  <a-select-option value="absent">缺勤</a-select-option>
                </a-select>
              </div>

              <div class="form-control">
                <label class="form-label">加班时间</label>
                <div class="overtime-input-group">
                  <input 
                    type="number" 
                    class="form-input" 
                    v-model.number="worker.overtimeHours" 
                    :min="0" 
                    :max="24"
                    step="0.5"
                    :disabled="worker.status === 'leave' || worker.status === 'absent'"
                  />
                  <span class="unit-text">小时</span>
                </div>
              </div>
            </div>

            <!-- 备注区域 -->
            <div class="remark-section">
              <label class="form-label">备注</label>
              <textarea 
                class="remark-input" 
                v-model="worker.notes" 
                placeholder="例如：东区支架加班、事假说明、设备巡检…"
                maxlength="200"
              ></textarea>
            </div>

            <!-- 操作栏 -->
            <div class="action-bar">
              <button class="btn-save" @click="saveCheckIn(worker)">
                {{ worker.recordId ? '✅ 更新打卡记录' : '✅ 保存打卡记录' }}
              </button>
            </div>
          </div>
        </div>
        
        <a-spin v-else />
      </a-card>
    </div>

    <div v-else>
      <a-card title="打卡记录">
        <template #extra>
          <a-space>
            <a-range-picker v-model:value="historyDateRange" :locale="zhCN" />
            <a-select v-model:value="filterWorkerId" style="width: 150px" allowClear placeholder="选择工人">
              <a-select-option v-for="w in workerStore.workers" :key="w.id" :value="w.id">
                {{ w.name }}
              </a-select-option>
            </a-select>
            <a-button type="primary" @click="fetchHistoryRecords">查询</a-button>
            <a-button @click="showAddModal">添加补卡</a-button>
            <a-button type="primary" ghost @click="showBatchModal">批量补卡</a-button>
            <a-button @click="exportHistoryData">导出数据</a-button>
          </a-space>
        </template>
        <a-table :dataSource="historyRecords" :columns="historyColumns" :loading="historyLoading" rowKey="id">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'workerName'">
              <a-tag color="blue">{{ getWorkerName(record.workerId) }}</a-tag>
            </template>
            <template v-if="column.key === 'date'">
              <a-tag>{{ record.date }}</a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusText(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'overtimeHours'">
              <span style="color: #52c41a; font-weight: 600">{{ Number(record.overtimeHours || 0).toFixed(1) }} h</span>
            </template>
            <template v-if="column.key === 'action'">
              <a-space>
                <a-button size="small" @click="editRecord(record)">编辑</a-button>
                <a-popconfirm title="确定删除?" @confirm="deleteRecord(record.id)">
                  <a-button size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <a-modal v-model:open="modalVisible" :title="editingRecord ? '编辑打卡' : '添加补卡'" @ok="handleSubmit" width="500px">
      <a-form :model="formState" layout="vertical">
        <a-form-item label="工人" required>
          <a-select v-model:value="formState.workerId" show-search>
            <a-select-option v-for="w in workerStore.workers" :key="w.id" :value="w.id">
              {{ w.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="日期" required>
          <a-date-picker v-model:value="formState.date" style="width: 100%" :locale="zhCN" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="formState.status">
            <a-select-option value="present">全天</a-select-option>
            <a-select-option value="half_day">半天</a-select-option>
            <a-select-option value="leave">请假</a-select-option>
            <a-select-option value="absent">缺勤</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="加班时长(小时)">
          <a-input-number v-model:value="formState.overtimeHours" :min="0" :max="24" style="width: 100%" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="formState.notes" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="batchModalVisible"
      title="批量补卡"
      :confirm-loading="batchSubmitting"
      @ok="handleBatchSubmit"
      width="620px"
    >
      <a-form :model="batchForm" layout="vertical">
        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 12px"
          message="按 工人 × 日期 批量补卡。已存在记录会自动更新，不会重复新增。"
        />
        <a-form-item label="工人（可多选）" required>
          <a-select
            v-model:value="batchForm.workerIds"
            mode="multiple"
            :max-tag-count="4"
            placeholder="请选择工人"
            show-search
          >
            <a-select-option v-for="w in workerStore.workers" :key="w.id" :value="w.id">
              {{ w.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="日期范围" required>
          <a-range-picker v-model:value="batchForm.dateRange" :locale="zhCN" style="width: 100%" />
        </a-form-item>
        <a-form-item label="快捷模板">
          <a-space wrap>
            <a-button size="small" @click="applyBatchDatePreset('today')">今天</a-button>
            <a-button size="small" @click="applyBatchDatePreset('thisWeek')">本周工作日</a-button>
            <a-button size="small" @click="applyBatchDatePreset('lastWeek')">上周工作日</a-button>
            <a-button size="small" @click="applyBatchDatePreset('thisMonth')">本月工作日</a-button>
          </a-space>
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="batchForm.skipWeekends">跳过周末（周六/周日）</a-checkbox>
        </a-form-item>
        <a-form-item label="状态" required>
          <a-select v-model:value="batchForm.status">
            <a-select-option value="present">全天</a-select-option>
            <a-select-option value="half_day">半天</a-select-option>
            <a-select-option value="leave">请假</a-select-option>
            <a-select-option value="absent">缺勤</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="加班时长(小时)">
          <a-input-number v-model:value="batchForm.overtimeHours" :min="0" :max="24" :step="0.5" style="width: 100%" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="batchForm.notes" :rows="3" placeholder="可统一填写本次批量补卡说明" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { useWorkerStore } from '@/stores/workers'
import { attendanceApi } from '@/api'
import dayjs, { Dayjs } from 'dayjs'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

const route = useRoute()
const workerStore = useWorkerStore()

const isTodayView = computed(() => route.path === '/attendance' || route.path === '/attendance/today')

const activeTab = ref('today')
const loading = ref(false)
const historyLoading = ref(false)
const modalVisible = ref(false)
const batchModalVisible = ref(false)
const batchSubmitting = ref(false)

const selectedDate = ref(dayjs())
const todayWorkers = ref<any[]>([])
const historyRecords = ref<any[]>([])
const editingRecord = ref<any>(null)

const historyDateRange = ref<[Dayjs, Dayjs] | null>(null)
const filterWorkerId = ref<string | undefined>(undefined)

const calendarWorkerId = ref<string | undefined>(undefined)
const calendarMonth = ref(dayjs().month() + 1)
const calendarValue = ref(dayjs())
const calendarData = ref<Map<string, any>>(new Map())
const workerAttendanceStats = ref<any[]>([])
const selectedDateInfo = ref<any>(null)

const calendarFullData = ref<Map<string, any>>(new Map())
const monthlyViewData = ref<any[]>([])
const monthlyViewLoading = ref(false)

const calendarStats = computed(() => {
  let present = 0, halfDay = 0, leave = 0, absent = 0
  calendarData.value.forEach((status) => {
    if (status === 'present') present++
    else if (status === 'half_day') halfDay++
    else if (status === 'leave') leave++
    else if (status === 'absent') absent++
  })
  return { present, halfDay, leave, absent }
})

// Filter calendar data by current month
const monthlyViewDataComputed = computed(() => {
  if (!calendarMonth.value || !calendarWorkerId.value) return []
  
  return Array.from(calendarFullData.value.entries())
    .filter(([dateStr, data]) => {
      const date = dayjs(dateStr)
      return date.month() + 1 === calendarMonth.value && 
             (!calendarWorkerId.value || data.workerId === calendarWorkerId.value)
    })
    .map(([dateStr, data]) => ({
      date: dateStr,
      status: data.status,
      overtimeHours: data.overtimeHours || 0,
      notes: data.notes || ''
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
})

const todayColumns = [
  { title: '工人姓名', dataIndex: 'workerName', key: 'workerName', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
  { title: '加班(时)', dataIndex: 'overtimeHours', key: 'overtimeHours', width: 90 },
  { title: '备注', dataIndex: 'notes', key: 'notes', width: 120 },
  { title: '操作', key: 'action', width: 280, fixed: 'right' }
]

const historyColumns = [
  { title: '工人姓名', dataIndex: 'workerId', key: 'workerName' },
  { title: '日期', dataIndex: 'date', key: 'date', align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '加班时长', dataIndex: 'overtimeHours', key: 'overtimeHours', align: 'right' },
  { title: '备注', dataIndex: 'notes', key: 'notes' },
  { title: '操作', key: 'action' }
]

const monthlyViewColumns = [
  { title: '日期', dataIndex: 'date', key: 'date', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
  { title: '加班时长', dataIndex: 'overtimeHours', key: 'overtimeHours', width: 90 },
  { title: '备注', dataIndex: 'notes', key: 'notes', width: 150 }
]

const formState = reactive({
  workerId: '',
  date: dayjs(),
  status: 'present',
  overtimeHours: 0,
  notes: ''
})

const batchForm = reactive({
  workerIds: [] as string[],
  dateRange: null as [Dayjs, Dayjs] | null,
  skipWeekends: true,
  status: 'present',
  overtimeHours: 0,
  notes: ''
})

// 提取共享数据加载函数
async function loadRouteData(routePath: string) {
  loading.value = true
  try {
    await workerStore.fetchWorkers({ status: 'active' })
    if (routePath === '/attendance/history') {
      await fetchHistoryRecords()
    } else if (routePath === '/attendance' || routePath === '/attendance/today') {
      await Promise.all([
        fetchTodayAttendance(),
        calculateWorkerAttendanceStats()
      ])
    }
  } finally {
    loading.value = false
  }
}

// 监听路由变化切换 tab 并重新加载数据
watch(() => route.path, (newPath) => {
  if (newPath === '/attendance' || newPath === '/attendance/today') {
    activeTab.value = 'today'
    loadRouteData(newPath)
  } else if (newPath.includes('/attendance/history')) {
    activeTab.value = 'history'
    loadRouteData(newPath)
  } else if (newPath.includes('/attendance/calendar')) {
    activeTab.value = 'calendar'
  }
}, { immediate: true })

onMounted(() => loadRouteData(route.path))

async function calculateWorkerAttendanceStats() {
  if (!workerStore.workers || workerStore.workers.length === 0) {
    console.warn('No workers loaded')
    workerAttendanceStats.value = []
    return
  }
  
  const now = dayjs()
  const start = now.startOf('month')
  const end = now.endOf('month')
  
  try {
    const res = await attendanceApi.getByRange(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))
    
    const stats: Record<string, { present: number, total: number }> = {}
    
    workerStore.workers.forEach(w => {
      stats[w.id] = { present: 0, total: 0 }
    })
    
    if (res.data && res.data.length > 0) {
      res.data.forEach((a: any) => {
        if (stats[a.workerId]) {
          stats[a.workerId].total++
          if (a.status === 'present') stats[a.workerId].present++
        }
      })
    }
    
    workerAttendanceStats.value = workerStore.workers.map(w => {
      const s = stats[w.id] || { present: 0, total: 0 }
      return {
        id: w.id,
        name: w.name,
        rate: s.total > 0 ? Math.round((s.present / s.total) * 100) : 100
      }
    }).sort((a, b) => a.rate - b.rate)
    
    // 只有在日历tab下才自动选择工人
    if (workerAttendanceStats.value.length > 0 && activeTab.value === 'calendar' && !calendarWorkerId.value) {
      calendarWorkerId.value = workerAttendanceStats.value[0].id
    }
  } catch (error) {
    console.error('Failed to calculate worker stats:', error)
     workerAttendanceStats.value = workerStore.workers.map(w => ({
      id: w.id,
      name: w.name,
      rate: 0
    }))
  }
}

async function fetchTodayAttendance() {
  loading.value = true
  try {
    const dateStr = selectedDate.value.format('YYYY-MM-DD')
    const todayRes = await attendanceApi.getByDate(dateStr)
    
    const attendanceMap = new Map(todayRes.data.map((a: any) => [a.workerId, a]))
    
      todayWorkers.value = workerStore.workers.map(w => {
        const attendance = attendanceMap.get(w.id)
        return {
          workerId: w.id,
          workerName: w.name,
          status: attendance?.status || '', // 空字符串表示未打卡
          overtimeHours: attendance?.overtimeHours || 0,
          notes: attendance?.notes || '',
          recordId: attendance?.id || null
        }
      })
  } catch (error) {
    message.error('获取考勤数据失败')
  } finally {
    loading.value = false
  }
}





async function quickCheckIn(record: any, status: string) {
  try {
    const dateStr = selectedDate.value.format('YYYY-MM-DD')
    
    if (record.recordId) {
      await attendanceApi.update(record.recordId, {
        workerId: record.workerId,
        date: dateStr,
        status,
        overtimeHours: record.overtimeHours || 0,
        notes: record.notes || ''
      })
    } else {
      const res = await attendanceApi.create({
        workerId: record.workerId,
        date: dateStr,
        status,
        overtimeHours: 0,
        notes: ''
      })
      record.recordId = res.data.id
    }
    
    record.status = status
    message.success('打卡成功')
  } catch (error) {
    message.error('打卡失败')
  }
}

// 处理状态变化，联动加班时间
function handleStatusChange(record: any, status: string) {
  record.status = status
  const isForbidden = (status === 'leave' || status === 'absent')
  
  if (isForbidden) {
    // 保存当前加班时间到临时变量
    if (!record._lastOvertime) {
      record._lastOvertime = record.overtimeHours || 0
    }
    record.overtimeHours = 0
  } else {
    // 恢复之前保存的加班时间
    if (record._lastOvertime !== undefined) {
      record.overtimeHours = record._lastOvertime
    }
  }
}

// 保存打卡记录
async function saveCheckIn(record: any) {
  try {
    const dateStr = selectedDate.value.format('YYYY-MM-DD')
    
    // 如果是请假或缺勤，强制加班时间为0
    if (record.status === 'leave' || record.status === 'absent') {
      record.overtimeHours = 0
    }
    
    // 确保加班时间非负
    if (!record.overtimeHours || record.overtimeHours < 0) {
      record.overtimeHours = 0
    }
    
    if (record.recordId) {
      await attendanceApi.update(record.recordId, {
        workerId: record.workerId,
        date: dateStr,
        status: record.status,
        overtimeHours: record.overtimeHours,
        notes: record.notes || ''
      })
    } else {
      const res = await attendanceApi.create({
        workerId: record.workerId,
        date: dateStr,
        status: record.status,
        overtimeHours: record.overtimeHours,
        notes: record.notes || ''
      })
      record.recordId = res.data.id
    }
    
    message.success('打卡记录已保存')
  } catch (error) {
    message.error('保存失败')
  }
}

async function fetchHistoryRecords() {
  historyLoading.value = true
  try {
    let start: string, end: string
    
    if (historyDateRange.value) {
      start = historyDateRange.value[0].format('YYYY-MM-DD')
      end = historyDateRange.value[1].format('YYYY-MM-DD')
    } else {
      start = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
      end = dayjs().format('YYYY-MM-DD')
    }
    
    const res = await attendanceApi.getByRange(start, end)
    let data = res.data
    
    if (filterWorkerId.value) {
      data = data.filter((a: any) => a.workerId === filterWorkerId.value)
    }
    
    historyRecords.value = data.sort((a: any, b: any) => b.date.localeCompare(a.date))
  } catch (error) {
    message.error('获取历史记录失败')
  } finally {
    historyLoading.value = false
  }
}

function showAddModal() {
  editingRecord.value = null
  Object.assign(formState, {
    workerId: filterWorkerId.value || '',
    date: dayjs(),
    status: 'present',
    overtimeHours: 0,
    notes: ''
  })
  modalVisible.value = true
}

function showBatchModal() {
  const defaultWorkerIds = filterWorkerId.value ? [filterWorkerId.value] : []
  batchForm.workerIds = defaultWorkerIds
  batchForm.dateRange = null
  batchForm.skipWeekends = true
  batchForm.status = 'present'
  batchForm.overtimeHours = 0
  batchForm.notes = ''
  batchModalVisible.value = true
}

function applyBatchDatePreset(type: 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth') {
  const now = dayjs()

  if (type === 'today') {
    batchForm.dateRange = [now, now]
    batchForm.skipWeekends = false
    return
  }

  if (type === 'thisMonth') {
    batchForm.dateRange = [now.startOf('month'), now.endOf('month')]
    batchForm.skipWeekends = true
    return
  }

  const weekOffset = type === 'lastWeek' ? 7 : 0
  const currentMonday = now.subtract((now.day() + 6) % 7 + weekOffset, 'day').startOf('day')
  const currentSunday = currentMonday.add(6, 'day').endOf('day')
  batchForm.dateRange = [currentMonday, currentSunday]
  batchForm.skipWeekends = true
}

function editRecord(record: any) {
  editingRecord.value = record
  Object.assign(formState, {
    workerId: record.workerId,
    date: dayjs(record.date),
    status: record.status,
    overtimeHours: record.overtimeHours || 0,
    notes: record.notes || ''
  })
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    const data = {
      ...formState,
      date: formState.date.format('YYYY-MM-DD')
    }
    
    if (editingRecord.value) {
      await attendanceApi.update(editingRecord.value.id, data)
      message.success('更新成功')
    } else {
      await attendanceApi.create(data)
      message.success('添加成功')
    }
    modalVisible.value = false
    await fetchHistoryRecords()
  } catch (error) {
    message.error('操作失败')
  }
}

function buildDateRange(startDate: Dayjs, endDate: Dayjs, skipWeekends: boolean) {
  const days: string[] = []
  let cursor = startDate.startOf('day')
  const end = endDate.startOf('day')

  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    const dayOfWeek = cursor.day()
    if (!skipWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      days.push(cursor.format('YYYY-MM-DD'))
    }
    cursor = cursor.add(1, 'day')
  }

  return days
}

async function handleBatchSubmit() {
  if (batchForm.workerIds.length === 0) {
    message.warning('请至少选择一名工人')
    return
  }
  if (!batchForm.dateRange) {
    message.warning('请选择日期范围')
    return
  }

  const dates = buildDateRange(batchForm.dateRange[0], batchForm.dateRange[1], batchForm.skipWeekends)
  if (dates.length === 0) {
    message.warning('可补卡日期为空，请调整日期范围或取消跳过周末')
    return
  }

  const normalizedOvertime = (batchForm.status === 'leave' || batchForm.status === 'absent')
    ? 0
    : Math.max(0, Number(batchForm.overtimeHours || 0))

  const records = batchForm.workerIds.flatMap((workerId) =>
    dates.map((date) => ({
      workerId,
      date,
      status: batchForm.status,
      overtimeHours: normalizedOvertime,
      notes: batchForm.notes || ''
    }))
  )

  const requestDedupMap = new Map<string, any>()
  for (const record of records) {
    requestDedupMap.set(`${record.workerId}@@${record.date}`, record)
  }
  const dedupedRecords = Array.from(requestDedupMap.values())
  const requestDedupedCount = records.length - dedupedRecords.length

  batchSubmitting.value = true
  try {
    const res = await attendanceApi.batchUpsert(dedupedRecords)
    batchModalVisible.value = false
    await fetchHistoryRecords()
    const serverDedupedCount = Number(res?.data?.dedupedCount || 0)
    const totalDedupedCount = requestDedupedCount + serverDedupedCount
    if (totalDedupedCount > 0) {
      message.success(`批量补卡完成：${res.data.successCount}/${res.data.dedupedTotal}，已去重 ${totalDedupedCount} 条`)
    } else {
      message.success(`批量补卡完成：${res.data.successCount}/${res.data.dedupedTotal}`)
    }
  } catch (error: any) {
    message.error(error?.response?.data?.message || '批量补卡失败')
  } finally {
    batchSubmitting.value = false
  }
}

async function deleteRecord(id: string) {
  try {
    await attendanceApi.delete(id)
    message.success('删除成功')
    await fetchHistoryRecords()
  } catch (error) {
    message.error('删除失败')
  }
}

function getWorkerName(workerId: string) {
  const worker = workerStore.workers.find(w => w.id === workerId)
  return worker?.name || workerId
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    present: 'green',
    absent: 'red',
    leave: 'blue',
    half_day: 'orange'
  }
  return colors[status] || 'default'
}

function getStatusText(status: string) {
  const texts: Record<string, string> = {
    present: '全天',
    absent: '缺勤',
    leave: '请假',
    half_day: '半天'
  }
  return texts[status] || status
}

async function fetchCalendarData() {
  if (!calendarWorkerId.value) return
  if (!calendarValue.value) return
  
    const year = calendarValue.value.year()
    const month = calendarMonth.value
    const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
  const end = start.endOf('month')
  
  try {
    const res = await attendanceApi.getByRange(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))
    const workerRecords = res.data ? res.data.filter((a: any) => a.workerId === calendarWorkerId.value) : []
    calendarData.value = new Map(workerRecords.map((a: any) => [a.date, a.status]))
    calendarFullData.value = new Map(workerRecords.map((a: any) => [a.date, {
      status: a.status,
      overtimeHours: a.overtimeHours || 0,
      notes: a.notes || ''
    }]))
    
    // Update monthly view data
    monthlyViewData.value = workerRecords.map((a: any) => ({
      workerId: a.workerId,
      date: a.date,
      status: a.status,
      overtimeHours: a.overtimeHours || 0,
      notes: a.notes || ''
    }))
  } catch (error) {
    console.error('Failed to fetch calendar data:', error)
    calendarData.value = new Map()
    calendarFullData.value = new Map()
  }
}

watch([calendarWorkerId, calendarMonth], () => {
  if (calendarWorkerId.value && activeTab.value === 'calendar') {
    const year = dayjs().year()
    calendarValue.value = dayjs(`${year}-${calendarMonth.value}-01`)
    fetchCalendarData()
  }
}, { immediate: true })

watch(activeTab, (tab) => {
  if (tab === 'history') {
    fetchHistoryRecords()
  } else if (tab === 'calendar') {
    // 确保切换到日历tab时有数据
    if (calendarWorkerId.value && workerAttendanceStats.value.length > 0) {
      fetchCalendarData()
    }
  }
})

function getCellClass(date: Dayjs) {
  if (!date || !date.format) return ''
  const dateStr = date.format('YYYY-MM-DD')
  const status = calendarData.value.get(dateStr)
  if (!status) return ''
  return `status-${status}`
}

function getCellStatus(date: Dayjs) {
  if (!date || !date.format) return false
  const dateStr = date.format('YYYY-MM-DD')
  return calendarData.value.has(dateStr)
}

function onCalendarSelect(date: Dayjs) {
  if (!date || !date.format) return
  const dateStr = date.format('YYYY-MM-DD')
  const status = calendarData.value.get(dateStr)
  
  if (status) {
    message.info(`${dateStr}: ${getStatusText(status)}`)
  }
  
  selectedDateInfo.value = calendarData.value.get(dateStr) || {
    date: dateStr,
    status: null,
    overtimeHours: 0,
    notes: ''
  }
  
  if (status) {
    selectedDateInfo.value.status = status
  }
}

function downloadCSV(content: string, filename: string) {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

async function exportTodayData() {
  try {
    const headers = ['工人姓名', '状态', '加班时长', '备注']
    const rows = todayWorkers.value.map((r: any) => [
      r.workerName,
      getStatusText(r.status) || '未打卡',
      r.overtimeHours || 0,
      r.notes || ''
    ])
    const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n')
    downloadCSV(csv, `当日打卡_${selectedDate.value.format('YYYY-MM-DD')}.csv`)
    message.success('导出成功')
  } catch (error) {
    message.error('导出失败')
  }
}

async function exportHistoryData() {
  try {
    const workerMap = new Map(workerStore.workers.map((w: any) => [w.id, w.name]))
    const headers = ['工人姓名', '日期', '状态', '加班时长', '备注']
    const rows = historyRecords.value.map((a: any) => [
      workerMap.get(a.workerId) || a.workerId,
      a.date,
      getStatusText(a.status),
      a.overtimeHours || 0,
      a.notes || ''
    ])
    const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n')
    downloadCSV(csv, `考勤数据_${dayjs().format('YYYY-MM-DD')}.csv`)
    message.success('导出成功')
  } catch (error) {
    message.error('导出失败')
  }
}

async function exportCalendarData() {
  if (!calendarWorkerId.value) {
    message.warning('请先选择工人')
    return
  }
  
  try {
    const workerName = getWorkerName(calendarWorkerId.value)
    const headers = ['日期', '状态']
    const rows: any[] = []
    
    calendarFullData.value.forEach((status, date) => {
      rows.push([date, getStatusText(status)])
    })
    
    const csv = [headers.join(','), ...rows.sort((a, b) => a[0].localeCompare(b[0])).map(r => r.join(','))].join('\n')
    downloadCSV(csv, `${workerName}_考勤日历_${calendarMonth.value}月.csv`)
    message.success('导出成功')
  } catch (error) {
    message.error('导出失败')
  }
}
</script>

<style scoped>
.attendance-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ----- 打卡卡片样式 (严格参考设计) ----- */
.attendance-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 8px 0;
}

.check-in-card {
  background-color: var(--bg-card, #ffffff);
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
  padding: 24px;
  width: 100%;
  max-width: 420px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.check-in-card:hover {
  box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.1);
  transform: translateY(-3px);
}

/* 头部区域 */
.check-in-card .card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1.5px solid var(--border-light, #e2e8f0);
}

.check-in-card .worker-name {
  font-size: 1.4rem;
  font-weight: 650;
  color: var(--text-primary, #1e293b);
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.date-badge {
  font-size: 0.85rem;
  font-weight: 500;
  background: var(--bg-light, #f8fafc);
  padding: 6px 12px;
  border-radius: 40px;
  color: var(--text-secondary, #64748b);
  border: 1px solid var(--border-light, #e2e8f0);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.date-badge::before {
  content: "📅";
  font-size: 0.9rem;
  opacity: 0.8;
  margin-right: 2px;
}

/* 核心信息行 */
.core-info-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: stretch;
}

.form-control {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 70px;
  justify-content: space-between;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--text-secondary, #64748b);
}

/* 下拉框样式 */
.status-select {
  width: 100%;
}

.check-in-card :deep(.status-select .ant-select-selector) {
  padding: 10px 12px !important;
  background-color: var(--bg-light, #f8fafc) !important;
  border: 1.5px solid var(--border-light, #e2e8f0) !important;
  border-radius: 10px !important;
  font-size: 0.95rem !important;
  color: var(--text-primary, #1e293b) !important;
  font-weight: 500 !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  height: 42px !important;
  line-height: 20px !important;
  display: flex !important;
  align-items: center !important;
}

.check-in-card :deep(.status-select:hover .ant-select-selector) {
  border-color: var(--primary-color, #1890ff) !important;
}

.check-in-card :deep(.status-select-focused .ant-select-selector) {
  border-color: var(--primary-color, #1890ff) !important;
  box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.15) !important;
}

/* 加班输入组 */
.overtime-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-light, #f8fafc);
  border: 1.5px solid var(--border-light, #e2e8f0);
  border-radius: 10px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  height: 42px;
  box-sizing: border-box;
}

.overtime-input-group:focus-within {
  border-color: var(--primary-color, #1890ff);
  box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.1);
}

.form-input {
  width: 0;
  flex: 1;
  padding: 10px 0 10px 12px;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: var(--text-primary, #1e293b);
  font-weight: 500;
  outline: none;
  height: 100%;
  line-height: 20px;
  box-sizing: border-box;
}

.form-input[type="number"]::-webkit-inner-spin-button, 
.form-input[type="number"]::-webkit-outer-spin-button {
  opacity: 0.5;
  height: 20px;
}

.form-input:disabled {
  background: transparent;
  color: #a0aec0;
  cursor: not-allowed;
  opacity: 0.7;
}

.unit-text {
  padding-right: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary, #64748b);
}

.overtime-input-group:has(.form-input:disabled) {
  background-color: #eef2f6;
  border-color: #d1d9e6;
}

/* 备注区域 */
.remark-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 28px;
}

.remark-input {
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid var(--border-light, #e2e8f0);
  border-radius: 10px;
  font-size: 0.95rem;
  color: var(--text-primary, #1e293b);
  min-height: 90px;
  resize: vertical;
  background-color: var(--bg-light, #f8fafc);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1.5;
  font-family: inherit;
}

.remark-input:focus {
  outline: none;
  border-color: var(--primary-color, #1890ff);
  box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.1);
}

.remark-input::placeholder {
  color: #a0b3c9;
  font-weight: 300;
  font-size: 0.9rem;
}

/* 操作按钮 */
.action-bar {
  display: flex;
  justify-content: flex-end;
}

.btn-save {
  background: var(--primary-color, #1890ff);
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 40px;
  font-size: 1rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 8px 18px -6px rgba(24, 144, 255, 0.4);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 100%;
}

.btn-save:hover {
  background: var(--primary-hover, #40a9ff);
  transform: scale(1.02);
  box-shadow: 0 12px 22px -8px rgba(24, 144, 255, 0.5);
}

.btn-save:active {
  transform: scale(0.98);
}

/* 旧卡片样式 - 保留兼容性 */
.attendance-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
  transition: box-shadow 0.3s;
}

.attendance-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.attendance-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.attendance-card .worker-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.card-body {
  margin-bottom: 12px;
}

.field-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.field-row:last-child {
  margin-bottom: 0;
}

.field-row label {
  width: 80px;
  font-size: 14px;
  color: #64748b;
  flex-shrink: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.card-actions button {
  flex: 1;
}

@media (max-width: 768px) {
  .attendance-cards {
    grid-template-columns: 1fr;
  }
}

.attendance-view :deep(.ant-table-thead > tr > th) {
  background: var(--border-light);
  color: var(--text-primary);
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}

.attendance-view :deep(.ant-table-tbody > tr > td) {
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
  transition: background var(--ease) 0.2s;
}

.attendance-view :deep(.ant-table-tbody > tr:hover > td) {
  background: var(--border-light);
}

.calendar-container {
  position: relative;
}

.calendar-header {
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.calendar-stats {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--border-light);
  border-radius: var(--radius-md);
}

.calendar-cell {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all 0.3s var(--ease);
}

.calendar-cell.status-present {
  background-color: color-mix(in srgb, var(--success) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 40%, transparent);
}

.calendar-cell.status-half_day {
  background-color: color-mix(in srgb, var(--warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
}

.calendar-cell.status-leave {
  background-color: color-mix(in srgb, var(--info) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--info) 40%, transparent);
}

.calendar-cell.status-absent {
  background-color: color-mix(in srgb, var(--danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--info);
  margin-top: 2px;
}

.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 16px;
}

.calendar-legend .dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 4px;
}

.calendar-legend .dot.present {
  background-color: var(--success);
}

.calendar-legend .dot.half-day {
  background-color: var(--warning);
}

.calendar-legend .dot.leave {
  background-color: var(--info);
}

.calendar-legend .dot.absent {
  background-color: var(--danger);
}
</style>