<template>
  <div class="calendar-view">
    <a-row :gutter="20">
      <!-- Left: controls + stats -->
      <a-col :span="6">
        <a-card title="筛选条件" size="small" class="filter-card">
          <a-form layout="inline">
            <a-form-item label="工人">
              <a-select
                v-model:value="selectedWorkerId"
                show-search
                :filter-option="filterWorker"
                placeholder="请选择"
                @change="fetchCalendarData"
              >
                <a-select-option v-for="w in activeWorkers" :key="w.id" :value="w.id">
                  {{ w.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="月份">
              <a-month-picker
                v-model:value="selectedMonth"
                @change="fetchCalendarData"
              />
            </a-form-item>
          </a-form>
        </a-card>

        <a-card title="月度统计" size="small" class="stats-card" v-if="selectedWorkerId">
          <div class="stat-grid">
            <div class="stat-item present-bg">
              <span class="stat-num">{{ stats.present }}</span>
              <span class="stat-label">全天</span>
            </div>
            <div class="stat-item halfday-bg">
              <span class="stat-num">{{ stats.halfDay }}</span>
              <span class="stat-label">半天</span>
            </div>
            <div class="stat-item leave-bg">
              <span class="stat-num">{{ stats.leave }}</span>
              <span class="stat-label">请假</span>
            </div>
            <div class="stat-item absent-bg">
              <span class="stat-num">{{ stats.absent }}</span>
              <span class="stat-label">缺勤</span>
            </div>
          </div>
          <div class="stat-summary">
            <div class="stat-row">
              <span>加班总计</span>
              <span class="stat-val">{{ stats.overtimeTotal }} 小时</span>
            </div>
          </div>
        </a-card>

        <div class="legend-card" v-if="selectedWorkerId">
          <div class="legend-title">图例</div>
          <div class="legend-items">
            <div class="legend-row">
              <div class="legend-item"><span class="legend-dot present"></span>全天出勤</div>
              <div class="legend-item"><span class="legend-dot halfday"></span>半天出勤</div>
            </div>
            <div class="legend-row">
              <div class="legend-item"><span class="legend-dot leave-dot"></span>请假</div>
              <div class="legend-item"><span class="legend-dot absent-dot"></span>缺勤</div>
              <div class="legend-item"><span class="legend-dot empty"></span>无记录</div>
            </div>
          </div>
        </div>
      </a-col>

      <!-- Right: calendar grid -->
      <a-col :span="18">
        <a-card size="small">
          <template #title>
            <div style="display:flex; align-items:center; justify-content:space-between">
              <span>{{ selectedMonth.format('YYYY年M月') }} 考勤日历</span>
              <span v-if="selectedWorkerName" style="font-weight:400; font-size:13px; color: var(--text-secondary)">
                工人: {{ selectedWorkerName }}
              </span>
            </div>
          </template>
          <div v-if="!selectedWorkerId" class="empty-state">
            <CalendarOutlined style="font-size: 48px; color: var(--text-muted); margin-bottom: 12px" />
            <p>请先选择工人查看考勤日历</p>
          </div>
          <div v-else class="calendar-grid">
            <div class="calendar-header-row">
              <div class="cal-header" v-for="day in weekDays" :key="day">{{ day }}</div>
            </div>
            <div class="calendar-body">
              <div
                v-for="(cell, idx) in calendarCells"
                :key="idx"
                :class="['cal-cell', cell.status ? `status-${cell.status}` : '', { 'other-month': !cell.isCurrentMonth, 'today': cell.isToday }]"
                @click="cell.isCurrentMonth && showDayDetail(cell)"
              >
                <span class="cal-day">{{ cell.day }}</span>
                <span v-if="cell.status && cell.isCurrentMonth" class="cal-status-text">{{ getStatusText(cell.status) }}</span>
                <span v-if="cell.overtime > 0 && cell.isCurrentMonth" class="cal-overtime">+{{ cell.overtime }}h</span>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- Day detail modal -->
    <a-modal v-model:open="detailVisible" :title="detailDate" :footer="null" width="360px">
      <div v-if="detailRecord" class="detail-content">
        <div class="detail-row">
          <span class="detail-key">状态</span>
          <a-tag :color="getStatusColor(detailRecord.status)">{{ getStatusText(detailRecord.status) }}</a-tag>
        </div>
        <div class="detail-row">
          <span class="detail-key">加班</span>
          <span>{{ detailRecord.overtimeHours || 0 }} 小时</span>
        </div>
        <div class="detail-row" v-if="detailRecord.notes">
          <span class="detail-key">备注</span>
          <span>{{ detailRecord.notes }}</span>
        </div>
      </div>
      <div v-else style="text-align: center; color: var(--text-muted); padding: 20px">
        当日无考勤记录
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorkerStore } from '@/stores/workers'
import { attendanceApi } from '@/api'
import { CalendarOutlined } from '@ant-design/icons-vue'
import dayjs, { Dayjs } from 'dayjs'

const workerStore = useWorkerStore()
const selectedWorkerId = ref<string | undefined>(undefined)
const selectedMonth = ref<Dayjs>(dayjs())
const attendanceMap = ref<Map<string, any>>(new Map())
const detailVisible = ref(false)
const detailDate = ref('')
const detailRecord = ref<any>(null)

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const activeWorkers = computed(() =>
  (workerStore.workers || []).filter(w => w.status === 'active')
)

const selectedWorkerName = computed(() => {
  if (!selectedWorkerId.value) return ''
  const w = workerStore.workers.find(w => w.id === selectedWorkerId.value)
  return w?.name || ''
})

const stats = computed(() => {
  let present = 0, halfDay = 0, leave = 0, absent = 0, overtimeTotal = 0
  attendanceMap.value.forEach(record => {
    if (record.status === 'present') present++
    else if (record.status === 'half_day') halfDay++
    else if (record.status === 'leave') leave++
    else if (record.status === 'absent') absent++
    overtimeTotal += parseFloat(record.overtimeHours) || 0
  })
  return { present, halfDay, leave, absent, overtimeTotal }
})

interface CalendarCell {
  day: number;
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  status: string | null;
  overtime: number;
  notes: string;
}

const calendarCells = computed<CalendarCell[]>(() => {
  const month = selectedMonth.value
  const firstDay = month.startOf('month')
  const lastDay = month.endOf('month')
  const daysInMonth = lastDay.date()

  // Monday = 0 in our grid (ISO weekday: 1=Mon, 7=Sun)
  let startWeekday = firstDay.day() // 0=Sun, 1=Mon...6=Sat
  startWeekday = startWeekday === 0 ? 6 : startWeekday - 1 // Convert to Mon=0

  const cells: CalendarCell[] = []
  const today = dayjs().format('YYYY-MM-DD')

  // Previous month padding
  const prevMonth = firstDay.subtract(1, 'day')
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevMonth.subtract(i, 'day')
    cells.push({
      day: d.date(),
      date: d.format('YYYY-MM-DD'),
      isCurrentMonth: false,
      isToday: false,
      status: null,
      overtime: 0,
      notes: ''
    })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = month.date(d).format('YYYY-MM-DD')
    const record = attendanceMap.value.get(dateStr)
    cells.push({
      day: d,
      date: dateStr,
      isCurrentMonth: true,
      isToday: dateStr === today,
      status: record?.status || null,
      overtime: parseFloat(record?.overtimeHours) || 0,
      notes: record?.notes || ''
    })
  }

  // Next month padding (fill to complete last week)
  const remainingCells = 7 - (cells.length % 7)
  if (remainingCells < 7) {
    const nextMonth = lastDay.add(1, 'day')
    for (let i = 0; i < remainingCells; i++) {
      const d = nextMonth.add(i, 'day')
      cells.push({
        day: d.date(),
        date: d.format('YYYY-MM-DD'),
        isCurrentMonth: false,
        isToday: false,
        status: null,
        overtime: 0,
        notes: ''
      })
    }
  }

  return cells
})

function filterWorker(input: string, option: any) {
  return option.children?.[0]?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
}

onMounted(async () => {
  await workerStore.fetchWorkers()
  if (activeWorkers.value.length > 0) {
    selectedWorkerId.value = activeWorkers.value[0].id
    fetchCalendarData()
  }
})

async function fetchCalendarData() {
  if (!selectedWorkerId.value) {
    attendanceMap.value = new Map()
    return
  }
  const start = selectedMonth.value.startOf('month').format('YYYY-MM-DD')
  const end = selectedMonth.value.endOf('month').format('YYYY-MM-DD')
  try {
    const res = await attendanceApi.getByRange(start, end)
    const records = (res.data || []).filter((a: any) => a.workerId === selectedWorkerId.value)
    attendanceMap.value = new Map(records.map((a: any) => [a.date, a]))
  } catch (error) {
    console.error('Failed to fetch calendar data:', error)
    attendanceMap.value = new Map()
  }
}

function showDayDetail(cell: CalendarCell) {
  detailDate.value = cell.date
  detailRecord.value = attendanceMap.value.get(cell.date) || null
  detailVisible.value = true
}

function getStatusText(status: string | null) {
  const texts: Record<string, string> = { present: '全天', half_day: '半天', leave: '请假', absent: '缺勤' }
  return status ? texts[status] || status : ''
}

function getStatusColor(status: string | null) {
  const colors: Record<string, string> = { present: 'green', half_day: 'orange', leave: 'blue', absent: 'red' }
  return status ? colors[status] || 'default' : 'default'
}
</script>

<style scoped>
.calendar-view { 
  padding: 0; 
}

/* 筛选条件卡片 */
.filter-card {
  margin-bottom: 12px;
}

.filter-card :deep(.ant-card-head) {
  padding: 8px 12px;
  min-height: 36px;
}

.filter-card :deep(.ant-card-head-title) {
  font-size: 13px;
  font-weight: 600;
}

.filter-card :deep(.ant-card-body) {
  padding: 12px;
}

.filter-card :deep(.ant-form-item) {
  margin-bottom: 8px;
}

.filter-card :deep(.ant-form-item-label) {
  font-size: 12px;
  padding-right: 6px;
}

.filter-card :deep(.ant-select) {
  font-size: 12px;
}

/* 统计卡片 */
.stats-card {
  margin-bottom: 12px;
}

.stats-card :deep(.ant-card-head) {
  padding: 8px 12px;
  min-height: 36px;
}

.stats-card :deep(.ant-card-head-title) {
  font-size: 13px;
  font-weight: 600;
}

.stats-card :deep(.ant-card-body) {
  padding: 12px;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-item {
  text-align: center;
  padding: 10px 6px;
  border-radius: 8px;
}

.present-bg { background: rgba(34, 197, 94, 0.08); }
.halfday-bg { background: rgba(245, 158, 11, 0.08); }
.leave-bg { background: rgba(59, 130, 246, 0.08); }
.absent-bg { background: rgba(239, 68, 68, 0.08); }

.stat-num {
  display: block;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.present-bg .stat-num { color: #22c55e; }
.halfday-bg .stat-num { color: #f59e0b; }
.leave-bg .stat-num { color: #3b82f6; }
.absent-bg .stat-num { color: #ef4444; }

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  display: block;
}

.stat-summary {
  border-top: 1px dashed var(--border);
  padding-top: 10px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-val { 
  font-weight: 600; 
  color: var(--text-primary); 
}

/* 图例 */
.legend-card {
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.legend-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.legend-items { 
  display: flex; 
  flex-direction: column; 
  gap: 6px; 
}

.legend-row { 
  display: flex; 
  gap: 12px; 
}

.legend-row:first-child { 
  margin-bottom: 0; 
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-dot.present { background: #22c55e; }
.legend-dot.halfday { background: #f59e0b; }
.legend-dot.leave-dot { background: #3b82f6; }
.legend-dot.absent-dot { background: #ef4444; }
.legend-dot.empty { background: #e2e8f0; }

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

/* 日历网格 */
.calendar-grid { 
  user-select: none; 
}

.calendar-header-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}

.cal-header {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 8px 0;
  text-transform: uppercase;
}

.calendar-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-cell {
  min-height: 64px;
  aspect-ratio: 1.25;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  background: var(--bg);
  position: relative;
}

.cal-cell:hover { 
  border-color: var(--border); 
  transform: scale(1.03); 
}

.cal-cell.other-month { 
  opacity: 0.3; 
  cursor: default; 
}

.cal-cell.other-month:hover { 
  transform: none; 
  border-color: transparent; 
}

.cal-cell.today { 
  border: 2px solid var(--accent); 
}

.cal-cell.status-present { background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3); }
.cal-cell.status-half_day { background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); }
.cal-cell.status-leave { background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3); }
.cal-cell.status-absent { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); }

.cal-day {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1;
}

.cal-status-text {
  font-size: 11px;
  margin-top: 2px;
  font-weight: 500;
}

.status-present .cal-status-text { color: #22c55e; }
.status-half_day .cal-status-text { color: #f59e0b; }
.status-leave .cal-status-text { color: #3b82f6; }
.status-absent .cal-status-text { color: #ef4444; }

.cal-overtime {
  font-size: 10px;
  color: var(--accent);
  font-weight: 600;
  position: absolute;
  top: 2px;
  right: 3px;
}

.detail-content { 
  display: flex; 
  flex-direction: column; 
  gap: 12px; 
}

.detail-row { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
}

.detail-key { 
  font-weight: 600; 
  color: var(--text-secondary); 
  min-width: 50px; 
}
</style>