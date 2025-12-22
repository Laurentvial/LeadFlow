# Python Version Issue - Fix Guide

## Problem
Your Plesk server has Python 3.6.8, but this project requires Python 3.12.

**Error:** `Could not find a version that satisfies the requirement asgiref==3.10.0`

This happens because:
- Django 5.2.7 requires Python 3.8+
- asgiref 3.10.0 requires Python 3.7+
- Your server only has Python 3.6.8

## Solution Options

### Option 1: Install Python 3.12 on Plesk (Recommended)

**Check if Python 3.12 is already installed:**

```bash
# Check for Python 3.12
ls -la /opt/plesk/python/
which python3.12
python3.12 --version

# Check all Python versions
ls -la /usr/bin/python*
```

**If Python 3.12 exists but isn't default:**

Update the deployment script to use Python 3.12 explicitly:

```bash
# Edit plesk-deploy.sh
nano plesk-deploy.sh

# Change line 27 from:
PYTHON_CMD=$(which python3 2>/dev/null || which python 2>/dev/null || echo "python3")

# To:
PYTHON_CMD=$(which python3.12 2>/dev/null || which python3 2>/dev/null || which python 2>/dev/null || echo "python3.12")
```

**If Python 3.12 doesn't exist, install it:**

1. **Via Plesk Panel:**
   - Go to **Hosting & DNS** → **Python**
   - Check if Python 3.12 can be enabled/installed
   - Or contact your hosting provider to install Python 3.12

2. **Via SSH (if you have root access):**
   ```bash
   # Install Python 3.12 (CentOS/RHEL)
   yum install python3.12 python3.12-pip python3.12-devel
   
   # Or (Ubuntu/Debian)
   apt-get install python3.12 python3.12-pip python3.12-venv
   ```

### Option 2: Use Plesk's Python Manager

Plesk often has multiple Python versions available:

```bash
# Check Plesk Python installations
ls -la /opt/plesk/python/

# Common locations:
# /opt/plesk/python/3.12/bin/python3
# /opt/plesk/python/3.11/bin/python3
# /opt/plesk/python/3.10/bin/python3
```

If Python 3.12 exists at `/opt/plesk/python/3.12/bin/python3`, update your script:

```bash
PYTHON_CMD="/opt/plesk/python/3.12/bin/python3"
PIP_CMD="/opt/plesk/python/3.12/bin/pip3"
```

### Option 3: Downgrade Requirements (NOT RECOMMENDED)

Only use this if you absolutely cannot upgrade Python. You'll need to downgrade Django and all dependencies:

**Create `backend/requirements-py36.txt`:**

```txt
asgiref==3.4.1
Django==3.2.28
django-cors-headers==4.0.0
djangorestframework==3.14.0
djangorestframework-simplejwt==5.2.2
PyJWT==2.8.0
pytz==2023.3
sqlparse==0.4.4
psycopg2-binary==2.9.9
python-dotenv==1.0.0
boto3==1.34.0
gunicorn==21.2.0
whitenoise==6.6.0
dj-database-url==2.1.0
email-validator==2.1.0
channels==3.0.5
channels-redis==4.1.0
redis==5.0.1
msgpack==1.0.7
daphne==4.0.0
resend==1.0.0
```

**⚠️ Warning:** This will break many features and is not recommended. Upgrade Python instead.

## Quick Fix Script

Create a script to check and use the correct Python version:

```bash
#!/bin/bash
# Check for Python 3.12

if command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
elif [ -f "/opt/plesk/python/3.12/bin/python3" ]; then
    PYTHON_CMD="/opt/plesk/python/3.12/bin/python3"
elif command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
    echo "Warning: Using Python 3.11 instead of 3.12"
elif command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
    echo "Warning: Using Python 3.10 instead of 3.12"
elif command -v python3.9 &> /dev/null; then
    PYTHON_CMD="python3.9"
    echo "Warning: Using Python 3.9 instead of 3.12"
elif command -v python3.8 &> /dev/null; then
    PYTHON_CMD="python3.8"
    echo "Warning: Using Python 3.8 instead of 3.12"
else
    echo "Error: Python 3.8+ required. Found: $(python3 --version)"
    exit 1
fi

echo "Using: $PYTHON_CMD"
$PYTHON_CMD --version
```

## Next Steps

1. **Check for Python 3.12:**
   ```bash
   ls -la /opt/plesk/python/
   which python3.12
   ```

2. **If found, update plesk-deploy.sh** to use it

3. **If not found, contact your hosting provider** to install Python 3.12

4. **Verify installation:**
   ```bash
   python3.12 --version
   python3.12 -m pip --version
   ```

## Contact Hosting Provider

If Python 3.12 is not available, contact your hosting provider with:

> "I need Python 3.12 installed on my Plesk server for my Django application. 
> Currently only Python 3.6.8 is available, but my application requires Python 3.12.
> Can you please install Python 3.12 via Plesk's Python Manager or system package manager?"

