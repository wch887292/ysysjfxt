// pages/admin/gifts/gifts.js
const { adminAPI } = require('../../../utils/api');

Page({
  data: {
    gifts: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    showCreateModal: false,
    showEditModal: false,
    newGift: { name: '', points: '', stock: '', category: 'other', description: '', cashPrice: 0 },
    editTarget: null,
    editName: '',
    editPoints: '',
    editStock: '',
    editCategory: 'other',
    editDescription: '',
    editCashPrice: 0
  },

  onLoad() {
    const app = getApp();
    app.onLoginReady(() => {
      this.loadGifts();
    });
  },

  onShow() {
    if (getApp().globalData.loginReady === 'ready') {
      this.refreshGifts();
    }
  },

  onPullDownRefresh() {
    this.refreshGifts();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadGifts();
    }
  },

  refreshGifts() {
    this.setData({ gifts: [], page: 1, hasMore: true });
    this.loadGifts();
  },

  async loadGifts() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const res = await adminAPI.getGifts({ page: this.data.page, pageSize: this.data.pageSize });
      const list = (res.data && res.data.gifts) || [];
      this.setData({
        gifts: this.data.gifts.concat(list),
        hasMore: res.data && res.data.hasMore !== false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 创建礼品
  onShowCreate() {
    this.setData({ showCreateModal: true, newGift: { name: '', points: '', stock: '', category: 'other', description: '', cashPrice: 0 } });
  },

  onCreateInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`newGift.${field}`]: e.detail.value });
  },

  onNewCategoryChange(e) {
    this.setData({ 'newGift.category': e.detail.value });
  },

  async onCreateGift() {
    const { name, points, stock, category, description, cashPrice } = this.data.newGift;
    if (!name || !points) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    try {
      const idempotencyKey = 'GIFT_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await adminAPI.createGift({ name, points: Number(points), stock: stock ? Number(stock) : 0, category, description, cashPrice: Number(cashPrice) || 0, idempotencyKey });
      wx.showToast({ title: '创建成功', icon: 'success' });
      this.setData({ showCreateModal: false });
      this.refreshGifts();
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  onCancelCreate() {
    this.setData({ showCreateModal: false });
  },

  // 编辑礼品
  onEditGift(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showEditModal: true,
      editTarget: item.id,
      editName: item.name,
      editPoints: String(item.points),
      editStock: String(item.stock || 0),
      editCategory: item.category || 'other',
      editDescription: item.description || '',
      editCashPrice: String(item.cashPrice || 0)
    });
  },

  onEditNameInput(e) { this.setData({ editName: e.detail.value }); },
  onEditPointsInput(e) { this.setData({ editPoints: e.detail.value }); },
  onEditStockInput(e) { this.setData({ editStock: e.detail.value }); },
  onEditCategoryChange(e) { this.setData({ editCategory: e.detail.value }); },
  onEditDescriptionInput(e) { this.setData({ editDescription: e.detail.value }); },
  onEditCashPriceInput(e) { this.setData({ editCashPrice: e.detail.value }); },

  async onConfirmEdit() {
    try {
      await adminAPI.updateGift(this.data.editTarget, {
        name: this.data.editName,
        points: Number(this.data.editPoints),
        stock: Number(this.data.editStock),
        category: this.data.editCategory,
        description: this.data.editDescription,
        cashPrice: Number(this.data.editCashPrice) || 0
      });
      wx.showToast({ title: '修改成功', icon: 'success' });
      this.setData({ showEditModal: false });
      this.refreshGifts();
    } catch (err) {
      wx.showToast({ title: '修改失败', icon: 'none' });
    }
  },

  onCancelEdit() {
    this.setData({ showEditModal: false });
  },

  // 删除礼品（需二次确认）
  onDeleteGift(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除礼品"${name}"吗？此操作不可恢复。`,
      confirmColor: '#F44336',
      success: (res) => {
        if (res.confirm) {
          this.doDelete(id);
        }
      }
    });
  },

  async doDelete(id) {
    try {
      await adminAPI.deleteGift(id);
      wx.showToast({ title: '删除成功', icon: 'success' });
      this.refreshGifts();
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  }
});
