# WhatsApp Monitor

A real-time WhatsApp group monitoring system that captures and displays messages through a beautiful web dashboard. No database required - uses local file storage.

## Features

- Real-time WhatsApp group message monitoring
- Beautiful web dashboard with live updates
- File-based storage (no database setup needed)
- Search and filter messages
- Keep-alive endpoint for uptime monitoring
- Clean, responsive UI

## Quick Start

1. Clone this repository
2. Install dependencies: `npm install`
3. Start the application: `npm start`
4. Open http://localhost:5000 in your browser
5. Scan the QR code with your phone to authenticate WhatsApp

## File Structure

```
├── whatsapp-real.js          # Main application server
├── server/
│   └── file-storage.js       # File-based storage system
├── public/
│   └── index.html           # Web dashboard
├── data/                    # Auto-created for storing messages
│   ├── messages.json
│   ├── config.json
│   ├── groups.json
│   └── errors.json
└── vercel.json              # Deployment configuration
```

## API Endpoints

- `GET /` - Web dashboard
- `GET /api/status` - System status
- `GET /api/messages` - Retrieve messages
- `GET /health` - Health check
- `GET :3000/` - Keep-alive endpoint

## Deployment

### Railway (Recommended)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Render
1. Connect GitHub repository
2. Set start command: `node whatsapp-real.js`
3. Deploy

### DigitalOcean App Platform
1. Connect GitHub repository
2. Configure as Node.js app
3. Deploy

## Environment Variables

No environment variables required. The application uses file-based storage and auto-configuration.

## How It Works

1. **Authentication**: Scan QR code with WhatsApp mobile app
2. **Monitoring**: Automatically captures messages from all your WhatsApp groups
3. **Storage**: Messages saved to local JSON files
4. **Dashboard**: Real-time web interface displays captured messages
5. **Persistence**: Message history maintained across restarts

## Technical Details

- **Backend**: Node.js with Express
- **WhatsApp Integration**: whatsapp-web.js library
- **Storage**: JSON files (no database required)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Real-time Updates**: Automatic refresh every 30 seconds

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License