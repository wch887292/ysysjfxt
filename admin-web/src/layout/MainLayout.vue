<template>
  <el-container class="main-layout">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '220px'" class="sidebar">
      <div class="logo">
        <img src="/favicon.svg" alt="logo" class="logo-img" v-if="!isCollapse" />
        <span v-if="!isCollapse" class="logo-text">元生AI健康管理</span>
        <img src="/favicon.svg" alt="logo" class="logo-img-mini" v-else />
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :unique-opened="true"
        router
        class="sidebar-menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <template v-for="route in menuRoutes" :key="route.fullPath">
          <!-- 分隔线标记 -->
          <div v-if="route.meta.isDivider" class="menu-divider">
            <span v-if="!isCollapse">{{ route.meta.title }}</span>
          </div>
          <!-- 跨角色菜单项（用不同颜色标识） -->
          <el-menu-item v-else :index="route.fullPath" :class="{ 'cross-role-item': isCrossRole(route.fullPath) }">
            <el-icon><component :is="route.meta.icon" /></el-icon>
            <template #title>{{ route.meta.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 顶栏 -->
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="isCollapse = !isCollapse">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentRoleLabel }}</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" :src="userStore.avatarUrl">
                {{ userStore.nickName.charAt(0) }}
              </el-avatar>
              <span class="user-name">{{ userStore.nickName }}</span>
              <el-tag size="small" :type="userStore.isSuper ? 'danger' : 'primary'" effect="plain">{{ userStore.roleLabel }}</el-tag>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人设置
                </el-dropdown-item>
                <el-dropdown-item command="changePassword">
                  <el-icon><Lock /></el-icon>修改密码
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <!-- 修改密码对话框 -->
    <ChangePasswordDialog v-model:visible="changePwdVisible" />
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useUserStore, ROLE_LABEL_MAP } from '@/store/user'
import ChangePasswordDialog from '@/components/ChangePasswordDialog.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isCollapse = ref(false)
const changePwdVisible = ref(false)

// 当前角色前缀对应的菜单路由
const rolePrefix = computed(() => {
  const path = route.path
  if (path.startsWith('/admin')) return '/admin'
  if (path.startsWith('/agent')) return '/agent'
  if (path.startsWith('/service-provider')) return '/service-provider'
  return '/admin'
})

// 当前角色可访问的菜单项
const menuRoutes = computed(() => {
  const prefix = rolePrefix.value
  // 从 router 的 children 中筛选当前角色前缀且非隐藏的菜单
  const allRoutes = router.getRoutes()
  let routes = allRoutes
    .filter(r => {
      if (!r.path.startsWith(prefix + '/') || !r.meta || !r.meta.title || r.meta.hidden) return false
      // 系统设置仅超级管理员可见
      if (r.name === 'AdminSystemSettings' && !userStore.isSuper) return false
      // 授权管理仅超级管理员可见
      if (r.name === 'AdminLicense' && !userStore.isSuper) return false
      return true
    })
    .map(r => ({
      fullPath: r.path,
      meta: r.meta
    }))

  // 超级管理员在管理台侧边栏显示代理商和服务商入口
  if (prefix === '/admin' && userStore.isSuper) {
    // 添加分隔标记 + 代理商管理子菜单
    routes.push({ fullPath: '_divider_agent', meta: { title: '── 代理商管理 ──', icon: 'Minus', isDivider: true } })
    const agentRoutes = allRoutes
      .filter(r => r.path.startsWith('/agent/') && r.meta?.title && !r.meta.hidden)
      .map(r => ({ fullPath: r.path, meta: r.meta }))
    routes.push(...agentRoutes)

    // 添加分隔标记 + 服务商管理子菜单
    routes.push({ fullPath: '_divider_sp', meta: { title: '── 服务商管理 ──', icon: 'Minus', isDivider: true } })
    const spRoutes = allRoutes
      .filter(r => r.path.startsWith('/service-provider/') && r.meta?.title && !r.meta.hidden)
      .map(r => ({ fullPath: r.path, meta: r.meta }))
    routes.push(...spRoutes)
  }

  // 代理商端：增加服务商入口（权限规则：代理商可查看服务商的数据）
  if (prefix === '/agent' && userStore.role === 'agent') {
    routes.push({ fullPath: '_divider_sp', meta: { title: '── 服务商管理 ──', icon: 'Minus', isDivider: true } })
    const spRoutes = allRoutes
      .filter(r => r.path.startsWith('/service-provider/') && r.meta?.title && !r.meta.hidden)
      .map(r => ({ fullPath: r.path, meta: r.meta }))
    routes.push(...spRoutes)
  }

  return routes
})

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => route.meta?.title || '')
const currentRoleLabel = computed(() => ROLE_LABEL_MAP[userStore.role] || '')

// 判断是否为跨角色菜单项（超级管理员视角下的 agent/SP 路由，或代理商视角下的 SP 路由）
function isCrossRole(path) {
  const prefix = rolePrefix.value
  if (prefix === '/admin') {
    return path.startsWith('/agent/') || path.startsWith('/service-provider/')
  }
  if (prefix === '/agent') {
    return path.startsWith('/service-provider/')
  }
  return false
}

async function handleCommand(command) {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await userStore.logout()
      ElMessage.success('已退出登录')
      router.push('/login')
    } catch { /* 取消 */ }
  } else if (command === 'changePassword') {
    changePwdVisible.value = true
  } else if (command === 'profile') {
    router.push(`${rolePrefix.value}/profile`)
  }
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  background-color: #2b3a4d;
}

.logo-img {
  width: 32px;
  height: 32px;
}

.logo-img-mini {
  width: 32px;
  height: 32px;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.sidebar-menu {
  border-right: none;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 220px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  padding: 0 20px;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #5a5e66;
}

.collapse-btn:hover {
  color: #409eff;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
}

.user-name {
  font-size: 14px;
  color: #303133;
}

.main-content {
  background-color: #f5f7fa;
  padding: 16px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.menu-divider {
  padding: 10px 20px 4px;
  color: #7a8b9a;
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  user-select: none;
  border-top: 1px solid #3d4f63;
  margin-top: 6px;
}

.cross-role-item {
  opacity: 0.85;
}
</style>
