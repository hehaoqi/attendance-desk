<template>
  <div class="salary-payment-view">
    <a-card title="工资发放记录">
      <template #extra>
        <a-space>
          <a-select v-model:value="selectedYear" style="width: 180px" @change="fetchPayments">
            <a-select-option v-for="y in yearOptions" :key="y.value" :value="y.value">{{ y.label }}</a-select-option>
          </a-select>
          <a-select v-model:value="filterWorkerId" style="width: 150px" allowClear placeholder="选择工人" @change="fetchPayments">
            <a-select-option v-for="worker in workers" :key="worker.id" :value="worker.id">
              {{ worker.name }}
            </a-select-option>
          </a-select>
          <a-button type="primary" @click="showAddModal">新增发放</a-button>
        </a-space>
      </template>

      <a-table
        :dataSource="paymentData"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        rowKey="id"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'workerName'">
            <a-tag color="blue">{{ record.workerName }}</a-tag>
          </template>
          <template v-if="column.key === 'paymentDate'">
            <a-tag>{{ record.paymentDate }}</a-tag>
          </template>
          <template v-if="column.key === 'amount'">
            <span style="color: #52c41a; font-weight: 600;">¥{{ parseFloat(record.amount).toFixed(2) }}</span>
          </template>
          <template v-if="column.key === 'paymentMethod'">
            {{ record.paymentMethod || '-' }}
          </template>
          <template v-if="column.key === 'paymentPeriod'">
            <a-tag v-if="record.paymentPeriod" color="geekblue">{{ record.paymentPeriod }}</a-tag>
            <span v-else style="color: #999;">-</span>
          </template>
          <template v-if="column.key === 'remarks'">
            <span v-if="record.remarks">{{ record.remarks }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button size="small" @click="handleEdit(record)">编辑</a-button>
              <a-button size="small" @click="editRemarks(record)">备注</a-button>
              <a-button size="small" type="link" danger @click="deletePayment(record.id)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>

  <a-modal v-model:open="modalVisible" :title="modalTitle" @ok="handleSubmit" :confirmLoading="loading">
    <a-form :model="formState" layout="vertical">
      <a-form-item label="选择工人" required>
        <a-select 
          v-model:value="formState.workerId" 
          show-search 
          placeholder="请选择工人"
          :disabled="!!editingId"
        >
          <a-select-option v-for="worker in workers" :key="worker.id" :value="worker.id">
            {{ worker.name }}
          </a-select-option>
        </a-select>
        <div v-if="editingId" style="font-size: 12px; color: #999; margin-top: 4px;">
          编辑模式下不可修改工人
        </div>
      </a-form-item>
      <a-form-item label="发放日期" required>
        <a-date-picker v-model:value="formState.paymentDate" style="width: 100%" />
      </a-form-item>
      <a-form-item label="工资金额" required>
        <a-input-number v-model:value="formState.amount" :min="0" :precision="2" style="width: 100%" />
      </a-form-item>
      <a-form-item label="发放方式">
        <a-select v-model:value="formState.paymentMethod" placeholder="请选择发放方式" allowClear>
          <a-select-option value="现金">现金</a-select-option>
          <a-select-option value="银行转账">银行转账</a-select-option>
          <a-select-option value="微信">微信</a-select-option>
          <a-select-option value="支付宝">支付宝</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="工资月份">
        <a-month-picker v-model:value="formState.paymentPeriod" style="width: 100%" placeholder="选择月份" />
      </a-form-item>
      <a-form-item label="备注">
        <a-textarea v-model:value="formState.remarks" :rows="3" placeholder="请填写备注信息" />
      </a-form-item>
    </a-form>
  </a-modal>

  <a-modal v-model:open="remarksModalVisible" title="编辑备注" @ok="handleRemarksSubmit" :confirmLoading="loading">
    <a-textarea v-model:value="remarksFormState.remarks" :rows="4" placeholder="请填写备注信息" />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import { useWorkerStore } from '@/stores/workers'
import { salaryPaymentApi, yearsApi, getLunarYearLabel } from '@/api'
import dayjs from 'dayjs'

const workerStore = useWorkerStore()

const modalVisible = ref(false)
const loading = ref(false)
const modalTitle = ref('新增工资发放')
const editingId = ref<string | null>(null)

const filterWorkerId = ref<string | null>(null)
const selectedYear = ref<number>(dayjs().year())
const yearOptions = ref<{ value: number; label: string }[]>([])
const yearRangeMap = ref<Record<number, { startDate: string; endDate: string }>>({})

const formState = reactive({
  workerId: undefined as string | undefined,
  paymentDate: undefined as any,
  amount: 0,
  paymentMethod: undefined as string | undefined,
  paymentPeriod: undefined as any,
  remarks: ''
})

const workers = computed(() => workerStore.workers || [])
const paymentData = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(10)

const columns = [
  {
    title: '序号',
    key: 'index',
    width: 70,
    align: 'center',
    customRender: ({ index }: { index: number }) => index + 1
  },
  { title: '工人', dataIndex: 'workerName', key: 'workerName', width: 120 },
  { title: '发放日期', dataIndex: 'paymentDate', key: 'paymentDate', width: 120, align: 'center' },
  { title: '工资金额', dataIndex: 'amount', key: 'amount', width: 120, align: 'right' },
  { title: '发放方式', dataIndex: 'paymentMethod', key: 'paymentMethod', width: 100 },
  { title: '工资月份', dataIndex: 'paymentPeriod', key: 'paymentPeriod', width: 100 },
  { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 150 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' }
]

const remarksModalVisible = ref(false)
const editingRemarksId = ref<string | null>(null)
const remarksFormState = reactive({
  remarks: ''
})

const pagination = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: paymentData.value.length,
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (page: number, size: number) => {
    currentPage.value = page
    pageSize.value = size
  }
}))

async function fetchPayments() {
  loading.value = true
  try {
    const params: any = {}
    if (filterWorkerId.value) {
      params.workerId = filterWorkerId.value
    }

    const yearRange = yearRangeMap.value[selectedYear.value]
    if (yearRange) {
      params.startDate = yearRange.startDate
      params.endDate = yearRange.endDate
    }

    const res = await salaryPaymentApi.getAll(params)
    paymentData.value = res.data || []
  } catch (error) {
    console.error('获取工资发放记录失败:', error)
    message.error('获取工资发放记录失败')
  } finally {
    loading.value = false
  }
}

async function loadYearOptions() {
  try {
    const res = await yearsApi.getAll()
    const rows = (res.data || [])
      .slice()
      .sort((a: any, b: any) => (a.yearNumber || 0) - (b.yearNumber || 0))

    yearOptions.value = rows.map((row: any) => ({
      value: row.yearNumber,
      label: getLunarYearLabel(row.yearNumber)
    }))

    yearRangeMap.value = rows.reduce((acc: Record<number, { startDate: string; endDate: string }>, row: any) => {
      acc[row.yearNumber] = {
        startDate: row.startDate,
        endDate: row.endDate
      }
      return acc
    }, {})

    if (rows.length > 0) {
      const defaultYear = rows.find((y: any) => !!y.isDefault)?.yearNumber || rows[0].yearNumber
      selectedYear.value = defaultYear
    }
  } catch (error) {
    console.error('加载年份选项失败:', error)
  }
}

async function handleSubmit() {
  if (!formState.workerId || !formState.paymentDate || formState.amount <= 0) {
    message.warning('请填写完整信息')
    return
  }
  
  loading.value = true
  try {
    const data: any = {
      workerId: formState.workerId,
      paymentDate: formState.paymentDate.format('YYYY-MM-DD'),
      amount: formState.amount,
      remarks: formState.remarks
    }
    
    if (formState.paymentMethod) {
      data.paymentMethod = formState.paymentMethod
    }
    if (formState.paymentPeriod) {
      data.paymentPeriod = formState.paymentPeriod.format('YYYY-MM')
    }
    
    if (editingId.value) {
      await salaryPaymentApi.update(editingId.value, data)
      message.success('更新成功')
    } else {
      await salaryPaymentApi.create(data)
      message.success('创建成功')
    }
    modalVisible.value = false
    fetchPayments()
  } catch (error) {
    console.error('操作失败:', error)
    message.error('操作失败')
  } finally {
    loading.value = false
  }
}

function showAddModal() {
  editingId.value = null
  modalTitle.value = '新增工资发放'
  formState.workerId = undefined
  formState.paymentDate = dayjs()
  formState.amount = 0
  formState.paymentMethod = undefined
  formState.paymentPeriod = undefined
  formState.remarks = ''
  modalVisible.value = true
}

function handleEdit(record: any) {
  editingId.value = record.id
  modalTitle.value = '编辑工资发放'
  formState.workerId = record.workerId
  formState.paymentDate = dayjs(record.paymentDate)
  formState.amount = parseFloat(record.amount)
  formState.paymentMethod = record.paymentMethod
  formState.paymentPeriod = record.paymentPeriod ? dayjs(record.paymentPeriod) : undefined
  formState.remarks = record.remarks || ''
  modalVisible.value = true
}

function editRemarks(record: any) {
  editingRemarksId.value = record.id
  remarksFormState.remarks = record.remarks || ''
  remarksModalVisible.value = true
}

async function handleRemarksSubmit() {
  if (!editingRemarksId.value) return
  
  loading.value = true
  try {
    await salaryPaymentApi.updateRemarks(editingRemarksId.value, remarksFormState.remarks)
    message.success('备注更新成功')
    remarksModalVisible.value = false
    fetchPayments()
  } catch (error) {
    message.error('备注更新失败')
  } finally {
    loading.value = false
  }
}

async function deletePayment(id: string) {
  loading.value = true
  try {
    await salaryPaymentApi.delete(id)
    message.success('删除成功')
    fetchPayments()
  } catch (error) {
    message.error('删除失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await workerStore.fetchWorkers()
  await loadYearOptions()
  fetchPayments()
})
</script>

<style scoped>
.salary-payment-view { padding: 0; }
</style>
