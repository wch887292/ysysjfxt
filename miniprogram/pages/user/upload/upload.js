// pages/user/upload/upload.js
const { clockInAPI } = require('../../../utils/api');
const voice = require('../../../utils/voice');

Page({
  data: {
    // 打卡模式
    clockInMode: 'icon', // 'icon' | 'image'

    // 餐食类型
    mealTypes: ['早餐', '午餐', '晚餐', '加餐'],
    mealTypeValues: ['breakfast', 'lunch', 'dinner', 'snack'],
    mealTypeIndex: 1,

    // 图标打卡
    foodIconOptions: [
      { key: 'vegetable', emoji: '🥬', label: '蔬菜' },
      { key: 'fruit', emoji: '🍎', label: '水果' },
      { key: 'water', emoji: '💧', label: '水' },
      { key: 'grain', emoji: '🌾', label: '主食' },
      { key: 'meat', emoji: '🥩', label: '肉类' },
      { key: 'fish', emoji: '🐟', label: '鱼类' },
      { key: 'milk', emoji: '🥛', label: '奶类' },
      { key: 'egg', emoji: '🍳', label: '蛋类' },
      { key: 'other', emoji: '🍽️', label: '其他' }
    ],
    selectedIcons: [],

    // 拍照打卡
    imageUrl: '',
    aiResult: null,
    isValidContent: null,
    validationMessage: '',

    // 公共
    followPlan: false,
    description: '',
    isSubmitting: false,

    // 今日打卡概览
    todayTotalPoints: 0,
    todayCount: 0,
    dailyLimit: 3,
    todayRecords: {
      breakfast: false,
      lunch: false,
      dinner: false
    }
  },

  onLoad() {
    this._alive = true;
    const app = getApp();
    app.onLoginReady(() => {
      if (!this._alive) return;
      this.loadTodayClockIn();
    });
  },

  onShow() {
    if (!this._alive) return;
    if (getApp().globalData.loginReady === 'ready') {
      this.loadTodayClockIn();
    }
  },

  onUnload() {
    this._alive = false;
  },

  // 切换打卡模式
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== this.data.clockInMode) {
      this.setData({
        clockInMode: mode,
        // 清空当前输入
        selectedIcons: [],
        imageUrl: '',
        aiResult: null,
        isValidContent: null,
        validationMessage: ''
      });
    }
  },

  // 餐食类型切换
  onMealTypeChange(e) {
    this.setData({ mealTypeIndex: e.detail.value });
  },

  // 点击今日打卡徽章，联动切换餐食类型
  quickSelectMeal(e) {
    const meal = e.currentTarget.dataset.meal;
    const mealValues = this.data.mealTypeValues;
    const idx = mealValues.indexOf(meal);
    if (idx < 0) return;
    if (this.data.mealTypeIndex === idx) {
      // 已选中，给出二次确认提示
      wx.showToast({ title: `当前已选${this.data.mealTypes[idx]}`, icon: 'none' });
      return;
    }
    const done = this.data.todayRecords[meal];
    this.setData({ mealTypeIndex: idx });
    wx.showToast({
      title: done ? `${this.data.mealTypes[idx]}已打卡` : `已选${this.data.mealTypes[idx]}，请在下方完成打卡`,
      icon: 'none',
      duration: 1800
    });
    // 滚动到打卡表单
    wx.pageScrollTo({ scrollTop: 380, duration: 300 });
  },

  // 切换食物图标
  toggleIcon(e) {
    const key = e.currentTarget.dataset.key;
    const selected = this.data.selectedIcons.slice();
    const idx = selected.indexOf(key);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else if (selected.length < 9) {
      selected.push(key);
    } else {
      wx.showToast({ title: '最多选择9个图标', icon: 'none' });
      return;
    }
    this.setData({ selectedIcons: selected });
  },

  // 切换遵循饮食计划
  toggleFollowPlan() {
    this.setData({ followPlan: !this.data.followPlan });
  },

  // 选择图片（拍照打卡核心入口）
  // 修复：相机权限被拒时原逻辑只提示“打开相机失败”且无法跳转设置页。
  // 现改为：先预检 scope.camera，未授权先申请授权，被拒则引导用户跳转系统设置开启权限。
  chooseImage() {
    wx.getSetting({
      success: (settingRes) => {
        const cameraAuth = settingRes.authSetting['scope.camera'];
        if (cameraAuth === true) {
          // 已授权，直接调起相机/相册
          this.openMedia();
        } else if (cameraAuth === undefined) {
          // 从未申请过授权：先向微信申请相机权限
          wx.authorize({
            scope: 'scope.camera',
            success: () => this.openMedia(),
            fail: () => this.promptOpenSetting()
          });
        } else {
          // 之前拒绝过：引导去系统设置开启
          this.promptOpenSetting();
        }
      },
      fail: () => {
        // 获取设置失败，退化为直接调起（首次会由微信弹授权框）
        this.openMedia();
      }
    });
  },

  // 调起相机/相册选择器
  // sourceType 缺省同时支持相册与相机；仅在用户明确拒绝相机时降级为仅相册，避免卡死
  openMedia(sourceType) {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: sourceType || ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ imageUrl: tempFilePath });
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '';
        const errno = err && err.errno;
        if (msg.indexOf('cancel') >= 0) return; // 用户主动取消，无需提示
        // 隐私协议未声明该接口范围（errno 112）：必须在微信公众平台补全隐私指引，代码无法绕过
        if (errno === 112 || msg.indexOf('privacy agreement') >= 0 || msg.indexOf('not declared') >= 0) {
          console.error('[隐私合规] chooseMedia 接口未在《隐私保护指引》中声明使用范围，请到 mp.weixin.qq.com 完善隐私协议（勾选「摄像头/相册」）', err);
          wx.showModal({
            title: '需完善隐私协议',
            content: '小程序《隐私保护指引》尚未声明「摄像头 / 相册」使用范围，导致无法拍照或选图。请开发者登录 mp.weixin.qq.com → 设置 → 服务内容 → 用户隐私保护指引，勾选对应场景并提交审核后重试。',
            showCancel: false,
            confirmText: '知道了'
          });
          return;
        }
        // 授权类错误：引导去系统设置开启相机权限
        if (msg.indexOf('authorize') >= 0 || msg.indexOf('permission') >= 0 || msg.indexOf('camera') >= 0) {
          that.promptOpenSetting();
          return;
        }
        console.error('选择图片失败:', err);
        wx.showToast({ title: '打开相机失败，请检查权限', icon: 'none' });
      }
    });
  },

  // 引导用户跳转系统设置页开启相机权限
  promptOpenSetting() {
    wx.showModal({
      title: '需要相机权限',
      content: '拍照打卡需要使用相机，请在设置中开启“摄像头”权限后重试。',
      confirmText: '去设置',
      cancelText: '仅用相册',
      success: (modalRes) => {
        if (modalRes.confirm) {
          wx.openSetting({
            success: (settingRes) => {
              if (settingRes.authSetting['scope.camera']) {
                // 用户已开启相机权限，自动重新打开相机
                this.openMedia();
              } else {
                // 仍未开启，降级为仅相册选择，保证仍可上传已有图片
                this.openMedia(['album']);
              }
            },
            fail: () => {
              wx.showToast({ title: '打开相机失败，请检查权限', icon: 'none' });
            }
          });
        } else {
          // 用户选择“仅用相册”，降级为相册选择，不阻断打卡
          this.openMedia(['album']);
        }
      }
    });
  },

  // 加载今日打卡记录
  loadTodayClockIn() {
    clockInAPI.getToday().then((res) => {
      if (res.success) {
        const records = res.data.records || [];
        const totalPoints = records.reduce((sum, r) => sum + (r.points_earned || 0), 0);
        this.setData({
          todayTotalPoints: totalPoints,
          todayCount: records.length,
          todayRecords: {
            breakfast: res.data.hasBreakfast,
            lunch: res.data.hasLunch,
            dinner: res.data.hasDinner
          }
        });
      }
    }).catch((err) => {
      console.error('加载今日打卡失败', err);
    });
  },

  // 提交打卡（统一入口）
  submitClockIn() {
    if (this.data.clockInMode === 'icon') {
      this.submitIconClockIn();
    } else {
      this.submitImageClockIn();
    }
  },

  // 图标打卡
  submitIconClockIn() {
    if (this.data.selectedIcons.length === 0) {
      wx.showToast({ title: '请选择食物图标', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交中...' });

    const mealType = this.data.mealTypeValues[this.data.mealTypeIndex];
    clockInAPI.iconClockIn({
      mealType,
      foodIcons: this.data.selectedIcons,
      followPlan: this.data.followPlan
    }).then((res) => {
      if (res.success) {
        const msg = res.data.surpriseMessage || `获得 ${res.data.pointsEarned} 积分`;
        // 规格7.1.5：语音播报打卡成功反馈
        voice.speak(msg);
        wx.showModal({
          title: '打卡成功',
          content: msg,
          showCancel: false,
          confirmText: '太棒了'
        });
        this.resetForm();
        this.loadTodayClockIn();
      } else {
        wx.showToast({ title: res.message || '打卡失败', icon: 'none' });
      }
    }).catch(() => {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    }).finally(() => {
      this.setData({ isSubmitting: false });
      wx.hideLoading();
    });
  },

  // 图片打卡（走统一 /clock-in/image 接口，自动压缩图片）
  async submitImageClockIn() {
    if (!this.data.imageUrl) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: 'AI识别中...' });

    const mealType = this.data.mealTypeValues[this.data.mealTypeIndex];

    try {
      const res = await clockInAPI.imageClockIn(this.data.imageUrl, {
        mealType,
        followPlan: String(this.data.followPlan)
      });
      if (res.success) {
        this.setData({
          aiResult: res.data.aiResult,
          isValidContent: res.data.imageValid,
          validationMessage: res.data.imageValid ? '图片验证通过' : '图片不合规'
        });
        const msg = res.data.surpriseMessage || `获得 ${res.data.pointsEarned} 积分`;
        // 规格7.1.5：语音播报打卡成功反馈
        voice.speak(msg);
        wx.showModal({
          title: '打卡成功',
          content: msg,
          showCancel: false,
          confirmText: '太棒了'
        });
        this.loadTodayClockIn();
      } else {
        wx.showToast({ title: res.message || '打卡失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '上传失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
      wx.hideLoading();
    }
  },

  // 重置表单
  resetForm() {
    this.setData({
      selectedIcons: [],
      imageUrl: '',
      aiResult: null,
      isValidContent: null,
      validationMessage: '',
      description: ''
    });
  },

  onShareAppMessage() {
    const userInfo = (getApp().globalData.userInfo) || wx.getStorageSync('userInfo') || {};
    const path = userInfo.id
      ? '/pages/user/home/home?referrerId=' + userInfo.id
      : '/pages/user/home/home';
    return {
      title: '健康饮食积分 - 记录每一餐，积累健康财富',
      path
    };
  }
});
