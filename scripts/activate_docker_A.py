import os, paramiko, secrets, time
HOST=os.environ.get("SSH_HOST","111.229.190.132"); PORT=int(os.environ.get("SSH_PORT","22"))
USER=os.environ.get("SSH_USER","root"); PW=os.environ.get("SSH_PW","")
ROOT="/www/wwwroot/rry.klai.top"; SERVER=ROOT+"/server"
def run(c,cmd,t=60):
    i,o,e=c.exec_command(cmd,timeout=t); out=o.read().decode("utf-8","replace"); err=e.read().decode("utf-8","replace"); rc=o.channel.recv_exit_status(); return out,err,rc
def sftp_put(c,local,remote):
    sftp=c.open_sftp(); sftp.put(local,remote); sftp.close()

c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,port=PORT,username=USER,password=PW,timeout=15,look_for_keys=False,allow_agent=False)
print("CONNECTED", flush=True)

# A0. 清理误产物（基于主机 .env 的错误产物）+ 杀游离主机进程
print("=== A0 清理误产物 ===")
run(c,f"rm -rf {SERVER}/.env.enc {SERVER}/keys")
run(c,"pkill -f 'node app.js' 2>/dev/null; echo 'stray host node killed (if any)'")
print("done")

# A1. 捕获容器真实运行环境（最可靠来源）
print("=== A1 捕获容器有效环境 ===")
out,err,rc=run(c,"docker exec ysjfxt-backend printenv", t=30)
if rc!=0 or not out.strip():
    print("!! 捕获失败:",err); sys.exit(1)
eff_path=ROOT+"/.effective.env"
with open("/tmp/_eff.txt","w") as f: f.write(out)
sftp=c.open_sftp(); sftp.put("/tmp/_eff.txt", eff_path); sftp.close()
print(f"有效环境已写入 {eff_path} ({len(out.splitlines())} 行)")

# A2. 生成主密钥 K1 -> .env.vault (0600)
print("=== A2 生成 .env.vault (VAULT_MASTER_KEY) ===")
mk=secrets.token_hex(32)
run(c,f"echo 'VAULT_MASTER_KEY={mk}' > {ROOT}/.env.vault && chmod 600 {ROOT}/.env.vault")
print(".env.vault 已写(600)")

# A3. 生成 .env.enc + keys/ (基于有效环境；密钥落项目根 keys/ 供挂载)
print("=== A3 三重加密 .env.enc + keys/ ===")
cmd=(f"cd {ROOT} && mkdir -p {ROOT}/keys && "
     f"VAULT_KEY_FILE={ROOT}/keys/vault.key VAULT_INSTANCE_FILE={ROOT}/keys/instance.id "
     f"VAULT_MASTER_KEY={mk} NODE_ENV=production "
     f"node {SERVER}/scripts/encrypt-env.js .effective.env .env.enc")
out,err,rc=run(c,cmd,t=60)
print(out.strip()); 
if err.strip(): print("[stderr]",err.strip())
if rc!=0: print("!! 加密失败"); sys.exit(1)
run(c,f"chmod 0644 {ROOT}/.env.enc; chmod 0755 {ROOT}/keys; chmod 0644 {ROOT}/keys/*")
print("权限: .env.enc=0644, keys/=0755, keys/*=0644 (容器 node 用户可只读)")

# A4. 备份并改造 docker-compose.yml
print("=== A4 改造 docker-compose.yml ===")
run(c,f"cp {ROOT}/docker-compose.yml {ROOT}/docker-compose.yml.bak && echo backed-up")
sftp=c.open_sftp(); 
with open("/tmp/_compose.yml","w") as f: 
    f.write(sftp.open(ROOT+"/docker-compose.yml").read().decode("utf-8"))
sftp.close()
comp=open("/tmp/_compose.yml").read()
# 改动1: env_file .env.docker -> .env.vault
comp=comp.replace("    env_file:\n      - .env.docker","    env_file:\n      - .env.vault")
# 改动2: 删除 environment 中的 DB_PASSWORD 行
comp=comp.replace("      DB_PASSWORD: wch@123456\n","")
# 改动3: backend volumes 增加 .env.enc 与 keys 只读挂载
comp=comp.replace(
"    volumes:\n      # 上传文件持久化（用户打卡图片等）\n      - uploads:/app/uploads\n      # PM2 日志\n      - pm2_logs:/app/.pm2",
"    volumes:\n      # 上传文件持久化（用户打卡图片等）\n      - uploads:/app/uploads\n      # PM2 日志\n      - pm2_logs:/app/.pm2\n      # 三重加密：密文配置与密钥（只读挂载）\n      - ./.env.enc:/app/.env.enc:ro\n      - ./keys:/app/keys:ro")
open("/tmp/_compose_new.yml","w").write(comp)
sftp=c.open_sftp(); sftp.put("/tmp/_compose_new.yml", ROOT+"/docker-compose.yml"); sftp.close()
# 校验
out,err,rc=run(c,f"cd {ROOT} && docker compose config --quiet 2>&1 && echo COMPOSE_OK || echo COMPOSE_INVALID")
print("compose 校验:", out.strip())

# A5. 给当前（旧）镜像打备份标签，便于回滚
print("=== A5 旧镜像备份标签 ===")
run(c,"docker tag ysjfxt-backend ysjfxt-backend:backup-20260807 2>&1; echo tagged")
# A6. .dockerignore 排除 keys/（防重建烤入）
run(c,f"grep -q '^keys/' {ROOT}/.dockerignore || echo 'keys/' >> {ROOT}/.dockerignore; echo dockerignore_updated")

# 验证产物（不打印明文）
print("=== 验证产物 ===")
out,_,_=run(c,f"ls -la {ROOT}/.env.enc {ROOT}/.env.vault {ROOT}/keys; "
              f"echo '--- .env.enc 加密项数 ---'; "
              f"grep -c '^ENV3:' {ROOT}/.env.enc; "
              f"echo '--- .env.enc 非敏感明文行(如PORT/DB_HOST) ---'; "
              f"grep -E '^(PORT|DB_HOST|NODE_ENV)=' {ROOT}/.env.enc")
print(out.strip())
print("=" * 60)
print("阶段A完成（未重启容器）。下一步：重建镜像+重启。")
c.close()
