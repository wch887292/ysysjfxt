// pages/service-provider/reports/reports.js - 客户报告
const { serviceProviderAPI } = require('../../../utils/api');

Page({
  data: {
    userId: '',
    reports: [],
    loading: false,
    downloading: false
  },

  onLoad(options) {
    if (options && options.userId) {
      this.setData({ userId: String(options.userId) });
    }
    const app = getApp();
    app.onLoginReady(() => {
      this.loadReports();
    });
  },

  // P1修复：onShow 刷新数据，避免返回后显示陈旧列表
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.loadReports();
    }
  },

  loadReports() {
    if (this.data.loading) return;
    if (!this.data.userId) {
      wx.showToast({ title: '缺少客户信息', icon: 'none' });
      return;
    }
    this.setData({ loading: true });

    const reportTypeMap = {
      crisis_hook: '危机钩子报告',
      '7day_plan': '7天调理方案'
    };

    serviceProviderAPI.getReports(this.data.userId).then(res => {
      const reports = ((res.data && res.data.reports) || []).map(r => ({
        id: r.id,
        title: r.title || '',
        content: r.content || '',
        reportType: r.report_type,
        reportTypeText: reportTypeMap[r.report_type] || '报告',
        riskScore: r.risk_score,
        riskLevel: r.risk_level || '',
        generateDate: this.formatDate(r.generate_date),
        createdAt: r.created_at
      }));
      this.setData({ reports: reports });
    }).catch(() => {}).finally(() => {
      this.setData({ loading: false });
    });
  },

  downloadReport(e) {
    const reportId = e.currentTarget.dataset.id;
    if (this.data.downloading) return;       // 防重复点击
    this.setData({ downloading: true });
    const app = getApp();
    const token = wx.getStorageSync('token');
    const path = serviceProviderAPI.downloadReport(reportId);
    wx.downloadFile({
      url: `${app.globalData.baseUrl}${path}`,
      header: { 'Authorization': `Bearer ${token}` },
      success: (res) => {
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            fail: () => {
              wx.showToast({ title: '文件已下载，无法预览', icon: 'none' });
            }
          });
        } else if (res.statusCode === 400 || res.statusCode === 403) {
          // 业务错误（次数已用完等）
          wx.getFileSystemManager().readFile({
            filePath: res.tempFilePath,
            encoding: 'utf8',
            success: (r) => {
              let msg = '下载失败';
              try { const d = JSON.parse(r.data); msg = d.message || msg; } catch (e) {}
              wx.showToast({ title: msg, icon: 'none', duration: 3000 });
            },
            fail: () => wx.showToast({ title: '下载失败', icon: 'none' })
          });
        } else {
          wx.showToast({ title: `下载失败(${res.statusCode})`, icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      },
      complete: () => {
        this.setData({ downloading: false });
      }
    });
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
});
