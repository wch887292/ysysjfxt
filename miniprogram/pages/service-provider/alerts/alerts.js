// pages/service-provider/alerts/alerts.js - 流失预警跟进
const { serviceProviderAPI } = require('../../../utils/api');

Page({
  data: {
    alerts: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showFollowUp: false,
    currentAlertId: '',
    followUpResult: '',
    submitting: false
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadAlerts();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshAlerts();
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, alerts: [], hasMore: true });
    this.loadAlerts(() => wx.stopPullDownRefresh());
  },

  refreshAlerts() {
    this.setData({ page: 1, alerts: [], hasMore: true });
    this.loadAlerts();
  },

  loadAlerts(cb) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    serviceProviderAPI.getAlerts({
      page: this.data.page,
      pageSize: this.data.pageSize
    }).then(res => {
      const newAlerts = ((res.data && res.data.alerts) || []).map(a => ({
        id: a.id,
        userName: (a.user && a.user.nick_name) ? a.user.nick_name : '未知用户',
        inactiveDays: a.inactive_days || 0,
        alertType: a.alert_type || '',
        alertTypeText: this.formatAlertType(a.alert_type),
        createdAt: this.formatDateTime(a.created_at)
      }));
      this.setData({
        alerts: this.data.alerts.concat(newAlerts),
        hasMore: res.data ? res.data.hasMore : false
      });
    }).catch(() => {}).finally(() => {
      this.setData({ loading: false });
      if (typeof cb === 'function') cb();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadAlerts();
    }
  },

  onFollowUpTap(e) {
    const alertId = e.currentTarget.dataset.id;
    this.setData({
      showFollowUp: true,
      currentAlertId: alertId,
      followUpResult: ''
    });
  },

  onFollowUpInput(e) {
    this.setData({ followUpResult: e.detail.value });
  },

  cancelFollowUp() {
    this.setData({
      showFollowUp: false,
      currentAlertId: '',
      followUpResult: ''
    });
  },

  submitFollowUp() {
    if (this.data.submitting) return;

    const { followUpResult, currentAlertId } = this.data;
    if (!followUpResult || !followUpResult.trim()) {
      wx.showToast({ title: '请输入跟进结果', icon: 'none' });
      return;
    }

    // 适老化：重要操作二次确认
    wx.showModal({
      title: '确认跟进',
      content: '确认要提交跟进结果吗？',
      confirmText: '确认提交',
      cancelText: '取消',
      success: (modalRes) => {
        if (!modalRes.confirm) return;
        this._doFollowUp();
      }
    });
  },

  _doFollowUp() {
    this.setData({ submitting: true });
    const { currentAlertId, followUpResult } = this.data;

    serviceProviderAPI.followUpAlert(currentAlertId, {
      followUpResult: followUpResult.trim()
    }).then(() => {
      wx.showToast({ title: '跟进成功', icon: 'success' });
      this.setData({
        showFollowUp: false,
        currentAlertId: '',
        followUpResult: ''
      });
      this.refreshAlerts();
    }).catch(() => {}).finally(() => {
      this.setData({ submitting: false });
    });
  },

  formatAlertType(type) {
    const map = {
      'inactive_3': '3天未活跃',
      'inactive_7': '7天未活跃',
      'inactive_14': '14天未活跃',
      'inactive_30': '30天未活跃',
      'churn_risk': '流失风险'
    };
    return map[type] || type || '预警';
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  }
});
