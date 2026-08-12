// pages/service-provider/receptions/receptions.js - 接待记录
const { serviceProviderAPI } = require('../../../utils/api');

const RESULT_OPTIONS = [
  { label: '待跟进', value: 'pending' },
  { label: '已转化', value: 'converted' },
  { label: '需回访', value: 'follow_up' },
  { label: '已流失', value: 'lost' }
];

Page({
  data: {
    receptions: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showForm: false,
    formData: {
      userId: '',
      receptionTime: '',
      content: '',
      result: 'pending'
    },
    submitting: false,
    resultOptions: RESULT_OPTIONS,
    resultIndex: 0
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadReceptions();
    });
  },

  // P1修复：onShow 刷新数据，避免返回后显示陈旧列表
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshReceptions();
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, receptions: [], hasMore: true });
    this.loadReceptions(() => wx.stopPullDownRefresh());
  },

  refreshReceptions() {
    this.setData({ page: 1, receptions: [], hasMore: true });
    this.loadReceptions();
  },

  loadReceptions(cb) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const resultMap = {};
    RESULT_OPTIONS.forEach(o => { resultMap[o.value] = o.label; });

    serviceProviderAPI.getReceptions({
      page: this.data.page,
      pageSize: this.data.pageSize
    }).then(res => {
      const newReceptions = ((res.data && res.data.receptions) || []).map(r => ({
        id: r.id,
        userName: (r.user && r.user.nick_name) ? r.user.nick_name : '未知用户',
        userPhone: (r.user && r.user.phone_masked) ? r.user.phone_masked : '',
        receptionTime: this.formatDateTime(r.reception_time),
        content: r.content || '',
        result: r.result,
        resultText: resultMap[r.result] || r.result
      }));
      this.setData({
        receptions: this.data.receptions.concat(newReceptions),
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
      this.loadReceptions();
    }
  },

  toggleForm() {
    this.setData({ showForm: !this.data.showForm });
  },

  onUserIdInput(e) {
    this.setData({ 'formData.userId': e.detail.value });
  },

  onTimeChange(e) {
    this.setData({ 'formData.receptionTime': e.detail.value });
  },

  onContentInput(e) {
    this.setData({ 'formData.content': e.detail.value });
  },

  onResultChange(e) {
    const idx = e.detail.value;
    this.setData({
      resultIndex: idx,
      'formData.result': RESULT_OPTIONS[idx].value
    });
  },

  validate() {
    const { userId, receptionTime } = this.data.formData;
    if (!userId || !userId.trim()) {
      wx.showToast({ title: '请输入客户ID', icon: 'none' });
      return false;
    }
    if (!receptionTime) {
      wx.showToast({ title: '请选择接待时间', icon: 'none' });
      return false;
    }
    return true;
  },

  submitReception() {
    if (this.data.submitting) return;       // 防双击
    if (!this.validate()) return;

    // 规格12.2 适老化：重要操作二次确认
    wx.showModal({
      title: '确认提交',
      content: '确认要提交该接待记录吗？',
      confirmText: '确认提交',
      cancelText: '取消',
      success: (modalRes) => {
        if (!modalRes.confirm) return;
        this._doSubmit();
      }
    });
  },

  _doSubmit() {
    this.setData({ submitting: true });
    const { userId, receptionTime, content, result } = this.data.formData;
    const payload = {
      userId: userId.trim(),
      receptionTime: receptionTime,
      content: content ? content.trim() : '',
      result: result
    };

    serviceProviderAPI.createReception(payload).then(() => {
      wx.showToast({ title: '提交成功', icon: 'success' });
      this.setData({
        showForm: false,
        formData: { userId: '', receptionTime: '', content: '', result: 'pending' },
        resultIndex: 0,
        page: 1,
        receptions: [],
        hasMore: true
      });
      this.loadReceptions();
    }).catch(() => {}).finally(() => {
      this.setData({ submitting: false });
    });
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
});
