// pages/agent/review/review.js - 餐食审核
const { agentAPI } = require('../../../utils/api');

Page({
  data: {
    meals: [],
    page: 1,
    hasMore: true,
    loading: false,
    statusFilter: 'pending',
    statusTabs: [
      { label: '待审核', value: 'pending' },
      { label: '已通过', value: 'approved' },
      { label: '已驳回', value: 'rejected' }
    ]
  },

  onLoad() {
    this.loadMeals();
  },

  // P1修复：onShow 刷新数据，避免返回后显示陈旧审核列表
  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.setData({ page: 1, meals: [], hasMore: true });
      this.loadMeals();
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, meals: [], hasMore: true });
    this.loadMeals(() => wx.stopPullDownRefresh());
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ statusFilter: status, page: 1, meals: [], hasMore: true });
    this.loadMeals();
  },

  loadMeals(cb) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const app = getApp();
    agentAPI.getMeals({
      status: this.data.statusFilter,
      page: this.data.page,
      pageSize: 10
    }).then(res => {
      const mealTypeMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
      const newMeals = (res.data.meals || []).map(m => ({
        id: m.id,
        userName: m.user ? m.user.nick_name : '未知用户',
        mealType: mealTypeMap[m.meal_type] || '餐食',
        imageUrl: m.image_url ? `${app.globalData.baseUrl.replace('/api', '')}${m.image_url}` : '',
        aiFoodType: m.ai_food_type || '',
        points: m.points,
        status: m.status,
        uploadTime: m.upload_time
      }));
      this.setData({
        meals: this.data.meals.concat(newMeals),
        hasMore: res.data.hasMore,
        loading: false
      });
      if (typeof cb === 'function') cb();
    }).catch(() => {
      this.setData({ loading: false });
      if (typeof cb === 'function') cb();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadMeals();
    }
  },

  approve(e) {
    this.review(e.currentTarget.dataset.id, 'approved');
  },

  reject(e) {
    this.review(e.currentTarget.dataset.id, 'rejected');
  },

  review(mealId, status) {
    const actionText = status === 'approved' ? '通过' : '驳回';
    wx.showModal({
      title: '确认操作',
      content: `确定要${actionText}该餐食吗？`,
      success: (res) => {
        if (res.confirm) {
          agentAPI.reviewMeal(mealId, { status }).then(() => {
            wx.showToast({ title: `已${actionText}`, icon: 'success' });
            this.setData({
              meals: this.data.meals.filter(m => m.id !== mealId)
            });
          }).catch(() => {});
        }
      }
    });
  }
});
