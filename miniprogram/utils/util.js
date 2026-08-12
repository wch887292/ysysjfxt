// utils/util.js - 工具函数

/**
 * 格式化时间
 */
function formatTime(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return `${[year, month, day].map(formatNumber).join('-')} ${[hour, minute, second].map(formatNumber).join(':')}`;
}

function formatNumber(n) {
  n = n.toString();
  return n[1] ? n : `0${n}`;
}

/**
 * 格式化日期
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * 防抖函数
 */
function debounce(fn, delay = 500) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 */
function throttle(fn, delay = 500) {
  let last = 0;
  return function(...args) {
    const now = Date.now();
    if (now - last > delay) {
      last = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 深拷贝
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }

  if (obj instanceof Object) {
    const copy = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        copy[key] = deepClone(obj[key]);
      }
    }
    return copy;
  }
}

/**
 * 检查手机号格式
 */
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 检查邮箱格式
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * 获取今天的日期字符串
 */
function getToday() {
  const today = new Date();
  return formatDate(today);
}

/**
 * 获取本周的日期范围
 */
function getWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek);
  const end = new Date(today);
  end.setDate(today.getDate() + (6 - dayOfWeek));

  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

/**
 * 获取本月的日期范围
 */
function getMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

/**
 * 计算BMI
 */
function calculateBMI(weight, height) {
  const heightM = height / 100;
  return (weight / (heightM * heightM)).toFixed(1);
}

/**
 * 根据BMI判断体型
 */
function getBMIStatus(bmi) {
  if (bmi < 18.5) {
    return { status: '偏瘦', color: '#FFA726' };
  } else if (bmi < 24) {
    return { status: '正常', color: '#4CAF50' };
  } else if (bmi < 28) {
    return { status: '偏胖', color: '#FF9800' };
  } else {
    return { status: '肥胖', color: '#F44336' };
  }
}

/**
 * 显示成功提示
 */
function showSuccess(title) {
  wx.showToast({
    title: title,
    icon: 'success',
    duration: 2000
  });
}

/**
 * 显示错误提示
 */
function showError(title) {
  wx.showToast({
    title: title,
    icon: 'none',
    duration: 3000
  });
}

/**
 * 显示加载中
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title: title,
    mask: true
  });
}

/**
 * 隐藏加载
 */
function hideLoading() {
  wx.hideLoading();
}

module.exports = {
  formatTime,
  formatDate,
  debounce,
  throttle,
  deepClone,
  isValidPhone,
  isValidEmail,
  getToday,
  getWeekRange,
  getMonthRange,
  calculateBMI,
  getBMIStatus,
  showSuccess,
  showError,
  showLoading,
  hideLoading
};