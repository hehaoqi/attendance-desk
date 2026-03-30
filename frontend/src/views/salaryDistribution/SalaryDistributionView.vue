<template>
  <div class="salary-distribution-view">
    <a-card>
      <template #title>
        <span>工资发放记录</span>
      </template>
      <template #extra>
        <a-space>
          <a-select v-model:value="selectedWorkerId" style="width: 200px" placeholder="选择工人查看工资记录" show-search>
            <a-select-option v-for="worker in workers" :key="worker.id" :value="worker.id">
              {{ worker.name }}
            </a-select-option>
          </a-select>
          <a-range-picker 
            v-model:value="dateRange" 
            style="width: 280px" 
            :locale="zhCN" 
            placeholder="选择日期范围" 
          />
          <a-button type="primary" @click="fetchPayments">查询</a-button>
          <a-button @click="showAddModal">新增发放</a-button>
        </a-space>
      </template>

      <div class="summary-stats" style="margin-top: 16px; margin-bottom: 24px;">
        <a-row :gutter="16">
          <a-col :span="6">
            <a-statistic title="发放次数" :value="summaryStats.totalPayments" suffix="次" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="发放总额" :precision="2" :value="summaryStats.totalAmount" suffix="元" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="工人数" :value="summaryStats.totalWorkers" suffix="人" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="平均发放" :precision="2" :value="summaryStats.avgAmount" suffix="元" />
          </a-col>
        </a-row>
      </div>

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
            <span style="color: #52c41a; font-weight: 600">¥{{ Number(record.amount || 0).toFixed(2) }}</span>
          </template>
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button size="small" @click="editPayment(record.id, record.remarks)">编辑备注</a-button>
              <a-popconfirm title="确定删除?" @confirm="deletePayment(record.id)">
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- Remarks Modal -->
    <a-modal 
      v-model:open="remarksModalVisible" 
      :title="remarksModalTitle" 
      @ok="handleRemarksSubmit" 
      width="500px"
    >
      <a-textarea 
        v-model:value="remarksFormState.remarks" 
        :rows="6" 
        placeholder="请填写备注信息" 
        style="width: 100%" 
      />
    </a-modal>

    <!-- Delete Confirm Modal -->
    <a-modal 
      v-model:open="deleteModalVisible" 
      :title="确定删除?" 
      @ok="confirmDelete" 
      width="400px"
    >
      <p>确定要删除这条工资发放记录吗？删除后无法恢复。</p>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useWorkerStore } from '@/stores/workers'
import { salaryPaymentApi } from '@/api'
import dayjs, { Dayjs } from 'dayjs'

const workerStore = useWorkerStore()

// Data
const loading = ref(false)
const modalVisible = ref(false)
const selectedWorkerId = ref<string | (undefined)('')
const dateRange = ref<[Dayjs, Dayjs] | null>(null)
const paymentData = ref<any[]>([])
const editingId = ref<string | undefined>(undefined)
const modalTitle = ref('新增工资发放')

// Form State
const formState = reactive({
  workerId: '',
  paymentDate: dayjs(),
  amount: 0,
  remarks: ''
})

const remarksModalVisible = ref(false)
const remarksModalTitle = ref('编辑备注')
const editingRemarksId = ref<string | undefined>(undefined)
const remarksFormState = reactive({
  remarks: ''
})
const deleteModalVisible = ref(false)
const deletingId = ref<string | undefined>(undefined)

// Pagination
const currentPage = ref(1)
const pageSize = ref(10)

const workers = computed(() => workerStore.workers)
const summaryStats = computed(() => {
  const totalPayments = paymentData.value.length
  const totalAmount = paymentData.value.reduce((sum, p) => sum + (p.amount || 0), 0)
  const totalWorkers = new Set(paymentData.value.map(p => p.workerId)).size
  const avgAmount = totalPayments > 0 ? totalAmount / totalPayments : 0

  return {
    totalPayments,
    totalAmount,
    totalWorkers,
    avgAmount
  }
})

const columns = [
  { title: '工人', dataIndex: 'workerName', key: 'workerName' },
  { title: '发放日期', dataIndex: 'paymentDate', key: 'paymentDate', align: 'center' },
  { title: '发放金额', dataIndex: 'amount', key: 'amount', align: 'right' },
  { title: '备注', dataIndex: 'remarks', key: 'remarks' },
  { title: '操作', key: 'action', width: 150 }
]

const pagination = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: paymentData.value.length
}))

async function fetchPayments() {
  if (!selectedWorkerId.value) {
    message.warning('请先选择工人')
    return
  }
  loading.value = true
  try {
    const params: any = {
      startDate: dateRange.value?.[0]?.format('YYYY-MM-DD'),
      endDate: dateRange.value?.[1]?.format('YYYY-MM-DD')
    }
    
    const res = await salaryPaymentApi.getByWorker(selectedWorkerId.value as string, params)
    paymentData.value = res.data || []
    currentPage.value = 1
  } catch (error) {
    message.error('获取工资发放记录失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

function showAddModal() {
  editingId.value = undefined
  modalVisible.value = true
  modalTitle.value = '新增工资发放'
  formState.workerId = selectedWorkerId.value || ''
  formState.paymentDate = dayjs()
  formState.amount = 0
  formState.remarks = ''
}

function editPayment(id: string, remarks: string) {
  const payment = paymentData.value.find(p => p.id === id)
  if (!payment) return
  
  editingId.value = id
  modalVisible.value = true
  modalTitle.value = '编辑工资发放'
  formState.workerId = payment.workerId
  formState.paymentDate = dayjs(payment.paymentDate)
  formState.amount = payment.amount
  formState.remarks = payment.remarks || ''
}

function editRemarks(id: string, remarks: string) {
  remarksModalVisible.value = true
  remarksModalTitle.value = '编辑备注'
  remarksFormState.remarks = remarks
  editingRemarksId.value = id
}

function handleRemarksSubmit() {
  if (!editingRemarksId.value) return
  
  salaryPaymentApi.updateRemarks(editingRemarksId.value, remarksFormState.remarks)
  remarksModalVisible.value = false
  message.success('备注更新成功')
}

function deletePayment(id: string) {
  deletingId.value = id
  deleteModalVisible.value = true
}

function confirmDelete() {
  if (!deletingId.value) return
  
  salaryPaymentApi.delete(deletingId.value)
  deleteModalVisible.value = false
  message.success('删除成功')
  fetchPayments()
}

watch(selectedWorkerId, () => {
  if (selectedWorkerId.value) {
    currentPage.value = 1
    fetchPayments()
  }
})

onMounted(async () => {
  try {
    await workerStore.fetchWorkers()
  } catch (error) {
    console.error('Failed to load workers:', error)
  }
})
</script>

<style scoped>
.salary-distribution-view {
  padding: 20px;
}
</style>
