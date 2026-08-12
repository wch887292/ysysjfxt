/**
 * 图标使用情况扫描工具
 *
 * 用途：比对 src 下实际用到的 Element Plus 图标 与 src/plugins/icons.js 已登记的图标，
 * 输出「缺失」（用了但没注册，运行时会空白）和「冗余」（注册了但没用到，白占体积）。
 *
 * 用法：在 admin-web 目录下执行
 *   node scripts/scan-icons.mjs
 *
 * 说明：扫描采用全词匹配，可能把同名普通标识符（如变量 Search）误判为图标使用，
 * 属于"宁多勿少"的安全偏差，不会导致漏注册。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'src')
const registryFile = path.join(srcDir, 'plugins', 'icons.js')

const iconsModule = await import('@element-plus/icons-vue')
const allNames = Object.keys(iconsModule).filter(k => k !== 'default' && /^[A-Z]/.test(k))

const files = []
;(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(vue|js|ts)$/.test(entry.name) && full !== registryFile) files.push(full)
  }
})(srcDir)

const text = files.map(f => fs.readFileSync(f, 'utf8')).join('\n')
const used = allNames.filter(n => new RegExp(`\\b${n}\\b`).test(text))

const { registeredIconNames } = await import(pathToFileUrl(registryFile))
const missing = used.filter(n => !registeredIconNames.includes(n))
const unused = registeredIconNames.filter(n => !used.includes(n))

console.log(`可用图标总数: ${allNames.length}`)
console.log(`源码实际使用: ${used.length}`)
console.log(`已注册: ${registeredIconNames.length}`)
console.log(missing.length ? `\n[缺失-需补充注册] ${missing.join(', ')}` : '\n[缺失] 无')
console.log(unused.length ? `[冗余-可移除] ${unused.join(', ')}` : '[冗余] 无')

if (missing.length) process.exitCode = 1

function pathToFileUrl(p) {
  return new URL(`file:///${p.replace(/\\/g, '/')}`).href
}
