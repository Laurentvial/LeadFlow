#!/bin/bash
# Script to install Python 3.12 on Plesk server
# Run as root: sudo bash INSTALL_PYTHON_3.12.sh

set -e

echo "🔍 Detecting operating system..."

# Detect OS
if [ -f /etc/redhat-release ]; then
    OS="centos"
    echo "✅ Detected: CentOS/RHEL"
elif [ -f /etc/debian_version ]; then
    OS="debian"
    echo "✅ Detected: Debian/Ubuntu"
else
    echo "❌ Unknown OS. Please install Python 3.12 manually."
    exit 1
fi

echo ""
echo "📦 Installing Python 3.12..."

if [ "$OS" = "centos" ]; then
    # CentOS/RHEL installation
    echo "Installing for CentOS/RHEL..."
    
    # Install EPEL repository
    yum install -y epel-release
    
    # Install Python 3.12 and dependencies
    yum install -y python312 python312-pip python312-devel gcc openssl-devel bzip2-devel libffi-devel zlib-devel
    
    # Verify installation
    echo ""
    echo "✅ Installation complete!"
    echo "Python version:"
    python3.12 --version
    
    echo ""
    echo "Pip version:"
    python3.12 -m pip --version
    
elif [ "$OS" = "debian" ]; then
    # Debian/Ubuntu installation
    echo "Installing for Debian/Ubuntu..."
    
    # Update package list
    apt-get update
    
    # Install prerequisites
    apt-get install -y software-properties-common
    
    # Add deadsnakes PPA (for Ubuntu) or use default repos
    if [ -f /etc/lsb-release ]; then
        # Ubuntu
        add-apt-repository -y ppa:deadsnakes/ppa
        apt-get update
    fi
    
    # Install Python 3.12
    apt-get install -y python3.12 python3.12-pip python3.12-venv python3.12-dev build-essential
    
    # Verify installation
    echo ""
    echo "✅ Installation complete!"
    echo "Python version:"
    python3.12 --version
    
    echo ""
    echo "Pip version:"
    python3.12 -m pip --version
fi

echo ""
echo "🎉 Python 3.12 is now installed!"
echo ""
echo "To use it in your deployment script, update plesk-deploy.sh:"
echo "  PYTHON_CMD=\"python3.12\""
echo "  PIP_CMD=\"python3.12 -m pip\""
echo ""
echo "Or if installed in a custom location:"
echo "  PYTHON_CMD=\"/usr/bin/python3.12\""
echo "  PIP_CMD=\"/usr/bin/python3.12 -m pip\""

