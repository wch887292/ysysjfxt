import subprocess
import json

key = r"C:\Users\Administrator\.ssh\trae_deploy_key"
host = "root@111.229.190.132"
port = "22"

# Check if cancel/reject routes exist
cmd = [
    "ssh", "-i", key, "-o", "StrictHostKeyChecking=no", "-p", port, host,
    "docker compose -f /www/wwwroot/rry.klai.top/docker-compose.yml exec -T backend node -e 'const admin = require(\"./routes/admin\"); const routes = []; admin.stack.forEach(m => { if (m.route) routes.push(m.route.path + \" \" + Object.keys(m.route.methods).join(\",\")); }); console.log(routes.filter(r => r.includes(\"commission\")).join(\"\\n\"));'"
]

result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
print("STDOUT:", result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[-500:])
print("RC:", result.returncode)