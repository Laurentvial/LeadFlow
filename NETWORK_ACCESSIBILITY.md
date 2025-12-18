# Network Accessibility Guide

Quick reference for making your local backend accessible to other devices.

## Current Default Setup

**Backend runs on**: `127.0.0.1:8000`  
**Accessible from**: Same computer only ✅  
**Security**: High (no external access)

## Making Backend Accessible on Local Network

### Step 1: Find Your Computer's IP Address

```powershell
# Windows PowerShell
ipconfig | findstr IPv4

# Or more detailed
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}
```

Example output: `192.168.1.100` or `10.0.0.5`

### Step 2: Update Backend Configuration

**Edit `backend/.env` (or root `.env`):**

```env
# Add your local IP address
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100

# Or allow all (less secure, but easier)
# ALLOWED_HOSTS=*
```

### Step 3: Start Backend on All Interfaces

**Instead of:**
```powershell
python manage.py runserver 127.0.0.1:8000
```

**Use:**
```powershell
python manage.py runserver 0.0.0.0:8000
```

**Or with Daphne:**
```powershell
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

### Step 4: Configure Windows Firewall (if needed)

```powershell
# Allow port 8000 through firewall
New-NetFirewallRule -DisplayName "Django Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### Step 5: Update Frontend Configuration

**Edit `frontend/.env.production`:**

```env
# Use your computer's local IP address
VITE_URL=http://192.168.1.100:8000
```

**Rebuild frontend:**
```powershell
cd frontend
npm run build
```

### Step 6: Access from Other Devices

- **From other computers on same network**: `http://192.168.1.100:8000`
- **From phones/tablets on same WiFi**: `http://192.168.1.100:8000`
- **Frontend URL**: `http://192.168.1.100:3000` (if serving frontend on network too)

## Security Considerations

### ✅ Safe: Localhost Only (`127.0.0.1`)
- Only accessible from same computer
- No firewall changes needed
- Best for development

### ⚠️ Medium Risk: Local Network (`0.0.0.0` + Local IP)
- Accessible to devices on same WiFi/router
- Only use on trusted networks (home/office)
- Don't use on public WiFi
- Consider firewall rules

### ❌ High Risk: Internet Access (`0.0.0.0` + Public IP)
- **NOT recommended** without proper security
- Exposes your backend to entire internet
- Requires:
  - Strong authentication
  - HTTPS/SSL
  - Rate limiting
  - Proper firewall configuration
  - Security monitoring

## Quick Commands Reference

### Check Current IP
```powershell
ipconfig | findstr IPv4
```

### Test Backend Accessibility
```powershell
# From same computer
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health/"

# From another computer on network (replace with your IP)
Invoke-RestMethod -Uri "http://192.168.1.100:8000/health/"
```

### Check if Port is Open
```powershell
# From another computer
Test-NetConnection -ComputerName 192.168.1.100 -Port 8000
```

### Stop Backend
```powershell
# Find process
netstat -ano | findstr :8000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

## Troubleshooting

### "Connection Refused" from Other Devices

1. **Check backend is bound to `0.0.0.0`**, not `127.0.0.1`
2. **Check Windows Firewall** - may need to allow port 8000
3. **Verify IP address** - use `ipconfig` to confirm
4. **Check router settings** - some routers block local network access

### Firewall Blocking Connections

```powershell
# Check firewall rules
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Django*"}

# Add firewall rule
New-NetFirewallRule -DisplayName "Django Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow

# Remove firewall rule (if needed)
Remove-NetFirewallRule -DisplayName "Django Backend"
```

### IP Address Changed

If your IP address changes (common with DHCP), update:
1. `backend/.env` - `ALLOWED_HOSTS`
2. `frontend/.env.production` - `VITE_URL`
3. Rebuild frontend: `npm run build`

## Example: Complete Network Setup

```powershell
# 1. Find your IP
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}).IPAddress
Write-Host "Your IP: $ip"

# 2. Update .env
# ALLOWED_HOSTS=localhost,127.0.0.1,$ip

# 3. Start backend
cd backend
python manage.py runserver 0.0.0.0:8000

# 4. Update frontend .env.production
# VITE_URL=http://$ip:8000

# 5. Build and serve frontend
cd ..\frontend
npm run build
serve -s dist -l 3000 -H 0.0.0.0
```

## Internet Access (Worldwide)

To make your backend accessible from **anywhere in the world**:

### Quick Setup with Tunnel Service (Easiest)

```powershell
# Using ngrok (recommended)
ngrok http 8000
# Use the provided HTTPS URL

# Using localtunnel
lt --port 8000
# Use the provided HTTPS URL
```

### Full Internet Access Setup

**See `INTERNET_ACCESS_SETUP.md` for complete guide.**

**Quick steps:**
1. Get your public IP: `Invoke-RestMethod -Uri "https://api.ipify.org"`
2. Configure router port forwarding (port 8000)
3. Set `ALLOWED_HOSTS=*` in `.env`
4. Set `DEBUG=False` in `.env`
5. Start backend: `python manage.py runserver 0.0.0.0:8000`
6. Configure firewall: `New-NetFirewallRule -DisplayName "Django Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow`
7. **REQUIRED**: Set up HTTPS/SSL (see `INTERNET_ACCESS_SETUP.md`)

**Use the script:**
```powershell
.\start-internet.ps1
```

## Summary

| Setup | Command | Accessible From | Security | Use Case |
|-------|---------|------------------|----------|----------|
| Localhost only | `runserver 127.0.0.1:8000` | Same computer | ✅ High | Development |
| Local network | `runserver 0.0.0.0:8000` | Same WiFi/router | ⚠️ Medium | Testing on LAN |
| Internet (tunnel) | `ngrok http 8000` | Entire internet | ⚠️ Medium | Temporary/production |
| Internet (direct) | `runserver 0.0.0.0:8000` + port forward | Entire internet | ⚠️ Low-Medium* | Production (with security) |

*Security depends on implemented measures (HTTPS, auth, rate limiting, etc.)

**Recommendations:**
- Use `127.0.0.1` for development
- Use `0.0.0.0` only when you need to test on multiple devices on a trusted network
- Use tunnel services (ngrok) for temporary internet access
- Use direct internet access only with proper security measures (HTTPS, authentication, rate limiting)
