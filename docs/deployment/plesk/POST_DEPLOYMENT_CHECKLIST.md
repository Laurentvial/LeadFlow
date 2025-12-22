# Post-Deployment Checklist for Plesk

## ✅ After Deployment Completes Successfully

### Step 1: Set Environment Variables

**In Plesk Panel:**
1. Go to **Hosting & DNS** → **Python** → **Environment Variables**
   - Or if Python UI not available, create `.env` file in `httpdocs` folder

2. **Required Variables:**
   ```bash
   SECRET_KEY=your-generated-secret-key-here
   DEBUG=False
   ALLOWED_HOSTS=blissful-spence.82-165-44-164.plesk.page,your-domain.com
   
   # Database (from PostgreSQL you created)
   DB_HOST=localhost
   DB_NAME=leadflow_db
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_PORT=5432
   
   # CORS & Security
   CSRF_TRUSTED_ORIGINS=https://blissful-spence.82-165-44-164.plesk.page,https://your-domain.com
   ```

3. **Generate SECRET_KEY:**
   ```bash
   python3.12 -c "import secrets; print(secrets.token_urlsafe(50))"
   ```

### Step 2: Create Database Superuser

**Via SSH Terminal:**
```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
python3.12 manage.py createsuperuser
```

Enter:
- Username
- Email
- Password (twice)

### Step 3: Configure Web Server

#### For Apache:
1. **Files** → `httpdocs` folder
2. Create `.htaccess` file (copy from `docs/deployment/plesk/plesk.htaccess`)
3. Update paths in `.htaccess`:
   - Replace `your-domain.com` with `blissful-spence.82-165-44-164.plesk.page`

#### For Nginx:
1. **Hosting & DNS** → **Apache & nginx Settings**
2. Scroll to **Additional nginx directives**
3. **IMPORTANT:** Copy content from `docs/deployment/plesk/plesk-nginx-fixed.conf` (NOT plesk-nginx.conf)
   - This version removes the `location /` block that conflicts with Plesk
4. Update paths to match your domain
5. **Set Document Root** to `/httpdocs/frontend/dist` in Hosting Settings to serve frontend

### Step 4: Verify Application is Running

**Check URLs:**
- Frontend: `http://blissful-spence.82-165-44-164.plesk.page`
- API Health: `http://blissful-spence.82-165-44-164.plesk.page/api/health/`
- Admin Panel: `http://blissful-spence.82-165-44-164.plesk.page/admin/`
- Static Files: `http://blissful-spence.82-165-44-164.plesk.page/static/`

### Step 5: Enable HTTPS/SSL

1. **Plesk Panel** → **SSL/TLS Certificates**
2. Click **Let's Encrypt** or **Add SSL Certificate**
3. Select your domain
4. Enable **Redirect from HTTP to HTTPS**
5. Click **Install**

### Step 6: Test Application Features

**Test Checklist:**
- [ ] Frontend loads correctly
- [ ] API endpoints respond (`/api/health/`)
- [ ] Admin panel accessible (`/admin/`)
- [ ] Static files loading (`/static/`)
- [ ] Can login/create account
- [ ] Database operations work
- [ ] WebSocket connections (if enabled)

### Step 7: Set Up Monitoring

**Check Logs:**
```bash
# Application logs
tail -f /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/error_log

# Python logs (if available)
# In Plesk: Python → Logs

# System logs
journalctl -u leadflow -f  # If using systemd
```

### Step 8: Configure Scheduled Tasks (Optional)

**For periodic tasks (e.g., cleanup, backups):**
1. **Plesk Panel** → **Scheduled Tasks**
2. Add task to run Django management commands:
   ```bash
   cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend && python3.12 manage.py your_command
   ```

## 🔧 Common Post-Deployment Tasks

### Restart Application

**If using Passenger:**
- Restart via Plesk Panel: **Python** → **Restart**

**If using systemd:**
```bash
sudo systemctl restart leadflow
sudo systemctl status leadflow
```

### Update Application

**When you push new code:**
```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs

# Pull latest code
git pull origin main

# Run deployment script
./plesk-deploy.sh
```

### Backup Database

**Via Plesk:**
1. **Databases** → **PostgreSQL**
2. Click on your database
3. Click **Backup**

**Via SSH:**
```bash
pg_dump -U your_db_user -h localhost leadflow_db > backup_$(date +%Y%m%d).sql
```

### Check Application Status

```bash
# Check if processes are running
ps aux | grep python
ps aux | grep gunicorn
ps aux | grep daphne

# Check port usage
netstat -tulpn | grep :8000

# Check disk space
df -h
```

## 🆘 Troubleshooting

### Application Not Loading

1. **Check logs:**
   ```bash
   tail -50 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/error_log
   ```

2. **Check environment variables:**
   ```bash
   # If using .env file
   cat .env
   
   # Or check in Plesk: Python → Environment Variables
   ```

3. **Check database connection:**
   ```bash
   cd backend
   python3.12 manage.py dbshell
   ```

### Static Files Not Loading

```bash
# Recollect static files
cd backend
python3.12 manage.py collectstatic --noinput

# Check permissions
chmod -R 755 backend/staticfiles
chmod -R 755 backend/media
```

### 500 Internal Server Error

1. Check Django logs
2. Verify environment variables are set
3. Check database connection
4. Verify `DEBUG=False` in production (should be False)

### Frontend Not Loading

1. Check if frontend was built:
   ```bash
   ls -la frontend/dist/
   ```

2. Rebuild if needed:
   ```bash
   cd frontend
   npm run build
   ```

## 📋 Quick Reference Commands

```bash
# Navigate to project
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs

# Run migrations
cd backend && python3.12 manage.py migrate

# Create superuser
cd backend && python3.12 manage.py createsuperuser

# Collect static files
cd backend && python3.12 manage.py collectstatic --noinput

# Check Django shell
cd backend && python3.12 manage.py shell

# View logs
tail -f logs/error_log

# Restart (if using systemd)
sudo systemctl restart leadflow
```

## ✅ Final Checklist

- [ ] Environment variables set
- [ ] Database superuser created
- [ ] Web server configured (Apache/Nginx)
- [ ] SSL certificate installed
- [ ] Frontend loads correctly
- [ ] API endpoints work
- [ ] Admin panel accessible
- [ ] Static files loading
- [ ] Application tested
- [ ] Logs monitored
- [ ] Backup configured

## 🎉 You're Done!

Your application should now be live and accessible. Bookmark these URLs:
- **Frontend:** `https://blissful-spence.82-165-44-164.plesk.page`
- **Admin:** `https://blissful-spence.82-165-44-164.plesk.page/admin/`
- **API:** `https://blissful-spence.82-165-44-164.plesk.page/api/`

