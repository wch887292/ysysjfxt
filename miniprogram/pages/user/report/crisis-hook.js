// pages/user/report/crisis-hook.js
const { reportAPI } = require('../../../utils/api');
const voice = require('../../../utils/voice');

const RISK_LEVEL_MAP = {
  low: { text: '低风险', cls: 'chip-low' },
  medium: { text: '中风险', cls: 'chip-medium' },
  high: { text: '高风险', cls: 'chip-high' }
};

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeReport(data) {
  if (!data) return null;
  const level = String(data.riskLevel || data.risk_level || data.level || '').toLowerCase();
  const levelInfo = RISK_LEVEL_MAP[level] || { text: '未知', cls: 'chip-unknown' };

  // 内容归一化为 sections: [{title, text}]
  let sections = [];
  const rawContent = data.content || data.reportContent || data.sections;
  if (typeof rawContent === 'string') {
    sections = [{ title: '', text: rawContent }];
  } else if (Array.isArray(rawContent)) {
    sections = rawContent.map((item) => {
      if (typeof item === 'string') return { title: '', text: item };
      if (item && typeof item === 'object') {
        return { title: item.title || '', text: item.content || item.text || item.description || '' };
      }
      return { title: '', text: '' };
    }).filter((s) => s.text);
  }

  return {
    // P0 修复：保留 id 字段，供下载报告接口使用（原缺失导致 reportId 为 undefined）
    id: data.id || data.reportId || data._id || null,
    title: data.title || data.reportTitle || '危机钩子报告',
    riskScore: data.riskScore != null ? data.riskScore : (data.risk_score != null ? data.risk_score : data.score),
    riskLevel: level,
    riskLevelText: levelInfo.text,
    riskLevelCls: levelInfo.cls,
    // 修复：后端 report.js 返回 generateDate（不含 d），原取值链首项 generatedAt（含 d）不匹配，
    // 导致生成日期恒为空字符串。将 generateDate 置于首位
    generatedDate: formatDate(data.generateDate || data.generatedAt || data.createdAt || data.created_at || data.generated_at || data.date),
    sections
  };
}

Page({
  data: {
    report: null,
    loading: true,
    generating: false,
    downloading: false,
    isMember: false,
    speaking: false // 规格7.1.5：语音播报状态
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadReport();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.loadReport();
    }
  },

  onHide() {
    // 离开页面时停止语音播报，避免后台继续播放
    voice.stop();
    this.setData({ speaking: false });
  },

  onUnload() {
    voice.stop();
  },

  // 规格7.1.5：语音播报报告内容（适老化，方便视力不佳的老年用户）
  toggleSpeak() {
    if (this.data.speaking) {
      voice.stop();
      this.setData({ speaking: false });
      return;
    }
    const report = this.data.report;
    if (!report) return;
    // 拼接标题 + 风险等级 + 各章节文本
    const parts = [report.title];
    if (report.riskLevelText) parts.push(`风险等级：${report.riskLevelText}`);
    if (report.generatedDate) parts.push(`生成日期：${report.generatedDate}`);
    for (const s of report.sections) {
      if (s.title) parts.push(s.title);
      if (s.text) parts.push(s.text);
    }
    parts.push('本报告仅供参考，不作为疾病诊断依据。如需详细解读，请咨询服务商或专业医师。');
    voice.speak(parts.join('。'));
    this.setData({ speaking: true });
  },

  async loadReport() {
    this.setData({ loading: true });
    try {
      const res = await reportAPI.getCrisisHook();
      const report = normalizeReport(res.data);
      // P0修复：从全局 userInfo 获取会员状态，控制"升级会员"按钮显示
      const app = getApp();
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
      this.setData({ report, loading: false, isMember: !!userInfo.is_member });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
    }
  },

  async generateReport() {
    if (this.data.generating) return;
    this.setData({ generating: true });
    try {
      await reportAPI.generate();
      wx.showToast({ title: '报告已生成', icon: 'success' });
      await this.loadReport();
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '生成失败', icon: 'none' });
    } finally {
      this.setData({ generating: false });
    }
  },

  onPullDownRefresh() {
    this.loadReport().then(() => wx.stopPullDownRefresh());
  },

  // P0修复：引导到店 CTA —— 电话咨询
  callStore() {
    wx.makePhoneCall({
      phoneNumber: '4008888888',
      fail: () => {}
    });
  },

  // P0修复：非会员引导到健康评估页（升级会员入口）
  goQuestionnaire() {
    wx.navigateTo({
      url: '/pages/user/questionnaire/questionnaire',
      fail: () => {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 下载报告 PDF（方案3.3：会员每月限1次）
  async downloadReport() {
    if (!this.data.report) {
      wx.showToast({ title: '暂无报告可下载', icon: 'none' });
      return;
    }
    if (this.data.downloading) return;
    this.setData({ downloading: true });
    const app = getApp();
    const token = wx.getStorageSync('token');
    const reportId = this.data.report.id;
    const path = reportAPI.downloadReport(reportId);
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
  }
});
