// pages/user/privacy/privacy.js - 隐私政策与数据权利（规格7.4）
const { userAPI } = require('../../../utils/api');

const DEFAULT_VISIBILITY = {
  showProfile: true,
  showPhone: false,
  showHealthData: true,
  showReports: true
};

Page({
  data: {
    exporting: false,
    visibilitySettings: { ...DEFAULT_VISIBILITY },
    saveTip: ''
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadVisibility();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.loadVisibility();
    }
  },

  // 规格7.4：获取信息可见范围设置
  async loadVisibility() {
    try {
      const res = await userAPI.getVisibility();
      const settings = res.data && res.data.visibilitySettings
        ? { ...DEFAULT_VISIBILITY, ...res.data.visibilitySettings }
        : { ...DEFAULT_VISIBILITY };
      this.setData({ visibilitySettings: settings });
    } catch (err) {
      // 接口失败时使用默认值，不阻塞页面
      this.setData({ visibilitySettings: { ...DEFAULT_VISIBILITY } });
    }
  },

  // 规格7.4：开关切换（实时保存）
  async onSwitchChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    if (!key) return;

    const nextSettings = { ...this.data.visibilitySettings, [key]: value };
    this.setData({ visibilitySettings: nextSettings, saveTip: '保存中...' });

    try {
      await userAPI.updateVisibility({ [key]: value });
      this.setData({ saveTip: '已保存' });
      setTimeout(() => this.setData({ saveTip: '' }), 2000);
    } catch (err) {
      // 保存失败回滚
      this.setData({
        visibilitySettings: { ...this.data.visibilitySettings, [key]: !value },
        saveTip: '保存失败，请重试'
      });
      wx.showToast({ title: '保存失败', icon: 'none' });
      setTimeout(() => this.setData({ saveTip: '' }), 2000);
    }
  },

  // 兼容点击行区域切换（无障碍/适老化：整行可点）
  toggleVisibility(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    // 注意：switch 的 bindchange 已处理实际切换，这里避免重复触发
    // 整行点击时通过模拟 switch 切换实现
    const nextValue = !this.data.visibilitySettings[key];
    this.onSwitchChange({
      currentTarget: { dataset: { key } },
      detail: { value: nextValue }
    });
  },

  // 导出个人数据（规格7.4：数据导出支持）
  exportData() {
    if (this.data.exporting) return;

    wx.showModal({
      title: '确认导出',
      content: '将导出您的全部个人数据（用户信息、问卷、打卡、积分、报告等）为JSON文件，是否继续？',
      confirmText: '确认导出',
      success: (res) => {
        if (!res.confirm) return;

        this.setData({ exporting: true });
        const token = wx.getStorageSync('token');
        const app = getApp();

        wx.downloadFile({
          url: `${app.globalData.baseUrl}${userAPI.getExportUrl()}`,
          header: { 'Authorization': `Bearer ${token}` },
          success: (res) => {
            if (res.statusCode === 200) {
              wx.saveFile({
                tempFilePath: res.tempFilePath,
                success: (saveRes) => {
                  wx.showModal({
                    title: '导出成功',
                    content: '数据已保存到本地。文件路径：' + saveRes.savedFilePath,
                    showCancel: false,
                    confirmText: '我知道了'
                  });
                },
                fail: () => {
                  wx.showToast({ title: '保存文件失败', icon: 'none' });
                }
              });
            } else {
              wx.showToast({ title: '导出失败', icon: 'none' });
            }
          },
          fail: () => {
            wx.showToast({ title: '网络异常，请重试', icon: 'none' });
          },
          complete: () => {
            this.setData({ exporting: false });
          }
        });
      }
    });
  },

  // 申请删除账号数据（规格7.4：数据删除支持，防误触需二次确认）
  async requestDeletion() {
    wx.showModal({
      title: '⚠️ 危险操作',
      content: '删除账号数据是不可逆操作！删除后您的所有信息（积分、打卡、报告等）将被永久清除。申请提交后需人工审核，审核通过后3个工作日内完成。确定要继续吗？',
      confirmText: '确认申请',
      confirmColor: '#F44336',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const result = await userAPI.requestDeletion('用户主动申请');
          if (result.success) {
            wx.showModal({
              title: '申请已提交',
              content: '您的删除申请已提交，将在3个工作日内审核处理。审核期间账号正常使用。',
              showCancel: false,
              confirmText: '我知道了'
            });
          } else {
            wx.showToast({ title: result.message || '提交失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '网络异常，请重试', icon: 'none' });
        }
      }
    });
  }
});
