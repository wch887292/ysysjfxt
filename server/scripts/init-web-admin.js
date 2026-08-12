// scripts/init-web-admin.js
// 用途：初始化超级管理员账号（含登录密码）
// 运行：node scripts/init-web-admin.js
//
// 交互式输入 openid / 昵称 / 手机号 / 密码，或在命令行参数中传入：
//   node scripts/init-web-admin.js --openid=admin001 --nickName=超级管理员 --phone=13800000000 --password=Admin123456
//
// 安全说明：
// - 密码经 User 模型 beforeSave 钩子自动 bcrypt 加密，明文不入库
// - 若账号已存在则提示并退出，不会重复创建
// - 仅用于首次部署初始化，日常账号管理请走 /api/admin/accounts 接口
// - 创建的账号自动标记为超级管理员（is_super=true）
// - 超级管理员只能通过此脚本创建，API 接口无法创建 admin 账号

'use strict';
require('dotenv').config();
const db = require('../models');
const logger = require('../utils/logger');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const parts = argv[i].split('=');
    if (parts.length === 2) args[parts[0].replace(/^--/, '')] = parts[1];
  }
  return args;
}

async function prompt(readline, question) {
  return new Promise((resolve) => readline.question(question, (ans) => resolve((ans || '').trim())));
}

async function main() {
  const args = parseArgs(process.argv);
  let { openid, nickName, phone, password } = args;

  // 若命令行未传全参数，进入交互模式
  if (!openid || !nickName || !password) {
    const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n========== 初始化超级管理员账号 ==========');
    openid = openid || (await prompt(readline, '请输入登录账号(openid，如 admin001): '));
    nickName = nickName || (await prompt(readline, '请输入昵称(如 超级管理员): '));
    phone = phone || (await prompt(readline, '请输入手机号(可选，回车跳过): '));
    password = password || (await prompt(readline, '请输入登录密码(8-32位，含字母和数字): '));
    readline.close();
  }

  if (!openid || openid.length < 3) { console.error('错误：openid 至少 3 个字符'); process.exit(1); }
  if (!nickName) { console.error('错误：昵称不能为空'); process.exit(1); }
  if (!password || !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=]{8,32}$/.test(password)) {
    console.error('错误：密码强度不足，需8-32位且至少含字母和数字');
    process.exit(1);
  }
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    console.error('错误：手机号格式不合法');
    process.exit(1);
  }

  await db.sequelize.authenticate();

  const existing = await db.User.findOne({ where: { openid } });
  if (existing) {
    console.log(`\n账号 ${openid} 已存在（role=${existing.role}, status=${existing.status}）。`);
    if (!existing.password) {
      console.log('该账号尚未设置密码，正在补设密码...');
      await existing.update({ password });
      console.log('密码已设置，现在可使用该账号登录 Web 后台。');
    } else {
      console.log('该账号已有密码。如需重置密码，请通过管理员后台或直接执行 SQL 更新。');
    }
    process.exit(0);
  }

  const user = await db.User.create({
    openid,
    nick_name: nickName,
    phone: phone || null,
    password,  // beforeSave 钩子自动加密
    role: 'admin',
    is_super: true,  // 超级管理员：仅通过此脚本设置
    identity_type: 'user',  // admin 映射为 user
    status: 'active'
  });

  console.log(`\n✅ 超级管理员账号创建成功：`);
  console.log(`   账号(openid): ${user.openid}`);
  console.log(`   昵称: ${user.nick_name}`);
  console.log(`   角色: ${user.role}`);
  console.log(`   超级管理员: ${user.is_super ? '是' : '否'}`);
  console.log(`   用户ID: ${user.id}`);
  console.log(`\n现在可以使用此账号登录 Web 后台（/api/auth/web-login 接口）。`);
  console.log(`注意：超级管理员密码仅可通过本脚本重置，API 接口无法修改。`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('初始化管理员账号失败:', err);
  console.error('初始化失败:', err.message);
  process.exit(1);
});
