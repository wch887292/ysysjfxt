// pages/user/profile/profile.js
const { authAPI, userAPI } = require('../../../utils/api');

// 规范3.2 荣誉等级映射（后端 honor_level enum → 中文展示名）
const HONOR_LEVEL_NAMES = {
  newcomer: '健康新人',
  expert: '健康达人',
  star: '健康之星',
  ambassador: '健康大使',
  messenger: '健康使者'
};

// 规范3.1 身份类型映射
const IDENTITY_NAMES = {
  guest: '游客',
  user: '用户',
  member: '会员',
  service_provider: '服务商',
  agent: '代理商'
};

// 规范3.2 荣誉等级对应Lv.
const HONOR_LEVEL_LV = {
  newcomer: 1,
  expert: 2,
  star: 3,
  ambassador: 4,
  messenger: 5
};

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

Page({
  data: {
    userInfo: {},
    points: 0,
    // 规范3.2 荣誉等级展示（替代原"健康达人 Lv.X"用积分硬算的错误逻辑）
    honorLevelName: '健康新人',
    honorLevelLv: 1,
    badges: [],
    // 规范3.1 会员身份展示
    isMember: false,
    identityName: '用户',
    memberSinceText: '',
    // 规范3.6 分享码归属展示
    boundShareCode: '',
    // 管理后台入口：根据 role 动态显示
    isAdmin: false,
    isAgent: false,
    isServiceProvider: false,
    // 管理员登录弹窗
    showLoginModal: false,
    adminAccount: '',
    adminPassword: '',
    menuItems: [
      { icon: '📊', title: '数据统计', url: '/pages/user/statistics/statistics' },
      { icon: '📋', title: '健康问卷', url: '/pages/user/questionnaire/questionnaire' },
      { icon: '🏆', title: '我的荣誉', url: '/pages/user/points/points' },
      { icon: '⚙️', title: '设置', url: '/pages/user/settings/settings' },
      { icon: '📞', title: '联系客服', url: '/pages/user/support/support' },
      { icon: '📄', title: '隐私政策', url: '/pages/user/privacy/privacy' },
      { icon: 'ℹ️', title: '关于我们', url: '/pages/user/about/about' }
    ]
  },

  onLoad() {
    this._alive = true;
    const app = getApp();
    app.onLoginReady(() => {
      if (!this._alive) return;
      this.loadUserInfo();
      this.loadPoints();
    });
  },

  onShow() {
    if (!this._alive) return;
    const app = getApp();
    if (app.globalData.loginReady === 'ready') {
      this.loadUserInfo();
      this.loadPoints();
    }
  },

  onUnload() {
    this._alive = false;
  },

  // 规范3.1/3.2/3.6：从 /auth/validate 获取完整用户信息（含荣誉/身份/分享码）
  async loadUserInfo() {
    if (!this._alive) return;
    try {
      const res = await authAPI.validate();
      if (!this._alive) return;
      const data = res.data || {};
      const honorLevel = data.honorLevel || 'newcomer';
      const userInfo = {
        id: data.id,
        nickName: data.nickName || data.nick_name || '健康新人',
        avatarUrl: data.avatarUrl || data.avatar_url || '',
        points: data.points || 0
      };
      this.setData({
        userInfo,
        honorLevelName: HONOR_LEVEL_NAMES[honorLevel] || '健康新人',
        honorLevelLv: HONOR_LEVEL_LV[honorLevel] || 1,
        badges: data.badges || [],
        isMember: !!data.isMember,
        identityName: IDENTITY_NAMES[data.identityType] || '用户',
        memberSinceText: data.isMember && data.memberSince ? `会员开通于 ${formatDate(data.memberSince)}` : '',
        boundShareCode: data.boundShareCode || '',
        // 管理后台入口：根据 role 判断（data.role 来自 /auth/validate）
        isAdmin: data.role === 'admin',
        isAgent: data.role === 'agent',
        isServiceProvider: data.role === 'service_provider',
        isSuperAdmin: !!data.isSuper
      });
      // 同步全局 userInfo（其他页面可能依赖）
      const app = getApp();
      app.globalData.userInfo = { ...userInfo, is_member: data.isMember, honor_level: honorLevel };
    } catch (err) {
      // 降级：使用本地缓存
      const app = getApp();
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
      const honorLevel = userInfo.honor_level || 'newcomer';
      this.setData({
        userInfo,
        honorLevelName: HONOR_LEVEL_NAMES[honorLevel] || '健康新人',
        honorLevelLv: HONOR_LEVEL_LV[honorLevel] || 1,
        badges: userInfo.badges || [],
        isMember: !!userInfo.is_member
      });
    }
  },

  async loadPoints() {
    if (!this._alive) return;
    try {
      const res = await userAPI.getPoints();
      if (!this._alive) return;
      this.setData({ points: (res.data && res.data.points) || 0 });
    } catch (err) {
      // request.js 已弹错误提示
    }
  },

  navigateTo(e) {
    const url = e.currentTarget.dataset.url;
    // tabBar 页面不能用 wx.navigateTo 跳转，需用 wx.switchTab
    const tabBarPages = [
      'pages/user/home/home',
      'pages/user/upload/upload',
      'pages/user/points/points',
      'pages/user/profile/profile'
    ];
    const isTabBar = tabBarPages.some(p => url.indexOf(p) >= 0);
    if (isTabBar) {
      wx.switchTab({
        url,
        fail: () => {
          wx.showToast({ title: '页面跳转失败', icon: 'none' });
        }
      });
    } else {
      wx.navigateTo({
        url,
        fail: () => {
          wx.showToast({ title: '页面跳转失败', icon: 'none' });
        }
      });
    }
  },

  navigateToReferral() {
    wx.navigateTo({
      url: '/pages/user/referral/referral',
      fail: () => {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 管理后台入口导航
  navigateToAdmin() {
    wx.navigateTo({
      url: '/pages/admin/dashboard/dashboard',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToAgentHome() {
    wx.navigateTo({
      url: '/pages/agent/home/home',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  navigateToServiceProviderHome() {
    wx.navigateTo({
      url: '/pages/service-provider/home/home',
      fail: () => wx.showToast({ title: '页面跳转失败', icon: 'none' })
    });
  },

  // 阻止事件冒泡（弹窗内容区使用）
  preventTap() {},

  // 点击遮罩层关闭弹窗（仅点击遮罩本身才关闭）
  onMaskTap(e) {
    if (e.target === e.currentTarget) {
      this.hideAdminLogin();
    }
  },

  // 管理员登录弹窗
  showAdminLogin() {
    console.log('[profile] showAdminLogin called');
    try {
      this.setData({ showLoginModal: true, adminAccount: '', adminPassword: '' });
      console.log('[profile] showLoginModal set to true');
    } catch (err) {
      console.error('[profile] setData error:', err);
      wx.showToast({ title: '弹窗显示失败: ' + (err.message || '未知错误'), icon: 'none' });
    }
  },

  hideAdminLogin() {
    this.setData({ showLoginModal: false, adminAccount: '', adminPassword: '' });
  },

  onAdminAccountInput(e) {
    this.setData({ adminAccount: e.detail.value });
  },

  onAdminPasswordInput(e) {
    this.setData({ adminPassword: e.detail.value });
  },

  // 管理员账号密码登录
  async doAdminLogin() {
    const { adminAccount, adminPassword } = this.data;
    console.log('[profile] doAdminLogin called, account:', adminAccount);
    if (!adminAccount || !adminAccount.trim()) {
      return wx.showToast({ title: '请输入账号', icon: 'none' });
    }
    if (!adminPassword) {
      return wx.showToast({ title: '请输入密码', icon: 'none' });
    }
    try {
      wx.showLoading({ title: '登录中...' });
      const res = await authAPI.webLogin(adminAccount.trim(), adminPassword);
      wx.hideLoading();
      // res = { success: true, data: { token, userInfo }, message: '登录成功' }
      if (res && res.data) {
        const { token, userInfo } = res.data;
        console.log('[profile] admin login success, role:', userInfo.role);
        // 更新本地存储的 token 和用户信息
        wx.setStorageSync('token', token);
        wx.setStorageSync('userInfo', userInfo);
        // 更新全局状态
        const app = getApp();
        app.globalData.userInfo = userInfo;
        app.globalData.userRole = userInfo.role;
        // 更新页面显示
        this.setData({
          showLoginModal: false,
          adminAccount: '',
          adminPassword: '',
          isAdmin: userInfo.role === 'admin',
          isAgent: userInfo.role === 'agent',
          isServiceProvider: userInfo.role === 'service_provider',
          isSuperAdmin: !!userInfo.isSuper,
          identityName: IDENTITY_NAMES[userInfo.identityType] || IDENTITY_NAMES[userInfo.role] || '管理员',
          userInfo: {
            id: userInfo.id,
            nickName: userInfo.nickName || '管理员',
            avatarUrl: userInfo.avatarUrl || '',
            points: userInfo.points || 0
          },
          honorLevelName: HONOR_LEVEL_NAMES[userInfo.honorLevel] || '健康新人',
          honorLevelLv: HONOR_LEVEL_LV[userInfo.honorLevel] || 1
        });
        wx.showToast({ title: '登录成功', icon: 'success' });
      } else {
        console.warn('[profile] admin login response missing data:', res);
        wx.showToast({ title: '登录响应异常', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      // err 是后端返回的 { success: false, message: '...', data: null }
      const msg = (err && err.message) || '登录失败，请检查账号密码';
      console.warn('[profile] admin login failed:', msg);
      wx.showToast({ title: msg, icon: 'none' });
    }
  },

  onShareAppMessage() {
    const userInfo = this.data.userInfo || wx.getStorageSync('userInfo') || {};
    const path = userInfo.id
      ? '/pages/user/home/home?referrerId=' + userInfo.id
      : '/pages/user/home/home';
    return {
      title: '健康饮食积分 - 记录每一餐，积累健康财富',
      path
    };
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗?',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.clearStorageSync();
          // 重置全局登录状态
          const app = getApp();
          app.globalData.userInfo = null;
          // P0修复：移除openid残留，隐私保护设计不再在客户端存储openid
          app.globalData.userRole = 'user';
          app.globalData.loginReady = 'pending';
          app.globalData._loginCallbacks = [];
          app.globalData._loginInProgress = false;
          // 跳转到首页并重新触发登录
          wx.reLaunch({
            url: '/pages/user/home/home'
          });
        }
      }
    });
  }
});