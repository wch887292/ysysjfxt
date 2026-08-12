import os, paramiko
HOST=os.environ.get("SSH_HOST","111.229.190.132"); PORT=int(os.environ.get("SSH_PORT","22"))
USER=os.environ.get("SSH_USER","root"); PW=os.environ.get("SSH_PW","")
ROOT="/www/wwwroot/rry.klai.top"; SERVER=ROOT+"/server"
def run(c,cmd,t=60):
    i,o,e=c.exec_command(cmd,timeout=t); out=o.read().decode("utf-8","replace"); err=e.read().decode("utf-8","replace"); rc=o.channel.recv_exit_status(); return out,err,rc
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,port=PORT,username=USER,password=PW,timeout=15,look_for_keys=False,allow_agent=False)

print("=== .env.enc 中 ENV3 加密项数 ===")
out,_,_=run(c,f"grep -c '=ENV3:' {ROOT}/.env.enc")
print("ENV3 行数 =", out.strip())

print("=== 解密回环验证（不打印明文）===")
cmd=(f"cd {ROOT} && set -a && . ./.env.vault && set +a && "
     f"VAULT_KEY_FILE={ROOT}/keys/vault.key VAULT_INSTANCE_FILE={ROOT}/keys/instance.id "
     f"node {SERVER}/scripts/decrypt-env.js .env.enc > /tmp/dec.txt 2>&1; "
     f"echo DEC_FAIL=$(grep -c '解密失败' /tmp/dec.txt); "
     f"echo DEC_COUNT=$(grep -c '=ENV3:' /tmp/dec.txt); "
     f"echo DBPW_MATCH=$(grep -c '^DB_PASSWORD=wch@123456$' /tmp/dec.txt); "
     f"echo JWT_OK=$(grep -c '^JWT_SECRET=' /tmp/dec.txt)")
out,_,_=run(c,cmd,t=60)
print(out.strip())

print("=== 备份镜像标签 ===")
out,_,_=run(c,"docker images ysjfxt-backend:backup-20260807 --format '{{.Repository}}:{{.Tag}} {{.ID}}'")
print("backup tag:", out.strip() or "NOT FOUND")

print("=== 改造后的 backend 服务片段 ===")
out,_,_=run(c,"sed -n '/^  backend:/,/^  nginx:/p' "+ROOT+"/docker-compose.yml")
print(out.strip())
c.close()
