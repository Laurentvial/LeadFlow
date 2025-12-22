# Frontend API Configuration

## Direct API Requests (No CORS Proxy)

The frontend is configured to make **direct API requests** to your Heroku backend. This means:

- ✅ All API calls go directly to: `https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com`
- ✅ No Vercel proxy is used
- ✅ CORS is handled by the backend (configured in `backend/backend/settings.py`)

## Environment Variable Setup

### For Vercel Deployment

You need to set the `VITE_URL` environment variable in Vercel:

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project: `lead-flow-orpin`
3. Go to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Name:** `VITE_URL`
   - **Value:** `https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com`
   - **Environment:** Production, Preview, Development (select all)
5. Click **Save**
6. **Redeploy** your application for changes to take effect

### For Local Development

Create a `.env` file in the `frontend` directory:

```env
VITE_URL=http://127.0.0.1:8000
```

Or use the default (localhost:8000) if not set.

## How It Works

All API calls use the `apiCall` function from `frontend/src/utils/api.ts`:

```typescript
const apiUrl = getEnvVar('VITE_URL') || 'http://127.0.0.1:8000';
```

This means:
- **Production (Vercel):** Uses `VITE_URL` environment variable → Direct to Heroku
- **Local Development:** Uses `VITE_URL` from `.env` or defaults to `http://127.0.0.1:8000`

## Files Using Direct API Calls

All these files make direct API requests:

1. `frontend/src/utils/api.ts` - Main API call function
2. `frontend/src/utils/auth.ts` - Authentication endpoints
3. `frontend/src/contexts/UserContext.tsx` - Token refresh
4. `frontend/src/components/Mails.tsx` - Email image loading
5. `frontend/src/components/ContactDocumentsTab.tsx` - Document downloads

## CORS Configuration

Since we're making direct cross-origin requests, the backend must have CORS properly configured:

✅ **Backend CORS Settings** (already configured):
- `CORS_ALLOW_ALL_ORIGINS = True` (allows all origins)
- CORS middleware is first in the middleware stack
- Proper CORS headers are sent with all responses

## Testing Direct API Calls

After setting `VITE_URL` in Vercel and redeploying:

1. Open browser DevTools → Network tab
2. Make an API request from your frontend
3. You should see requests going directly to:
   `https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/api/...`
4. Check response headers - should include:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
   Access-Control-Allow-Headers: authorization, content-type, ...
   ```

## Troubleshooting

### CORS Errors Still Occurring?

1. **Verify backend CORS is configured:**
   ```powershell
   # Check backend logs
   heroku logs --tail --app leadflow-backend-eu
   ```

2. **Verify VITE_URL is set in Vercel:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Make sure `VITE_URL` is set correctly
   - Redeploy after setting

3. **Check browser console:**
   - Look for CORS error messages
   - Verify the request URL is correct

4. **Test backend CORS directly:**
   ```powershell
   Invoke-RestMethod -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/cors-test/" -Headers @{"Origin"="https://lead-flow-orpin.vercel.app"}
   ```

### API Calls Going to Wrong URL?

1. **Check environment variable:**
   ```javascript
   // In browser console
   console.log(import.meta.env.VITE_URL);
   ```

2. **Verify Vercel environment variable:**
   - Must be set in Vercel dashboard
   - Must redeploy after setting

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

## Summary

✅ **Frontend:** Makes direct API calls (no proxy)
✅ **Backend:** Handles CORS with proper headers
✅ **Configuration:** Set `VITE_URL` environment variable in Vercel
✅ **Result:** Direct communication between frontend and backend

