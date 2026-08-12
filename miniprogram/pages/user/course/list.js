// pages/user/course/list.js
const { courseAPI } = require('../../../utils/api');

Page({
  data: {
    courses: [],
    progressMap: {},
    loading: true
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadCourses();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.loadCourses();
    }
  },

  async loadCourses() {
    this.setData({ loading: true });
    try {
      const [listRes, historyRes] = await Promise.all([
        courseAPI.getList(),
        courseAPI.getHistory({ page: 1, pageSize: 100 }).catch(() => null)
      ]);

      const courses = (listRes.data && listRes.data.courses) || [];

      // 按课程ID汇总最大进度
      const progressMap = {};
      if (historyRes && historyRes.data && historyRes.data.records) {
        historyRes.data.records.forEach((r) => {
          const cid = r.course_id || r.courseId;
          if (cid === undefined || cid === null) return;
          if (progressMap[cid] === undefined || r.progress > progressMap[cid]) {
            progressMap[cid] = r.progress;
          }
        });
      }

      this.setData({ courses, progressMap, loading: false });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/user/course/detail?id=${id}` });
  },

  onPullDownRefresh() {
    this.loadCourses().then(() => wx.stopPullDownRefresh());
  }
});
