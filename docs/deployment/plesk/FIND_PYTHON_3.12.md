# How to Find and Use Python 3.12 on Plesk

## Quick Check Commands

Run these commands in your Plesk SSH terminal to find Python 3.12:

```bash
# Method 1: Check Plesk Python directory
ls -la /opt/plesk/python/

# Method 2: Check if python3.12 command exists
which python3.12
python3.12 --version

# Method 3: Search for all Python installations
find /usr -name "python3.12" 2>/dev/null
find /opt -name "python3.12" 2>/dev/null

# Method 4: Check common Plesk locations
ls -la /opt/plesk/python/3.12/bin/python3 2>/dev/null && echo "Found!" || echo "Not found"
ls -la /opt/plesk/python/3.11/bin/python3 2>/dev/null && echo "Found!" || echo "Not found"
ls -la /opt/plesk/python/3.10/bin/python3 2>/dev/null && echo "Found!" || echo "Not found"
```

## If Python 3.12 is Found

If you find Python 3.12 at a specific path, update your deployment script:

```bash
# Edit plesk-deploy.sh
nano plesk-deploy.sh

# Find the line with PYTHON_CMD and change it to:
PYTHON_CMD="/opt/plesk/python/3.12/bin/python3"
PIP_CMD="/opt/plesk/python/3.12/bin/pip3"
```

Or create a wrapper script:

```bash
# Create a script that uses Python 3.12
cat > deploy-with-python312.sh << 'EOF'
#!/bin/bash
export PYTHON_CMD="/opt/plesk/python/3.12/bin/python3"
export PIP_CMD="/opt/plesk/python/3.12/bin/pip3"
./plesk-deploy.sh
EOF

chmod +x deploy-with-python312.sh
./deploy-with-python312.sh
```

## If Python 3.12 is NOT Found

### Option 1: Install via Plesk Panel

1. Log into Plesk Panel
2. Go to **Hosting & DNS** → **Python**
3. Look for **Python version** dropdown
4. Select **Python 3.12** if available
5. Click **Apply**

### Option 2: Request Installation from Hosting Provider

Contact your hosting provider with this message:

```
Subject: Request to Install Python 3.12 on Plesk Server

Hello,

I need Python 3.12 installed on my Plesk server for my Django application.

Current situation:
- Server currently has Python 3.6.8
- My application requires Python 3.12 (as specified in runtime.txt)
- Django 5.2.7 requires Python 3.8+

Could you please:
1. Install Python 3.12 via Plesk's Python Manager, or
2. Install it via system package manager (yum/apt)

My domain: blissful-spence.82-165-44-164.plesk.page

Thank you!
```

### Option 3: Install Manually (if you have root access)

**For CentOS/RHEL:**
```bash
# Install Python 3.12
yum install -y python312 python312-pip python312-devel

# Verify installation
python3.12 --version
python3.12 -m pip --version
```

**For Ubuntu/Debian:**
```bash
# Add deadsnakes PPA (for Ubuntu)
add-apt-repository ppa:deadsnakes/ppa
apt-get update

# Install Python 3.12
apt-get install -y python3.12 python3.12-pip python3.12-venv

# Verify installation
python3.12 --version
python3.12 -m pip --version
```

## Temporary Workaround (NOT RECOMMENDED)

If you absolutely cannot get Python 3.12, you could downgrade Django, but this will break features:

**Create `backend/requirements-py36.txt`:**
```txt
Django==3.2.28
asgiref==3.4.1
# ... other compatible versions
```

**⚠️ Warning:** This is NOT recommended. Many features will break. Upgrade Python instead.

## Verify Installation

After Python 3.12 is installed:

```bash
# Check version
python3.12 --version
# Should show: Python 3.12.x

# Check pip
python3.12 -m pip --version
# Should show: pip x.x.x

# Test installation
python3.12 -m pip install --user django==5.2.7
```

## Next Steps

1. Run the check commands above
2. If Python 3.12 is found, update the script to use it
3. If not found, contact your hosting provider
4. Once Python 3.12 is available, run the deployment script again

