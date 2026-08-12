// pages/user/course/play.js
const { courseAPI } = require('../../../utils/api');

Page({
  data: {
    courseId: null,
    course: null,
    progress: 0,
    pointsEarned: 0,
    loading: true,
    updating: false,
    contentHtml: ''
  },

  onLoad(options) {
    const id = options.id;
    this.setData({ courseId: id });
    const app = getApp();
    app.onLoginReady(() => {
      this.loadCourse();
    });
  },

  async loadCourse() {
    this.setData({ loading: true });
    try {
      const [listRes, historyRes] = await Promise.all([
        courseAPI.getList(),
        courseAPI.getHistory({ page: 1, pageSize: 100 }).catch(() => null)
      ]);

      const courses = (listRes.data && listRes.data.courses) || [];
      const course = courses.find((c) => String(c.id) === String(this.data.courseId)) || null;

      // 取该课程的最新进度与已获积分
      let progress = 0;
      let pointsEarned = 0;
      if (historyRes && historyRes.data && historyRes.data.records) {
        historyRes.data.records.forEach((r) => {
          const cid = r.course_id || r.courseId;
          if (String(cid) === String(this.data.courseId)) {
            if (r.progress > progress) {
              progress = r.progress;
            }
            const earned = r.points_earned || r.pointsEarned || 0;
            if (earned > pointsEarned) {
              pointsEarned = earned;
            }
          }
        });
      }

      // 将文档内容转为 rich-text 可用的 HTML
      const contentHtml = this.renderContent(course ? course.content : '');

      this.setData({ course, progress, pointsEarned, contentHtml, loading: false });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  // 将纯文本内容转为 HTML 格式
  renderContent(content) {
    if (!content) return '';
    // 按行分割，逐行处理
    const lines = content.split('\n');
    let html = '';
    let inList = false;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += '<p style="margin:8rpx 0;">&nbsp;</p>';
        return;
      }

      // 数字序号列表项（如 "1. xxx"）
      if (/^\d+[\.\、]/.test(trimmed)) {
        if (!inList) {
          html += '<ul style="padding-left:40rpx;margin:10rpx 0;">';
          inList = true;
        }
        html += '<li style="font-size:32rpx;line-height:2;color:#333;margin-bottom:6rpx;">' + this.escapeHtml(trimmed) + '</li>';
        return;
      }

      // 短横线列表项（如 "- xxx"）
      if (/^[-—]/.test(trimmed)) {
        if (!inList) {
          html += '<ul style="padding-left:40rpx;margin:10rpx 0;">';
          inList = true;
        }
        html += '<li style="font-size:32rpx;line-height:2;color:#333;margin-bottom:6rpx;">' + this.escapeHtml(trimmed.replace(/^[-—]\s*/, '')) + '</li>';
        return;
      }

      if (inList) {
        html += '</ul>';
        inList = false;
      }

      // 标题（【xxx】或 "一、二、" 开头的标题行）
      if (/^【/.test(trimmed) || /^[一二三四五六七八九十]+[、．]/.test(trimmed)) {
        html += '<h3 style="font-size:36rpx;font-weight:bold;color:#333;margin:24rpx 0 12rpx 0;line-height:1.8;">' + this.escapeHtml(trimmed) + '</h3>';
        return;
      }

      // 普通段落
      html += '<p style="font-size:32rpx;line-height:2;color:#333;margin:6rpx 0;text-indent:2em;">' + this.escapeHtml(trimmed) + '</p>';
    });

    if (inList) {
      html += '</ul>';
    }

    return html;
  },

  // 转义 HTML 特殊字符
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  finishCourse() {
    if (this.data.updating) return;
    this.updateProgress(100);
  },

  async updateProgress(newProgress) {
    if (!this.data.course) return;
    this.setData({ updating: true });
    try {
      const res = await courseAPI.updateProgress({
        courseId: this.data.courseId,
        progress: newProgress,
        courseName: this.data.course.title
      });

      const data = res.data || {};
      const pointsEarned = data.pointsEarned || (data.record && data.record.pointsEarned) || this.data.pointsEarned;

      this.setData({
        progress: newProgress,
        pointsEarned,
        updating: false
      });

      if (data.pointsEarned > 0 && data.message) {
        wx.showToast({ title: data.message, icon: 'none', duration: 2500 });
      } else {
        wx.showToast({ title: '进度已更新', icon: 'none' });
      }
    } catch (err) {
      this.setData({ updating: false });
      wx.showToast({ title: err.message || '更新失败', icon: 'none' });
    }
  }
});