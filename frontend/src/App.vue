<template>
  <a-config-provider :locale="zhCN">
    <a-layout style="min-height: 100vh" v-if="isLoggedIn">
      <a-layout-sider
        v-model:collapsed="collapsed"
        collapsible
        :width="220"
        :collapsedWidth="64"
        theme="dark"
      >
        <div class="sidebar-logo">
          <transition name="fade">
            <span v-if="!collapsed" class="logo-text">考勤管理</span>
          </transition>
        </div>
        <a-menu
          v-model:selectedKeys="selectedKeys"
          v-model:openKeys="openKeys"
          mode="inline"
          theme="dark"
          @click="handleMenuClick"
        >
          <a-menu-item key="/">
            <template #icon><DashboardOutlined /></template>
            首页概览
          </a-menu-item>
          <a-menu-item key="/workers">
            <template #icon><TeamOutlined /></template>
            工人管理
          </a-menu-item>
          <a-sub-menu key="attendance">
            <template #icon><CalendarOutlined /></template>
            <template #title>打卡管理</template>
            <a-menu-item key="/attendance/today">当日打卡</a-menu-item>
            <a-menu-item key="/attendance/history">打卡记录</a-menu-item>
            <a-menu-item key="/attendance/calendar">日历视图</a-menu-item>
          </a-sub-menu>
          <a-sub-menu key="salary">
            <template #icon><WalletOutlined /></template>
            <template #title>工资管理</template>
            <a-menu-item key="/salary/monthly">月度工资</a-menu-item>
            <a-menu-item key="/salary/yearly">年度工资</a-menu-item>
            <a-menu-item key="/salary/payments">工资发放</a-menu-item>
          </a-sub-menu>
          <a-sub-menu key="settings" v-if="isAdmin">
            <template #icon><SettingOutlined /></template>
            <template #title>系统设置</template>
            <a-menu-item key="/settings/wage">工种工资</a-menu-item>
            <a-menu-item key="/settings/backup">数据备份</a-menu-item>
            <a-menu-item key="/settings/years">年份管理</a-menu-item>
            <a-menu-item key="/settings/users">用户管理</a-menu-item>
            <a-menu-item key="/settings/roles">角色管理</a-menu-item>
          </a-sub-menu>
        </a-menu>
      </a-layout-sider>
      <a-layout>
        <header class="app-header">
          <div class="header-left">
            <h2 class="page-title">{{ pageTitle }}</h2>
            <span class="page-breadcrumb">{{ pageBreadcrumb }}</span>
          </div>
          <div class="header-right">
            <div class="user-info">
              <a-avatar :size="32" style="background: linear-gradient(135deg, #1e3a5f, #2a4a73)">
                {{ (currentUser?.realName || '用')[0] }}
              </a-avatar>
              <span class="user-name">{{ currentUser?.realName || '用户' }}</span>
            </div>
            <a-button type="text" class="logout-btn" @click="logout">
              <LogoutOutlined />
              退出
            </a-button>
          </div>
        </header>
        <a-layout-content class="app-content">
          <router-view />
        </a-layout-content>
      </a-layout>
    </a-layout>
    <router-view v-else />
  </a-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import {
  DashboardOutlined,
  TeamOutlined,
  CalendarOutlined,
  WalletOutlined,
  SettingOutlined,
  LogoutOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const isAdmin = ref(true)
const currentUser = ref<any>(null)

const isLoggedIn = computed(() => {
  try {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      if (user && (user.id || user.username)) {
        currentUser.value = user
        isAdmin.value = user.role === 'admin'
        return true
      }
    }
  } catch (e) {
    console.error('Failed to parse user from localStorage:', e)
    localStorage.removeItem('user')
  }
  return false
})

const selectedKeys = ref([route.path])
const openKeys = ref(['attendance', 'salary', 'settings'])

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': '首页概览',
    '/workers': '工人管理',
    '/attendance/today': '当日打卡',
    '/attendance/history': '打卡记录',
    '/attendance/calendar': '日历视图',
    '/salary/monthly': '月度工资',
    '/salary/yearly': '年度工资',
    '/salary/payments': '工资发放',
    '/settings/wage': '工种工资',
    '/settings/backup': '数据备份与恢复',
    '/settings/years': '年份管理',
    '/settings/users': '用户管理',
    '/settings/roles': '角色管理'
  }
  return titles[route.path] || '考勤管理系统'
})

const pageBreadcrumb = computed(() => {
  const breadcrumbs: Record<string, string> = {
    '/': '数据总览与统计分析',
    '/workers': '管理工人信息、入职与离职',
    '/attendance/today': '记录今日考勤状态',
    '/attendance/history': '查看和管理历史考勤',
    '/attendance/calendar': '按月查看个人考勤日历',
    '/salary/monthly': '月度工资计算与统计',
    '/salary/yearly': '年度工资汇总分析',
    '/salary/payments': '工资发放记录管理',
    '/settings/wage': '各工种工资标准设置',
    '/settings/backup': '导出备份并导入恢复数据库',
    '/settings/years': '管理农历年份及日期范围',
    '/settings/users': '管理系统用户账号',
    '/settings/roles': '管理角色与菜单权限'
  }
  return breadcrumbs[route.path] || ''
})

watch(() => route.path, (newPath) => {
  selectedKeys.value = [newPath]
}, { immediate: true })

function handleMenuClick({ key }: { key: string }) {
  router.push(key)
}

function logout() {
  localStorage.removeItem('user')
  currentUser.value = null
  isAdmin.value = true
  window.location.href = '/login'
}
</script>

<style scoped>
.sidebar-logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-text {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.app-header {
  height: 64px;
  background: #fff;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light);
  box-shadow: var(--shadow-xs);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.page-breadcrumb {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.3;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--text-secondary);
}

.logout-btn {
  color: var(--text-muted) !important;
  font-size: 13px !important;
  border-radius: var(--radius-sm) !important;
}

.logout-btn:hover {
  color: var(--danger) !important;
  background: var(--danger-bg) !important;
}

.app-content {
  margin: 20px;
  padding: 24px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  min-height: calc(100vh - 104px);
  box-shadow: var(--shadow-sm);
}
</style>
