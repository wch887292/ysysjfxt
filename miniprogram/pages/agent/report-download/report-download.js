// pages/agent/report-download/report-download.js - 代理商报告下载
const { agentAPI } = require('../../../utils/api');

Page({
  data: {
    userId: '',
    userName: '',
    reports: [],
    loading: false,
    downloadingId: ''
  },

  onLoad(options) {
    const userId = options.userId || '';
    this.setData({ userId });
    const app = getApp();
    app.onLoginReady(() => {
      this.loadReports();
    });
  },

  // P1修复：onShow 刷新数据，避免返回后显示陈旧列表
  onShow() {
    if (getApp().globalData.loginReady === 'ready' && this.data.userId) {
      this.loadReports();
    }
  },

  // 加载报告列表
  loadReports() {
    if (!this.data.userId) return;
    this.setData({ loading: true });
    const app = getApp();
    agentAPI.getReports(this.data.userId).then(res => {
      const reports = (res.data && res.data.reports) || [];
      const userName = (res.data && res.data.userName) || '未知用户';
      const typeMap = {
        crisis_hook: '危机钩子',
        '7day_plan': '7天方案'
      };
      const formatted = reports.map(r => ({
        id: r.id,
        title: r.title || (typeMap[r.report_type] || '健康报告'),
        reportType: r.report_type || '',
        typeLabel: typeMap[r.report_type] || '报告',
        generatedAt: r.generated_at || r.created_at || '',
        status: r.status || ''
      }));
      this.setData({ reports: formatted, userName, loading: false });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  // 下载报告
  downloadReport(e) {
    const reportId = e.currentTarget.dataset.id;
    if (!reportId || this.data.downloadingId) return;

    // 规格12.2 适老化：重要操作二次确认
    wx.showModal({
      title: '确认下载',
      content: '确定要下载该报告吗？',
      confirmText: '确认下载',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doDownload(reportId);
        }
      }
    });
  },

  // 执行下载
  doDownload(reportId) {
    this.setData({ downloadingId: reportId });
    const app = getApp();
    const downloadPath = agentAPI.downloadReport(reportId);
    const baseUrl = app.globalData.baseUrl || '';
    const fullUrl = baseUrl.replace(/\/$/, '') + downloadPath;

    wx.showLoading({ title: '下载中...' });
    wx.downloadFile({
      url: fullUrl,
      header: {
        'Authorization': 'Bearer ' + (wx.getStorageSync('token') || '')
      },
      success: (res) => {
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            success: () => {
              wx.showToast({ title: '打开成功', icon: 'success' });
            },
            fail: () => {
              wx.showToast({ title: '文件打开失败', icon: 'none' });
            }
          });
        } else {
          wx.showToast({ title: '下载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '下载失败，请重试', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ downloadingId: '' });
      }
    });
  }
});
