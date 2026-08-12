// 全局常量配置
// 适老化设计常量（规格7.1）
export const FONT = {
  MIN: 18,        // 最小字体 18px
  TITLE: 24,      // 标题最小 24px
  BODY: 18,       // 正文 18px
  SMALL: 16,      // 辅助文字 16px
  LINE_HEIGHT: 1.8, // 行高 1.8倍
};

export const BUTTON = {
  MIN_HEIGHT: 48,   // 最小按钮高度 48px
  MIN_WIDTH: 44,    // 最小点击区域 44pt
  GAP: 16,          // 按钮间距 16px
};

export const COLORS = {
  PRIMARY: '#4CAF50',
  PRIMARY_DARK: '#388E3C',
  PRIMARY_LIGHT: '#C8E6C9',
  SECONDARY: '#FF9800',
  DANGER: '#F44336',
  WARNING: '#FF9800',
  INFO: '#2196F3',
  SUCCESS: '#4CAF50',
  BG: '#F5F7FA',
  WHITE: '#FFFFFF',
  TEXT: '#303133',
  TEXT_SECONDARY: '#606266',
  TEXT_PLACEHOLDER: '#909399',
  BORDER: '#DCDFE6',
  CARD_BG: '#FFFFFF',
  DISABLED: '#C0C4CC',
};

// 角色与首页映射
export const ROLE_HOME = {
  user: 'UserHome',
  member: 'UserHome',
  agent: 'AgentDashboard',
  service_provider: 'SpDashboard',
  admin: 'AdminDashboard',
};

// 角色标签
export const ROLE_LABEL = {
  user: '用户',
  member: '会员',
  agent: '代理商',
  service_provider: '服务商',
  admin: '管理员',
};

// 餐食类型
export const MEAL_TYPES = [
  { key: 'staple', label: '主食', icon: '🍚' },
  { key: 'vegetable', label: '蔬菜', icon: '🥬' },
  { key: 'meat', label: '肉类', icon: '🥩' },
  { key: 'milk', label: '奶', icon: '🥛' },
  { key: 'egg', label: '蛋', icon: '🥚' },
  { key: 'fruit', label: '水果', icon: '🍎' },
  { key: 'noodle', label: '面食', icon: '🍜' },
  { key: 'porridge', label: '粥', icon: '🥣' },
  { key: 'other', label: '其他', icon: '🍲' },
  { key: 'photo', label: '拍照', icon: '📷' },
];

// 荣誉等级
export const HONOR_LEVELS = {
  newcomer: '健康新人',
  expert: '健康达人',
  star: '健康之星',
  ambassador: '健康大使',
  messenger: '健康信使',
};