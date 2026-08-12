import os, sys, paramiko, secrets, time
from datetime import datetime

HOST = os.environ.get("SSH_HOST", "111.229.190.132")
PORT = int(os.environ.get("SSH_PORT", "22"))
USER = os.environ.get("SSH_USER", "root")
PW = os.environ.get("SSH_PW", "")

REMOTE_BASE = "/www/wwwroot/rry.klai.top"
SERVER_DIR = REMOTE_BASE + "/server"
BACKUP = "/root/ysjfxt_server_backup_20260807_003207.tar.gz"
PLAINTEXT_ENV = SERVER_DIR + "/.env"


def run(client, cmd, timeout=60):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    exit_code = stdout.channel.recv_exit_status()
    return out, err, exit_code


def main():
    if not PW:
        print("ERROR: SSH_PW not set"); sys.exit(2)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PW, timeout=15,
                   look_for_keys=False, allow_agent=False)
    print(f"CONNECTED -> {USER}@{HOST}:{PORT}\n")

    # 0) 当前运行环境（决定回滚时的 NODE_ENV）
    print("=== [0] 当前运行环境 ===")
    out, _, _ = run(client, "P=$(pgrep -f 'node app.js' | head -1); "
                            "echo \"RUN_PID=$P\"; "
                            "[ -n \"$P\" ] && cat /proc/$P/environ 2>/dev/null | tr '\\0' '\\n' | grep '^NODE_ENV=' ; "
                            "grep '^NODE_ENV=' " + SERVER_DIR + "/.env ; "
                            "grep -m1 '^PORT=' " + SERVER_DIR + "/.env | tr -d '\"'")
    print(out.strip())
    cur_node_env = ""
    cur_port = ""
    for line in out.splitlines():
        if line.startswith("NODE_ENV="):
            cur_node_env = line.split("=", 1)[1].strip()
        if line.startswith("PORT="):
            cur_port = line.split("=", 1)[1].strip()
    print(f"[解析] 当前 NODE_ENV={cur_node_env or '(空)'}  端口={cur_port or '(未知)'}")
    print("-" * 60)

    # 1) 生成主密钥 K1（64 hex），写入 keys/master.env（仅服务器本地，0600）
    print("=== [1] 生成主密钥并写入 keys/master.env ===")
    master_key = secrets.token_hex(32)
    run(client, f"mkdir -p {SERVER_DIR}/keys && chmod 700 {SERVER_DIR}/keys")
    sftp = client.open_sftp()
    with sftp.open(SERVER_DIR + "/keys/master.env", "w", 600) as f:
        f.write(f"VAULT_MASTER_KEY={master_key}\n")
    sftp.close()
    run(client, f"chown www:www {SERVER_DIR}/keys/master.env && chmod 600 {SERVER_DIR}/keys/master.env")
    print("主密钥已生成并写入服务器 keys/master.env（0600, www）。")
    print("⚠️ 此文件是解密 .env.enc 的唯一 K1，请另行安全备份，服务器丢失它=无法解密配置。")
    print("-" * 60)

    # 2) 加密 .env -> .env.enc（源 master.env + NODE_ENV=production）
    print("=== [2] 三重加密 .env -> .env.enc ===")
    cmd = (f"cd {SERVER_DIR} && set -a && . ./{ 'keys/master.env' } && set +a && "
           f"NODE_ENV=production node scripts/encrypt-env.js .env .env.enc")
    out, err, code = run(client, cmd, timeout=60)
    print(out.strip())
    if err.strip(): print("[stderr]", err.strip())
    if code != 0:
        print("!! 加密失败，中止（未重启）"); sys.exit(1)
    print("-" * 60)

    # 3) 验证可解密（不打印明文）
    print("=== [3] 验证 .env.enc 可还原 ===")
    cmd = (f"cd {SERVER_DIR} && set -a && . ./keys/master.env && set +a && "
           f"node scripts/decrypt-env.js .env.enc")
    out, err, code = run(client, cmd, timeout=60)
    if "解密失败" in out or "解密失败" in err:
        print("!! 解密校验出现失败项，中止（未重启）")
        print(out.strip())
        sys.exit(1)
    # 统计解密项数
    cnt = sum(1 for l in out.splitlines() if "=" in l and "解密结果" not in l)
    print(f"解密校验通过，共还原 {cnt} 项密钥，无失败项（明文不打印）。")
    print("-" * 60)

    # 4) 权限加固：keys/ 与 .env.enc 归 www，严格限权
    print("=== [4] 权限加固 ===")
    run(client, f"chown -R www:www {SERVER_DIR}/keys {SERVER_DIR}/.env.enc")
    run(client, f"chmod 700 {SERVER_DIR}/keys")
    run(client, f"chmod 600 {SERVER_DIR}/keys/master.env {SERVER_DIR}/keys/vault.key {SERVER_DIR}/keys/instance.id")
    run(client, f"chmod 640 {SERVER_DIR}/.env.enc")
    out, _, _ = run(client, f"ls -la {SERVER_DIR}/keys {SERVER_DIR}/.env.enc")
    print(out.strip())
    print("-" * 60)

    # 5) 重启（停旧 -> 起新[带主密钥] -> 健康检查；失败自动回滚）
    print("=== [5] 重启服务 ===")
    # 5a 停旧
    run(client, "pkill -TERM -f 'node app.js' 2>/dev/null; sleep 2; "
                "if pgrep -f 'node app.js' >/dev/null; then pkill -9 -f 'node app.js'; sleep 1; fi")
    # 等端口释放
    port_arg = cur_port or "3999"
    run(client, f"for i in $(seq 1 10); do ss -tlnp 2>/dev/null | grep -q ':{port_arg} ' && sleep 1 || break; done")
    # 5b 起新（setsid 彻底脱离会话，避免 SSH 关闭时被 SIGHUP）
    start_cmd = (f"su -s /bin/bash www -c 'cd {SERVER_DIR} && set -a && . ./keys/master.env && set +a && "
                 f"setsid env NODE_ENV=production node app.js >> logs/startup.log 2>&1 < /dev/null &'")
    run(client, start_cmd)
    time.sleep(4)
    out, _, _ = run(client, "pgrep -af 'node app.js'")
    print("新进程:", out.strip() or "(未检测到)")
    # 5c 健康检查
    health = False
    for i in range(20):
        out, _, _ = run(client, f"curl -s -m 5 -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{port_arg}/api/health/live")
        code = out.strip()
        if code == "200":
            health = True
            break
        time.sleep(1)
    print(f"[健康检查 /api/health/live] HTTP={code}")
    if not health:
        # 回滚
        print("!! 健康检查失败，执行回滚（恢复旧源码并重载）...")
        run(client, f"cd {REMOTE_BASE} && tar xzf {BACKUP} server/ 2>/dev/null; "
                    f"pkill -9 -f 'node app.js' 2>/dev/null; sleep 1; "
                    f"su -s /bin/bash www -c 'cd {SERVER_DIR} && setsid env NODE_ENV={cur_node_env or 'production'} node app.js >> logs/startup.log 2>&1 < /dev/null &'")
        time.sleep(4)
        out, _, _ = run(client, f"curl -s -m 5 -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{port_arg}/api/health/live")
        print(f"[回滚后健康检查] HTTP={out.strip()}")
        print("已回滚到部署前状态，明文 .env 保留。请检查 logs/startup.log。")
        client.close()
        sys.exit(1)
    print("健康检查通过 ✅")
    print("-" * 60)

    # 6) 删除明文 .env（.env.enc 已验证可用；tar 备份仍可恢复）
    print("=== [6] 删除明文 .env ===")
    run(client, f"rm -f {PLAINTEXT_ENV}")
    out, _, _ = run(client, f"(test -f {PLAINTEXT_ENV} && echo '明文 .env: 仍存在!!' || echo '明文 .env: 已删除'); "
                            f"ls -la {SERVER_DIR}/.env.enc >/dev/null 2>&1 && echo '.env.enc: 就位' || echo '.env.enc: 缺失'")
    print(out.strip())
    print("=" * 60)
    print("🎉 升级完成：三重加密已激活，明文凭据已从服务器移除。")
    print(f"备份(含明文 .env)仍位于 {BACKUP} —— 上线稳定后请妥善处置该明文备份。")
    print("⚠️ 务必另行离线备份 keys/master.env（K1），否则服务器损坏将导致 .env.enc 无法解密。")
    client.close()


if __name__ == "__main__":
    main()
