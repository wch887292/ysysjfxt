// app.js

// 环境配置：开发环境用本地IP，生产环境用正式域名
// 关键：__wxConfig 仅在开发者工具中存在，生产环境为 undefined
// 因此默认值设为 'release'，确保正式包始终指向生产域名
const _envVersion = (__wxConfig && __wxConfig.envVersion) || 'release';
const CONFIG = {
  develop: {
    baseUrl: 'https://rry.klai.top/api',
    staticUrl: 'https://rry.klai.top/static'
  },
  trial: {
    baseUrl: 'https://rry.klai.top/api',
    staticUrl: 'https://rry.klai.top/static'
  },
  release: {
    baseUrl: 'https://rry.klai.top/api',
    staticUrl: 'https://rry.klai.top/static'
  }
};
const currentConfig = CONFIG[_envVersion] || CONFIG.release;

const logger = require('./utils/logger.js');
const { hasAgreedPrivacy } = require('./utils/privacy.js');

App({
  globalData: {
    userInfo: null,
    userRole: 'user', // user, agent, admin
    pendingShareCode: null,
    pendingReferrerId: null,
    launchStartTime: Date.now(),
    baseUrl: currentConfig.baseUrl,
    staticUrl: currentConfig.staticUrl,
    env: _envVersion,
    pointsRules: {
      healthyMeal: 10,
      vegetable: 5,
      fruit: 3,
      water: 2,
      followPlan: 20
    },
    // 登录就绪状态：'pending' | 'ready' | 'failed'
    loginReady: 'pending',
    _loginCallbacks: [],
    // 隐私协议状态
    privacyAgreed: false,
    showPrivacyPopup: false,
    // Token 有效期配置（7天）
    TOKEN_EXPIRES_IN: 7 * 24 * 60 * 60 * 1000
  },

  onLaunch(options) {
    // 初始化日志系统（必须在最前，确保后续错误都能被捕获）
    logger.initLogger();

    // 初始化网络状态检测
    const { initNetworkStatus } = require('./utils/request.js');
    initNetworkStatus();

    // 检查隐私协议状态（仅记录状态，不操作页面）
    this.globalData.privacyAgreed = hasAgreedPrivacy();
    if (!this.globalData.privacyAgreed) {
      this.globalData.showPrivacyPopup = true;
    }

    // 解析启动参数中的分享码与推荐人ID
    this.parseShareParams(options);

    // 只有同意隐私协议后才执行登录
    if (this.globalData.privacyAgreed) {
      this.checkLoginStatus();
    } else {
      // 等待用户同意隐私协议后再登录
      this.globalData._privacyCallbacks = this.globalData._privacyCallbacks || [];
      this.globalData._privacyCallbacks.push(() => {
        this.checkLoginStatus();
      });
    }

    // 预热网络，提前建立网络连接，减少首页数据请求延迟
    wx.getNetworkType();

    logger.writeLog('app_launch', {
      env: this.globalData.env,
      scene: options.scene,
      referrerInfo: options.referrerInfo ? 'yes' : 'no',
      privacyAgreed: this.globalData.privacyAgreed
    });
  },

  // 用户同意隐私协议后的回调
  onPrivacyAgreed() {
    this.globalData.privacyAgreed = true;
    this.globalData.showPrivacyPopup = false;

    // 执行等待中的登录回调
    const callbacks = this.globalData._privacyCallbacks || [];
    this.globalData._privacyCallbacks = [];
    callbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error('隐私协议回调执行失败:', e); }
    });
  },

  // 解析分享参数
  parseShareParams(options = {}) {
    const query = options.query || {};
    if (query.shareCode) {
      this.globalData.pendingShareCode = query.shareCode;
    }
    if (query.referrerId) {
      this.globalData.pendingReferrerId = query.referrerId;
    }
    // 支持场景值解析（如扫码进入）
    if (options.scene) {
      this.globalData.launchScene = options.scene;
    }
  },

  // 检查登录状态（含 token 过期检查）
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    const tokenExpireAt = wx.getStorageSync('token_expire_at');

    if (userInfo && token) {
      // 检查 token 是否过期
      if (tokenExpireAt && Date.now() > tokenExpireAt) {
        console.log('[checkLoginStatus] token 已过期，清除本地存储并重新登录');
        this.clearAuthStorage();
        this.login({
          shareCode: this.globalData.pendingShareCode,
          referrerId: this.globalData.pendingReferrerId
        });
        return;
      }

      this.globalData.userInfo = userInfo;
      this.validateToken(token);
    } else {
      this.login({
        shareCode: this.globalData.pendingShareCode,
        referrerId: this.globalData.pendingReferrerId
      });
    }
  },

  // 清除本地认证存储（退出登录/token 过期时调用）
  clearAuthStorage() {
    try {
      wx.removeStorageSync('token');
      wx.removeStorageSync('token_expire_at');
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('questionnaire_draft');
    } catch (e) {
      console.error('清除存储失败:', e);
    }
  },

  // 退出登录
  logout() {
    this.clearAuthStorage();
    this.globalData.userInfo = null;
    this.globalData.userRole = 'user';
    this.globalData.loginReady = 'pending';
    this.globalData._loginCallbacks = [];
    this.globalData._loginInProgress = false;
    console.log('[logout] 已退出登录');
  },

  // 登录就绪回调（页面 onLoad 调用，确保登录完成后再加载数据）
  // 修复：原代码仅处理 'ready' 状态，'failed' 状态时回调被 push 进数组但永不会触发，
  // 导致从失败状态恢复的页面在用户未主动操作前一直无响应
  onLoginReady(callback) {
    if (this.globalData.loginReady === 'ready') {
      callback();
    } else if (this.globalData.loginReady === 'failed') {
      // 登录已失败，立即以 error 通知调用方，避免页面永久卡在"加载中"
      callback(new Error('登录失败'));
    } else {
      this.globalData._loginCallbacks.push(callback);
    }
  },

  // 触发登录就绪回调
  _triggerLoginReady() {
    this.globalData.loginReady = 'ready';
    this.globalData._loginAttempts = 0; // 重置登录尝试次数
    console.log('[perf] 登录就绪耗时:', Date.now() - this.globalData.launchStartTime, 'ms');
    const callbacks = this.globalData._loginCallbacks;
    this.globalData._loginCallbacks = [];
    callbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error('登录就绪回调执行失败:', e); }
    });
  },

  // P1 修复：登录失败时也要通知等待的页面，避免永久卡在"加载中"
  _failLoginReady() {
    this.globalData.loginReady = 'failed';
    this.globalData._loginAttempts = 0; // 重置登录尝试次数
    const callbacks = this.globalData._loginCallbacks;
    this.globalData._loginCallbacks = [];
    callbacks.forEach(cb => {
      try { cb(new Error('登录失败')); } catch (e) { console.error('登录失败回调执行异常:', e); }
    });
  },

  // 用户登录
  login(options = {}) {
    // 防止重复调用 login
    if (this.globalData._loginInProgress) {
      console.warn('登录已在进行中，跳过重复调用');
      return;
    }

    // 防止无限重试：最多3次登录尝试
    this.globalData._loginAttempts = (this.globalData._loginAttempts || 0) + 1;
    if (this.globalData._loginAttempts > 3) {
      console.error('登录尝试次数超限（3次），停止重试');
      this._failLoginReady();
      this.globalData._loginAttempts = 0;
      return;
    }

    this.globalData._loginInProgress = true;

    // 关键：重置为 pending，清除上一次失败留下的 'failed' 状态。
    // 否则用户点击"重试登录"时，随后注册的 onLoginReady 会命中 failed 分支被同步立即回调，
    // 页面瞬间弹出"登录失败"，而这次真正发起的登录结果已无人监听。
    this.globalData.loginReady = 'pending';

    wx.showLoading({ title: '登录中...' });
    this.globalData._loadingShown = true;

    // 从启动参数或页面参数中获取分享码与推荐人ID
    const shareCode = options.shareCode || this.globalData.pendingShareCode || null;
    const referrerId = options.referrerId || this.globalData.pendingReferrerId || null;

    wx.login({
      success: (res) => {
        if (res.code) {
          // 发送 code 到后台换取 openid 和 token
          this.requestLogin(res.code, shareCode, referrerId);
        } else {
          console.error('登录失败！' + res.errMsg);
          this._endLogin();
          this._failLoginReady();
        }
      },
      fail: (err) => {
        console.error('wx.login 调用失败', err);
        this._endLogin();
        this._failLoginReady();
      }
    });
  },

  // 结束登录流程，清理 loading 状态
  _endLogin() {
    this.globalData._loginInProgress = false;
    // 防止 showLoading/hideLoading 错配：仅在确有 loading 显示时才收回，
    // 避免业务错误→回退重试路径里出现「两次 hideLoading 对应一次 showLoading」的告警
    if (this.globalData._loadingShown) {
      wx.hideLoading();
      this.globalData._loadingShown = false;
    }
  },

  // 请求后台登录接口
  requestLogin(code, shareCode, referrerId) {
    const _doRequest = (url) => {
      wx.request({
        url: `${url}/auth/login`,
        method: 'POST',
        data: { code, shareCode, referrerId },
        success: (res) => {
          if (res.data.success) {
            const { token, userInfo } = res.data.data;
            this.globalData.userInfo = userInfo;
            this.globalData.userRole = userInfo.role || 'user';
            wx.setStorageSync('token', token);
            wx.setStorageSync('userInfo', userInfo);
            // 保存 token 过期时间（默认 7 天，使用后端返回的 expiresIn 或配置值）
            const expiresIn = (res.data.data && res.data.data.expiresIn) || this.globalData.TOKEN_EXPIRES_IN;
            wx.setStorageSync('token_expire_at', Date.now() + expiresIn);
            console.log('登录成功', userInfo.nickName || userInfo.nick_name);
            this._endLogin();
            this._triggerLoginReady();
          } else {
            const errMsg = res.data.message || '登录失败';
            console.warn('登录失败:', errMsg);

            // 显示后端返回的具体错误信息给用户
            wx.showModal({
              title: '登录失败',
              content: errMsg,
              showCancel: false,
              confirmText: '知道了'
            });

            // 业务错误（如分享码无效等）也尝试回退到生产环境
            if (_envVersion === 'develop' && !this.globalData._fallbackTriggered && url === CONFIG.develop.baseUrl) {
              this.globalData._fallbackTriggered = true;
              this.globalData.baseUrl = CONFIG.release.baseUrl;
              this.globalData.staticUrl = CONFIG.release.staticUrl;
              _doRequest(CONFIG.release.baseUrl);
            } else {
              this._failLoginReady();
            }
          }
        },
        fail: (err) => {
          const errMsg = (err && err.errMsg) || '';

          // 域名白名单校验失败：不重试，直接提示
          if (errMsg.indexOf('not in domain list') !== -1) {
            wx.showModal({
              title: '域名未配置',
              content: '请求域名不在微信小程序合法域名列表中。\n\n开发调试：在开发者工具→设置→项目设置→安全中勾选「不校验合法域名」。\n\n上线发布：登录 mp.weixin.qq.com→开发→开发设置→服务器域名，添加 rry.klai.top',
              showCancel: false,
              confirmText: '知道了'
            });
            this._endLogin();
            this._failLoginReady();
            return;
          }

          // 开发环境 + 首次失败 → 自动回退到生产域名
          if (_envVersion === 'develop' && !this.globalData._fallbackTriggered && url === CONFIG.develop.baseUrl) {
            this.globalData._fallbackTriggered = true;
            this.globalData.baseUrl = CONFIG.release.baseUrl;
            this.globalData.staticUrl = CONFIG.release.staticUrl;
            wx.showToast({ title: '本地服务不可达，已切换到线上', icon: 'none', duration: 2000 });
            // 用生产域名重试一次
            _doRequest(CONFIG.release.baseUrl);
          } else {
            console.error('登录请求失败', err);
            this._endLogin();
            this._failLoginReady();
          }
        }
      });
    };

    _doRequest(this.globalData.baseUrl);
  },

  // 验证 token 有效性
  validateToken(token) {
    // 开发环境下先尝试，如果本地服务不可达，自动回退到线上服务
    wx.request({
      url: `${this.globalData.baseUrl}/auth/validate`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (_envVersion === 'develop') {
          console.log('[validateToken] 响应状态:', res.statusCode);
        }
        if (!res.data.success) {
          // token 失效,重新登录（但要防止循环）
          console.log('[validateToken] token失效，重新登录');
          this.login({ forceRefresh: true });
        } else {
          if (_envVersion === 'develop') {
            console.log('[validateToken] token有效，角色:', res.data.data.role);
          }
          this.globalData.userRole = res.data.data.role;
          this.globalData.userInfo = res.data.data;
          this._triggerLoginReady();
        }
      },
      fail: (err) => {
        console.error('[validateToken] 请求失败:', err);
        const errMsg = (err && err.errMsg) || '';

        // 域名白名单校验失败：给出明确指引
        if (errMsg.indexOf('not in domain list') !== -1) {
          wx.showModal({
            title: '域名未配置',
            content: '请求域名不在微信小程序合法域名列表中。\n\n开发调试：在开发者工具→设置→项目设置→安全中勾选「不校验合法域名」。\n\n上线发布：登录 mp.weixin.qq.com→开发→开发设置→服务器域名，添加 rry.klai.top',
            showCancel: false,
            confirmText: '知道了'
          });
          this._failLoginReady();
          return;
        }

        // 开发环境下网络不可达 → 自动回退到生产域名
        if (_envVersion === 'develop' && !this.globalData._fallbackTriggered) {
          this.globalData._fallbackTriggered = true;
          const releaseConfig = CONFIG.release;
          this.globalData.baseUrl = releaseConfig.baseUrl;
          this.globalData.staticUrl = releaseConfig.staticUrl;
          wx.showToast({ title: '本地服务不可达，已切换到线上', icon: 'none', duration: 2000 });
          // 回退后用生产域名重新验证
          wx.request({
            url: `${releaseConfig.baseUrl}/auth/validate`,
            method: 'GET',
            header: { 'Authorization': `Bearer ${token}` },
            success: (res2) => {
              if (res2.data && res2.data.success) {
                this.globalData.userRole = res2.data.data.role;
                this.globalData.userInfo = res2.data.data;
                this._triggerLoginReady();
              } else {
                // 生产服务器也不认识这个 token（本地 token 无法在生产环境验证）
                // → 清除旧 token，用生产域名重新走 wx.login → /auth/login 流程
                console.log('[validateToken] 生产环境 token 无效，重新登录');
                wx.removeStorageSync('token');
                wx.removeStorageSync('userInfo');
                const errMsg = (res2.data && res2.data.message) || 'token 已失效';
                wx.showToast({ title: errMsg, icon: 'none', duration: 2000 });
                this.login({ forceRefresh: true, shareCode: this.globalData.pendingShareCode, referrerId: this.globalData.pendingReferrerId });
              }
            },
            fail: () => {
              // 生产服务器也不可达 → 彻底失败
              this._failLoginReady();
            }
          });
        } else {
          // 非开发环境 或 已尝试回退 → 标记失败，不再重试
          this._failLoginReady();
        }
      }
    });
  },

  // 获取用户信息
  getUserInfo() {
    return new Promise((resolve) => {
      if (this.globalData.userInfo) {
        resolve(this.globalData.userInfo);
      } else {
        const cached = wx.getStorageSync('userInfo');
        if (cached) {
          this.globalData.userInfo = cached;
        }
        resolve(cached || null);
      }
    });
  }
});