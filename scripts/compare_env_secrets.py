# -*- coding: utf-8 -*-
"""
对比 .env 与历史备份文件的字段差异（仅输出字段名与是否一致，绝不打印明文值）。
用途：判断磁盘上的明文凭据备份是否仍包含当前生效的密钥。
"""
import hashlib
import os
import sys

SENSITIVE_HINTS = ('SECRET', 'PASSWORD', 'KEY', 'TOKEN', 'AES', 'SALT', 'PRIVATE')


def load(path):
    data = {}
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            data[k.strip()] = v.strip()
    return data


def fp(v):
    """指纹：仅取 sha256 前 8 位，用于判断是否相同，无法反推原值。"""
    return hashlib.sha256(v.encode('utf-8')).hexdigest()[:8] if v else '(empty)'


def is_sensitive(k):
    return any(h in k.upper() for h in SENSITIVE_HINTS)


def main():
    cur = load(sys.argv[1])
    bak = load(sys.argv[2])
    if cur is None or bak is None:
        print('文件不存在')
        return

    print('当前 .env 字段数: %d，备份文件字段数: %d\n' % (len(cur), len(bak)))
    same_secrets = []
    diff_secrets = []
    only_in_backup = []

    for k, v in bak.items():
        if k not in cur:
            only_in_backup.append(k)
            continue
        if not is_sensitive(k):
            continue
        if fp(v) == fp(cur[k]):
            same_secrets.append(k)
        else:
            diff_secrets.append(k)

    print('[仍与当前生效值完全一致的敏感字段] (%d 个 —— 泄露即等同于当前密钥泄露)' % len(same_secrets))
    for k in same_secrets:
        print('  - %s  fp=%s' % (k, fp(bak[k])))
    print('\n[已轮换/不一致的敏感字段] (%d 个 —— 备份中为历史旧值)' % len(diff_secrets))
    for k in diff_secrets:
        print('  - %s' % k)
    print('\n[仅存在于备份、当前 .env 已移除的字段] (%d 个)' % len(only_in_backup))
    for k in only_in_backup:
        print('  - %s%s' % (k, '  <敏感>' if is_sensitive(k) else ''))


if __name__ == '__main__':
    main()
