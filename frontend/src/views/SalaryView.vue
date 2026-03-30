<template>
  <div class="salary-view">
    <div v-if="isMonthlyView">
      <a-card title="月度工资">
        <template #extra>
          <a-space>
            <a-select v-model:value="selectedYear" style="width: 140px">
              <a-select-option v-for="y in yearOptions" :key="y.value" :value="y.value">{{ y.label }}</a-select-option>
            </a-select>
            <a-select v-model:value="selectedMonth" style="width: 100px">
              <a-select-option v-for="m in 12" :key="m" :value="m">{{ m }}月</a-select-option>
            </a-select>
            <a-button type="primary" @click="calculateSalary">计算工资</a-button>
            <a-button @click="exportSalary">导出数据</a-button>
          </a-space>
        </template>

        <a-row :gutter="24">
          <a-col :span="14">
            <a-table :dataSource="salaryData" :columns="columns" :loading="loading" rowKey="workerId">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'workerName'">
                  <a-tag color="blue">{{ record.workerName }}</a-tag>
                </template>
                <template v-if="column.key === 'normalSalary' || column.key === 'overtimeSalary'">
                  <span style="color: #52c41a; font-weight: 600">¥{{ Number(record[column.key] || 0).toFixed(2) }}</span>
                </template>
                <template v-if="column.key === 'totalSalary'">
                  <span style="color: #52c41a; font-weight: bold">¥{{ Number(record.totalSalary || 0).toFixed(2) }}</span>
                </template>
              </template>
            </a-table>
          </a-col>
          <a-col :span="10">
            <div class="summary-panel">
              <div class="summary-card total">
                <div class="summary-label">工资总额</div>
                <div class="summary-value">¥{{ Math.round(monthlyTotals.total) }}</div>
              </div>
              <a-row :gutter="12">
                <a-col :span="12">
                  <div class="summary-card">
                    <div class="summary-label">基本工资</div>
                    <div class="summary-value secondary">¥{{ Math.round(monthlyTotals.base) }}</div>
                  </div>
                </a-col>
                <a-col :span="12">
                  <div class="summary-card">
                    <div class="summary-label">加班工资</div>
                    <div class="summary-value secondary">¥{{ Math.round(monthlyTotals.overtime) }}</div>
                  </div>
                </a-col>
              </a-row>
            </div>
            <a-card title="收入对比" size="small" style="margin-top: 16px">
                <div ref="monthlyChartRef" style="height: 280px"></div>
              </a-card>
          </a-col>
        </a-row>
      </a-card>
    </div>

    <div v-else-if="isYearlyView">
      <a-card title="年度工资">
        <template #extra>
          <a-space>
            <a-select v-model:value="yearlyYear" style="width: 140px">
              <a-select-option v-for="y in yearOptions" :key="y.value" :value="y.value">{{ y.label }}</a-select-option>
            </a-select>
            <a-button type="primary" @click="calculateYearlySalary">查询</a-button>
            <a-button @click="exportYearlySalary">导出数据</a-button>
          </a-space>
        </template>

        <!-- 汇总面板：年度总额、已发放、剩余金额 - 一行显示 -->
        <a-row :gutter="16" style="margin-bottom: 24px">
          <a-col :span="8">
            <div class="summary-card total">
              <div class="summary-label">年度总额</div>
              <div class="summary-value">¥{{ Math.round(yearlyTotals.total) }}</div>
            </div>
          </a-col>
          <a-col :span="8">
            <div class="summary-card success-card">
              <div class="summary-label">已发放</div>
              <div class="summary-value">¥{{ Math.round(yearlyTotals.paidAmount) }}</div>
            </div>
          </a-col>
          <a-col :span="8">
            <div class="summary-card warning-card">
              <div class="summary-label">剩余金额</div>
              <div class="summary-value">¥{{ Math.round(yearlyTotals.remainingAmount) }}</div>
            </div>
          </a-col>
        </a-row>

        <!-- 月份数据表格 -->
        <a-row style="margin-bottom: 24px">
          <a-col :span="24">
            <a-table
              class="yearly-table"
              :dataSource="yearlyData"
              :columns="yearlyColumns"
              :loading="yearlyLoading"
              :pagination="false"
              :scroll="{ x: 1500, y: 500 }"
              bordered
              size="small"
              rowKey="workerId"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'workerName'">
                  <a-tag color="blue">{{ record.workerName }}</a-tag>
                </template>
              </template>
            </a-table>
          </a-col>
        </a-row>

      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { salaryApi, yearsApi, getLunarYearLabel } from '@/api'
import { message } from 'ant-design-vue'
import * as echarts from 'echarts'

const route = useRoute()

const isMonthlyView = computed(() => route.path === '/salary' || route.path === '/salary/monthly')
const isYearlyView = computed(() => route.path.includes('/salary/yearly'))

const activeTab = ref('monthly')
const loading = ref(false)
const yearlyLoading = ref(false)

const selectedYear = ref(dayjs().year())
const selectedMonth = ref(dayjs().month() + 1)
const yearlyYear = ref(dayjs().year())

const yearOptions = ref<{ value: number; label: string }[]>([])

async function loadYearOptions() {
  try {
    const res = await yearsApi.getAll()
    const data = (res.data || [])
      .slice()
      .sort((a: any, b: any) => (a.yearNumber || 0) - (b.yearNumber || 0))
    yearOptions.value = data.map((y: any) => ({
      value: y.yearNumber,
      label: getLunarYearLabel(y.yearNumber)
    }))
    if (data.length > 0) {
      const defaultYear = data.find((y: any) => !!y.isDefault)?.yearNumber || data[0].yearNumber
      selectedYear.value = defaultYear
      yearlyYear.value = defaultYear
    }
  } catch (e) {
    // Fallback
    yearOptions.value = [2026, 2027, 2028, 2029].map(y => ({ value: y, label: getLunarYearLabel(y) }))
  }
}

const columns = [
  {
    title: '序号',
    key: 'index',
    width: 70,
    align: 'center',
    customRender: ({ index }: { index: number }) => index + 1
  },
  { title: '工人', dataIndex: 'workerName', key: 'workerName' },
  { title: '打卡天数', dataIndex: 'checkInDays', key: 'checkInDays' },
  { title: '请假', dataIndex: 'leaveDays', key: 'leaveDays' },
  { title: '缺勤', dataIndex: 'absentDays', key: 'absentDays' },
  { title: '加班时长', dataIndex: 'overtimeHours', key: 'overtimeHours' },
  { title: '基本工资', dataIndex: 'normalSalary', key: 'normalSalary' },
  { title: '加班工资', dataIndex: 'overtimeSalary', key: 'overtimeSalary' },
  { title: '总工资', dataIndex: 'totalSalary', key: 'totalSalary' }
]

const yearlyColumns = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    fixed: 'left',
    customRender: ({ index }: { index: number }) => index + 1
  },
  { title: '工人', dataIndex: 'workerName', key: 'workerName', width: 100, fixed: 'left' },
  {
    title: '年度总额',
    dataIndex: 'yearlyTotal',
    key: 'yearlyTotal',
    width: 110,
    align: 'right',
    customRender: ({ text }: { text: any }) => `¥${Math.round(text || 0)}`
  },
  {
    title: '已发放',
    dataIndex: 'paidAmount',
    key: 'paidAmount',
    width: 110,
    align: 'right',
    customRender: ({ text }: { text: any }) => `¥${Math.round(text || 0)}`
  },
  {
    title: '剩余金额',
    key: 'remainingAmount',
    width: 110,
    align: 'right',
    customRender: ({ record }: { record: any }) => {
      const total = parseFloat(record.yearlyTotal) || 0
      const paid = parseFloat(record.paidAmount) || 0
      const remaining = Math.max(0, parseFloat(record.unpaidAmount) || (total - paid))
      return `¥${Math.round(remaining)}`
    }
  },
  { title: '1月', dataIndex: 'jan', key: 'jan', width: 80, align: 'right' },
  { title: '2月', dataIndex: 'feb', key: 'feb', width: 80, align: 'right' },
  { title: '3月', dataIndex: 'mar', key: 'mar', width: 80, align: 'right' },
  { title: '4月', dataIndex: 'apr', key: 'apr', width: 80, align: 'right' },
  { title: '5月', dataIndex: 'may', key: 'may', width: 80, align: 'right' },
  { title: '6月', dataIndex: 'jun', key: 'jun', width: 80, align: 'right' },
  { title: '7月', dataIndex: 'jul', key: 'jul', width: 80, align: 'right' },
  { title: '8月', dataIndex: 'aug', key: 'aug', width: 80, align: 'right' },
  { title: '9月', dataIndex: 'sep', key: 'sep', width: 80, align: 'right' },
  { title: '10月', dataIndex: 'oct', key: 'oct', width: 80, align: 'right' },
  { title: '11月', dataIndex: 'nov', key: 'nov', width: 80, align: 'right' },
  { title: '12月', dataIndex: 'dec', key: 'dec', width: 80, align: 'right' }
]

const salaryData = ref<any[]>([])
const yearlyData = ref<any[]>([])
const yearlyTotals = ref({ total: 0, paidAmount: 0, remainingAmount: 0 })

const monthlyTotals = computed(() => {
  let total = 0, base = 0, overtime = 0
  salaryData.value.forEach(s => {
    total += parseFloat(s.totalSalary) || 0
    base += parseFloat(s.normalSalary) || 0
    overtime += parseFloat(s.overtimeSalary) || 0
  })
  return { total, base, overtime }
})

const monthlyChartRef = ref<HTMLElement | null>(null)
let monthlyChart: echarts.ECharts | null = null

function initFromRoute() {
  loadYearOptions().then(() => {
    if (route.path.includes('/salary/yearly')) {
      activeTab.value = 'yearly'
      nextTick(() => calculateYearlySalary())
    } else {
      activeTab.value = 'monthly'
      nextTick(() => calculateSalary())
    }
  })
}

onMounted(() => {
  initFromRoute()
})

watch(() => route.path, (newPath) => {
  if (newPath.includes('/salary/yearly') && activeTab.value !== 'yearly') {
    activeTab.value = 'yearly'
    nextTick(() => calculateYearlySalary())
  } else if ((newPath === '/salary' || newPath === '/salary/monthly') && activeTab.value !== 'monthly') {
    activeTab.value = 'monthly'
    nextTick(() => calculateSalary())
  }
})

onUnmounted(() => {
  monthlyChart?.dispose()
  monthlyChart = null
})

async function calculateSalary() {
  loading.value = true
  try {
    const res = await salaryApi.calculate(selectedYear.value, selectedMonth.value)
    salaryData.value = res.data || []
    initMonthlyChart()
  } catch (error) {
    message.error('获取工资数据失败')
  } finally {
    loading.value = false
  }
}

async function calculateYearlySalary() {
  yearlyLoading.value = true
  try {
    const response = await salaryApi.annualSummaryWithPayments(yearlyYear.value)
    const payload = response.data

    // New payload: { rows, summary }; fallback for old array payload.
    if (Array.isArray(payload)) {
      yearlyData.value = payload
      const fallbackSummary = payload.reduce((acc: any, row: any) => {
        const yearlyTotal = parseFloat(row.yearlyTotal) || 0
        const paidAmount = parseFloat(row.paidAmount) || 0
        const remainingAmount = Math.max(0, parseFloat(row.unpaidAmount) || (yearlyTotal - paidAmount))
        acc.total += yearlyTotal
        acc.paidAmount += paidAmount
        acc.remainingAmount += remainingAmount
        return acc
      }, { total: 0, paidAmount: 0, remainingAmount: 0 })
      yearlyTotals.value = fallbackSummary
    } else {
      yearlyData.value = payload?.rows || []
      yearlyTotals.value = {
        total: parseFloat(payload?.summary?.total) || 0,
        paidAmount: parseFloat(payload?.summary?.paidAmount) || 0,
        remainingAmount: parseFloat(payload?.summary?.remainingAmount) || 0
      }
    }
  } catch (error) {
    console.error('Failed to fetch yearly salary:', error)
    message.error('获取年度工资数据失败')
    yearlyData.value = []
    yearlyTotals.value = { total: 0, paidAmount: 0, remainingAmount: 0 }
  } finally {
    yearlyLoading.value = false
  }
}

function initMonthlyChart() {
  if (!monthlyChartRef.value) return
  
  if (monthlyChart) {
    monthlyChart.dispose()
  }
  
  monthlyChart = echarts.init(monthlyChartRef.value)
  
  const data = salaryData.value.slice(0, 10).map(s => ({
    name: s.workerName,
    value: parseFloat(s.totalSalary) || 0
  }))
  
  const colors = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#6366f1', '#818cf8', '#a5b4fc', '#f59e0b', '#fbbf24']
  
  monthlyChart.setOption({
    tooltip: { 
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: [12, 16],
      extraCssText: 'border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);',
      formatter: (params: any) => {
        return `${params[0].name}: ¥${Math.round(params[0].value)}`
      }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { 
      type: 'category', 
      data: data.map(d => d.name),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#6b7280', fontSize: 10, rotate: 30 },
      axisTick: { show: false }
    },
    yAxis: { 
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
      axisLabel: { color: '#9ca3af', fontSize: 11 }
    },
    series: [{
      type: 'bar',
      data: data.map((d, i) => ({
        value: d.value,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: colors[i % colors.length] },
            { offset: 1, color: colors[i % colors.length] + '60' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      })),
      barMaxWidth: 40,
      label: {
        show: true,
        position: 'top',
        formatter: (params: any) => '¥' + Math.round(params.value),
        fontSize: 10,
        color: '#64748b',
        fontWeight: 600
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0,0,0,0.2)'
        }
      }
    }]
  })
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

async function exportSalary() {
  try {
    const headers = ['工人', '打卡天数', '请假', '缺勤', '加班时长', '基本工资', '加班工资', '总工资']
    const rows = salaryData.value.map(s => [
      s.workerName, s.checkInDays, s.leaveDays, s.absentDays,
      s.overtimeHours, Math.round(s.normalSalary), Math.round(s.overtimeSalary), Math.round(s.totalSalary)
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    downloadCSV(csv, `工资报表_${selectedYear.value}-${selectedMonth.value}.csv`)
    message.success('导出成功')
  } catch (error) {
    message.error('导出失败')
  }
}

async function exportYearlySalary() {
  try {
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const headers = ['工人', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '年度总计']
    const rows = yearlyData.value.map(s => [
      s.workerName,
      ...monthKeys.map(k => Math.round(parseFloat(s[k]) || 0)),
      Math.round(parseFloat(s.yearlyTotal) || 0)
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    downloadCSV(csv, `年度工资报表_${yearlyYear.value}.csv`)
    message.success('导出成功')
  } catch (error) {
    message.error('导出失败')
  }
}
</script>

<style scoped>
.salary-view {
  padding: 0;
}

.summary-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-card {
  background: var(--border-light);
  border-radius: var(--radius-md);
  padding: 18px;
  text-align: center;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.summary-card.total {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: #fff;
  border: none;
  box-shadow: var(--shadow-md);
}

.summary-card .summary-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.summary-card.total .summary-label {
  color: rgba(255, 255, 255, 0.85);
}

.summary-card .summary-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.summary-card .summary-value.secondary {
  color: var(--info);
  font-size: 18px;
}

.summary-card.total .summary-value {
  color: #fff;
  font-size: 28px;
}

.summary-card.success-card {
  background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%) !important;
  border: none;
  box-shadow: var(--shadow-md);
}

.summary-card.success-card .summary-label,
.summary-card.success-card .summary-value {
  color: #fff !important;
}

.summary-card.warning-card {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%) !important;
  border: none;
  box-shadow: var(--shadow-md);
}

.summary-card.warning-card .summary-label,
.summary-card.warning-card .summary-value {
  color: #fff !important;
}

.yearly-table :deep(.ant-table-cell-fix-left),
.yearly-table :deep(.ant-table-cell-fix-right) {
  background: #fff !important;
}

.yearly-table :deep(.ant-table-thead .ant-table-cell-fix-left),
.yearly-table :deep(.ant-table-thead .ant-table-cell-fix-right) {
  background: #fafafa !important;
}

.yearly-table :deep(.ant-table-row:hover .ant-table-cell-fix-left),
.yearly-table :deep(.ant-table-row:hover .ant-table-cell-fix-right) {
  background: #fafafa !important;
}
</style>
