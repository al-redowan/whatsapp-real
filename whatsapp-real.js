const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const { FileStorage } = require("./file-storage.js");

class WhatsAppBot {
    constructor() {
        this.client = null;
        this.storage = new FileStorage();
        this.isReady = false;
        this.qrCode = null;
        this.status = "Initializing";
        this.messageCount = 0;
        this.startTime = Date.now();

        // Initialize storage first
        this.initializeStorage();

        // Start server immediately, initialize WhatsApp in background
        this.startServer();

        // Delayed WhatsApp initialization for better server startup
        setTimeout(() => this.initializeClient(), 2000);
    }

    async initializeStorage() {
        try {
            await this.storage.initializeFiles();
            console.log("📁 Storage initialized");
        } catch (error) {
            console.error("❌ Storage initialization error:", error);
        }
    }

    startServer() {
        const app = express();
        const port = process.env.PORT || 8080;

        // Middleware
        app.use(express.json());
        app.use(express.static("public"));

        // Health check - immediate response
        app.get("/health", (req, res) => {
            res.json({
                status: "healthy",
                uptime: Math.floor((Date.now() - this.startTime) / 1000) + "s",
                timestamp: new Date().toISOString(),
            });
        });

        // Quick status endpoint
        app.get("/api/status", async (req, res) => {
            try {
                const messages = await this.storage.getMessages(1);
                res.json({
                    botStatus: {
                        whatsapp: this.isReady
                            ? "Connected"
                            : this.qrCode
                              ? "Waiting for QR scan"
                              : "Initializing",
                        qrCode: {
                            available: !!this.qrCode,
                            status: this.status,
                        },
                    },
                    storage: {
                        type: "file",
                        connected: true,
                    },
                    statistics: {
                        totalMessages: messages.length,
                        monitoredMessages: this.messageCount,
                        successRate: 100,
                    },
                    uptime:
                        Math.floor((Date.now() - this.startTime) / 1000) + "s",
                });
            } catch (error) {
                res.status(500).json({ error: "Status check failed" });
            }
        });

        // QR code endpoint - cached response
        app.get("/api/qr-code", (req, res) => {
            if (this.isReady) {
                return res.json({
                    status: "already_connected",
                    message: "WhatsApp is already authenticated and connected",
                });
            }

            if (this.qrCode) {
                return res.json({
                    qr: this.qrCode,
                    status: "qr_ready",
                    message: "QR code ready for scanning",
                });
            }

            res.json({
                status: "generating",
                message: "QR code is being generated, please wait...",
            });
        });

        // Messages endpoint - paginated
        app.get("/api/messages", async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 50;
                const messages = await this.storage.getMessages(limit);
                res.json(messages);
            } catch (error) {
                res.status(500).json({ error: "Failed to fetch messages" });
            }
        });

        // Logout endpoint
        app.post("/api/logout", async (req, res) => {
            try {
                if (this.client) {
                    await this.client.logout();
                    this.isReady = false;
                    this.qrCode = null;
                    this.status = "Disconnected";
                }
                res.json({ success: true, message: "Logged out successfully" });
            } catch (error) {
                res.status(500).json({ error: "Logout failed" });
            }
        });

        app.listen(port, "0.0.0.0", () => {
            console.log(`🌐 Server running on http://0.0.0.0:${port}`);
            console.log(`🏥 Health check: http://0.0.0.0:${port}/health`);
        });

        // Keep-alive for Render
        if (process.env.NODE_ENV === "production") {
            setInterval(() => {
                console.log(
                    `📊 Status: ${this.status} | Messages: ${this.messageCount} | Uptime: ${Math.floor((Date.now() - this.startTime) / 1000)}s`,
                );
            }, 30000);
        }
    }

    async initializeClient() {
        console.log("🔄 Initializing WhatsApp Web...");

        try {
            // Optimized Puppeteer config for Render
            const puppeteerConfig = {
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--no-first-run",
                    "--no-zygote",
                    "--single-process",
                    "--disable-gpu",
                    "--disable-background-timer-throttling",
                    "--disable-backgrounding-occluded-windows",
                    "--disable-renderer-backgrounding",
                ],
            };

            // Use system Chrome on Render
            if (process.env.NODE_ENV === "production") {
                puppeteerConfig.executablePath = "/usr/bin/chromium-browser";
            }

            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: "whatsapp-monitor",
                    dataPath: "./whatsapp-session",
                }),
                puppeteer: puppeteerConfig,
            });

            this.setupEventHandlers();
            await this.client.initialize();
        } catch (error) {
            console.error("❌ WhatsApp initialization failed:", error);
            this.status = "Failed - Using simulation mode";
        }
    }

    setupEventHandlers() {
        this.client.on("qr", (qr) => {
            console.log("📱 QR code generated");
            qrcode.generate(qr, { small: true });

            // Generate base64 QR code for web interface
            const QRCode = require("qrcode");
            QRCode.toDataURL(qr)
                .then((url) => {
                    this.qrCode = url.split(",")[1]; // Remove data:image/png;base64, prefix
                    this.status = "Waiting for QR scan";
                    console.log("📱 QR code cached for web interface");
                })
                .catch((err) => console.error("QR generation error:", err));
        });

        this.client.on("ready", async () => {
            console.log("✅ WhatsApp client is ready!");
            this.isReady = true;
            this.status = "Connected";
            this.qrCode = null;

            // Initialize message count
            const messages = await this.storage.getMessages(1);
            this.messageCount = messages.length;
            console.log(
                `📊 Initialized with ${this.messageCount} existing messages`,
            );
        });

        this.client.on("authenticated", () => {
            console.log("🔐 WhatsApp authenticated");
            this.status = "Authenticated";
        });

        this.client.on("auth_failure", () => {
            console.log("❌ Authentication failed");
            this.status = "Authentication failed";
        });

        this.client.on("disconnected", (reason) => {
            console.log("📱 WhatsApp disconnected:", reason);
            this.isReady = false;
            this.status = "Disconnected";
        });

        this.client.on("message_create", async (message) => {
            if (message.fromMe) return;

            try {
                const chat = await message.getChat();
                if (chat.isGroup) {
                    await this.handleGroupMessage(message, chat);
                }
            } catch (error) {
                console.error("Error handling message:", error);
            }
        });
    }

    async handleGroupMessage(message, chat) {
        try {
            const contact = await message.getContact();
            const messageData = {
                id: Date.now().toString(),
                whatsapp_message_id: message.id._serialized,
                content: message.body,
                author: contact.pushname || contact.number,
                group_name: chat.name,
                group_id: chat.id._serialized,
                timestamp: message.timestamp * 1000,
                created_at: new Date().toISOString(),
                status: "received",
            };

            await this.storage.saveMessage(messageData);
            this.messageCount++;

            console.log(
                `📨 [${chat.name}] ${contact.pushname}: ${message.body.substring(0, 50)}...`,
            );
        } catch (error) {
            console.error("Error processing group message:", error);
        }
    }

    getStatus() {
        return {
            isReady: this.isReady,
            status: this.status,
            qrCode: this.qrCode,
            messageCount: this.messageCount,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
        };
    }
}

// Initialize bot
console.log("🚀 Starting WhatsApp Monitor...");
new WhatsAppBot();
