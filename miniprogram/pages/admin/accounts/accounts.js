// pages/admin/accounts/accounts.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    accounts: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showCreateModal: false,
    showRoleModal: false,
    showStatusModal: false,
    showResetPwdModal: false,
    newAccount: { nick_name: '', role: 'agent', phone: '', password: '' },
    editTarget: null,
    selectedRole: '',
    selectedStatus: '',
    resetPwdId: '',
    resetPwdNewPwd: ''
  },

  onLoad() {
    // P0修复：客户端角色验证
    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role;
    if (role !== 'admin') {
      wx.showModal({
        title: '无权限',
        content: '仅管理员可访问此页面',
        showCancel: false,
        success: () => { wx.switchTab({ url: '/pages/user/home/home' }); }
      });
      return;
    }
    app.onLoginReady((err) => {
      if (err) return;
      this.loadAccounts();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshAccounts();
    }
  },

  onPullDownRefresh() {
    this.refreshAccounts();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadAccounts();
    }
  },

  refreshAccounts() {
    this.setData({ accounts: [], page: 1, hasMore: true });
    this.loadAccounts();
  },

  async loadAccounts() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getAccounts({ page: this.data.page, pageSize: this.data.pageSize });
      const list = (res.data && res.data.accounts) || [];
      this.setData({
        accounts: this.data.accounts.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 创建账号
  onShowCreate() {
    this.setData({ showCreateModal: true, newAccount: { nick_name: '', role: 'agent', phone: '', password: '' } });
  },

  onCreateInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`newAccount.${field}`]: e.detail.value });
  },

  onCreateRoleChange(e) {
    this.setData({ 'newAccount.role': e.detail.value });
  },

  async onCreateAccount() {
    const { nick_name, role, phone, password } = this.data.newAccount;
    if (!nick_name || !phone || !password) {
      wx.showToast({ title: '请填写昵称、手机号和密码', icon: 'none' });
      return;
    }
    try {
      await adminAPI.createAccount({ nickName: nick_name, role, phone, password });
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.setData({ showCreateModal: false });
      this.refreshAccounts();
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  onCancelCreate() {
    this.setData({ showCreateModal: false });
  },

  // 修改角色
  onEditRole(e) {
    const id = e.currentTarget.dataset.id;
    const currentRole = e.currentTarget.dataset.role;
    this.setData({ showRoleModal: true, editTarget: id, selectedRole: currentRole });
  },

  onRoleChange(e) {
    this.setData({ selectedRole: e.detail.value });
  },

  async onConfirmRole() {
    // P0修复：角色变更为重要操作，需二次确认（与后端 confirm:true 要求一致）
    wx.showModal({
      title: '确认修改',
      content: `确定将此账号角色修改为 ${this.data.selectedRole} 吗？此操作不可撤销。`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await adminAPI.updateAccountRole(this.data.editTarget, {
            role: this.data.selectedRole,
            confirm: true  // P0修复：后端要求 confirm=true
          });
          wx.showToast({ title: '修改成功', icon: 'success' });
          this.setData({ showRoleModal: false });
          this.refreshAccounts();
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '修改失败', icon: 'none' });
        }
      }
    });
  },

  onCancelRole() {
    this.setData({ showRoleModal: false });
  },

  // 修改状态
  onEditStatus(e) {
    const id = e.currentTarget.dataset.id;
    const currentStatus = e.currentTarget.dataset.status;
    this.setData({ showStatusModal: true, editTarget: id, selectedStatus: currentStatus });
  },

  onStatusChange(e) {
    this.setData({ selectedStatus: e.detail.value });
  },

  async onConfirmStatus() {
    // P0修复：账号启停为重要操作，需二次确认
    const actionText = this.data.selectedStatus === 'banned' ? '封禁' : '启用';
    wx.showModal({
      title: '确认操作',
      content: `确定${actionText}此账号吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await adminAPI.updateAccountStatus(this.data.editTarget, { status: this.data.selectedStatus });
          wx.showToast({ title: '修改成功', icon: 'success' });
          this.setData({ showStatusModal: false });
          this.refreshAccounts();
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '修改失败', icon: 'none' });
        }
      }
    });
  },

  onCancelStatus() {
    this.setData({ showStatusModal: false });
  },

  // 重置密码
  onResetPassword(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showResetPwdModal: true, resetPwdId: id, resetPwdNewPwd: '' });
  },

  onResetPwdInput(e) {
    this.setData({ resetPwdNewPwd: e.detail.value });
  },

  async onConfirmResetPwd() {
    if (!this.data.resetPwdNewPwd) {
      wx.showToast({ title: '请输入新密码', icon: 'none' });
      return;
    }
    // P0修复：密码重置为重要操作，需二次确认
    wx.showModal({
      title: '确认重置密码',
      content: '确定重置此账号的密码吗？此操作不可撤销。',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await adminAPI.resetPassword(this.data.resetPwdId, {
            newPassword: this.data.resetPwdNewPwd,
            confirm: true
          });
          wx.showToast({ title: '重置成功', icon: 'success' });
          this.setData({ showResetPwdModal: false });
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '重置失败', icon: 'none' });
        }
      }
    });
  },

  onCancelResetPwd() {
    this.setData({ showResetPwdModal: false });
  },

  formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
});
