# How to Set Up Python Application Root in Plesk

## Step-by-Step Instructions

### Step 1: Log into Plesk Panel

1. Open your browser and go to your Plesk login URL (usually `https://your-server-ip:8443` or your domain's Plesk URL)
2. Log in with your credentials

### Step 2: Navigate to Your Domain

1. In the **left sidebar**, find **"Websites & Domains"** (or **"Hosting & DNS"** in newer Plesk versions)
2. Click on your domain name: `blissful-spence.82-165-44-164.plesk.page`

### Step 3: Find Python Settings

**Option A: If you see "Python" directly:**
- Look for **"Python"** in the list of options/tabs
- Click on **"Python"**

**Option B: If you see "Hosting & DNS" first:**
1. Click **"Hosting & DNS"** (or **"Websites & Domains"**)
2. Look for **"Python"** in the submenu or tabs
3. Click on **"Python"**

**Option C: Alternative path:**
- Sometimes it's under **"Hosting Settings"** → **"Python"**
- Or **"Additional Services"** → **"Python"**

### Step 4: Enable Python

1. You should see a page titled **"Python"** or **"Python Support"**
2. Look for a toggle switch or checkbox labeled:
   - **"Enable Python"** or
   - **"Python support"** or
   - **"Python application"**
3. **Turn it ON** (toggle switch to the right, or check the checkbox)

### Step 5: Set Application Root

After enabling Python, you should see these fields:

1. **"Application root"** or **"Application Root"** field
   - This is usually a text input box
   - **Type:** `/backend`
   - (This tells Plesk where your Django application is located)

2. **"Application startup file"** or **"Startup file"** field
   - This is usually a text input box or dropdown
   - **Type:** `passenger_wsgi.py`
   - (This tells Plesk which file to use to start your application)

### Step 6: Select Python Version (if available)

- Look for **"Python version"** dropdown
- Select **"Python 3.12"** (or the highest available version)

### Step 7: Save Settings

1. Look for a button at the bottom:
   - **"Apply"** or
   - **"OK"** or
   - **"Save"** or
   - **"Update"**
2. Click it to save your settings

### Step 8: Verify

After saving, Plesk should:
- Show a success message
- Automatically start your application
- Display status as "Running" or "Active"

---

## Visual Guide - What You Should See

```
Plesk Panel
├── Websites & Domains (or Hosting & DNS)
    └── blissful-spence.82-165-44-164.plesk.page
        ├── Python ← CLICK HERE
        │   ├── ☑ Enable Python (toggle ON)
        │   ├── Application root: [/backend] ← TYPE THIS
        │   ├── Application startup file: [passenger_wsgi.py] ← TYPE THIS
        │   └── Python version: [Python 3.12 ▼] ← SELECT THIS
        │   └── [Apply] or [OK] ← CLICK TO SAVE
```

---

## Common Field Names in Different Plesk Versions

The exact field names may vary slightly:

| What to Set | Possible Field Names |
|------------|---------------------|
| Application root | "Application root", "App root", "Application directory", "App directory" |
| Startup file | "Application startup file", "Startup file", "WSGI file", "Entry point" |
| Enable Python | "Enable Python", "Python support", "Python application", checkbox/toggle |

---

## Troubleshooting

### "Python" option not visible?

1. **Check if Python extension is installed:**
   - Go to **"Tools & Settings"** → **"Updates and Upgrades"**
   - Look for Python extension/component
   - Install if missing

2. **Contact your hosting provider:**
   - They may need to enable Python support for your account
   - Some shared hosting plans don't include Python

### "Application root" field not visible?

- Make sure you **enabled Python first** (toggle switch)
- The fields appear after enabling Python

### Can't find the domain settings?

- Make sure you're logged in as the domain owner/admin
- Some Plesk installations have different layouts
- Try searching for "Python" in the Plesk search bar (top right)

### Settings saved but application not starting?

1. Check **Python** → **Logs** in Plesk
2. Verify `passenger_wsgi.py` exists in your `httpdocs` folder
3. Check file permissions:
   ```bash
   ls -la /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/passenger_wsgi.py
   ```

---

## Quick Checklist

- [ ] Logged into Plesk Panel
- [ ] Selected your domain
- [ ] Found and clicked "Python"
- [ ] Enabled Python (toggle ON)
- [ ] Set Application root to: `/backend`
- [ ] Set Application startup file to: `passenger_wsgi.py`
- [ ] Selected Python 3.12 (if available)
- [ ] Clicked "Apply" or "OK"
- [ ] Verified application is running

---

## After Setup

Once configured, test your API:

```bash
# Via SSH
curl http://127.0.0.1:8000/api/health/

# Via browser
https://blissful-spence.82-165-44-164.plesk.page/api/health/
```

You should see: `{"status": "healthy", "service": "backend"}`

