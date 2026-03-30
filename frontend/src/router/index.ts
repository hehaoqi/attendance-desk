import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/workers',
    name: 'Workers',
    component: () => import('@/views/WorkersView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/attendance',
    name: 'Attendance',
    component: () => import('@/views/AttendanceView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/attendance/today',
    name: 'AttendanceToday',
    component: () => import('@/views/AttendanceView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/attendance/history',
    name: 'AttendanceHistory',
    component: () => import('@/views/AttendanceView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/attendance/calendar',
    name: 'AttendanceCalendar',
    component: () => import('@/views/AttendanceCalendarView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/salary',
    name: 'Salary',
    component: () => import('@/views/SalaryView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/salary/monthly',
    name: 'SalaryMonthly',
    component: () => import('@/views/SalaryView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/salary/yearly',
    name: 'SalaryYearly',
    component: () => import('@/views/SalaryView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/salary/payments',
    name: 'SalaryPayments',
    component: () => import('@/views/Salary/Salary-payment/SalaryPaymentView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    redirect: '/settings/wage'
  },
  {
    path: '/settings/wage',
    name: 'SettingsWage',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/backup',
    name: 'SettingsBackup',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/users',
    name: 'SettingsUsers',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/roles',
    name: 'SettingsRoles',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/years',
    name: 'SettingsYears',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStr = localStorage.getItem('user')
  let user = null
  
  try {
    user = userStr ? JSON.parse(userStr) : null
  } catch (e) {
    localStorage.removeItem('user')
    next('/login')
    return
  }
  
  // 验证用户对象完整性 - 更灵活的检查，只要有标识字段即可
  if (user && !user.id && !user.username) {
    localStorage.removeItem('user')
    user = null
  }
  
  if (to.meta.requiresAuth && !user) {
    next('/login')
  } else if (to.meta.requiresAdmin && (!user || user.role !== 'admin')) {
    next('/')  // 非管理员访问管理页面，重定向首页
  } else if (to.path === '/login' && user) {
    next('/')
  } else {
    next()
  }
})

export default router