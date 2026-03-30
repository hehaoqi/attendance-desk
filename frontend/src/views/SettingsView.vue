<template>
  <div class="settings-view">
    <!-- 工种工资 -->
    <div v-if="isWageView">
      <a-card title="工资标准设置">
        <a-alert message="设置不同技能等级的默认工资，添加工人时将根据等级自动填充。" type="info" show-icon style="margin-bottom: 24px" />
        <a-form layout="vertical">
          <a-row :gutter="16">
            <a-col :xs="24" :md="8">
              <a-card size="small" class="wage-card" title="高级工">
                <a-row :gutter="16">
                  <a-col :span="24">
                    <a-form-item label="日薪(元)">
                      <a-input-number v-model:value="settings.seniorDailyWage" :min="0" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="24">
                    <a-form-item label="加班时薪(元)">
                      <a-input-number v-model:value="settings.seniorOvertimeWage" :min="0" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-card>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-card size="small" class="wage-card" title="中级工">
                <a-row :gutter="16">
                  <a-col :span="24">
                    <a-form-item label="日薪(元)">
                      <a-input-number v-model:value="settings.mediumDailyWage" :min="0" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="24">
                    <a-form-item label="加班时薪(元)">
                      <a-input-number v-model:value="settings.mediumOvertimeWage" :min="0" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-card>
            </a-col>
            <a-col :xs="24" :md="8">
              <a-card size="small" class="wage-card" title="普通工">
                <a-row :gutter="16">
                  <a-col :span="24">
                    <a-form-item label="日薪(元)">
                      <a-input-number v-model:value="settings.normalDailyWage" :min="0" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="24">
                    <a-form-item label="加班时薪(元)">
                      <a-input-number v-model:value="settings.normalOvertimeWage" :min="0" style="width: 100%" />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-card>
            </a-col>
          </a-row>
          <a-form-item style="margin-top: 16px">
            <a-button type="primary" @click="saveWageSettings">保存设置</a-button>
          </a-form-item>
        </a-form>
      </a-card>
    </div>

    <!-- 数据备份与恢复 -->
    <div v-else-if="isBackupView">
      <a-card title="数据备份与恢复" style="margin-top: 16px">
        <a-alert
          type="warning"
          show-icon
          style="margin-bottom: 16px"
          message="导入会覆盖当前系统数据，建议先执行一次导出备份。"
        />
        <a-space direction="vertical" style="width: 100%" :size="12">
          <a-space>
            <a-button type="primary" :loading="exportingBackup" @click="exportDatabaseBackup">导出数据库备份</a-button>
            <span style="color: #888">导出完整 .db 文件，用于异地存储</span>
          </a-space>

          <a-space>
            <a-upload :before-upload="beforeSelectBackupFile" :show-upload-list="false" accept=".db">
              <a-button>选择备份文件(.db)</a-button>
            </a-upload>
            <span style="max-width: 360px; color: #555">{{ selectedBackupFile?.name || '未选择文件' }}</span>
          </a-space>

          <a-space>
            <a-button danger :disabled="!selectedBackupFile" :loading="importingBackup" @click="importDatabaseBackup">
              导入并恢复数据库
            </a-button>
          </a-space>
        </a-space>
      </a-card>
    </div>

    <!-- 用户管理 -->
    <div v-else-if="isUsersView">
      <a-card title="用户列表">
        <template #extra>
          <a-button type="primary" @click="showAddUserModal">添加用户</a-button>
        </template>
        <a-table :dataSource="users" :columns="userColumns" size="small" rowKey="id">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'role'">
              <a-tag :color="record.role === 'admin' ? 'gold' : 'blue'">
                {{ getRoleName(record.role) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? '正常' : '禁用' }}
              </a-tag>
            </template>
            <template v-if="column.key === 'action'">
              <a-space>
                <a-button size="small" @click="editUser(record)">编辑</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 角色管理 -->
    <div v-else-if="isRolesView">
      <a-card title="角色列表">
        <template #extra>
          <a-button type="primary" @click="showAddRoleModal">添加角色</a-button>
        </template>
        <a-table :dataSource="roles" :columns="roleColumns" size="small" rowKey="id">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'menus'">
              <a-tag v-for="menu in getMenuTags(record.menus)" :key="menu" style="margin: 2px">{{ menu }}</a-tag>
            </template>
            <template v-if="column.key === 'action'">
              <a-space>
                <a-button size="small" @click="editRole(record)">编辑</a-button>
                <a-button size="small" danger @click="deleteRole(record.id)" :disabled="record.name === 'admin'">删除</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 年份管理 -->
    <div v-else-if="isYearsView">
      <a-card title="年份管理">
        <template #extra>
          <a-button type="primary" @click="showAddYearModal">添加年份</a-button>
        </template>
        <a-alert message="系统已预置2026-2035农历年数据（默认丙午马年），可在此维护。" type="info" show-icon style="margin-bottom: 20px" />
        <a-table :dataSource="years" :columns="yearColumns" size="small" rowKey="id" :loading="yearsLoading">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'zodiacName'">
              <span style="font-weight: 600">{{ getLunarYearName(record.yearNumber) }}</span>
            </template>
            <template v-if="column.key === 'isDefault'">
              <a-tag :color="record.isDefault ? 'green' : 'default'">
                {{ record.isDefault ? '默认' : '非默认' }}
              </a-tag>
            </template>
            <template v-if="column.key === 'dateRange'">
              {{ formatYearDateRange(record) }}
            </template>
            <template v-if="column.key === 'action'">
              <a-space>
                <a-checkbox 
                  v-if="!record.isDefault"
                  @change="setDefaultYear(record)"
                >
                  设为默认
                </a-checkbox>
                <a-button size="small" @click="editYear(record)">编辑</a-button>
                <a-popconfirm title="确定删除该年份?" @confirm="deleteYear(record.id)">
                  <a-button size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- Modals -->
    <a-modal v-model:open="addUserVisible" :title="editingUser ? '编辑用户' : '添加用户'" @ok="handleAddUser" width="500px">
      <a-form :model="newUser" layout="vertical">
        <a-form-item label="用户名" required>
          <a-input v-model:value="newUser.username" :disabled="!!editingUser" />
        </a-form-item>
        <a-form-item label="密码" :required="!editingUser">
          <a-input-password v-model:value="newUser.password" :placeholder="editingUser ? '留空则不修改' : ''" />
        </a-form-item>
        <a-form-item label="姓名">
          <a-input v-model:value="newUser.realName" />
        </a-form-item>
        <a-form-item label="角色">
          <a-select v-model:value="newUser.role">
            <a-select-option v-for="r in roles" :key="r.name" :value="r.name">{{ r.displayName }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="newUser.status">
            <a-select-option value="active">正常</a-select-option>
            <a-select-option value="inactive">禁用</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="addRoleVisible" :title="editingRole ? '编辑角色' : '添加角色'" @ok="handleAddRole" width="600px">
      <a-form :model="newRole" layout="vertical">
        <a-form-item label="角色名称" required>
          <a-input v-model:value="newRole.name" placeholder="如: manager" :disabled="!!editingRole" />
        </a-form-item>
        <a-form-item label="显示名称" required>
          <a-input v-model:value="newRole.displayName" placeholder="如: 项目经理" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="newRole.description" :rows="2" />
        </a-form-item>
        <a-form-item label="菜单权限">
          <a-checkbox-group v-model:value="newRole.menuList">
            <a-row>
              <a-col :span="8" v-for="menu in allMenus" :key="menu.key">
                <a-checkbox :value="menu.key">{{ menu.name }}</a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="addYearVisible" :title="editingYear ? '编辑年份' : '添加年份'" @ok="handleAddYear" width="500px">
      <a-form :model="newYear" layout="vertical">
        <a-form-item label="年份" required>
          <a-input-number 
            v-model:value="newYear.yearNumber" 
            :min="1900" 
            :max="2100" 
            style="width: 100%"
            :disabled="!!editingYear"
            placeholder="如: 2026"
          />
        </a-form-item>
        <a-form-item label="开始日期" required>
          <a-date-picker v-model:value="newYear.startDate" style="width: 100%" />
        </a-form-item>
        <a-form-item label="结束日期" required>
          <a-date-picker v-model:value="newYear.endDate" style="width: 100%" />
        </a-form-item>
        <a-form-item label="设为默认年份">
          <a-checkbox v-model:checked="newYear.isDefault" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { settingsApi, usersApi, rolesApi, yearsApi, getLunarYearName } from '@/api'
import dayjs from 'dayjs'

const route = useRoute()

const isWageView = computed(() => route.path === '/settings/wage')
const isBackupView = computed(() => route.path === '/settings/backup')
const isUsersView = computed(() => route.path === '/settings/users')
const isRolesView = computed(() => route.path === '/settings/roles')
const isYearsView = computed(() => route.path === '/settings/years')

const addUserVisible = ref(false)
const addRoleVisible = ref(false)
const addYearVisible = ref(false)
const editingUser = ref<any>(null)
const editingRole = ref<any>(null)
const editingYear = ref<any>(null)

const users = ref<any[]>([])

const roles = ref<any[]>([])

const years = ref<any[]>([])
const yearsLoading = ref(false)
const exportingBackup = ref(false)
const importingBackup = ref(false)
const selectedBackupFile = ref<any>(null)

const DEFAULT_LUNAR_YEARS = [
  { yearNumber: 2026, startDate: '2026-02-17', endDate: '2027-02-05', isDefault: true },
  { yearNumber: 2027, startDate: '2027-02-06', endDate: '2028-01-25', isDefault: false },
  { yearNumber: 2028, startDate: '2028-01-26', endDate: '2029-02-12', isDefault: false },
  { yearNumber: 2029, startDate: '2029-02-13', endDate: '2030-02-02', isDefault: false },
  { yearNumber: 2030, startDate: '2030-02-03', endDate: '2031-01-22', isDefault: false },
  { yearNumber: 2031, startDate: '2031-01-23', endDate: '2032-02-10', isDefault: false },
  { yearNumber: 2032, startDate: '2032-02-11', endDate: '2033-01-30', isDefault: false },
  { yearNumber: 2033, startDate: '2033-01-31', endDate: '2034-02-18', isDefault: false },
  { yearNumber: 2034, startDate: '2034-02-19', endDate: '2035-02-07', isDefault: false },
  { yearNumber: 2035, startDate: '2035-02-08', endDate: '2036-01-27', isDefault: false }
]

const allMenus = [
  { key: 'home', name: '首页' },
  { key: 'workers', name: '工人管理' },
  { key: 'attendance', name: '打卡管理' },
  { key: 'salary', name: '工资统计' },
  { key: 'settings', name: '系统设置' }
]

const settings = reactive({
  seniorDailyWage: 350,
  seniorOvertimeWage: 50,
  mediumDailyWage: 280,
  mediumOvertimeWage: 40,
  normalDailyWage: 220,
  normalOvertimeWage: 30
})

const userColumns = [
  {
    title: '序号',
    key: 'index',
    width: 70,
    align: 'center',
    customRender: ({ index }: { index: number }) => index + 1
  },
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '姓名', dataIndex: 'realName', key: 'realName' },
  { title: '角色', dataIndex: 'role', key: 'role' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '操作', key: 'action' }
]

const roleColumns = [
  {
    title: '序号',
    key: 'index',
    width: 70,
    align: 'center',
    customRender: ({ index }: { index: number }) => index + 1
  },
  { title: '角色名称', dataIndex: 'name', key: 'name' },
  { title: '显示名称', dataIndex: 'displayName', key: 'displayName' },
  { title: '描述', dataIndex: 'description', key: 'description' },
  { title: '菜单权限', dataIndex: 'menus', key: 'menus' },
  { title: '操作', key: 'action' }
]

const yearColumns = [
  {
    title: '序号',
    key: 'index',
    width: 70,
    align: 'center',
    customRender: ({ index }: { index: number }) => index + 1
  },
  { title: '农历年', key: 'zodiacName', width: 120 },
  { title: '日期范围', dataIndex: 'dateRange', key: 'dateRange', width: 360 },
  { title: '状态', dataIndex: 'isDefault', key: 'isDefault', width: 100 },
  { title: '操作', key: 'action' }
]

const newUser = reactive({
  username: '',
  password: '',
  realName: '',
  role: 'user',
  status: 'active'
})

const newRole = reactive({
  name: '',
  displayName: '',
  description: '',
  menuList: [] as string[]
})

const newYear = reactive({
  yearNumber: undefined as number | undefined,
  startDate: undefined as any,
  endDate: undefined as any,
  isDefault: false
})

onMounted(async () => {
  await Promise.all([loadSettings(), loadUsers(), loadRoles(), loadYears()])
})

async function loadSettings() {
  try {
    const response = await settingsApi.getAll()
    if (response.data) {
      Object.assign(settings, {
        seniorDailyWage: Number(response.data.seniorDailyWage) || 350,
        seniorOvertimeWage: Number(response.data.seniorOvertimeWage) || 50,
        mediumDailyWage: Number(response.data.mediumDailyWage) || 280,
        mediumOvertimeWage: Number(response.data.mediumOvertimeWage) || 40,
        normalDailyWage: Number(response.data.normalDailyWage) || 220,
        normalOvertimeWage: Number(response.data.normalOvertimeWage) || 30
      })
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

async function loadUsers() {
  try {
    const response = await usersApi.getAll()
    users.value = response.data || []
  } catch (error) {
    console.error('Failed to load users:', error)
    users.value = []
  }
}

async function loadRoles() {
  try {
    const response = await rolesApi.getAll()
    roles.value = response.data || []
  } catch (error) {
    console.error('Failed to load roles:', error)
    roles.value = []
  }
}

async function saveWageSettings() {
  try {
    const data = {
      seniorDailyWage: settings.seniorDailyWage,
      seniorOvertimeWage: settings.seniorOvertimeWage,
      mediumDailyWage: settings.mediumDailyWage,
      mediumOvertimeWage: settings.mediumOvertimeWage,
      normalDailyWage: settings.normalDailyWage,
      normalOvertimeWage: settings.normalOvertimeWage
    }
    await settingsApi.update(data)
    message.success('保存成功')
  } catch (error) {
    message.error('保存失败')
  }
}

function getFilenameFromDisposition(disposition?: string) {
  if (!disposition) return ''
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch (e) {
      // ignore malformed URI encoding and fallback to plain filename
    }
  }
  const normalMatch = disposition.match(/filename="?([^";]+)"?/i)
  return normalMatch?.[1] || ''
}

async function exportDatabaseBackup() {
  exportingBackup.value = true
  try {
    const response = await settingsApi.exportBackup()
    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: 'application/octet-stream' })

    if (!blob.size) {
      throw new Error('empty-backup')
    }

    const filename =
      getFilenameFromDisposition(response.headers?.['content-disposition']) ||
      `attendance-backup-${dayjs().format('YYYYMMDD_HHmmss')}.db`
    const objectUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(objectUrl)

    message.success('数据库备份导出成功')
  } catch (error: any) {
    let errorMessage = '数据库备份导出失败'
    const blobError = error?.response?.data
    if (blobError instanceof Blob && blobError.type.includes('application/json')) {
      try {
        const parsed = JSON.parse(await blobError.text())
        if (parsed?.message) {
          errorMessage = parsed.message
        }
      } catch (e) {
        // ignore JSON parse error and keep default message
      }
    } else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message
    }
    message.error(errorMessage)
  } finally {
    exportingBackup.value = false
  }
}

async function beforeSelectBackupFile(file: any) {
  const isDbExt = String(file?.name || '').toLowerCase().endsWith('.db')
  if (!isDbExt) {
    message.error('仅支持 .db 备份文件')
    selectedBackupFile.value = null
    return false
  }

  const maxBytes = 100 * 1024 * 1024
  if ((file?.size || 0) > maxBytes) {
    message.error('备份文件过大，请选择小于 100MB 的文件')
    selectedBackupFile.value = null
    return false
  }

  try {
    const headerBuffer = await file.slice(0, 16).arrayBuffer()
    const headerText = new TextDecoder().decode(headerBuffer)
    if (!headerText.startsWith('SQLite format 3')) {
      message.error('文件不是有效的 SQLite 数据库备份')
      selectedBackupFile.value = null
      return false
    }
  } catch (e) {
    message.error('备份文件校验失败，请重新选择')
    selectedBackupFile.value = null
    return false
  }

  selectedBackupFile.value = file
  message.success('备份文件校验通过')
  return false
}

async function importDatabaseBackup() {
  if (!selectedBackupFile.value) {
    message.warning('请先选择备份文件')
    return
  }

  const confirmImport = window.confirm('导入将覆盖当前数据库中的业务数据，是否继续？')
  if (!confirmImport) return

  importingBackup.value = true
  try {
    const fileBuffer = await selectedBackupFile.value.arrayBuffer()
    await settingsApi.importBackup(fileBuffer)
    message.success('数据库导入成功，页面将刷新以加载最新数据')
    selectedBackupFile.value = null
    window.location.reload()
  } catch (error: any) {
    message.error(error?.response?.data?.message || '数据库导入失败')
  } finally {
    importingBackup.value = false
  }
}

function getRoleName(role: string) {
  const r = roles.value.find(x => x.name === role)
  return r?.displayName || role
}

function getMenuTags(menus: string) {
  if (!menus) return []
  const menuKeys = menus.split(',')
  return menuKeys.map(key => {
    const menu = allMenus.find(m => m.key === key)
    return menu?.name || key
  })
}

function formatYearDateRange(record: any) {
  if (!record?.startDate || !record?.endDate) return ''

  const start = dayjs(record.startDate)
  const end = dayjs(record.endDate)
  return `${start.format('YYYY年M月D日')} ~ ${end.format('YYYY年M月D日')}`
}

function showAddUserModal() {
  editingUser.value = null
  Object.assign(newUser, {
    username: '',
    password: '',
    realName: '',
    role: 'user',
    status: 'active'
  })
  addUserVisible.value = true
}

function editUser(record: any) {
  editingUser.value = record
  Object.assign(newUser, {
    username: record.username,
    password: '',
    realName: record.realName,
    role: record.role,
    status: record.status
  })
  addUserVisible.value = true
}

async function handleAddUser() {
  if (!newUser.username || (!editingUser.value && !newUser.password)) {
    message.error('请填写必填项')
    return
  }
  try {
    if (editingUser.value) {
      const data: any = {
        realName: newUser.realName,
        role: newUser.role,
        status: newUser.status
      }
      if (newUser.password) {
        data.password = newUser.password
      }
      await usersApi.update(editingUser.value.id, data)
      message.success('用户更新成功')
    } else {
      await usersApi.create({
        username: newUser.username,
        password: newUser.password,
        realName: newUser.realName,
        role: newUser.role,
        status: newUser.status
      })
      message.success('用户添加成功')
    }
    addUserVisible.value = false
    await loadUsers()
  } catch (error) {
    message.error('操作失败')
  }
}

function showAddRoleModal() {
  editingRole.value = null
  Object.assign(newRole, {
    name: '',
    displayName: '',
    description: '',
    menuList: []
  })
  addRoleVisible.value = true
}

function editRole(record: any) {
  editingRole.value = record
  Object.assign(newRole, {
    name: record.name,
    displayName: record.displayName,
    description: record.description,
    menuList: record.menus ? record.menus.split(',') : []
  })
  addRoleVisible.value = true
}

async function handleAddRole() {
  if (!newRole.name || !newRole.displayName) {
    message.error('请填写必填项')
    return
  }
  try {
    const data = {
      name: newRole.name,
      displayName: newRole.displayName,
      description: newRole.description,
      menus: newRole.menuList.join(',')
    }
    if (editingRole.value) {
      await rolesApi.update(editingRole.value.id, data)
      message.success('角色更新成功')
    } else {
      await rolesApi.create(data)
      message.success('角色添加成功')
    }
    addRoleVisible.value = false
    await loadRoles()
  } catch (error) {
    message.error('操作失败')
  }
}

async function deleteRole(id: string) {
  try {
    await rolesApi.delete(id)
    message.success('角色删除成功')
    await loadRoles()
  } catch (error) {
    message.error('删除失败')
  }
}

// 年份管理相关函数
async function loadYears() {
  yearsLoading.value = true
  try {
    let response = await yearsApi.getAll()
    let yearRows = response.data || []

    // 自动补全：当年份表为空时，按预置农历年一次性补齐10年数据
    if (yearRows.length === 0) {
      for (const item of DEFAULT_LUNAR_YEARS) {
        await yearsApi.create(item)
      }
      response = await yearsApi.getAll()
      yearRows = response.data || []
    }

    years.value = yearRows
      .map((year: any) => ({
        ...year,
        startDate: year.startDate || '',
        endDate: year.endDate || ''
      }))
      .sort((a: any, b: any) => {
        if (a.startDate && b.startDate) {
          return a.startDate.localeCompare(b.startDate)
        }
        if (a.startDate) return -1
        if (b.startDate) return 1
        return (a.yearNumber || 0) - (b.yearNumber || 0)
      })
  } catch (error) {
    console.error('Failed to load years:', error)
    years.value = []
  } finally {
    yearsLoading.value = false
  }
}

function showAddYearModal() {
  editingYear.value = null
  Object.assign(newYear, {
    yearNumber: undefined,
    startDate: undefined,
    endDate: undefined,
    isDefault: false
  })
  addYearVisible.value = true
}

function editYear(record: any) {
  editingYear.value = record
  Object.assign(newYear, {
    yearNumber: record.yearNumber,
    startDate: record.startDate ? dayjs(record.startDate) : undefined,
    endDate: record.endDate ? dayjs(record.endDate) : undefined,
    isDefault: record.isDefault || false
  })
  addYearVisible.value = true
}

async function handleAddYear() {
  if (!newYear.yearNumber || !newYear.startDate || !newYear.endDate) {
    message.error('请填写必填项')
    return
  }
  try {
    const data = {
      yearNumber: newYear.yearNumber,
      startDate: newYear.startDate.format('YYYY-MM-DD'),
      endDate: newYear.endDate.format('YYYY-MM-DD'),
      isDefault: newYear.isDefault
    }
    if (editingYear.value) {
      await yearsApi.update(editingYear.value.id, data)
      message.success('年份更新成功')
    } else {
      await yearsApi.create(data)
      message.success('年份添加成功')
    }
    addYearVisible.value = false
    await loadYears()
  } catch (error) {
    message.error('操作失败')
  }
}

async function setDefaultYear(record: any) {
  try {
    await yearsApi.update(record.id, {
      yearNumber: record.yearNumber,
      startDate: record.startDate,
      endDate: record.endDate,
      isDefault: true
    })
    message.success('默认年份已更新')
    await loadYears()
  } catch (error) {
    message.error('设置失败')
  }
}

async function deleteYear(id: string) {
  try {
    await yearsApi.delete(id)
    message.success('年份删除成功')
    await loadYears()
  } catch (error) {
    message.error('删除失败')
  }
}
</script>

<style scoped>
.settings-view { padding: 0; }
.wage-card { margin-bottom: 16px; border-radius: var(--radius-sm); }
.wage-card :deep(.ant-card-head) { min-height: 40px; padding: 0 12px; background: var(--border-light); }
.wage-card :deep(.ant-card-body) { padding: 16px; }
</style>
