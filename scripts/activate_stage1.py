import os, sys, paramiko, socket
from datetime import datetime

HOST = os.environ.get("SSH_HOST", "111.229.190.132")
PORT = int(os.environ.get("SSH_PORT", "22"))
USER = os.environ.get("SSH_USER", "root")
PW = os.environ.get("SSH_PW", "")

LOCAL_BASE = r"H:\ysjfxt\server"
REMOTE_BASE = "/www/wwwroot/rry.klai.top/server"

# 相对路径：本地 server/X -> 远程 server/X
FILES = [
    "app.js",
    "routes/admin.js",
    "routes/auth.js",
    "middleware/bruteForce.js",
    "middleware/fail2ban.js",
    "routes/course.js",
    "routes/points.js",
    "routes/gift.js",
    "routes/service-provider.js",
    "utils/distributedLock.js",
    "utils/secretVault.js",
    "ecosystem.production.config.js",
    "scripts/encrypt-env.js",
    "scripts/decrypt-env.js",
    "scripts/verify_vault.js",
]

PLAINTEXT_BACKUP = "/www/wwwroot/rry.klai.top/server/- 副本20260729.env.txt"


def run(client, cmd, timeout=60):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    exit_code = stdout.channel.recv_exit_status()
    return out, err, exit_code


def main():
    if not PW:
        print("ERROR: SSH_PW not set"); sys.exit(2)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"/root/ysjfxt_server_backup_{ts}.tar.gz"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PW, timeout=15,
                   look_for_keys=False, allow_agent=False)
    print(f"CONNECTED -> {USER}@{HOST}:{PORT}\n")

    # 1) 备份当前 server/
    print("=== [1/4] 备份当前 server/ ===")
    out, err, code = run(client,
        f"cd /www/wwwroot/rry.klai.top && tar czf {backup_path} --exclude=server/node_modules --exclude=server/logs server/ && chmod 600 {backup_path} && ls -lh {backup_path}")
    print(out.strip()); 
    if err.strip(): print("[stderr]", err.strip())
    if code != 0:
        print("!! 备份失败，中止"); sys.exit(1)
    print("-" * 60)

    # 2) 删除服务器明文凭据备份
    print("=== [2/4] 删除服务器明文凭据备份 ===")
    out, err, code = run(client, f"rm -f '{PLAINTEXT_BACKUP}' && (test -f '{PLAINTEXT_BACKUP}' && echo STILL_EXISTS || echo DELETED)")
    print(out.strip())
    print("-" * 60)

    # 3) 上传修复文件（SFTP，带大小校验）
    print("=== [3/4] SFTP 上传修复文件 ===")
    sftp = client.open_sftp()
    ok = 0
    for rel in FILES:
        local = os.path.join(LOCAL_BASE, rel)
        remote = REMOTE_BASE + "/" + rel
        if not os.path.exists(local):
            print(f"  [SKIP] 本地缺失: {local}")
            continue
        try:
            sftp.put(local, remote)
            rstat = sftp.stat(remote)
            lsize = os.path.getsize(local)
            if rstat.st_size == lsize:
                print(f"  [OK] {rel} ({lsize} bytes)")
                ok += 1
            else:
                print(f"  [MISMATCH] {rel} local={lsize} remote={rstat.st_size}")
        except Exception as e:
            print(f"  [ERR] {rel}: {e}")
    sftp.close()
    print(f"上传成功 {ok}/{len(FILES)}")
    print("-" * 60)

    # 4) 确认明文备份已删 + 新模块已就位
    print("=== [4/4] 验证 ===")
    out, _, _ = run(client,
        f"(test -f '{PLAINTEXT_BACKUP}' && echo '明文备份: 仍存在!!' || echo '明文备份: 已删除'); "
        f"ls /www/wwwroot/rry.klai.top/server/utils/secretVault.js >/dev/null 2>&1 && echo 'secretVault.js: 已就位' || echo 'secretVault.js: 缺失'")
    print(out.strip())
    print("=" * 60)
    print("阶段一完成：仅做安全变更（备份/删明文备份/上传），未重启服务。")
    print(f"备份位置: {backup_path}（含明文 .env，请妥善保存，上线稳定后清理）")
    client.close()


if __name__ == "__main__":
    main()
