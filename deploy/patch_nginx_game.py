#!/usr/bin/env python3
"""Add /game/ reverse proxy to the existing blog nginx site."""

import os
import re
import sys

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
GAME_PORT = os.environ.get("GAME_SERVER_PORT", "8081")

GAME_LOCATIONS = f"""
    location /game/ws/ {{
        proxy_pass http://127.0.0.1:{GAME_PORT}/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }}

    location /game/ {{
        proxy_pass http://127.0.0.1:{GAME_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }}
"""


def run(ssh, cmd, sudo=False):
    if sudo:
        cmd = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    _, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    code = stdout.channel.recv_exit_status()
    return code, stdout.read().decode(), stderr.read().decode()


def patch_server_block(block: str) -> str:
    if "location /game/" in block:
        return block
    return block.replace("    location / {", GAME_LOCATIONS + "\n    location / {", 1)


def patch_nginx(text: str) -> str:
    if "location /game/" in text:
        return text
    parts = re.split(r"(?=server\s*\{)", text)
    return "".join(patch_server_block(part) if part.strip().startswith("server") else part for part in parts)


def main() -> int:
    if not PASSWORD:
        print("Set DEPLOY_PASSWORD")
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    _, nginx, _ = run(ssh, "cat /etc/nginx/sites-available/blog", sudo=True)
    patched = patch_nginx(nginx)
    if patched == nginx:
        print("nginx already has /game/ locations")
    else:
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/blog.nginx", "w") as f:
            f.write(patched)
        sftp.close()
        code, out, err = run(
            ssh,
            "cp /tmp/blog.nginx /etc/nginx/sites-available/blog && nginx -t && systemctl reload nginx",
            sudo=True,
        )
        print(out or err)
        if code != 0:
            ssh.close()
            return 1

    _, out, _ = run(ssh, "curl -s -o /dev/null -w '%{http_code}' https://xiewenwen.xyz/game/ || true")
    print(f"HTTPS /game/ -> {out.strip()}")
    ssh.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
