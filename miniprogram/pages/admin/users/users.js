// pages/admin/users/users.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    users: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    searchKeyword: '',
    showDetailModal: false,
    showStatusModal: false,
    showRoleModal: false,
    currentUser: null,
    selectedStatus: '',
    selectedRole: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadUsers();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshUsers();
    }
  },

  onPullDownRefresh() {
    this.refreshUsers();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadUsers();
    }
  },

  refreshUsers() {
    this.setData({ users: [], page: 1, hasMore: true });
    this.loadUsers();
  },

  async loadUsers() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getUsers({ page: this.data.page, pageSize: this.data.pageSize, keyword: this.data.searchKeyword });
      const list = (res.data && res.data.users) || [];
      this.setData({
        users: this.data.users.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch() {
    this.refreshUsers();
  },

  // 查看详情
  async onViewDetail(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const res = await adminAPI.getUserDetail(id);
      this.setData({ showDetailModal: true, currentUser: res.data });
    } catch (err) {
      wx.showToast({ title: '获取详情失败', icon: 'none' });
    }
  },

  onCloseDetail() {
    this.setData({ showDetailModal: false, currentUser: null });
  },

  // 修改状态
  onEditStatus(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    this.setData({ showStatusModal: true, editTarget: id, selectedStatus: status });
  },

  onStatusChange(e) {
    this.setData({ selectedStatus: e.detail.value });
  },

  async onConfirmStatus() {
    try {
      await adminAPI.updateUserStatus(this.data.editTarget, { status: this.data.selectedStatus });
      wx.showToast({ title: '修改成功', icon: 'success' });
      this.setData({ showStatusModal: false });
      this.refreshUsers();
    } catch (err) {
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  onCancelStatus() {
    this.setData({ showStatusModal: false });
  },

  // 修改角色
  onEditRole(e) {
    const id = e.currentTarget.dataset.id;
    const role = e.currentTarget.dataset.role;
    this.setData({ showRoleModal: true, editTarget: id, selectedRole: role });
  },

  onRoleChange(e) {
    this.setData({ selectedRole: e.detail.value });
  },

  async onConfirmRole() {
    try {
      await adminAPI.updateUserRole(this.data.editTarget, { role: this.data.selectedRole });
      wx.showToast({ title: '修改成功', icon: 'success' });
      this.setData({ showRoleModal: false });
      this.refreshUsers();
    } catch (err) {
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  onCancelRole() {
    this.setData({ showRoleModal: false });
  }
});
