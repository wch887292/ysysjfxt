// pages/agent/write-off/write-off.js
const { agentAPI } = require('../../../utils/api');

// 生成本地幂等键（页面生命周期内复用，防网络超时重试导致重复扣积分）
function genIdempotencyKey() {
  return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 10).toUpperCase();
}

Page({
  data: {
    userList: [],
    userId: '',
    selectedUser: null,        // { id, nickName, phone, points }
    points: '',
    giftDescription: '',
    remark: '',
    submitting: false,
    loadingUsers: false,
    result: null               // { newBalance, writeOffId, writeOffTime, duplicated }
  },

  // 实例级幂等键缓存（跨重试复用，与服务端唯一索引配合防双扣）
  _idempotencyKey: null,

  onLoad(options) {
    this.loadUsers();
    if (options && options.userId) {
      this.setData({ userId: String(options.userId) });
    }
  },

  loadUsers() {
    if (this.data.loadingUsers) return;
    this.setData({ loadingUsers: true });
    agentAPI.getUsers({ page: 1, pageSize: 200 })
      .then((res) => {
        const users = (res.data && res.data.users) || [];
        this.setData({ userList: users });
        if (this.data.userId) {
          const matched = users.find((u) => String(u.id) === this.data.userId);
          if (matched) {
            this.setData({ selectedUser: this.normalizeUser(matched) });
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        this.setData({ loadingUsers: false });
      });
  },

  normalizeUser(u) {
    return {
      id: u.id,
      nickName: u.nickName || '未命名用户',
      phone: u.phone || '',
      points: u.points || 0
    };
  },

  onUserChange(e) {
    const idx = e.detail.value;
    const u = this.data.userList[idx];
    if (!u) return;
    this.setData({
      userId: String(u.id),
      selectedUser: this.normalizeUser(u),
      result: null
    });
  },

  onPointsInput(e) {
    this.setData({ points: e.detail.value, result: null });
  },

  onGiftInput(e) {
    this.setData({ giftDescription: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  validate() {
    const { selectedUser, points, giftDescription } = this.data;
    if (!selectedUser) {
      wx.showToast({ title: '请先选择会员', icon: 'none' });
      return false;
    }
    const pts = Number(points);
    if (!points || !Number.isInteger(pts) || pts <= 0) {
      wx.showToast({ title: '核销积分须为正整数', icon: 'none' });
      return false;
    }
    if (pts > selectedUser.points) {
      wx.showToast({ title: '超出会员可用积分', icon: 'none' });
      return false;
    }
    if (!giftDescription || !giftDescription.trim()) {
      wx.showToast({ title: '请填写礼品/核销说明', icon: 'none' });
      return false;
    }
    if (giftDescription.length > 200) {
      wx.showToast({ title: '说明不超过200字', icon: 'none' });
      return false;
    }
    return true;
  },

  submit() {
    if (this.data.submitting) return;       // 防双击
    if (!this.validate()) return;

    // 规格12.2 适老化：重要操作二次确认（积分核销为不可逆资金操作）
    const userName = this.data.selectedUser.nickName || this.data.selectedUser.name || '该用户';
    const points = Number(this.data.points);
    const desc = this.data.giftDescription.trim();
    wx.showModal({
      title: '⚠️ 确认核销',
      content: `将为「${userName}」核销 ${points} 积分\n礼品/说明：${desc}\n\n此操作不可撤销，请确认无误后继续。`,
      confirmText: '确认核销',
      confirmColor: '#d32f2f',
      cancelText: '取消',
      success: (modalRes) => {
        if (!modalRes.confirm) return; // 用户取消
        this._doWriteOff();
      }
    });
  },

  _doWriteOff() {
    if (!this._idempotencyKey) {
      this._idempotencyKey = genIdempotencyKey();
    }

    this.setData({ submitting: true });
    const payload = {
      userId: this.data.selectedUser.id,
      points: Number(this.data.points),
      giftDescription: this.data.giftDescription.trim(),
      remark: this.data.remark ? this.data.remark.trim() : '',
      idempotencyKey: this._idempotencyKey
    };

    agentAPI.writeOffPoints(payload)
      .then((res) => {
        const d = res.data || {};
        const newBalance = (d.newBalance != null) ? d.newBalance : this.data.selectedUser.points;
        this.setData({
          result: {
            newBalance: newBalance,
            writeOffId: d.writeOffId,
            writeOffTime: d.writeOffTime,
            duplicated: !!d.duplicated
          },
          selectedUser: {
            ...this.data.selectedUser,
            points: newBalance
          }
        });
        wx.showToast({
          title: d.duplicated ? '已核销(幂等)' : '核销成功',
          icon: 'success'
        });
      })
      .catch(() => {
        // request.js 已弹错误提示；网络超时场景下保留幂等键，便于重试时幂等返回
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  },

  resetForm() {
    this._idempotencyKey = null;
    this.setData({
      points: '',
      giftDescription: '',
      remark: '',
      result: null
    });
  }
});
