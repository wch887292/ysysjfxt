// pages/user/report/7day-plan.js
const { reportAPI } = require('../../../utils/api');

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

function normalizePlan(data) {
  if (!data) return null;
  const level = String(data.riskLevel || data.risk_level || data.level || '').toLowerCase();
  const levelInfo = RISK_LEVEL_MAP[level] || { text: '未知', cls: 'chip-unknown' };

  // 内容归一化为 sections: [{title, text}]
  let sections = [];
  const rawContent = data.content || data.planContent || data.sections || data.days;
  if (typeof rawContent === 'string') {
    sections = [{ title: '', text: rawContent }];
  } else if (Array.isArray(rawContent)) {
    sections = rawContent.map((item) => {
      if (typeof item === 'string') return { title: '', text: item };
      if (item && typeof item === 'object') {
        return { title: item.title || item.day || '', text: item.content || item.text || item.description || '' };
      }
      return { title: '', text: '' };
    }).filter((s) => s.text);
  }

  return {
    // P1 修复：保留 id 字段，与 crisis-hook 保持一致
    id: data.id || data.reportId || data._id || null,
    title: data.title || data.planTitle || '7天调理方案',
    riskScore: data.riskScore != null ? data.riskScore : (data.risk_score != null ? data.risk_score : data.score),
    riskLevel: level,
    riskLevelText: levelInfo.text,
    riskLevelCls: levelInfo.cls,
    // 修复：后端 report.js /my-7day-plan 返回 generateDate（不含 d），原取值链首项不匹配
    generatedDate: formatDate(data.generateDate || data.generatedAt || data.createdAt || data.created_at || data.generated_at || data.date),
    sections
  };
}

Page({
  data: {
    plan: null,
    loading: true
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadPlan();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.loadPlan();
    }
  },

  async loadPlan() {
    this.setData({ loading: true });
    try {
      const res = await reportAPI.getMy7DayPlan();
      const plan = normalizePlan(res.data);
      this.setData({ plan, loading: false });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
    }
  },

  callStore() {
    wx.makePhoneCall({
      phoneNumber: '4008888888',
      fail: () => {}
    });
  },

  goQuestionnaire() {
    wx.navigateTo({ url: '/pages/user/questionnaire/questionnaire' });
  },

  onPullDownRefresh() {
    this.loadPlan().then(() => wx.stopPullDownRefresh());
  }
});
