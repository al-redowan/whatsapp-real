# Render Deployment Guide

This guide explains how to deploy the WhatsApp Monitor on Render.com using your GitHub repository.

## Prerequisites

1. GitHub repository with all project files
2. Render.com account (free tier available)
3. Git configured for SSH access

## Deployment Steps

### 1. Push to GitHub

```bash
# Add all files to Git
git add .

# Commit changes
git commit -m "Add WhatsApp Monitor for Render deployment"

# Push to GitHub
git push origin main
```

### 2. Deploy on Render

1. **Login to Render.com**
2. **Click "New +" → "Web Service"**
3. **Connect GitHub repository**: `al-redowan/whatsapp-real`
4. **Configure deployment**:
   - **Name**: `whatsapp-monitor`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### 3. Environment Variables

Set these in Render dashboard:

```env
NODE_ENV=production
PORT=10000
HEADLESS=true
```

### 4. Custom Build Configuration

Render will automatically detect `render.yaml` for configuration.

## File Structure for Render

```
whatsapp-real/
├── render.yaml              # Render configuration
├── Dockerfile              # Container setup (optional)
├── package.json             # Dependencies
├── whatsapp-real.js         # Main application
├── file-storage.js          # Storage handler
├── public/                  # Web interface
├── api/                     # API endpoints
├── .github/workflows/       # GitHub Actions
└── data/                    # Message storage
```

## Important Notes

### Chrome Dependencies
Render automatically handles Chrome installation through the Dockerfile.

### File Storage
- Messages stored in `/tmp` directory on Render
- Data persists during app runtime only
- Consider adding database for production use

### Port Configuration
- Render assigns port automatically
- Application reads from `process.env.PORT`
- Default fallback is port 8080

### QR Code Access
- Access QR scanner at: `https://your-app.onrender.com`
- Scan with WhatsApp mobile app
- Session data stored temporarily

## Troubleshooting

### Build Failures
- Check build logs in Render dashboard
- Verify `package.json` dependencies
- Ensure Node.js version compatibility

### Chrome Issues
- Dockerfile includes all required dependencies
- HEADLESS mode enabled by default
- No manual Chrome installation needed

### Memory Limits
- Free tier has 512MB RAM limit
- Monitor usage in Render metrics
- Upgrade plan if needed for production

## Production Recommendations

1. **Upgrade to paid plan** for:
   - Persistent storage
   - Better performance
   - Custom domains

2. **Add database** for:
   - Message persistence
   - Multi-instance scaling
   - Data backup

3. **Configure monitoring** for:
   - Uptime tracking
   - Error alerts
   - Performance metrics

## Support

- Render documentation: https://render.com/docs
- GitHub repository: https://github.com/al-redowan/whatsapp-real
- Check logs in Render dashboard for debugging