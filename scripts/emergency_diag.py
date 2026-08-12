import os, paramiko
HOST=os.environ.get("SSH_HOST","111.229.190.132"); PORT=int(os.environ.get("SSH_PORT","22"))
USER=os.environ.get("SSH_USER","root"); PW=os.environ.get("SSH_PW","")
SD="/www/wwwroot/rry.klai.top"

def run(c,cmd,t=60):
    i,o,e=c.exec_command(cmd,timeout=t)
    out=o.read().decode("utf-8","replace"); err=e.read().decode("utf-8","replace")
    rc=o.channel.recv_exit_status(); return out,err,rc

c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,port=PORT,username=USER,password=PW,timeout=15,look_for_keys=False,allow_agent=False)

def sec(t): print("\n===== "+t+" =====")

sec("1. 容器列表")
out,_,_=run(c,"docker ps -a --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}'")
print(out.strip())

sec("2. ysjfxt-backend inspect")
out,_,_=run(c,"docker inspect ysjfxt-backend --format 'State={{.State.Status}} Running={{.State.Running}} ExitCode={{.State.ExitCode}} Health={{.State.Health.Status}} Image={{.Image}} Started={{.State.StartedAt}}' 2>&1")
print(out.strip())

sec("3. 健康检查最近输出")
out,_,_=run(c,"docker inspect ysjfxt-backend --format '{{range .State.Health.Log}}[{{.ExitCode}}] {{.Output}}\\n{{end}}' 2>&1 | tail -20")
print(out.strip())

sec("4. 容器日志 (最后 80 行)")
out,err,_=run(c,"docker logs ysjfxt-backend --tail 80 2>&1")
print((out+err).strip())

sec("5. 站点外部可用性")
out,_,_=run(c,"curl -s -o /dev/null -w 'local3001=%{http_code}\\n' --max-time 8 http://127.0.0.1:3001/api/health; curl -s -o /dev/null -w 'https=%{http_code}\\n' --max-time 10 https://rry.klai.top/api/health")
print(out.strip())

sec("6. 容器内 curl 自检")
out,err,_=run(c,"docker exec ysjfxt-backend sh -c 'curl -s -m 5 -o /dev/null -w \"incontainer=%{http_code}\" http://127.0.0.1:3001/api/health' 2>&1")
print((out+err).strip())

sec("7. 当前 compose 使用的 env_file / 镜像")
out,_,_=run(c,"grep -nE 'env_file|image:|\\.env|keys' "+SD+"/docker-compose.yml | head -30")
print(out.strip())

sec("8. 镜像列表")
out,_,_=run(c,"docker images | grep -iE 'ysjfxt|rryklai' ")
print(out.strip())

sec("9. 关键文件状态")
out,_,_=run(c,"ls -la "+SD+"/.env.vault "+SD+"/.env.enc "+SD+"/keys/ "+SD+"/docker-compose.yml "+SD+"/docker-compose.yml.bak 2>&1")
print(out.strip())

c.close()
print("\n[DIAG DONE]")
