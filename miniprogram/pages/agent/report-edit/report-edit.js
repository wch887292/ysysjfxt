// pages/agent/report-edit/report-edit.js - 代理商报告编辑
const { agentAPI, adminAPI } = require('../../../utils/api');

Page({
  data: {
    userId: '',
    userName: '',
    reports: [],
    selectedId: '',
    content: '',
    originalContent: '',
    forbiddenWords: [],
    warningWords: [],
    loading: false,
    saving: false,
    contentChanged: false
  },

  onLoad(options) {
    const userId = options.userId || '';
    this.setData({ userId });
    const app = getApp();
    app.onLoginReady(() => {
      this.loadReports();
      this.loadForbiddenWords();
    });
  },

  // P1修复：onShow 刷新数据，避免返回后显示陈旧内容
  onShow() {
    if (getApp().globalData.loginReady === 'ready' && this.data.userId) {
      this.loadReports();
    }
  },

  // 加载报告列表
  loadReports() {
    if (!this.data.userId) return;
    this.setData({ loading: true });
    agentAPI.getReports(this.data.userId).then(res => {
      const reports = (res.data && res.data.reports) || [];
      const userName = (res.data && res.data.userName) || '未知用户';
      this.setData({ reports, userName, loading: false });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  // 加载违禁词列表
  loadForbiddenWords() {
    adminAPI.getForbiddenWords({ pageSize: 1000 }).then(res => {
      const words = (res.data && res.data.words) || [];
      this.setData({
        forbiddenWords: words.map(w => w.word || w.content || '').filter(Boolean)
      });
    }).catch(() => {});
  },

  // 选中报告
  selectReport(e) {
    const id = e.currentTarget.dataset.id;
    const report = this.data.reports.find(r => r.id === id);
    if (!report) return;
    const content = report.content || '';
    this.setData({
      selectedId: id,
      content,
      originalContent: content,
      contentChanged: false,
      warningWords: []
    });
    this.checkForbiddenWords(content);
  },

  // 输入内容
  onContentInput(e) {
    const content = e.detail.value;
    this.setData({
      content,
      contentChanged: content !== this.data.originalContent
    });
    this.checkForbiddenWords(content);
  },

  // 违禁词检测（本地正则匹配）
  checkForbiddenWords(content) {
    if (!content || !this.data.forbiddenWords.length) {
      this.setData({ warningWords: [] });
      return;
    }
    const found = this.data.forbiddenWords.filter(word => {
      try {
        const re = new RegExp(word, 'i');
        return re.test(content);
      } catch (e) {
        return content.indexOf(word) !== -1;
      }
    });
    this.setData({ warningWords: found });
  },

  // 保存报告
  saveReport() {
    if (this.data.saving) return;
    if (!this.data.selectedId) {
      wx.showToast({ title: '请先选择报告', icon: 'none' });
      return;
    }
    if (!this.data.contentChanged) {
      wx.showToast({ title: '内容未修改', icon: 'none' });
      return;
    }

    // 有违禁词时弹窗警告，仍允许保存
    const doSave = () => {
      this.setData({ saving: true });
      agentAPI.editReport(this.data.selectedId, { content: this.data.content }).then(() => {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({
          originalContent: this.data.content,
          contentChanged: false
        });
        // 刷新列表
        this.loadReports();
      }).catch(() => {}).finally(() => {
        this.setData({ saving: false });
      });
    };

    if (this.data.warningWords.length > 0) {
      wx.showModal({
        title: '违禁词警告',
        content: `内容包含违禁词：${this.data.warningWords.join('、')}，是否仍要保存？`,
        confirmText: '仍然保存',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) doSave();
        }
      });
    } else {
      // 规格12.2 适老化：重要操作二次确认
      wx.showModal({
        title: '确认保存',
        content: '确定保存对报告的修改吗？',
        confirmText: '确认保存',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) doSave();
        }
      });
    }
  }
});
