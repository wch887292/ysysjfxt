import os, sys, paramiko, socket

HOST = os.environ.get("SSH_HOST", "111.229.190.132")
PORT = int(os.environ.get("SSH_PORT", "22"))
USER = os.environ.get("SSH_USER", "root")
PW = os.environ.get("SSH_PW", "")

TARGET = "/www/wwwroot/rry.klai.top"

CMDS = [
    ("=== 目标目录结构 ===", f"ls -la {TARGET}"),
    ("=== server 子目录 ===", f"ls {TARGET}/server 2>/dev/null | head -40"),
    ("=== package.json (name/version/main) ===",
     f"grep -E '\"name\"|\"version\"|\"main\"' {TARGET}/package.json 2>/dev/null"),
    ("=== node / pm2 / npm 版本 ===", "node -v; pm2 -v 2>/dev/null; npm -v"),
    ("=== PM2 运行进程 ===", "pm2 list 2>/dev/null; echo '--- jlist(trunc) ---'; pm2 jlist 2>/dev/null | head -c 1500"),
    ("=== 监听端口 ===",
     "ss -tlnp 2>/dev/null | grep -E ':80 |:443 |:3999 |:22 ' ; echo '--- netstat fallback ---'; netstat -tlnp 2>/dev/null | grep -E ':80|:443|:3999'"),
    ("=== 磁盘 /www ===", "df -h /www 2>/dev/null; echo '--- 目录大小 ---'; du -sh %s 2>/dev/null" % TARGET),
    ("=== .env 字段名(不打印值) ===",
     f"grep -oE '^[A-Z_]+=' {TARGET}/server/.env 2>/dev/null | sed 's/=$//' | sort -u || echo 'NO .env'"),
    ("=== 是否已存在 .env.enc ===",
     f"ls -la {TARGET}/server/.env.enc 2>/dev/null && echo 'EXISTS' || echo 'NOT_EXISTS'"),
    ("=== app.js 是否已含 loadVaultEnv(三重加密) ===",
     f"grep -n 'loadVaultEnv' {TARGET}/server/app.js 2>/dev/null && echo 'DEPLOYED' || echo 'NOT_DEPLOYED'"),
    ("=== secretVault 模块是否存在 ===",
     f"ls -la {TARGET}/server/utils/secretVault.js 2>/dev/null && echo 'EXISTS' || echo 'NOT_EXISTS'"),
    ("=== 已部署代码 git 状态 ===",
     f"cd {TARGET} && git log --oneline -3 2>/dev/null; echo '--- status ---'; git status -s 2>/dev/null | head"),
    ("=== 进程快照 ===",
     "ps aux | grep -E 'node|pm2|nginx|mysql' | grep -v grep | head -20"),
    ("=== 系统/面板线索 ===",
     "ls /www/server/panel/vhost/nginx/ 2>/dev/null | head; echo '---'; cat /etc/os-release 2>/dev/null | head -3"),
]

def run(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return out, err

def main():
    if not PW:
        print("ERROR: SSH_PW env var not set"); sys.exit(2)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PW, timeout=15,
                   look_for_keys=False, allow_agent=False)
    print(f"CONNECTED -> {USER}@{HOST}:{PORT}\n")
    for title, cmd in CMDS:
        print(title)
        try:
            out, err = run(client, cmd)
            print(out.rstrip())
            if err.strip():
                print("[stderr]", err.strip())
        except Exception as e:
            print(f"[CMD ERROR] {e}")
        print("-" * 60)
    client.close()
    print("\nDONE (read-only inspection, no writes performed)")

if __name__ == "__main__":
    main()
