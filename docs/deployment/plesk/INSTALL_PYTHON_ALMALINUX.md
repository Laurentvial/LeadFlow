# Install Python 3.12 on AlmaLinux

## Quick Install Commands

### Method 1: Using EPEL Repository (Recommended)

```bash
# Install EPEL repository
dnf install -y epel-release

# Install Python 3.12
dnf install -y python3.12 python3.12-pip python3.12-devel

# Verify installation
python3.12 --version
python3.12 -m pip --version
```

### Method 2: Using PowerTools Repository

```bash
# Enable PowerTools/CRB repository
dnf config-manager --set-enabled powertools
# Or for AlmaLinux 9:
dnf config-manager --set-enabled crb

# Install Python 3.12
dnf install -y python3.12 python3.12-pip python3.12-devel

# Verify
python3.12 --version
```

### Method 3: Install from Source (If packages not available)

```bash
# Install build dependencies
dnf groupinstall -y "Development Tools"
dnf install -y openssl-devel bzip2-devel libffi-devel zlib-devel readline-devel sqlite-devel xz-devel

# Download Python 3.12.8
cd /tmp
wget https://www.python.org/ftp/python/3.12.8/Python-3.12.8.tgz
tar xzf Python-3.12.8.tgz
cd Python-3.12.8

# Configure and compile
./configure --enable-optimizations --prefix=/usr/local
make -j$(nproc)
make altinstall

# Verify
/usr/local/bin/python3.12 --version
/usr/local/bin/python3.12 -m pip --version
```

## Check Available Python Versions

```bash
# Check what Python versions are available in repositories
dnf list available python3*

# Or search specifically
dnf search python3.12
```

## One-Liner Install

```bash
dnf install -y epel-release && dnf install -y python3.12 python3.12-pip python3.12-devel && python3.12 --version
```

## After Installation

Update your deployment script:

```bash
# Edit plesk-deploy.sh
nano plesk-deploy.sh

# The script should auto-detect python3.12, but verify it's using it
# Or explicitly set:
PYTHON_CMD="python3.12"
PIP_CMD="python3.12 -m pip"
```

## Troubleshooting

**If "No package python3.12 available":**
- Try Method 3 (install from source)
- Or check if it's available as `python312`:
  ```bash
  dnf search python312
  dnf install -y python312 python312-pip
  ```

**If using yum instead of dnf:**
- AlmaLinux 8+ uses `dnf` by default, but `yum` is an alias
- Both commands work the same way

**Check AlmaLinux version:**
```bash
cat /etc/almalinux-release
```

