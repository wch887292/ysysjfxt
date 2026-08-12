// components/privacy-popup/privacy-popup.js
// 微信隐私协议弹窗组件
// 合规要求：2023年9月后上线的小程序必须包含隐私协议弹窗

const { agreePrivacy } = require('../../utils/privacy.js');

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {},

  methods: {
    // 查看隐私政策
    viewPrivacy() {
      wx.navigateTo({
        url: '/pages/user/privacy/privacy'
      });
    },

    // 同意隐私协议
    onAgree() {
      agreePrivacy();
      this.triggerEvent('agree');
      this.setData({ show: false });
    },

    // 不同意隐私协议
    onDisagree() {
      wx.showModal({
        title: '提示',
        content: '您需要同意隐私政策才能使用本小程序的完整功能。如果您不同意，将无法使用登录、打卡、积分兑换等功能。',
        confirmText: '再看看',
        cancelText: '关闭小程序',
        success: (res) => {
          if (res.confirm) {
            // 用户选择再看看，保持弹窗显示
          } else {
            // 用户选择关闭小程序
            wx.exitMiniProgram({
              success: () => {},
              fail: () => {
                wx.showToast({
                  title: '您可以随时在设置中查看隐私政策',
                  icon: 'none',
                  duration: 3000
                });
              }
            });
          }
        }
      });
    }
  }
});
