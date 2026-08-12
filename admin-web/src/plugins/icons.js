/**
 * Element Plus 图标按需全局注册
 *
 * 背景：原先在 main.js 里 `import * as ElementPlusIconsVue` 全量注册 293 个图标，
 * 打包体积约 170 KB（gzip 44 KB），而项目实际只用到 37 个。
 *
 * 为什么仍需"全局注册"而不是各页面局部 import：
 * 侧边栏菜单与仪表盘快捷入口使用 `<component :is="route.meta.icon" />` 这种
 * **字符串动态组件**写法，Vue 只能从全局组件表里解析，局部 import 无法命中。
 *
 * 维护约定（重要）：
 * 新页面若使用了新的图标（无论是模板里的 <el-icon><Xxx /></el-icon>，
 * 还是路由 meta.icon / 数据里的图标字符串），必须在下面 icons 对象中补充导入，
 * 否则运行时该图标位置会空白并在控制台报 "Failed to resolve component"。
 *
 * 可用 `node scripts/scan-icons.mjs` 重新扫描源码，自动比对当前实际使用的图标清单。
 */
import {
  ArrowDown,
  Back,
  Bell,
  ChatDotRound,
  Check,
  Coin,
  CopyDocument,
  CreditCard,
  Document,
  Edit,
  EditPen,
  ElementPlus,
  Expand,
  Fold,
  Key,
  Link,
  Loading,
  Lock,
  Minus,
  Money,
  Odometer,
  OfficeBuilding,
  Picture,
  Plus,
  Present,
  Reading,
  Refresh,
  Search,
  Setting,
  ShoppingCart,
  Suitcase,
  SwitchButton,
  Tickets,
  Tools,
  User,
  UserFilled,
  Warning
} from '@element-plus/icons-vue'

const icons = {
  ArrowDown,
  Back,
  Bell,
  ChatDotRound,
  Check,
  Coin,
  CopyDocument,
  CreditCard,
  Document,
  Edit,
  EditPen,
  ElementPlus,
  Expand,
  Fold,
  Key,
  Link,
  Loading,
  Lock,
  Minus,
  Money,
  Odometer,
  OfficeBuilding,
  Picture,
  Plus,
  Present,
  Reading,
  Refresh,
  Search,
  Setting,
  ShoppingCart,
  Suitcase,
  SwitchButton,
  Tickets,
  Tools,
  User,
  UserFilled,
  Warning
}

export default function registerIcons(app) {
  for (const [name, component] of Object.entries(icons)) {
    app.component(name, component)
  }
}

export const registeredIconNames = Object.keys(icons)
