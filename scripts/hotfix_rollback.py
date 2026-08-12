import os, sys, time, paramiko
HOST=os.environ.get("SSH_HOST","111.229.190.132"); PORT=int(os.environ.get("SSH_PORT","22"))
USER=os.environ.get("SSH_USER","root"); PW=os.environ.get("SSH_PW","")
SD="/www/wwwroot/rry.klai.top"

def run(c,cmd,t=180):
    i,o,e=c.exec_command(cmd,timeout=t)
    out=o.read().decode("utf-8","replace"); err=e.read().decode("utf-8","replace")
    rc=o.channel.recv_exit_status(); return out,err,rc

c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,port=PORT,username=USER,password=PW,timeout=15,look_for_keys=False,allow_agent=False)

print("=== R1. 用 backup 镜像覆盖 compose 期望的镜像标签 ===")
out,err,rc=run(c,"docker tag ysjfxt-backend:backup-20260807 rryklaitop-backend:latest && echo TAG_OK")
print((out+err).strip())

print("=== R2. 确认 compose 已是原始版本(.env.docker) ===")
out,_,_=run(c,"grep -nE 'env_file|\\.env' "+SD+"/docker-compose.yml | head")
print(out.strip())

print("=== R3. 强制以旧镜像重建容器(不 build) ===")
out,err,rc=run(c,"cd "+SD+" && docker compose up -d --force-recreate --no-build backend 2>&1")
print((out+err).strip()[-1500:])

print("=== R4. 健康检查轮询 ===")
ok=False
for i in range(20):
    time.sleep(6)
    out,_,_=run(c,"docker inspect ysjfxt-backend --format '{{.State.Status}}|{{.State.Health.Status}}' 2>&1")
    st=out.strip()
    out2,_,_=run(c,"curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3001/api/health")
    code=out2.strip()
    print("  t=%ds state=%s http=%s" % ((i+1)*6, st, code))
    if code in ("200","304"):
        ok=True; break

print("=== R5. 外部站点 ===")
out,_,_=run(c,"curl -s -o /dev/null -w 'https=%{http_code}' --max-time 10 https://rry.klai.top/api/health")
print(out.strip())

if ok:
    print("\n[恢复成功] 站点已回到升级前健康状态")
else:
    print("\n[!! 恢复未确认] 打印最近日志:")
    out,err,_=run(c,"docker logs ysjfxt-backend --tail 30 2>&1")
    print((out+err).strip()[-3000:])

c.close()
sys.exit(0 if ok else 1)
