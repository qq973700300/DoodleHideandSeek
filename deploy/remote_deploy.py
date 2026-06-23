#!/usr/bin/env python3
"""Deploy DoodleHideandSeek to the same Tencent Cloud server as blog."""

import os
import sys
import time
import zipfile
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "101.33.218.140")
USER = os.environ.get("DEPLOY_USER", "ubuntu")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
PORT = int(os.environ.get("DEPLOY_PORT", "22"))
APP_DIR = "/home/ubuntu/DoodleHideandSeek"
SERVICE_NAME = "hideandseek"
SERVER_PORT = os.environ.get("GAME_SERVER_PORT", "8081")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ZIP_PATH = PROJECT_ROOT / "deploy" / "hideandseek-src.zip"

UPLOAD_NAMES = [
    "pom.xml",
    "mvnw",
    "mvnw.cmd",
    ".mvn",
    "src",
    ".gitattributes",
]


def log(msg: str) -> None:
    print(msg, flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, sudo: bool = False) -> tuple[int, str, str]:
    if sudo:
        cmd = f"echo '{PASSWORD}' | sudo -S bash -lc {repr(cmd)}"
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return exit_code, out, err


def make_zip() -> None:
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in UPLOAD_NAMES:
            path = PROJECT_ROOT / name
            if not path.exists():
                continue
            if path.is_dir():
                for file in path.rglob("*"):
                    if file.is_file() and "target" not in file.parts:
                        arc = file.relative_to(PROJECT_ROOT).as_posix()
                        zf.write(file, arc)
            else:
                zf.write(path, name)


def upload(ssh: paramiko.SSHClient) -> None:
    sftp = ssh.open_sftp()
    try:
        run(ssh, f"mkdir -p {APP_DIR}")
        remote_zip = f"{APP_DIR}/hideandseek-src.zip"
        log(f"Uploading {ZIP_PATH.name} ...")
        sftp.put(str(ZIP_PATH), remote_zip)
        run(ssh, f"cd {APP_DIR} && unzip -o hideandseek-src.zip && rm -f hideandseek-src.zip")
    finally:
        sftp.close()


def wait_for_health(ssh: paramiko.SSHClient, timeout: int = 120) -> None:
    log("Waiting for game app to become ready ...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        code, out, err = run(
            ssh,
            f"curl -s -o /dev/null -w '%{{http_code}}' http://127.0.0.1:{SERVER_PORT}/ || true",
        )
        if out.strip() == "200":
            log("Game app is ready (HTTP 200).")
            return
        time.sleep(2)
    raise RuntimeError("Game app did not become ready within timeout.")


def deploy(ssh: paramiko.SSHClient) -> None:
    code, out, err = run(ssh, "java -version 2>&1 || true")
    if "version" not in out.lower() and "version" not in err.lower():
        log("Installing OpenJDK 17 ...")
        code, out, err = run(
            ssh,
            "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-17-jdk unzip",
            sudo=True,
        )
        if code != 0:
            raise RuntimeError(f"JDK install failed:\n{out}\n{err}")

    log("Building project on server ...")
    build_cmd = f"cd {APP_DIR} && chmod +x mvnw && ./mvnw -q package -DskipTests"
    code, out, err = run(ssh, build_cmd, sudo=False)
    if code != 0:
        raise RuntimeError(f"Build failed:\n{out}\n{err}")
    log("Build succeeded.")

    code, out, err = run(ssh, f"ls -1 {APP_DIR}/target/*.jar")
    jar_name = [
        line.strip()
        for line in out.splitlines()
        if line.strip().endswith(".jar") and "original" not in line
    ][-1]
    jar_path = jar_name if jar_name.startswith("/") else f"{APP_DIR}/target/{jar_name.split('/')[-1]}"
    log(f"JAR: {jar_path}")

    service = f"""[Unit]
Description=Doodle Hide and Seek Spring Boot App
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory={APP_DIR}
Environment="SERVER_PORT={SERVER_PORT}"
ExecStart=/usr/bin/java -jar {jar_path}
Restart=on-failure
RestartSec=5
TimeoutStartSec=120
TimeoutStopSec=60
SuccessExitStatus=143

[Install]
WantedBy=multi-user.target
"""

    sftp = ssh.open_sftp()
    local_service = PROJECT_ROOT / "deploy" / "hideandseek.service"
    local_service.write_text(service, encoding="utf-8")
    sftp.put(str(local_service), "/tmp/hideandseek.service")
    sftp.close()

    log("Installing systemd service ...")
    run(ssh, "cp /tmp/hideandseek.service /etc/systemd/system/hideandseek.service", sudo=True)
    run(
        ssh,
        "systemctl daemon-reload && systemctl enable hideandseek && systemctl restart hideandseek",
        sudo=True,
    )
    wait_for_health(ssh)

    code, out, err = run(
        ssh,
        f"systemctl is-active hideandseek && ss -tlnp | grep {SERVER_PORT} || true",
    )
    log(out.strip() or err.strip())


def main() -> int:
    if not PASSWORD:
        log("Set DEPLOY_PASSWORD environment variable.")
        return 1

    make_zip()
    log(f"Created package: {ZIP_PATH}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    log(f"Connecting to {USER}@{HOST} ...")
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)

    try:
        upload(ssh)
        deploy(ssh)
        log(f"Deploy complete: port {SERVER_PORT} (nginx path /game/ if configured)")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
