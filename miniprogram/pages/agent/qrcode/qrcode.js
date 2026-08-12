// pages/agent/qrcode/qrcode.js - 代理商拉新二维码
const { agentAPI } = require('../../../utils/api');
const app = getApp();

Page({
  data: {
    shareCode: '',
    qrImageUrl: '',
    loading: true
  },

  onLoad() {
    app.onLoginReady(() => {
      this.loadShareData();
    });
  },

  onShow() {
    if (app.globalData.loginReady === 'ready') {
      this.loadShareData();
    }
  },

  loadShareData() {
    this.setData({ loading: true });
    agentAPI.getShareCode().then(res => {
      const d = res.data || {};
      this.setData({
        shareCode: d.shareCode || '',
        qrImageUrl: d.qrImageUrl || '',
        loading: false
      });
      // 若后端未直接返回小程序码图片，则调用云函数生成
      if (!d.qrImageUrl && d.shareCode) {
        this.generateQrCode(d.shareCode);
      }
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '获取分享码失败', icon: 'none' });
    });
  },

  generateQrCode(shareCode) {
    wx.cloud.callFunction({
      name: 'getMiniProgramCode',
      data: {
        scene: shareCode,
        page: 'pages/user/home/home'
      }
    }).then(res => {
      if (res.result && res.result.fileID) {
        // 云函数返回云文件ID，获取临时链接
        wx.cloud.getTempFileURL({
          fileList: [res.result.fileID]
        }).then(fileRes => {
          if (fileRes.fileList && fileRes.fileList.length > 0) {
            this.setData({ qrImageUrl: fileRes.fileList[0].tempFileURL });
          }
        });
      } else if (res.result && res.result.buffer) {
        // 云函数返回buffer，写入临时文件
        const fs = wx.getFileSystemManager();
        const filePath = `${wx.env.USER_DATA_PATH}/agent_qr_${shareCode}.png`;
        fs.writeFile({
          filePath,
          data: res.result.buffer,
          encoding: 'base64',
          success: () => {
            this.setData({ qrImageUrl: filePath });
          }
        });
      }
    }).catch(() => {
      wx.showToast({ title: '二维码生成失败', icon: 'none' });
    });
  },

  saveToAlbum() {
    const qrImageUrl = this.data.qrImageUrl;
    if (!qrImageUrl) {
      wx.showToast({ title: '二维码尚未生成', icon: 'none' });
      return;
    }

    wx.getSetting({
      success: (settingRes) => {
        if (settingRes.authSetting['scope.writePhotosAlbum'] === false) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存到相册',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting();
              }
            }
          });
          return;
        }
        this.doSaveImage(qrImageUrl);
      }
    });
  },

  doSaveImage(url) {
    // 若为网络图片，先下载再保存
    if (url.startsWith('http')) {
      wx.downloadFile({
        url,
        success: (downloadRes) => {
          if (downloadRes.statusCode === 200) {
            wx.saveImageToPhotosAlbum({
              filePath: downloadRes.tempFilePath,
              success: () => {
                wx.showToast({ title: '已保存到相册', icon: 'success' });
              },
              fail: () => {
                wx.showToast({ title: '保存失败', icon: 'none' });
              }
            });
          }
        }
      });
    } else {
      wx.saveImageToPhotosAlbum({
        filePath: url,
        success: () => {
          wx.showToast({ title: '已保存到相册', icon: 'success' });
        },
        fail: () => {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      });
    }
  },

  onShareAppMessage() {
    const shareCode = this.data.shareCode;
    const path = shareCode
      ? `/pages/user/home/home?agentCode=${shareCode}`
      : '/pages/user/home/home';
    return {
      title: '健康饮食积分 - 扫码加入，一起记录健康',
      path
    };
  }
});
