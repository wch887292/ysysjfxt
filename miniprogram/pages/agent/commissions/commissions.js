// pages/agent/commissions/commissions.js - 分润查询
const { agentAPI } = require('../../../utils/api');

Page({
  data: {
    commissions: [],
    summary: {
      pendingTotal: '0.00',
      settledTotal: '0.00',
      allTotal: '0.00'
    },
    loading: false,
    statusFilter: '',
    page: 1,
    hasMore: true,
    statusTabs: [
      { label: '全部', value: '' },
      { label: '待结算', value: 'pending' },
      { label: '已结算', value: 'settled' },
      { label: '已取消', value: 'cancelled' }
    ]
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadCommissions();
    });
  },

  // 适老化：onShow 刷新数据，避免返回后显示陈旧分润记录
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshCommissions();
    }
  },

  onPullDownRefresh() {
    this.refreshCommissions(() => wx.stopPullDownRefresh());
  },

  refreshCommissions(cb) {
    this.setData({ commissions: [], page: 1, hasMore: true });
    this.loadCommissions(cb);
  },

  loadCommissions(cb) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const params = {
      page: this.data.page,
      pageSize: 20
    };
    if (this.data.statusFilter) {
      params.status = this.data.statusFilter;
    }

    agentAPI.getCommissions(params).then(res => {
      const sourceMap = {
        gift_exchange: '礼品兑换',
        write_off: '积分核销',
        member_service: '会员服务',
        other: '其他'
      };
      const statusMap = {
        pending: '待结算',
        settled: '已结算',
        cancelled: '已取消'
      };
      const newCommissions = (res.data.commissions || []).map(c => ({
        id: c.id,
        sourceLabel: sourceMap[c.source] || '其他',
        userName: c.user ? c.user.nick_name : '未知用户',
        phone: c.user ? c.user.phone_masked : '',
        period: c.period,
        amount: this.formatAmount(c.amount),
        rate: c.rate,
        baseAmount: this.formatAmount(c.base_amount),
        statusLabel: statusMap[c.status] || '未知',
        status: c.status,
        createdAt: c.created_at
      }));
      const s = res.data.summary || {};
      this.setData({
        commissions: this.data.commissions.concat(newCommissions),
        hasMore: res.data.hasMore,
        summary: {
          pendingTotal: this.formatAmount(s.pendingTotal),
          settledTotal: this.formatAmount(s.settledTotal),
          allTotal: this.formatAmount(s.allTotal)
        },
        loading: false
      });
      if (typeof cb === 'function') cb();
    }).catch(() => {
      this.setData({ loading: false });
      if (typeof cb === 'function') cb();
    });
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.statusFilter) return;
    this.setData({ statusFilter: status, page: 1, commissions: [], hasMore: true });
    this.loadCommissions();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadCommissions();
    }
  },

  formatAmount(amount) {
    const num = Number(amount) || 0;
    return num.toFixed(2);
  }
});
