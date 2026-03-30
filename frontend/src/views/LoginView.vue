<template>
  <div class="login-page">
    <div class="login-left">
      <div class="brand-section">
        <img src="/logo.png" alt="Logo" class="brand-logo" />
        <h1 class="brand-title">工人考勤管理系统</h1>
        <p class="brand-desc">高效管理工人考勤、工资计算与发放</p>
      </div>
      <div class="feature-list">
        <div class="feature-item">
          <CheckCircleOutlined class="feature-icon" />
          <span>快速打卡，一键记录考勤</span>
        </div>
        <div class="feature-item">
          <BarChartOutlined class="feature-icon" />
          <span>自动计算工资，精准不出错</span>
        </div>
        <div class="feature-item">
          <SafetyOutlined class="feature-icon" />
          <span>数据安全存储，随时可查</span>
        </div>
      </div>
    </div>
    <div class="login-right">
      <div class="login-form-wrapper">
        <h2 class="form-title">欢迎登录</h2>
        <p class="form-subtitle">请输入账号和密码</p>
        <a-form
          :model="formState"
          @finish="handleLogin"
          layout="vertical"
          autocomplete="off"
          class="login-form"
        >
          <a-form-item
            name="username"
            :rules="[{ required: true, message: '请输入用户名' }]"
          >
            <a-input
              v-model:value="formState.username"
              placeholder="用户名"
              size="large"
              class="login-input"
            >
              <template #prefix>
                <UserOutlined style="color: #94a3b8" />
              </template>
            </a-input>
          </a-form-item>

          <a-form-item
            name="password"
            :rules="[{ required: true, message: '请输入密码' }]"
          >
            <a-input-password
              v-model:value="formState.password"
              placeholder="密码"
              size="large"
              class="login-input"
            >
              <template #prefix>
                <LockOutlined style="color: #94a3b8" />
              </template>
            </a-input-password>
          </a-form-item>

          <a-form-item>
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              block
              :loading="loading"
              class="login-btn"
            >
              登 录
            </a-button>
          </a-form-item>
        </a-form>
        <p class="login-hint">默认账号: admin / admin123</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  UserOutlined,
  LockOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  SafetyOutlined
} from '@ant-design/icons-vue'
import { authApi } from '@/api'

const router = useRouter()
const loading = ref(false)

const formState = reactive({
  username: '',
  password: ''
})

async function handleLogin() {
  loading.value = true
  try {
    const res = await authApi.login(formState.username, formState.password)
    if (res.data.success) {
      localStorage.setItem('user', JSON.stringify(res.data.user))
      message.success('登录成功')
      window.location.href = '/'
    } else {
      message.error(res.data.message || '登录失败')
    }
  } catch (error: any) {
    message.error(error.response?.data?.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
}

.login-left {
  flex: 1;
  background: linear-gradient(160deg, #0f1e33 0%, #1e3a5f 50%, #2a4a73 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60px;
  position: relative;
  overflow: hidden;
}

.login-left::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -30%;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(255, 107, 53, 0.12) 0%, transparent 70%);
  border-radius: 50%;
}

.login-left::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -20%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
  border-radius: 50%;
}

.brand-section {
  position: relative;
  z-index: 1;
  margin-bottom: 48px;
}

.brand-logo {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  margin-bottom: 24px;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
}

.brand-title {
  font-size: 32px;
  font-weight: 800;
  color: white;
  margin-bottom: 12px;
  letter-spacing: -0.5px;
}

.brand-desc {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.6;
}

.feature-list {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;
}

.feature-icon {
  font-size: 18px;
  color: #ff6b35;
}

.login-right {
  width: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #fff;
}

.login-form-wrapper {
  width: 100%;
  max-width: 360px;
}

.form-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.form-subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 36px;
}

.login-form .login-input {
  height: 48px;
  border-radius: 10px !important;
  font-size: 15px;
}

.login-form .login-input :deep(.ant-input) {
  font-size: 15px;
}

.login-btn {
  height: 48px !important;
  border-radius: 10px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  letter-spacing: 4px;
}

.login-hint {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 20px;
}

@media (max-width: 900px) {
  .login-left { display: none; }
  .login-right { width: 100%; }
}
</style>
