// 插入违禁词测试数据
require('dotenv').config();
const db = require('../models');

const WORDS = [
  {
    pattern: '确诊',
    message: '禁止使用"确诊"等医疗诊断用语',
    category: 'diagnosis',
    status: 'active',
    note: '医疗合规红线：系统不能替代医生进行诊断'
  },
  {
    pattern: '治愈.{0,5}(?:病|症|炎|癌|瘤)',
    message: '禁止承诺治愈疾病',
    category: 'promise',
    status: 'active',
    note: '医疗合规红线：不能承诺治疗效果'
  },
  {
    pattern: '服用.{0,5}(?:药|片|胶囊|颗粒|口服液)',
    message: '禁止推荐或暗示使用药物',
    category: 'treatment',
    status: 'active',
    note: '医疗合规红线：不能推荐用药方案'
  }
];

async function main() {
  for (const w of WORDS) {
    const [r, created] = await db.ForbiddenWord.findOrCreate({
      where: { pattern: w.pattern, category: w.category },
      defaults: w
    });
    console.log(created ? `✅ 创建: ${w.pattern}` : `⏭️ 已存在: ${w.pattern}`);
  }
  const total = await db.ForbiddenWord.count();
  console.log(`\n违禁词总数: ${total}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
