# Install Python 3.12 - Quick Commands

## Step 1: Detect Your OS

```bash
# Check OS type
cat /etc/os-release
# Or
cat /etc/redhat-release  # For CentOS/RHEL
cat /etc/debian_version  # For Debian/Ubuntu
```

## Step 2: Install Python 3.12

### For CentOS/RHEL (Most Common on Plesk)

```bash
# Install EPEL repository (if not already installed)
yum install -y epel-release

# Install Python 3.12
yum install -y python312 python312-pip python312-devel

# Verify installation
python3.12 --version
python3.12 -m pip --version
```

**If python312 package is not available, install from source:**

```bash
# Install build dependencies
yum groupinstall -y "Development Tools"
yum install -y openssl-devel bzip2-devel libffi-devel zlib-devel readline-devel sqlite-devel

# Download and compile Python 3.12
cd /tmp
wget https://www.python.org/ftp/python/3.12.8/Python-3.12.8.tgz
tar xzf Python-3.12.8.tgz
cd Python-3.12.8
./configure --enable-optimizations --prefix=/usr/local
make altinstall

# Verify
/usr/local/bin/python3.12 --version
/usr/local/bin/python3.12 -m pip --version
```

### For Ubuntu/Debian

```bash
# Update package list
apt-get update

# Install prerequisites
apt-get install -y software-properties-common

# Add deadsnakes PPA (for Ubuntu)
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update

# Install Python 3.12
apt-get install -y python3.12 python3.12-pip python3.12-venv python3.12-dev

# Verify installation
python3.12 --version
python3.12 -m pip --version
```

**For Debian (without PPA):**

```bash
# Update package list
apt-get update

# Install Python 3.12 from Debian repositories
apt-get install -y python3.12 python3.12-pip python3.12-venv python3.12-dev

# Verify installation
python3.12 --version
python3.12 -m pip --version
```

## Step 3: Update Your Deployment Script

After installation, update `plesk-deploy.sh`:

```bash
# Edit the script
nano plesk-deploy.sh

# Change these lines:
PYTHON_CMD="python3.12"
PIP_CMD="python3.12 -m pip"
```

Or if installed in custom location:

```bash
PYTHON_CMD="/usr/local/bin/python3.12"
PIP_CMD="/usr/local/bin/python3.12 -m pip"
```

## Quick Install Script

Use the provided script:

```bash
# Download and run
chmod +x INSTALL_PYTHON_3.12.sh
sudo bash INSTALL_PYTHON_3.12.sh
```

## Alternative: Install Latest Python (3.13)

If you want the absolute latest version:

### CentOS/RHEL:
```bash
yum install -y python313 python313-pip python313-devel
```

### Ubuntu/Debian:
```bash
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update
apt-get install -y python3.13 python3.13-pip python3.13-venv python3.13-dev
```

## Troubleshooting

**If "package not found" error:**
- Try installing from source (see CentOS section above)
- Or contact your hosting provider

**If permission denied:**
- Make sure you're running as root: `sudo bash install-command.sh`
- Or use: `su -` to switch to root

**Verify installation:**
```bash
which python3.12
python3.12 --version
python3.12 -m pip --version
```

