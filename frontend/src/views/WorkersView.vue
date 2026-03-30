<template>
  <div class="workers-view">
    <a-card title="工人管理">
      <template #extra>
        <a-space>
          <a-select v-model:value="filterType" style="width: 120px" allowClear placeholder="工人类型">
            <a-select-option value="permanent">正式工</a-select-option>
            <a-select-option value="temporary">临时工</a-select-option>
          </a-select>
          <a-select v-model:value="filterLevel" style="width: 120px" allowClear placeholder="技能等级">
            <a-select-option value="senior">高级工</a-select-option>
            <a-select-option value="medium">中级工</a-select-option>
            <a-select-option value="normal">普通工</a-select-option>
          </a-select>
          <a-button @click="exportWorkers">导出数据</a-button>
          <a-button type="primary" @click="showAddModal">
            <template #icon><PlusOutlined /></template>
            添加工人
          </a-button>
        </a-space>
      </template>

      <a-table :dataSource="filteredWorkers" :columns="columns" :loading="workerStore.loading" rowKey="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-tag color="blue">{{ record.name }}</a-tag>
          </template>
          <template v-if="column.key === 'workerType'">
            <a-tag :color="record.workerType === 'permanent' ? 'blue' : 'orange'">
              {{ record.workerType === 'permanent' ? '正式工' : '临时工' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'skillLevel'">
            <a-tag :color="getSkillColor(record.skillLevel)">
              {{ getSkillText(record.skillLevel) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'active' ? 'green' : 'red'">
              {{ record.status === 'active' ? '在职' : '离职' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'dailyWage' || column.key === 'overtimeWage'">
            <span style="color: #52c41a; font-weight: 600">¥{{ Number(record[column.key] || 0).toFixed(2) }}</span>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button size="small" @click="editWorker(record)">编辑</a-button>
              <a-popconfirm title="确定删除?" @confirm="deleteWorker(record.id)">
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="modalVisible" :title="editingWorker ? '编辑工人' : '添加工人'" @ok="handleSubmit" width="600px">
      <a-form :model="formState" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="姓名" required>
              <a-input v-model:value="formState.name" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="手机号">
              <a-input v-model:value="formState.phone" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="工人类型">
              <a-select v-model:value="formState.workerType" @change="onWorkerTypeChange">
                <a-select-option value="permanent">正式工</a-select-option>
                <a-select-option value="temporary">临时工</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="技能等级">
              <a-select v-model:value="formState.skillLevel" @change="onSkillLevelChange">
                <a-select-option value="senior">高级工</a-select-option>
                <a-select-option value="medium">中级工</a-select-option>
                <a-select-option value="normal">普通工</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="日薪">
              <a-input-number v-model:value="formState.dailyWage" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="加班时薪">
              <a-input-number v-model:value="formState.overtimeWage" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="入职日期">
              <a-date-picker v-model:value="formState.joinDate" style="width: 100%" :locale="zhCN" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="formState.status">
                <a-select-option value="active">在职</a-select-option>
                <a-select-option value="inactive">离职</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-textarea v-model:value="formState.notes" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useWorkerStore } from '@/stores/workers'
import type { Worker } from '@/stores/workers'
import { settingsApi } from '@/api'
import dayjs from 'dayjs'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

const workerStore = useWorkerStore()

const filterType = ref<string | undefined>(undefined)
const filterLevel = ref<string | undefined>(undefined)

const columns = [
  {
    title: '序号',
    key: 'index',
    width: 70,
    align: 'center',
    customRender: ({ index }: { index: number }) => index + 1
  },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '工人类型', dataIndex: 'workerType', key: 'workerType' },
  { title: '技能等级', dataIndex: 'skillLevel', key: 'skillLevel' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  { title: '日薪', dataIndex: 'dailyWage', key: 'dailyWage', align: 'right' },
  { title: '加班时薪', dataIndex: 'overtimeWage', key: 'overtimeWage', align: 'right' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '操作', key: 'action' }
]

const modalVisible = ref(false)
const editingWorker = ref<Worker | null>(null)

const wageSettings = reactive({
  seniorDaily: 350,
  seniorOvertime: 50,
  mediumDaily: 280,
  mediumOvertime: 40,
  normalDaily: 220,
  normalOvertime: 30
})

const formState = reactive({
  name: '',
  phone: '',
  workerType: 'permanent',
  skillLevel: 'normal',
  dailyWage: 220,
  overtimeWage: 30,
  joinDate: null as any,
  status: 'active',
  notes: ''
})

const filteredWorkers = computed(() => {
  let result = workerStore.workers
  if (filterType.value) {
    result = result.filter(w => w.workerType === filterType.value)
  }
  if (filterLevel.value) {
    result = result.filter(w => w.skillLevel === filterLevel.value)
  }
  return result
})

onMounted(async () => {
  await workerStore.fetchWorkers()
  await loadWageSettings()
})

async function loadWageSettings() {
  try {
    const res = await settingsApi.getAll()
    if (res.data) {
      wageSettings.seniorDaily = Number(res.data.seniorDailyWage) || 350
      wageSettings.seniorOvertime = Number(res.data.seniorOvertimeWage) || 50
      wageSettings.mediumDaily = Number(res.data.mediumDailyWage) || 280
      wageSettings.mediumOvertime = Number(res.data.mediumOvertimeWage) || 40
      wageSettings.normalDaily = Number(res.data.normalDailyWage) || 220
      wageSettings.normalOvertime = Number(res.data.normalOvertimeWage) || 30
    }
  } catch (error) {
    console.error('Failed to load wage settings:', error)
  }
}

function onSkillLevelChange(level: string) {
  switch (level) {
    case 'senior':
      formState.dailyWage = wageSettings.seniorDaily
      formState.overtimeWage = wageSettings.seniorOvertime
      break
    case 'medium':
      formState.dailyWage = wageSettings.mediumDaily
      formState.overtimeWage = wageSettings.mediumOvertime
      break
    case 'normal':
      formState.dailyWage = wageSettings.normalDaily
      formState.overtimeWage = wageSettings.normalOvertime
      break
  }
}

function onWorkerTypeChange() {}

function getSkillColor(level: string) {
  const colors: Record<string, string> = {
    senior: 'gold',
    medium: 'cyan',
    normal: 'default'
  }
  return colors[level] || 'default'
}

function getSkillText(level: string) {
  const texts: Record<string, string> = {
    senior: '高级工',
    medium: '中级工',
    normal: '普通工'
  }
  return texts[level] || level
}

function showAddModal() {
  editingWorker.value = null
  Object.assign(formState, {
    name: '',
    phone: '',
    workerType: 'permanent',
    skillLevel: 'normal',
    dailyWage: wageSettings.normalDaily,
    overtimeWage: wageSettings.normalOvertime,
    joinDate: dayjs(),
    status: 'active',
    notes: ''
  })
  modalVisible.value = true
}

function editWorker(worker: Worker) {
  editingWorker.value = worker
  Object.assign(formState, {
    name: worker.name,
    phone: worker.phone,
    workerType: worker.workerType || 'permanent',
    skillLevel: worker.skillLevel || 'normal',
    dailyWage: worker.dailyWage,
    overtimeWage: worker.overtimeWage || 0,
    joinDate: worker.joinDate ? dayjs(worker.joinDate) : null,
    status: worker.status,
    notes: worker.notes || ''
  })
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    const data = {
      ...formState,
      joinDate: formState.joinDate ? formState.joinDate.format('YYYY-MM-DD') : null
    }
    
    if (editingWorker.value) {
      await workerStore.updateWorker(editingWorker.value.id, data)
      message.success('更新成功')
    } else {
      await workerStore.createWorker(data)
      message.success('添加成功')
    }
    modalVisible.value = false
  } catch (error) {
    message.error('操作失败')
  }
}

async function deleteWorker(id: string) {
  try {
    await workerStore.deleteWorker(id)
    message.success('删除成功')
  } catch (error) {
    message.error('删除失败')
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

async function exportWorkers() {
  try {
    const workers = filteredWorkers.value
    const headers = ['姓名', '工人类型', '技能等级', '手机号', '日薪', '加班时薪', '入职日期', '状态']
    const rows = workers.map((w: any) => [
      w.name,
      w.workerType === 'permanent' ? '正式工' : '临时工',
      getSkillText(w.skillLevel),
      w.phone || '',
      w.dailyWage || 0,
      w.overtimeWage || 0,
      w.joinDate || '',
      w.status === 'active' ? '在职' : '离职'
    ])
    const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n')
    downloadCSV(csv, `工人数据_${dayjs().format('YYYY-MM-DD')}.csv`)
    message.success('导出成功')
  } catch (error) {
    message.error('导出失败')
  }
}
</script>

<style scoped>
.workers-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workers-view :deep(.ant-card) {
  border-radius: 0;
  box-shadow: none;
}

.workers-view :deep(.ant-table) {
  border-radius: var(--radius-md);
}

.workers-view :deep(.ant-table-thead > tr > th) {
  background: var(--border-light);
  color: var(--text-primary);
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}

.workers-view :deep(.ant-table-tbody > tr > td) {
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
  transition: background var(--ease) 0.2s;
}

.workers-view :deep(.ant-table-tbody > tr:hover > td) {
  background: var(--border-light);
}

.workers-view :deep(.ant-table-pagination) {
  margin: 16px 0 0;
}
</style>