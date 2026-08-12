"""
部署脚本 - 使用 SSH 密钥认证 + wexpect 自动输入密码
"""
import wexpect
import os
import sys
import shutil

SERVER = "root@111.229.190.132"
PASSWORD = "WCHqaz887292@"
PORT = 22
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY_FILE = os.path.expanduser("~/.ssh/trae_deploy_key")

def ssh_exec(command, timeout=30, password_required=True):
    """执行 SSH 命令，自动处理密码"""
    cmd = f'ssh -i "{KEY_FILE}" -o StrictHostKeyChecking=no -p {PORT} {SERVER} "{command}"'
    
    try:
        child = wexpect.spawn(cmd)
        if password_required:
            i = child.expect(['password:', 'Password:', 'KEY_OK', wexpect.EOF, wexpect.TIMEOUT], timeout=10)
            if i == 0 or i == 1:
                child.sendline(PASSWORD)
                child.expect(wexpect.EOF, timeout=timeout)
            elif i == 4:
                # EOF - likely key already works
                pass
        else:
            child.expect(wexpect.EOF, timeout=timeout)
        
        output = child.before
        return (True, output.decode('utf-8', errors='ignore') if output else '')
    except Exception as e:
        return (False, str(e))

def scp_upload(local_path, remote_path, password_required=True):
    """上传文件，自动处理密码"""
    local_path = os.path.abspath(local_path)
    if not os.path.exists(local_path):
        print(f"  ! 文件不存在: {local_path}")
        return False
    
    cmd = f'scp -i "{KEY_FILE}" -P {PORT} -o StrictHostKeyChecking=no "{local_path}" {SERVER}:{remote_path}'
    print(f"  → 上传: {os.path.basename(local_path)}")
    
    try:
        child = wexpect.spawn(cmd)
        if password_required:
            i = child.expect(['password:', 'Password:', wexpect.EOF, wexpect.TIMEOUT], timeout=15)
            if i == 0 or i == 1:
                child.sendline(PASSWORD)
                child.expect(wexpect.EOF, timeout=60)
            elif i == 2:
                pass  # EOF - likely key already works
        else:
            child.expect(wexpect.EOF, timeout=60)
        
        print(f"  ✓ OK")
        return True
    except Exception as e:
        print(f"  ✗ 失败: {e}")
        return False

def main():
    password_needed = True
    
    # 1. 检查密钥是否已安装
    print("=== 1. 检查 SSH 密钥 ===")
    ok, out = ssh_exec("echo KEY_OK", password_required=True)
    if "KEY_OK" in out:
        print("  ✓ 密钥已安装，无需密码")
        password_needed = False
    else:
        print("  → 需要安装 SSH 密钥")
        # 上传公钥
        pub_key = os.path.expanduser("~/.ssh/trae_deploy_key.pub")
        ok, _ = ssh_exec("mkdir -p ~/.ssh && chmod 700 ~/.ssh", password_required=True)
        if ok:
            scp_upload(pub_key, "~/.ssh/authorized_keys_tmp", password_required=True)
            ok, _ = ssh_exec("cat ~/.ssh/authorized_keys_tmp >> ~/.ssh/authorized_keys", password_required=True)
            ok, _ = ssh_exec("chmod 600 ~/.ssh/authorized_keys", password_required=True)
            ok, _ = ssh_exec("rm -f ~/.ssh/authorized_keys_tmp", password_required=False)
            # 验证
            ok, out = ssh_exec("echo KEY_OK", password_required=False)
            if "KEY_OK" in out:
                print("  ✓ SSH 密钥安装成功！")
                password_needed = False
            else:
                print("  ✗ 密钥安装失败，将使用密码模式")
    
    # 2. 上传后端文件
    print("\n=== 2. 上传后端文件 ===")
    scp_upload(
        os.path.join(BASE_DIR, "server", "models", "Commission.js"),
        "/www/wwwroot/rry.klai.top/server/models/Commission.js",
        password_needed
    )
    scp_upload(
        os.path.join(BASE_DIR, "server", "routes", "admin.js"),
        "/www/wwwroot/rry.klai.top/server/routes/admin.js",
        password_needed
    )
    
    # 3. 上传压缩图片
    print("\n=== 3. 上传压缩图片 ===")
    images = [
        ("server/public/images/gifts/gym.jpg", "/www/wwwroot/rry.klai.top/server/public/images/gifts/gym.jpg"),
        ("server/public/images/gifts/salad.jpg", "/www/wwwroot/rry.klai.top/server/public/images/gifts/salad.jpg"),
        ("server/public/images/gifts/fruit-box.jpg", "/www/wwwroot/rry.klai.top/server/public/images/gifts/fruit-box.jpg"),
        ("server/public/images/gifts/nutrition.jpg", "/www/wwwroot/rry.klai.top/server/public/images/gifts/nutrition.jpg"),
        ("server/public/images/gifts/checkup.jpg", "/www/wwwroot/rry.klai.top/server/public/images/gifts/checkup.jpg"),
        ("server/public/uploads/gifts/health-checkup.jpg", "/www/wwwroot/rry.klai.top/server/public/uploads/gifts/health-checkup.jpg"),
        ("server/public/uploads/gifts/oat-gift-box.jpg", "/www/wwwroot/rry.klai.top/server/public/uploads/gifts/oat-gift-box.jpg"),
        ("server/uploads/articles/summer-diet-cover.jpg", "/www/wwwroot/rry.klai.top/server/uploads/articles/summer-diet-cover.jpg"),
        ("server/uploads/gifts/health-checkup.jpg", "/www/wwwroot/rry.klai.top/server/uploads/gifts/health-checkup.jpg"),
        ("server/uploads/gifts/oat-gift-box.jpg", "/www/wwwroot/rry.klai.top/server/uploads/gifts/oat-gift-box.jpg"),
    ]
    for local_rel, remote_path in images:
        local_path = os.path.join(BASE_DIR, local_rel)
        if os.path.exists(local_path):
            scp_upload(local_path, remote_path, password_needed)
    
    # 4. 上传前端构建
    print("\n=== 4. 上传前端构建 ===")
    dist_dir = os.path.join(BASE_DIR, "admin-web", "dist")
    if os.path.exists(dist_dir):
        # 创建远程目录
        ssh_exec("mkdir -p /www/wwwroot/admin-dist", password_needed)
        # 上传所有文件
        total = 0
        for root, dirs, files in os.walk(dist_dir):
            for f in files:
                local_file = os.path.join(root, f)
                rel_path = os.path.relpath(local_file, dist_dir)
                remote_file = f"/www/wwwroot/admin-dist/{rel_path.replace(os.sep, '/')}"
                remote_dir = os.path.dirname(remote_file)
                ssh_exec(f"mkdir -p {remote_dir}")
                scp_upload(local_file, remote_file, password_needed)
                total += 1
                if total % 50 == 0:
                    print(f"  ... 已上传 {total} 个文件")
        print(f"  ✓ 共上传 {total} 个前端文件")
    else:
        print(f"  ! 前端构建目录不存在: {dist_dir}")
        print("  请先执行: cd admin-web && npm run build")
    
    # 5. 重建后端
    print("\n=== 5. 重建后端容器 ===")
    ok, out = ssh_exec("cd /www/wwwroot/rry.klai.top && docker compose up -d --build backend", 120, password_needed)
    print(f"  {out[:500]}")
    
    print("\n" + "="*50)
    print("  ✅ 部署完成！")
    print("="*50)

if __name__ == "__main__":
    main()