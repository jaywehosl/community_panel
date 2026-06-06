#!/bin/bash
# deploy.sh - Build and install 3x-ui as a systemd service on Linux

# Check root
[[ $EUID -ne 0 ]] && echo "Please run this script with sudo or as root" && exit 1

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== 1. Building Frontend ==="
cd frontend
if command -v npm &> /dev/null; then
    npm install
    npm run build
else
    echo "Warning: npm is not installed. Using existing build in web/dist/ if present."
fi
cd ..

echo "=== 2. Building Go Backend ==="
if command -v go &> /dev/null; then
    go build -o x-ui main.go
else
    echo "Error: Go compiler (go) is required to build the panel on this server."
    exit 1
fi

echo "=== 3. Installing Panel Files ==="
XUI_FOLDER="/usr/local/x-ui"
mkdir -p "${XUI_FOLDER}/bin"
cp -f x-ui "${XUI_FOLDER}/"
cp -f x-ui.sh "${XUI_FOLDER}/"

# Copy systemd service file based on distro release
if [ -f "x-ui.service.debian" ]; then
    cp -f x-ui.service.debian /etc/systemd/system/x-ui.service
elif [ -f "x-ui.service.rhel" ]; then
    cp -f x-ui.service.rhel /etc/systemd/system/x-ui.service
fi

# Set binary permissions
chmod +x "${XUI_FOLDER}/x-ui"
chmod +x "${XUI_FOLDER}/x-ui.sh"

# Setup symbolic link to CLI
ln -sf "${XUI_FOLDER}/x-ui.sh" /usr/bin/x-ui
chmod +x /usr/bin/x-ui

echo "=== 4. Activating systemd Service ==="
systemctl daemon-reload
systemctl enable x-ui
systemctl restart x-ui

echo "=== 5. Deployment Completed ==="
echo "3X-UI Antigravity panel has been built and restarted."
echo "Check system status using: systemctl status x-ui"
echo "Manage credentials and certificates using: x-ui"
