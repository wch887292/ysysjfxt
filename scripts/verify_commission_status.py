import subprocess
import json

key = r"C:\Users\Administrator\.ssh\trae_deploy_key"
host = "root@111.229.190.132"
port = "22"

# Check Commission model status values via docker exec
cmd = [
    "ssh", "-i", key, "-o", "StrictHostKeyChecking=no", "-p", port, host,
    "docker compose -f /www/wwwroot/rry.klai.top/docker-compose.yml exec -T backend node -e 'console.log(JSON.stringify(require(\"./models\").Commission.rawAttributes.status.values))'"
]

result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("RC:", result.returncode)