# Installing Heroku CLI on Windows

## Option 1: Installer (Recommended)

1. **Download the Heroku CLI installer:**
   - Visit: https://devcenter.heroku.com/articles/heroku-cli
   - Or direct download: https://cli-assets.heroku.com/heroku-x64.exe

2. **Run the installer:**
   - Double-click the downloaded `.exe` file
   - Follow the installation wizard
   - The installer will add Heroku CLI to your PATH

3. **Restart PowerShell/Terminal:**
   - Close and reopen your PowerShell window
   - Verify installation: `heroku --version`

## Option 2: Using Chocolatey (if you have it)

```powershell
choco install heroku-cli
```

## Option 3: Using Scoop (if you have it)

```powershell
scoop install heroku
```

## Option 4: Using npm (if you have Node.js)

```powershell
npm install -g heroku
```

## Verify Installation

After installation, restart PowerShell and run:

```powershell
heroku --version
```

You should see something like: `heroku/8.x.x`

## After Installation

1. **Login to Heroku:**
   ```powershell
   heroku login
   ```
   This will open a browser window for authentication.

2. **Verify you're logged in:**
   ```powershell
   heroku auth:whoami
   ```

## Troubleshooting

If `heroku` command is still not recognized after installation:

1. **Check if Heroku is in PATH:**
   - Heroku CLI is usually installed in: `C:\Program Files\Heroku\bin`
   - Add it to your PATH if needed:
     - Open System Properties → Environment Variables
     - Edit PATH variable
     - Add: `C:\Program Files\Heroku\bin`

2. **Restart PowerShell completely** (not just close/reopen, but restart the application)

3. **Try using full path:**
   ```powershell
   & "C:\Program Files\Heroku\bin\heroku.cmd" --version
   ```

