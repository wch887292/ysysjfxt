import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import registerIcons from './plugins/icons'
import './styles/main.css'

const app = createApp(App)

// 按需全局注册图标（清单见 plugins/icons.js，新增图标需在那里登记）
registerIcons(app)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')
