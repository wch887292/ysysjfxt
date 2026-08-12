// pages/user/course/detail.js
const { courseAPI } = require('../../../utils/api');

Page({
  data: {
    courseId: null,
    course: null,
    progress: 0,
    historyRecords: [],
    loading: true
  },

  onLoad(options) {
    const id = options.id;
    this.setData({ courseId: id });
    const app = getApp();
    app.onLoginReady(() => {
      this.loadDetail();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready' && this.data.courseId) {
      this.loadDetail();
    }
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const [listRes, historyRes] = await Promise.all([
        courseAPI.getList(),
        courseAPI.getHistory({ page: 1, pageSize: 100 }).catch(() => null)
      ]);

      const courses = (listRes.data && listRes.data.courses) || [];
      const course = courses.find((c) => String(c.id) === String(this.data.courseId)) || null;

      // 汇总该课程的最新进度与历史记录
      let progress = 0;
      const historyRecords = [];
      if (historyRes && historyRes.data && historyRes.data.records) {
        historyRes.data.records.forEach((r) => {
          const cid = r.course_id || r.courseId;
          if (String(cid) === String(this.data.courseId)) {
            historyRecords.push(r);
            if (r.progress > progress) {
              progress = r.progress;
            }
          }
        });
      }

      this.setData({ course, progress, historyRecords, loading: false });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  goRead() {
    wx.navigateTo({ url: `/pages/user/course/play?id=${this.data.courseId}` });
  },

  goHistory() {
    wx.pageScrollTo({ selector: '.history-section', duration: 300 });
  }
});
