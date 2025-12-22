# Plesk Deployment Troubleshooting

## Common Issues and Solutions

### "pip: command not found"

**Problem:** The `pip` command is not found when running `plesk-deploy.sh`

**Solutions:**

1. **Use pip3 instead:**
   ```bash
   # Check if pip3 is available
   which pip3
   
   # If yes, the script should auto-detect it
   # If no, try python3 -m pip
   python3 -m pip --version
   ```

2. **Find Python installation:**
   ```bash
   # Check Python location
   which python3
   which python
   
   # Check pip location
   which pip3
   python3 -m pip --version
   ```

3. **Use full path to pip:**
   ```bash
   # Common Plesk Python paths
   /opt/plesk/python/3.12/bin/pip3
   /usr/bin/pip3
   /usr/local/bin/pip3
   ```

4. **Install pip if missing:**
   ```bash
   # For Python 3
   python3 -m ensurepip --upgrade
   # Or
   curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
   python3 get-pip.py --user
   ```

### "python: command not found"

**Problem:** Python command not found

**Solutions:**

1. **Use python3:**
   ```bash
   python3 --version
   ```

2. **Find Python installation:**
   ```bash
   which python3
   ls -la /opt/plesk/python/
   ```

3. **Use full path:**
   ```bash
   /opt/plesk/python/3.12/bin/python3
   ```

### Script Path Issues

**Problem:** Script can't find backend/ or frontend/ directories

**Solution:** Make sure you're running the script from the correct location:

```bash
# Navigate to project root first
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs

# Then run the script with full path
bash docs/deployment/plesk/plesk-deploy.sh

# Or copy script to root and run
cp docs/deployment/plesk/plesk-deploy.sh ./
chmod +x plesk-deploy.sh
./plesk-deploy.sh
```

### Permission Denied Errors

**Problem:** Permission denied when installing packages

**Solutions:**

1. **Use --user flag (already in script):**
   ```bash
   pip3 install --user -r requirements.txt
   ```

2. **Check file permissions:**
   ```bash
   ls -la backend/requirements.txt
   chmod 644 backend/requirements.txt
   ```

3. **Check directory permissions:**
   ```bash
   ls -la backend/
   chmod 755 backend/
   ```

### Database Connection Errors

**Problem:** Can't connect to PostgreSQL database

**Solutions:**

1. **Check database credentials in .env file:**
   ```bash
   cat .env | grep DB_
   ```

2. **Verify database exists:**
   ```bash
   # In Plesk: Databases → PostgreSQL
   # Or via command line:
   psql -U your_db_user -d your_db_name -h localhost
   ```

3. **Check PostgreSQL is running:**
   ```bash
   systemctl status postgresql
   ```

### Static Files Not Collecting

**Problem:** `collectstatic` fails or files not found

**Solutions:**

1. **Create staticfiles directory:**
   ```bash
   mkdir -p backend/staticfiles
   chmod 755 backend/staticfiles
   ```

2. **Check STATIC_ROOT in settings:**
   ```bash
   grep STATIC_ROOT backend/backend/settings.py
   ```

3. **Run manually:**
   ```bash
   cd backend
   python3 manage.py collectstatic --noinput
   ```

## Quick Fixes

### Run Individual Commands

If the script fails, run commands manually:

```bash
# 1. Navigate to project root
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs

# 2. Install dependencies
cd backend
python3 -m pip install --user -r requirements.txt --upgrade

# 3. Run migrations
python3 manage.py migrate --noinput

# 4. Collect static files
python3 manage.py collectstatic --noinput

# 5. Build frontend
cd ../frontend
npm install
npm run build

# 6. Set permissions
cd ..
chmod -R 755 backend/staticfiles
```

### Check Script Location

```bash
# Find where script is
find . -name "plesk-deploy.sh"

# Check script permissions
ls -la docs/deployment/plesk/plesk-deploy.sh

# Make executable if needed
chmod +x docs/deployment/plesk/plesk-deploy.sh
```

## Getting Help

If issues persist:
1. Check Plesk logs: **Logs** section in Plesk Panel
2. Check Python logs: **Python** → **Logs** (if available)
3. Check system logs: `journalctl -xe`
4. Verify environment variables are set correctly

