import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'ant-design-vue/dist/reset.css'
import './assets/main.css'

dayjs.locale('zh-cn')

window.addEventListener('error', (event) => {
	window.electronAPI?.log?.({
		level: 'error',
		message: 'Renderer window error',
		meta: {
			message: event.message,
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno
		}
	})
})

window.addEventListener('unhandledrejection', (event) => {
	window.electronAPI?.log?.({
		level: 'error',
		message: 'Renderer unhandled rejection',
		meta: {
			reason: event.reason instanceof Error
				? { message: event.reason.message, stack: event.reason.stack }
				: event.reason
		}
	})
})

const app = createApp(App)
app.config.errorHandler = (error, instance, info) => {
	window.electronAPI?.log?.({
		level: 'error',
		message: 'Vue application error',
		meta: {
			info,
			component: instance?.type ? String(instance.type) : 'unknown',
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined
		}
	})
}

app.use(createPinia())
app.use(router)
app.use(Antd)
app.mount('#app')