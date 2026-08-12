// pages/user/support/support.js - 联系客服
Page({
  data: {
    servicePhone: '400-000-0000',
    serviceTime: '周一至周日 9:00 - 18:00',
    faqs: [
      { q: '如何获得积分？', a: '每日三餐打卡每餐+10分，遵循饮食计划+20分，每日签到+5分，学习课程（进度达80%）+10分，邀请新朋友注册并完成首次评估+50分。' },
      { q: '积分如何使用？', a: '积分可在积分商城以"积分+现金"方式兑换商品，也可到线下服务网点由代理商核销兑换实物礼品。' },
      { q: '每月可以做几次健康评估？', a: '会员每月可免费进行1次健康评估，次月自动恢复次数。' },
      { q: '如何查看完整调理方案？', a: '完整7天调理方案请前往最近的服务网点，由专业服务商为您解读领取。' }
    ],
    openIndex: -1
  },

  callService() {
    wx.makePhoneCall({
      phoneNumber: this.data.servicePhone.replace(/-/g, ''),
      fail: () => {}
    });
  },

  toggleFaq(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      openIndex: this.data.openIndex === index ? -1 : index
    });
  }
});
