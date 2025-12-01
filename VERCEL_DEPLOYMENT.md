# Vercel Deployment Guide

## Prerequisites
- Vercel account (sign up at https://vercel.com)
- Vercel CLI installed globally: `npm install -g vercel`

## Environment Variables
Before deploying, make sure to set up these environment variables in Vercel:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add the following variables:
   - `MONGO_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Your JWT secret key
   - `PORT` - Set to 3000 (or leave blank, Vercel handles this)
   - Any other environment variables your app uses

## Deployment Steps

### Option 1: Deploy via Vercel CLI (Recommended)

1. Install Vercel CLI if not already installed:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy to production:
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via Git Integration

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to https://vercel.com/new
3. Import your repository
4. Vercel will automatically detect the configuration
5. Add your environment variables
6. Click "Deploy"

## Important Notes

- **Database Connection**: The app uses MongoDB. Make sure your MongoDB Atlas (or other cloud MongoDB) allows connections from anywhere (0.0.0.0/0) or whitelist Vercel's IP ranges.

- **Serverless Functions**: Vercel runs this backend as serverless functions. The `slotScheduler` in your original `server.js` won't work in serverless. You may need to:
  - Use Vercel Cron Jobs (https://vercel.com/docs/cron-jobs)
  - Or use an external cron service to trigger an API endpoint

- **CORS Configuration**: Update your CORS settings in `src/app.js` to allow your frontend domain.

## Files Created for Vercel

- `vercel.json` - Vercel configuration
- `api/index.js` - Serverless function entry point
- `.vercelignore` - Files to exclude from deployment

## Testing Locally

To test the serverless setup locally with Vercel CLI:
```bash
vercel dev
```

## Post-Deployment

After deployment, your API will be available at:
```
https://your-project-name.vercel.app/api/health
```

Update your frontend to use this new API URL.
