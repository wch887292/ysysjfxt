import os, paramiko
HOST=os.environ.get("SSH_HOST","111.229.190.132"); PORT=int(os.environ.get("SSH_PORT","22"))
USER=os.environ.get("SSH_USER","root"); PW=os.environ.get("SSH_PW","")
SD="/www/wwwroot/rry.klai.top/server"
def run(c,cmd,t=30):
    i,o,e=c.exec_command(cmd,timeout=t); out=o.read().decode("utf-8","replace"); err=e.read().decode("utf-8","replace"); rc=o.channel.recv_exit_status(); return out,err,rc
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,port=PORT,username=USER,password=PW,timeout=15,look_for_keys=False,allow_agent=False)
print("=== 全部监听端口 ===")
out,_,_=run(c,"ss -tlnp 2>/dev/null | grep -i listen")
print(out.strip())
print("=== pid 1840977 详情 ===")
out,_,_=run(c,"ps -o pid,ppid,stat,etime,cmd -p 1840977 2>/dev/null; echo '--- 该进程打开的监听socket ---'; ss -tlnp 2>/dev/null | grep 1840977")
print(out.strip())
print("=== curl 健康检查(现在) ===")
out,_,_=run(c,"curl -s -m 5 -o /dev/null -w 'live=%{http_code}\\n' http://127.0.0.1:3000/api/health/live; curl -s -m 5 -o /dev/null -w 'health=%{http_code}\\n' http://127.0.0.1:3000/api/health", t=20)
print(out.strip())
print("=== logger 去向 ===")
out,_,_=run(c,f"grep -n 'transports\\|filename\\|File\\|console' {SD}/utils/logger.js | head -20")
print(out.strip())
print("=== 最近写入的日志文件 ===")
out,_,_=run(c,f"ls -lt {SD}/logs/ 2>/dev/null | head; echo '---'; tail -30 {SD}/logs/*.log 2>/dev/null | tail -30")
print(out.strip())
c.close()
