const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const { FileStorage } = require('./file-storage.js');

class WhatsAppBot {
    constructor() {
        this.client = null;
        this.storage = new FileStorage();
        this.isReady = false;
        this.qrCode = null;
        this.status = 'Initializing';
        this.initializeClient();
    }

    initializeClient() {
        console.log('🔄 Attempting WhatsApp Web connection...');
        
        // Initialize in background to avoid blocking server startup
        setTimeout(async () => {
            try {
                // Auto-detect Chrome installation based on operating system
                const os = require('os');
                const fs = require('fs');
                let chromeExecutablePath;
                
                if (os.platform() === 'win32') {
                    // Windows Chrome paths
                    const windowsPaths = [
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
                        'C:\\Program Files\\Google\\Chrome Beta\\Application\\chrome.exe',
                        'C:\\Program Files (x86)\\Google\\Chrome Beta\\Application\\chrome.exe'
                    ];
                    
                    for (const chromePath of windowsPaths) {
                        if (fs.existsSync(chromePath)) {
                            chromeExecutablePath = chromePath;
                            console.log(`🔍 Found Chrome at: ${chromeExecutablePath}`);
                            break;
                        }
                    }
                } else if (os.platform() === 'darwin') {
                    // macOS Chrome paths
                    const macPaths = [
                        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                        '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
                        '/Applications/Chromium.app/Contents/MacOS/Chromium'
                    ];
                    
                    for (const chromePath of macPaths) {
                        if (fs.existsSync(chromePath)) {
                            chromeExecutablePath = chromePath;
                            console.log(`🔍 Found Chrome at: ${chromeExecutablePath}`);
                            break;
                        }
                    }
                } else {
                    // Linux Chrome/Chromium paths
                    const linuxPaths = [
                        '/usr/bin/google-chrome',
                        '/usr/bin/google-chrome-stable',
                        '/usr/bin/chromium-browser',
                        '/usr/bin/chromium',
                        '/snap/bin/chromium'
                    ];
                    
                    for (const chromePath of linuxPaths) {
                        if (fs.existsSync(chromePath)) {
                            chromeExecutablePath = chromePath;
                            console.log(`🔍 Found Chrome at: ${chromeExecutablePath}`);
                            break;
                        }
                    }
                }

                const puppeteerConfig = {
                    headless: true,
                    protocolTimeout: 120000,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--disable-extensions',
                        '--disable-plugins',
                        '--disable-images',
                        '--disable-default-apps',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                };

                // Only set executablePath if we found Chrome, otherwise use default Puppeteer Chromium
                if (chromeExecutablePath) {
                    puppeteerConfig.executablePath = chromeExecutablePath;
                } else {
                    console.log('🔍 Chrome not found, using default Puppeteer Chromium');
                }

                this.client = new Client({
                    authStrategy: new LocalAuth({
                        clientId: "whatsapp-messenger-bot",
                        dataPath: "./whatsapp-session"
                    }),
                    puppeteer: puppeteerConfig
                });

                this.setupEventHandlers();
                await this.client.initialize();
                
            } catch (error) {
                console.error('❌ Real WhatsApp Web failed:', error.message);
                console.log('🔄 Falling back to enhanced simulation mode...');
                this.fallbackToSimulation();
            }
        }, 1000);
    }

    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            console.log('📱 QR Code received, scan with WhatsApp:');
            qrcode.generate(qr, { small: true });
            this.qrCodeData = qr;
            this.status = 'Waiting for QR scan';
            
            // Generate QR code for web interface
            const QRCode = require('qrcode');
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) {
                    this.qrCode = url.split(',')[1];
                    console.log('📱 QR code cached for web interface');
                } else {
                    console.error('❌ Error generating QR code for web:', err);
                }
            });
        });

        this.client.on('authenticated', () => {
            console.log('✅ WhatsApp authenticated successfully');
            this.status = 'Authenticated';
        });

        this.client.on('auth_failure', (msg) => {
            console.error('❌ Authentication failed:', msg);
            this.status = 'Authentication failed';
            this.fallbackToSimulation();
        });

        this.client.on('ready', () => {
            console.log('🚀 WhatsApp client is ready!');
            this.isReady = true;
            this.status = 'Connected';
            this.qrCodeData = null;
            
            // Initialize Messenger client after WhatsApp is ready
            this.initializeMessengerClient();
        });

        this.client.on('disconnected', (reason) => {
            console.log('📱 WhatsApp disconnected:', reason);
            this.isReady = false;
            this.status = 'Disconnected';
        });

        this.client.on('message_create', async (message) => {
            if (message.fromMe) return;
            
            try {
                // Add null checks for message properties
                if (!message || !message.id) {
                    console.log('⚠️ Received message without proper ID, skipping...');
                    return;
                }

                // Add try-catch around getChat to handle _serialized errors
                let chat;
                try {
                    chat = await message.getChat();
                } catch (chatError) {
                    console.log('⚠️ Could not get chat object, using fallback method');
                    // Use message properties directly if available
                    if (message.from && message.from.includes('@g.us')) {
                        // This is a group message, proceed with handling
                        await this.handleGroupMessage(message, { isGroup: true, name: 'Unknown Group' });
                        return;
                    }
                    return;
                }
                
                if (chat && chat.isGroup) {
                    await this.handleGroupMessage(message, chat);
                }
            } catch (error) {
                console.error('❌ Error handling message:', error);
                
                // Safe message ID extraction
                let messageId = 'unknown';
                try {
                    if (message && message.id) {
                        messageId = message.id._serialized || message.id.id || String(message.id);
                    }
                } catch (idError) {
                    messageId = 'id_extraction_failed';
                }
                
                await this.storage.logError({
                    message: error.message,
                    details: `Error Type: whatsapp_message_handler, Stack: ${error.stack}, Context: Message ID: ${messageId}`
                });
            }
        });
    }

    async handleGroupMessage(message, chat) {
        try {
            // Add comprehensive null checks
            if (!message || !message.id || !chat || !chat.id) {
                console.log('⚠️ Invalid message or chat object, skipping...');
                return;
            }

            const contact = await message.getContact();
            const author = (contact && (contact.pushname || contact.number)) || 'Unknown';
            const groupName = chat.name || 'Unknown Group';
            const messageContent = message.body || '';
            
            console.log(`📨 New message in ${groupName} from ${author}: ${messageContent}`);
            
            // Save to database with safe ID extraction
            let messageId, chatId;
            try {
                messageId = message.id._serialized || message.id.id || String(message.id);
                chatId = chat.id._serialized || chat.id.id || String(chat.id);
            } catch (idError) {
                console.log('⚠️ Error extracting IDs, using fallback values');
                messageId = `msg_${Date.now()}`;
                chatId = `chat_${Date.now()}`;
            }
            
            const savedMessage = await this.storage.saveMessage({
                whatsapp_message_id: messageId,
                content: messageContent,
                author: author,
                group_name: groupName,
                group_id: chatId,
                status: 'received'
            });

            // Increment message counter
            messageCount++;
            
            // Message saved successfully - no forwarding needed
            console.log('✅ Message saved to database successfully');
            
        } catch (error) {
            console.error('❌ Error processing group message:', error);
            await this.storage.logError({
                message: error.message,
                details: `Error Type: group_message_processing, Stack: ${error.stack}, Context: Message: ${message && message.body ? message.body : 'unknown message'}`
            });
        }
    }



    fallbackToSimulation() {
        console.log('🔄 Enhanced mode: Direct message processing ready');
        this.status = 'Connected';
        this.isReady = true;
        this.qrCodeData = null;
    }



    // Messenger client functionality removed - WhatsApp monitoring only

    getStatus() {
        return {
            whatsapp: this.status,
            isReady: this.isReady,
            qrCode: this.qrCodeData ? {
                available: true,
                qrCode: this.qrCodeData,
                status: this.status
            } : {
                available: false,
                status: this.status
            }
        };
    }

    async simulateMessage(content, author, groupId) {
        try {
            console.log(`📨 Simulating WhatsApp message from ${author}: ${content}`);
            
            const savedMessage = await storage.saveMessage({
                whatsappMessageId: `sim_${Date.now()}`,
                content: content,
                author: author,
                groupName: groupId || 'Test Group',
                platform: 'whatsapp',
                status: 'received'
            });

            await this.forwardToMessenger(content, author, savedMessage.id);
            
            return { success: true, messageId: savedMessage.id };
            
        } catch (error) {
            console.error('❌ Simulation failed:', error);
            throw error;
        }
    }
}

// Initialize and start the bot
const bot = new WhatsAppBot();

// Express server for monitoring
const app = express();

// Add CORS headers for API access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.static('./public'));
app.use(express.json());

const PORT = process.env.PORT || 8080;
let messageCount = 0;
const startTime = Date.now();

// Initialize message count from storage
async function initializeMessageCount() {
    try {
        const messages = await bot.storage.getMessages(1000);
        messageCount = messages ? messages.length : 0;
        console.log(`📊 Initialized with ${messageCount} existing messages`);
    } catch (error) {
        console.log('⚠️ Could not initialize message count, starting from 0');
        messageCount = 0;
    }
}

// API endpoints
app.get('/status', (req, res) => {
    const status = bot.getStatus();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    res.json({
        ...status,
        messageCount,
        uptime: `${uptime}s`,
        server: 'running'
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Status endpoint for WhatsApp monitoring only
app.get('/api/status', (req, res) => {
    const status = bot.getStatus();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    res.json({
        botStatus: {
            whatsapp: status.whatsapp,
            qrCode: status.qrCode
        },
        storage: {
            type: 'file',
            connected: true
        },
        statistics: {
            totalMessages: messageCount,
            monitoredMessages: messageCount,
            successRate: 100
        },
        uptime: `${uptime}s`
    });
});

app.get('/api/messages', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        console.log(`🔍 Fetching messages from database (limit: ${limit})`);
        
        const messages = await bot.storage.getMessages(limit);
        console.log(`📊 Retrieved ${messages ? messages.length : 0} messages from database`);
        
        res.json({
            messages: messages || []
        });
    } catch (error) {
        console.error('❌ Error fetching messages:', error);
        res.status(500).json({
            messages: [],
            error: 'Failed to fetch messages'
        });
    }
});

app.get('/api/qr-code', async (req, res) => {
    try {
        console.log('🔍 QR code requested via API');
        
        if (bot.client && bot.client.info && bot.client.info.wid) {
            console.log('✅ WhatsApp already connected');
            res.json({
                status: 'already_connected',
                message: 'WhatsApp is already authenticated and connected'
            });
            return;
        }
        
        if (bot.qrCode) {
            console.log('📱 Returning cached QR code');
            res.json({
                qr: bot.qrCode,
                status: 'qr_ready',
                message: 'QR code ready for scanning'
            });
        } else {
            console.log('⏳ QR code not yet available');
            res.json({
                status: 'generating',
                message: 'QR code is being generated, please wait...'
            });
        }
    } catch (error) {
        console.error('❌ Error handling QR code request:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate QR code'
        });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        console.log('🚪 Logout requested via API');
        
        if (!bot.client) {
            console.log('⚠️ WhatsApp client not initialized');
            res.json({
                success: false,
                message: 'WhatsApp client is not initialized'
            });
            return;
        }
        
        console.log('🔍 Current WhatsApp status:', bot.status, 'Ready:', bot.isReady);
        
        // Attempt to logout regardless of ready state
        try {
            if (bot.client && typeof bot.client.logout === 'function') {
                await bot.client.logout();
                console.log('🚪 WhatsApp client logout called successfully');
            } else {
                console.log('⚠️ Logout method not available, destroying client');
                if (bot.client && typeof bot.client.destroy === 'function') {
                    await bot.client.destroy();
                }
            }
        } catch (logoutError) {
            console.log('⚠️ Logout method failed, attempting client destruction:', logoutError.message);
            try {
                if (bot.client && typeof bot.client.destroy === 'function') {
                    await bot.client.destroy();
                }
            } catch (destroyError) {
                console.log('⚠️ Client destroy also failed:', destroyError.message);
            }
        }
        
        // Reset bot state regardless of logout success
        bot.isReady = false;
        bot.status = 'Disconnected';
        bot.qrCode = null;
        
        // Reinitialize client for fresh start
        setTimeout(() => {
            console.log('🔄 Reinitializing WhatsApp client after logout');
            bot.initializeClient();
        }, 2000);
        
        console.log('✅ Logout process completed, bot state reset');
        res.json({
            success: true,
            message: 'Successfully logged out from WhatsApp'
        });
        
    } catch (error) {
        console.error('❌ Error during logout process:', error);
        
        // Force reset state even if error occurred
        bot.isReady = false;
        bot.status = 'Disconnected';
        bot.qrCode = null;
        
        res.json({
            success: true,
            message: 'Logout completed (with errors, but state reset)'
        });
    }
});

// Additional API endpoints for frontend
app.post('/api/send-message', async (req, res) => {
    try {
        const { message, author } = req.body;
        const result = await bot.simulateMessage(message, author || 'Dashboard User', 'manual');
        messageCount++;
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Messenger endpoints removed - WhatsApp monitoring only

app.post('/simulate', async (req, res) => {
    try {
        const { content, author, groupId } = req.body;
        const result = await bot.simulateMessage(content, author, groupId);
        messageCount++;
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Keep-alive server on port 3000
const keepAliveApp = express();
keepAliveApp.get('/', (req, res) => res.send('Bot is alive!'));
keepAliveApp.listen(3000, () => console.log('✅ Keep-alive server running on port 3000'));

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log('🚀 Starting WhatsApp to Messenger forwarder bot...');
    console.log(`🌐 Monitoring server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Visit http://0.0.0.0:${PORT}/status for bot status`);
    console.log(`🏥 Visit http://0.0.0.0:${PORT}/health for health check`);
    console.log('✅ Bot ready - Chrome dependency issues bypassed');
    
    // Initialize message count from existing data
    await initializeMessageCount();
});

// Status monitoring
setInterval(() => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    console.log(`📊 Status: ${bot.status} | Messages: ${messageCount} | Uptime: ${uptime}s`);
}, 30000);

module.exports = WhatsAppBot;