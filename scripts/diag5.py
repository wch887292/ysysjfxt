import os, paramiko
HOST=os.environ.get("SSH_HOST","111.229.190.132"); PORT=int(os.environ.get("SSH_PORT","22"))
USER=os.environ.get("SSH_USER","root"); PW=os.environ.get("SSH_PW","")
SD="/www/wwwroot/rry.klai.top"
def run(c,cmd,t=30):
    i,o,e=c.exec_command(cmd,timeout=t); out=o.read().decode("utf-8","replace"); err=e.read().decode("utf-8","replace"); rc=o.channel.recv_exit_status(); return out,err,rc
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,port=PORT,username=USER,password=PW,timeout=15,look_for_keys=False,allow_agent=False)
print("=== server/Dockerfile ===")
out,_,_=run(c,"cat "+SD+"/server/Dockerfile 2>/dev/null")
print(out.strip())
print("=== .dockerignore ===")
out,_,_=run(c,"cat "+SD+"/.dockerignore 2>/dev/null")
print(out.strip())
print("=== .env.docker 字段名(不取值) ===")
out,_,_=run(c,"grep -oE '^[A-Z_]+=' "+SD+"/.env.docker 2>/dev/null | sed 's/=$//' | sort -u")
print(out.strip() or "(无 .env.docker 或无字段)")
print("=== 容器当前镜像构建时间 ===")
out,_,_=run(c,"docker inspect ysjfxt-backend --format 'Image: {{.Image}}\\nCreated: {{.Created}}' 2>/dev/null")
print(out.strip())
c.close()
