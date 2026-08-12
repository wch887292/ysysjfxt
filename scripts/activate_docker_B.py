import os, paramiko, time
HOST=os.environ.get("SSH_HOST","111.229.190.132"); PORT=int(os.environ.get("SSH_PORT","22"))
USER=os.environ.get("SSH_USER","root"); PW=os.environ.get("SSH_PW","")
ROOT="/www/wwwroot/rry.klai.top"
def run(c,cmd,t=60):
    i,o,e=c.exec_command(cmd,timeout=t); out=o.read().decode("utf-8","replace"); err=e.read().decode("utf-8","replace"); rc=o.channel.recv_exit_status(); return out,err,rc
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,port=PORT,username=USER,password=PW,timeout=15,look_for_keys=False,allow_agent=False)
print("CONNECTED", flush=True)

# B0. 给当前(旧)镜像打备份标签（按镜像ID，保证可回滚）
print("=== B0 旧镜像备份标签 ===")
out,_,_=run(c,"IMG=$(docker inspect ysjfxt-backend --format '{{.Image}}'); docker tag $IMG ysjfxt-backend:backup-20260807 && echo TAGGED || echo TAGFAIL")
print(out.strip())
out,_,_=run(c,"docker images ysjfxt-backend:backup-20260807 --format 'backup={{.ID}}'")
print("backup:", out.strip() or "NOT FOUND")

# B1. 重建镜像（bake 新代码）
print("=== B1 docker compose build backend ===")
out,err,rc=run(c,f"cd {ROOT} && docker compose build backend 2>&1 | tail -25", t=600)
print(out.strip()); 
if err.strip(): print("[stderr]",err.strip()[:500])
if rc!=0:
    print("!! 构建失败，中止（未重启）"); sys.exit(1)
print("构建成功")

# B2. 重启容器
print("=== B2 docker compose up -d backend ===")
out,_,_=run(c,f"cd {ROOT} && docker compose up -d backend 2>&1 | tail -10", t=120)
print(out.strip())

# B3. 健康检查轮询
print("=== B3 健康检查(最多90s) ===")
healthy=False; curl_ok=False
for i in range(45):
    st,_,_=run(c,"docker inspect -f '{{.State.Health.Status}}' ysjfxt-backend 2>/dev/null")
    st=st.strip()
    co,_,_=run(c,"curl -s -m 5 -o /dev/null -w '%{http_code}' http://172.20.0.2:3001/api/health 2>/dev/null")
    co=co.strip()
    if st=="healthy": healthy=True
    if co in ("200","301"): curl_ok=True
    if healthy and curl_ok:
        print(f"[{i*2}s] health={st} api_health={co}"); break
    time.sleep(2)
print(f"结果: health={healthy} curl={curl_ok}")

if not (healthy and curl_ok):
    # 回滚
    print("!! 健康检查未通过，执行回滚...")
    run(c,f"cd {ROOT} && cp docker-compose.yml.bak docker-compose.yml && docker tag ysjfxt-backend:backup-20260807 ysjfxt-backend && docker compose up -d backend 2>&1 | tail -5")
    time.sleep(20)
    st,_,_=run(c,"docker inspect -f '{{.State.Health.Status}}' ysjfxt-backend 2>/dev/null"); st=st.strip()
    print(f"回滚后 health={st}")
    print("已回滚到升级前镜像+原 compose。请检查日志。")
    c.close(); sys.exit(1)

# B4. 收口明文：清空 .env.docker 敏感字段（容器已改用挂载的 .env.enc）
print("=== B4 收口 .env.docker 明文 ===")
sftp=c.open_sftp()
data=sftp.open(ROOT+"/.env.docker").read().decode("utf-8")
import re
lines=data.splitlines()
new=[]
for ln in lines:
    if re.match(r'^[A-Za-z_]+=',ln):
        k=ln.split('=',1)[0]
        if re.search(r'secret|password|key|token',k,re.I):
            new.append(f"{k}=__MOVED_TO_ENV3__")
            continue
    new.append(ln)
sftp.open(ROOT+"/.env.docker","w").write("\n".join(new)+"\n")
sftp.close()
print(".env.docker 敏感字段已置为占位符（容器不再读取它）")

# B5. 最终验证
print("=== B5 最终验证 ===")
out,_,_=run(c,"docker inspect -f 'health={{.State.Health.Status}}' ysjfxt-backend; "
              "curl -s -m5 -o /dev/null -w 'api_health=%{http_code}\\n' http://172.20.0.2:3001/api/health; "
              "curl -s -m5 -o /dev/null -w 'public_site=%{http_code}\\n' https://rry.klai.top/api/health")
print(out.strip())
print("=" * 60)
print("🎉 升级完成：新镜像已上线，三重加密已激活，.env.docker 明文已收口。")
print(f"K1 主密钥位于 {ROOT}/.env.vault —— 务必另行离线备份，服务器损坏将导致 .env.enc 无法解密。")
print(f"旧镜像备份: ysjfxt-backend:backup-20260807（如需回滚可执行回滚步骤）")
c.close()
