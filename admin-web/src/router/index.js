// 路由配置 + 守卫
import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore, ROLE_HOME_MAP } from '@/store/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Login.vue'),
    meta: { public: true, title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/redirect',
    children: [
      // 重定向到角色首页
      { path: 'redirect', name: 'Redirect', component: () => import('@/views/Redirect.vue') }
    ]
  },
  // ===== 管理台路由 =====
  {
    path: '/admin',
    component: () => import('@/layout/MainLayout.vue'),
    meta: { roles: ['admin'] },
    children: [
      { path: 'dashboard', name: 'AdminDashboard', component: () => import('@/views/admin/Dashboard.vue'), meta: { title: '仪表盘', icon: 'Odometer' } },
      { path: 'accounts', name: 'AdminAccounts', component: () => import('@/views/admin/Accounts.vue'), meta: { title: '账号管理', icon: 'UserFilled' } },
      { path: 'users', name: 'AdminUsers', component: () => import('@/views/admin/Users.vue'), meta: { title: '用户管理', icon: 'User' } },
      { path: 'config', name: 'AdminConfig', component: () => import('@/views/admin/Config.vue'), meta: { title: '系统配置', icon: 'Setting' } },
      { path: 'forbidden-words', name: 'AdminForbiddenWords', component: () => import('@/views/admin/ForbiddenWords.vue'), meta: { title: '违禁词库', icon: 'Warning' } },
      { path: 'reports', name: 'AdminReports', component: () => import('@/views/admin/Reports.vue'), meta: { title: '报告复核', icon: 'Document' } },
      { path: 'prompts', name: 'AdminPrompts', component: () => import('@/views/admin/Prompts.vue'), meta: { title: 'Prompt管理', icon: 'ChatDotRound' } },
      { path: 'posts', name: 'AdminPosts', component: () => import('@/views/admin/Posts.vue'), meta: { title: '发布审核', icon: 'Picture' } },
      { path: 'articles', name: 'AdminArticles', component: () => import('@/views/admin/Articles.vue'), meta: { title: '资讯管理', icon: 'Reading' } },
      { path: 'gifts', name: 'AdminGifts', component: () => import('@/views/admin/Gifts.vue'), meta: { title: '礼品管理', icon: 'Present' } },
      { path: 'orders', name: 'AdminOrders', component: () => import('@/views/admin/Orders.vue'), meta: { title: '订单管理', icon: 'ShoppingCart' } },
      { path: 'commissions', name: 'AdminCommissions', component: () => import('@/views/admin/Commissions.vue'), meta: { title: '分润管理', icon: 'Money' } },
      { path: 'points', name: 'AdminPoints', component: () => import('@/views/admin/Points.vue'), meta: { title: '积分管理', icon: 'Coin' } },
      { path: 'system-settings', name: 'AdminSystemSettings', component: () => import('@/views/admin/SystemSettings.vue'), meta: { title: '系统设置', icon: 'Tools', superAdminOnly: true } },
      { path: 'license', name: 'AdminLicense', component: () => import('@/views/admin/License.vue'), meta: { title: '授权管理', icon: 'Key', superAdminOnly: true } },
      { path: 'profile', name: 'AdminProfile', component: () => import('@/views/common/Profile.vue'), meta: { title: '个人设置', icon: 'User', hidden: true } }
    ]
  },
  // ===== 代理端路由（仅 agent 角色可访问，超级管理员通过守卫自动放行） =====
  // 权限规则：用户管理、报告审核/编辑/下载、积分核销、数据统计、分润查询、店面信息发布
  {
    path: '/agent',
    component: () => import('@/layout/MainLayout.vue'),
    meta: { roles: ['agent'] },
    children: [
      { path: 'dashboard', name: 'AgentDashboard', component: () => import('@/views/agent/Dashboard.vue'), meta: { title: '仪表盘', icon: 'Odometer' } },
      { path: 'users', name: 'AgentUsers', component: () => import('@/views/agent/Users.vue'), meta: { title: '用户管理', icon: 'User' } },
      { path: 'reports', name: 'AgentReports', component: () => import('@/views/agent/Reports.vue'), meta: { title: '报告审核', icon: 'Document' } },
      { path: 'write-off', name: 'AgentWriteOff', component: () => import('@/views/agent/WriteOff.vue'), meta: { title: '积分核销', icon: 'CreditCard' } },
      { path: 'commissions', name: 'AgentCommissions', component: () => import('@/views/agent/Commissions.vue'), meta: { title: '分润查询', icon: 'Money' } },
      { path: 'posts', name: 'AgentPosts', component: () => import('@/views/agent/Posts.vue'), meta: { title: '店面信息发布', icon: 'Picture' } },
      { path: 'sp-setting', name: 'AgentSpSetting', component: () => import('@/views/agent/SpSetting.vue'), meta: { title: '关联服务商', icon: 'Link' } },
      { path: 'profile', name: 'AgentProfile', component: () => import('@/views/common/Profile.vue'), meta: { title: '个人设置', icon: 'User', hidden: true } }
    ]
  },
  // ===== 服务商端路由（仅 service_provider 角色可访问，超级管理员通过守卫自动放行） =====
  // 权限规则：客户查询、报告下载、线下接待记录、网点管理、活跃度监控
  {
    path: '/service-provider',
    component: () => import('@/layout/MainLayout.vue'),
    meta: { roles: ['service_provider'] },
    children: [
      { path: 'dashboard', name: 'SpDashboard', component: () => import('@/views/service-provider/Dashboard.vue'), meta: { title: '仪表盘', icon: 'Odometer' } },
      { path: 'users', name: 'SpUsers', component: () => import('@/views/service-provider/Users.vue'), meta: { title: '客户查询', icon: 'User' } },
      { path: 'clients', name: 'SpClients', component: () => import('@/views/service-provider/Clients.vue'), meta: { title: '名下客户', icon: 'UserFilled' } },
      { path: 'reports', name: 'SpReports', component: () => import('@/views/service-provider/Reports.vue'), meta: { title: '报告下载', icon: 'Document' } },
      { path: 'receptions', name: 'SpReceptions', component: () => import('@/views/service-provider/Receptions.vue'), meta: { title: '接待记录', icon: 'Tickets' } },
      { path: 'profile', name: 'SpProfile', component: () => import('@/views/service-provider/Profile.vue'), meta: { title: '网点管理', icon: 'OfficeBuilding' } },
      { path: 'inactive-users', name: 'SpInactiveUsers', component: () => import('@/views/service-provider/InactiveUsers.vue'), meta: { title: '活跃度监控', icon: 'Bell' } },
      { path: 'settings', name: 'SpSettings', component: () => import('@/views/common/Profile.vue'), meta: { title: '个人设置', icon: 'User', hidden: true } }
    ]
  },
  // ===== 错误页 =====
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { public: true, title: '无权访问' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { public: true, title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 全局前置守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  // 设置页面标题
  document.title = to.meta.title
    ? `${to.meta.title} - 元生AI健康管理后台`
    : '元生AI生态健康饮食积分系统 - 后台管理'

  // 公开页面直接放行
  if (to.meta.public) {
    // 已登录用户访问登录页，重定向到首页
    if (to.path === '/login' && userStore.isLoggedIn) {
      return next(userStore.homePath)
    }
    return next()
  }

  // 未登录跳转登录页
  if (!userStore.isLoggedIn) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // 角色权限校验：超级管理员可访问所有路由，代理商可访问服务商路由，其他角色仅限自己角色的路由
  const allowedRoles = to.meta.roles
  if (allowedRoles && !allowedRoles.includes(userStore.role) && !userStore.isSuper) {
    // 代理商可访问服务商路由（权限规则：代理商可查看服务商的数据）
    if (!(userStore.role === 'agent' && allowedRoles.includes('service_provider'))) {
      return next('/403')
    }
  }

  // 超级管理员专属页面
  if (to.meta.superAdminOnly && !userStore.isSuper) {
    return next('/403')
  }

  next()
})

export default router
