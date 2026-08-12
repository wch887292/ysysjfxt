// components/icp-footer/icp-footer.js
// ICP 备案号页脚组件（工信部要求小程序公示备案号）
Component({
  properties: {
    // 备案号，默认取项目主体备案号
    icp: {
      type: String,
      value: '闽ICP备2026010973号'
    },
    // 可选：主体名称，留空则不显示
    company: {
      type: String,
      value: ''
    },
    // 是否为 tabBar 页面（true 时底部留出导航栏高度）
    tabbar: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    // 点击复制备案号，便于用户到 beian.miit.gov.cn 核验
    onCopy() {
      const icp = this.data.icp;
      if (!icp) return;
      wx.setClipboardData({
        data: icp,
        success: () => {
          wx.showToast({
            title: '备案号已复制',
            icon: 'none',
            duration: 1500
          });
        },
        fail: () => {
          wx.showToast({
            title: '复制失败',
            icon: 'none',
            duration: 1500
          });
        }
      });
    }
  }
});
