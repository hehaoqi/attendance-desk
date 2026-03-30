<template>
  <div class="home-view">
    <!-- Stats Cards Row -->
    <a-row :gutter="[20, 20]" class="stats-row">
      <a-col :xs="24" :sm="24" :md="8">
        <div class="metric-card animate-fade-in stagger-1" @click="goToAttendance" style="cursor:pointer">
          <div class="metric-header">
            <div class="metric-icon-title">
              <div class="metric-icon today-icon">
                <CalendarOutlined />
              </div>
              <span class="metric-date">{{ formatDateCN(todayStats.date) }}</span>
            </div>
            <span class="metric-badge">今日</span>
          </div>
          <div class="metric-grid">
            <div class="metric-item">
              <span class="metric-num present">{{ todayStats.attendance?.present || 0 }}</span>
              <span class="metric-label">全天</span>
            </div>
            <div class="metric-item">
              <span class="metric-num halfday">{{ todayStats.attendance?.halfDay || 0 }}</span>
              <span class="metric-label">半天</span>
            </div>
            <div class="metric-item">
              <span class="metric-num leave">{{ todayStats.attendance?.leave || 0 }}</span>
              <span class="metric-label">请假</span>
            </div>
            <div class="metric-item">
              <span class="metric-num absent">{{ todayStats.attendance?.absent || 0 }}</span>
              <span class="metric-label">缺勤</span>
            </div>
          </div>
        </div>
      </a-col>
      <a-col :xs="24" :sm="12" :md="8">
        <div class="metric-card animate-fade-in stagger-2">
          <div class="metric-header">
            <div class="metric-icon-title">
              <div class="metric-icon month-icon">
                <BarChartOutlined />
              </div>
              <span class="metric-date">{{ monthStats.year }}年{{ monthStats.month }}月</span>
            </div>
            <span class="metric-badge">当月</span>
          </div>
          <div class="metric-summary">
            <div class="summary-row">
              <span class="summary-key">出工</span>
              <span class="summary-val">{{ monthStats.attendance?.totalWorkDays || 0 }} 人天</span>
            </div>
            <div class="summary-row">
              <span class="summary-key">工人数</span>
              <span class="summary-val">{{ monthStats.workerCount || 0 }} 人</span>
            </div>
            <div class="summary-row highlight-row">
              <span class="summary-key">工资总额</span>
              <span class="summary-val">¥{{ (monthStats.totalSalary || 0).toLocaleString() }}</span>
            </div>
            <div class="summary-row success-row">
              <span class="summary-key">已发放</span>
              <span class="summary-val">¥{{ (monthStats.paidSalary || 0).toLocaleString() }}</span>
            </div>
            <div class="summary-row warning-row">
              <span class="summary-key">待发放</span>
              <span class="summary-val">¥{{ (monthStats.remainingSalary || 0).toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </a-col>
      <a-col :xs="24" :sm="12" :md="8">
        <div class="metric-card animate-fade-in stagger-3">
          <div class="metric-header">
            <div class="metric-icon-title">
              <div class="metric-icon year-icon">
                <LineChartOutlined />
              </div>
              <span class="metric-date">{{ getLunarYearLabel(selectedYear) }}</span>
            </div>
          </div>
          <div class="metric-summary">
            <div class="summary-row">
              <span class="summary-key">出工</span>
              <span class="summary-val">{{ yearStats.totalWorkDays || 0 }} 人天</span>
            </div>
            <div class="summary-row">
              <span class="summary-key">工人数</span>
              <span class="summary-val">{{ yearStats.workerCount || 0 }} 人</span>
            </div>
            <div class="summary-row highlight-year-row">
              <span class="summary-key">工资总额</span>
              <span class="summary-val">¥{{ (yearStats.totalSalary || 0).toLocaleString() }}</span>
            </div>
            <div class="summary-row success-row">
              <span class="summary-key">已发放</span>
              <span class="summary-val">¥{{ (yearStats.paidSalary || 0).toLocaleString() }}</span>
            </div>
            <div class="summary-row warning-row">
              <span class="summary-key">待发放</span>
              <span class="summary-val">¥{{ (yearStats.remainingSalary || 0).toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </a-col>
    </a-row>

    <!-- Chart Section -->
    <div class="chart-panel animate-fade-in stagger-4">
      <div class="chart-toolbar">
        <h3 class="chart-title">
          <AreaChartOutlined class="chart-title-icon" />
          考勤趋势
        </h3>
        <a-radio-group v-model:value="timeRange" @change="fetchTrendData" button-style="solid" size="small">
          <a-radio-button value="week">近一周</a-radio-button>
          <a-radio-button value="month">近一月</a-radio-button>
          <a-radio-button value="quarter">近三月</a-radio-button>
        </a-radio-group>
      </div>
      <div ref="chartRef" class="chart-container"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarOutlined, BarChartOutlined, LineChartOutlined, AreaChartOutlined } from '@ant-design/icons-vue'
import { dashboardApi, attendanceApi, yearsApi, getLunarYearLabel } from '@/api'
import * as echarts from 'echarts'
import dayjs from 'dayjs'

const router = useRouter()
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null
let resizeHandler: (() => void) | null = null

const timeRange = ref('week')
const todayStats = ref<any>({})
const monthStats = ref<any>({})
const yearStats = ref<any>({})
const trendData = ref<any[]>([])
const selectedYear = ref<number>(dayjs().year())

function goToAttendance() { router.push('/attendance/today') }

onMounted(async () => {
  try {
    // Load available years and pick the configured default year first.
    const yearsResponse = await yearsApi.getAll()
    const yearRows = (yearsResponse.data || [])
      .slice()
      .sort((a: any, b: any) => (a.yearNumber || 0) - (b.yearNumber || 0))
    if (yearRows.length > 0) {
      const defaultYearRow = yearRows.find((y: any) => !!y.isDefault)
      selectedYear.value = defaultYearRow?.yearNumber || yearRows[0].yearNumber
    }
  } catch (error) {
    console.error('Failed to load years:', error)
  }
  
  await Promise.all([fetchTodayStats(), fetchMonthStats(), fetchYearStats(), fetchTrendData()])
  nextTick(() => initChart())
})

function formatDateCN(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`
}

function formatYearRange(startDate: string | undefined, endDate: string | undefined): string {
  if (!startDate || !endDate) return ''
  const s = startDate.split('-'), e = endDate.split('-')
  return `${s[0]}年${parseInt(s[1])}月 ~ ${e[0]}年${parseInt(e[1])}月`
}

onUnmounted(() => {
  if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null }
  chartInstance?.dispose(); chartInstance = null
})

async function fetchTodayStats() {
  try { todayStats.value = (await dashboardApi.getToday()).data } catch (e) { console.error(e) }
}
async function fetchMonthStats() {
  try { monthStats.value = (await dashboardApi.getMonth()).data } catch (e) { console.error(e) }
}
async function fetchYearStats() {
  try { yearStats.value = (await dashboardApi.getYearByNumber(selectedYear.value)).data } catch (e) { console.error(e) }
}

async function fetchTrendData() {
  try {
    const end = dayjs()
    let start: dayjs.Dayjs
    switch (timeRange.value) {
      case 'week': start = end.subtract(7, 'day'); break
      case 'month': start = end.subtract(30, 'day'); break
      case 'quarter': start = end.subtract(90, 'day'); break
      default: start = end.subtract(7, 'day')
    }
    trendData.value = (await attendanceApi.getTrend(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))).data
    updateChart()
  } catch (e) { console.error(e) }
}

function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  updateChart()
  resizeHandler = () => chartInstance?.resize()
  window.addEventListener('resize', resizeHandler)
}

function updateChart() {
  if (!chartInstance) return
  const dates = trendData.value.map(d => d.date)
  const makeSeries = (name: string, key: string, color: string) => ({
    name, type: 'line', data: trendData.value.map(d => d[key] || 0),
    smooth: true, symbol: 'circle', symbolSize: 6,
    itemStyle: { color }, lineStyle: { width: 2.5 },
    areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: color.replace(')', ', 0.2)').replace('rgb', 'rgba') },
      { offset: 1, color: color.replace(')', ', 0.01)').replace('rgb', 'rgba') }
    ]) }
  })
  chartInstance.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.98)', borderColor: '#e2e8f0', borderWidth: 1, padding: [12, 16], textStyle: { color: '#1a1a2e', fontSize: 13 }, extraCssText: 'border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);' },
    legend: { data: ['全天', '半天', '请假', '缺勤'], top: 10, textStyle: { color: '#64748b', fontSize: 14 }, itemGap: 24, icon: 'circle', itemWidth: 8, itemHeight: 8 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '55px', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#94a3b8', fontSize: 11 }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [
      { name: '全天', type: 'line', data: trendData.value.map(d => d.present || 0), smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#22c55e' }, lineStyle: { width: 2.5 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(34,197,94,0.2)' }, { offset: 1, color: 'rgba(34,197,94,0.01)' }]) } },
      { name: '半天', type: 'line', data: trendData.value.map(d => d.halfDay || 0), smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#f59e0b' }, lineStyle: { width: 2.5 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(245,158,11,0.2)' }, { offset: 1, color: 'rgba(245,158,11,0.01)' }]) } },
      { name: '请假', type: 'line', data: trendData.value.map(d => d.leave || 0), smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#3b82f6' }, lineStyle: { width: 2.5 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(59,130,246,0.2)' }, { offset: 1, color: 'rgba(59,130,246,0.01)' }]) } },
      { name: '缺勤', type: 'line', data: trendData.value.map(d => d.absent || 0), smooth: true, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#ef4444' }, lineStyle: { width: 2.5 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(239,68,68,0.2)' }, { offset: 1, color: 'rgba(239,68,68,0.01)' }]) } }
    ]
  })
}
</script>

<style scoped>
.home-view { padding: 0; }
.stats-row { margin-bottom: 20px; }

.metric-card {
  background: #fff; border-radius: 14px; padding: 22px; height: 100%;
  position: relative; overflow: hidden; border: 1px solid var(--border-light);
  transition: all 0.3s var(--ease);
}
.metric-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }

.metric-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }

.metric-icon-title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }

.metric-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.today-icon { background: var(--success-bg); color: var(--success); }
.month-icon { background: var(--primary-100); color: var(--primary); }
.year-icon { background: var(--info-bg); color: var(--info); }

.metric-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: var(--bg); color: var(--text-secondary); flex-shrink: 0; }
.metric-date { font-size: 13px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.metric-item { text-align: center; padding: 14px 8px; background: var(--bg); border-radius: 10px; transition: all 0.2s; }
.metric-item:hover { background: var(--border-light); }
.metric-num { display: block; font-size: 28px; font-weight: 800; line-height: 1.2; }
.metric-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; display: block; }
.metric-num.present { color: var(--success); }
.metric-num.halfday { color: var(--warning); }
.metric-num.leave { color: var(--info); }
.metric-num.absent { color: var(--danger); }

.metric-summary { display: flex; flex-direction: column; gap: 8px; }
.summary-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg); border-radius: 8px; transition: all 0.2s; }
.summary-row:hover { background: var(--border-light); }
.summary-key { color: var(--text-secondary); font-size: 13px; }
.summary-val { font-weight: 600; font-size: 14px; color: var(--text-primary); }

.highlight-row { background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%) !important; }
.highlight-row .summary-key, .highlight-row .summary-val { color: #fff; }
.highlight-year-row { background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%) !important; }
.highlight-year-row .summary-key, .highlight-year-row .summary-val { color: #fff; }
.success-row { background: linear-gradient(135deg, var(--success) 0%, #4ade80 100%) !important; }
.success-row .summary-key, .success-row .summary-val { color: #fff; }
.warning-row { background: linear-gradient(135deg, var(--warning) 0%, #fbbf24 100%) !important; }
.warning-row .summary-key, .warning-row .summary-val { color: #fff; }

.chart-panel { background: #fff; border-radius: 14px; padding: 24px; border: 1px solid var(--border-light); }
.chart-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.chart-title { font-size: 16px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin: 0; }
.chart-title-icon { color: var(--accent); }
.chart-container { height: 340px; }
</style>
