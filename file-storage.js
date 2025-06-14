const fs = require('fs').promises;
const path = require('path');

class FileStorage {
    constructor() {
        this.dataDir = './data';
        this.messagesFile = path.join(this.dataDir, 'messages.json');
        this.configFile = path.join(this.dataDir, 'config.json');
        this.groupsFile = path.join(this.dataDir, 'groups.json');
        this.errorsFile = path.join(this.dataDir, 'errors.json');
        
        this.initializeFiles();
    }

    async initializeFiles() {
        try {
            // Create data directory if it doesn't exist
            try {
                await fs.access(this.dataDir);
            } catch {
                await fs.mkdir(this.dataDir, { recursive: true });
                console.log('📁 Created data directory');
            }

            // Initialize files if they don't exist
            const files = [
                { path: this.messagesFile, default: [] },
                { path: this.configFile, default: {} },
                { path: this.groupsFile, default: [] },
                { path: this.errorsFile, default: [] }
            ];

            for (const file of files) {
                try {
                    await fs.access(file.path);
                } catch {
                    await this.writeJsonFile(file.path, file.default);
                    console.log(`📄 Created ${path.basename(file.path)}`);
                }
            }
        } catch (error) {
            console.error('❌ Error initializing storage files:', error);
        }
    }

    async readJsonFile(filePath, defaultValue = []) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.warn(`⚠️ Could not read ${filePath}, using default:`, error.message);
            return defaultValue;
        }
    }

    async writeJsonFile(filePath, data) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`❌ Error writing to ${filePath}:`, error);
            throw error;
        }
    }

    async saveMessage(message) {
        try {
            const messages = await this.readJsonFile(this.messagesFile, []);
            
            const newMessage = {
                id: Date.now(),
                whatsapp_message_id: message.whatsapp_message_id,
                content: message.content,
                author: message.author,
                group_name: message.group_name,
                group_id: message.group_id,
                status: message.status || 'received',
                timestamp: new Date().toISOString(),
                created_at: new Date().toISOString()
            };

            messages.unshift(newMessage);
            
            // Keep only last 1000 messages to prevent file from getting too large
            if (messages.length > 1000) {
                messages.splice(1000);
            }

            await this.writeJsonFile(this.messagesFile, messages);
            console.log('✅ Message saved to database successfully');
            return newMessage;
        } catch (error) {
            console.error('❌ Error saving message:', error);
            throw error;
        }
    }

    async updateMessageStatus(id, status, errorMessage) {
        try {
            const messages = await this.readJsonFile(this.messagesFile, []);
            const messageIndex = messages.findIndex(msg => msg.id === id);
            
            if (messageIndex !== -1) {
                messages[messageIndex].status = status;
                if (errorMessage) {
                    messages[messageIndex].error = errorMessage;
                }
                messages[messageIndex].updated_at = new Date().toISOString();
                
                await this.writeJsonFile(this.messagesFile, messages);
                console.log(`📝 Updated message ${id} status to ${status}`);
            }
        } catch (error) {
            console.error('❌ Error updating message status:', error);
            throw error;
        }
    }

    async getMessages(limit = 100) {
        try {
            const messages = await this.readJsonFile(this.messagesFile, []);
            return messages.slice(0, limit);
        } catch (error) {
            console.error('❌ Error retrieving messages:', error);
            return [];
        }
    }

    async getMessageByWhatsappId(whatsappMessageId) {
        try {
            const messages = await this.readJsonFile(this.messagesFile, []);
            return messages.find(msg => msg.whatsapp_message_id === whatsappMessageId);
        } catch (error) {
            console.error('❌ Error finding message by WhatsApp ID:', error);
            return null;
        }
    }

    async setBotConfig(key, value) {
        try {
            const config = await this.readJsonFile(this.configFile, {});
            config[key] = value;
            await this.writeJsonFile(this.configFile, config);
            console.log(`⚙️ Set config ${key} = ${value}`);
        } catch (error) {
            console.error('❌ Error setting bot config:', error);
            throw error;
        }
    }

    async getBotConfig(key) {
        try {
            const config = await this.readJsonFile(this.configFile, {});
            return config[key];
        } catch (error) {
            console.error('❌ Error getting bot config:', error);
            return null;
        }
    }

    async addWhatsappGroup(group) {
        try {
            const groups = await this.readJsonFile(this.groupsFile, []);
            
            const existingGroup = groups.find(g => g.group_id === group.group_id);
            if (existingGroup) {
                existingGroup.name = group.name;
                existingGroup.is_active = group.is_active !== undefined ? group.is_active : true;
                existingGroup.updated_at = new Date().toISOString();
            } else {
                const newGroup = {
                    id: Date.now(),
                    group_id: group.group_id,
                    name: group.name,
                    is_active: group.is_active !== undefined ? group.is_active : true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                groups.push(newGroup);
            }
            
            await this.writeJsonFile(this.groupsFile, groups);
            console.log(`👥 Added/Updated WhatsApp group: ${group.name}`);
            return existingGroup || groups[groups.length - 1];
        } catch (error) {
            console.error('❌ Error adding WhatsApp group:', error);
            throw error;
        }
    }

    async getActiveGroups() {
        try {
            const groups = await this.readJsonFile(this.groupsFile, []);
            return groups.filter(group => group.is_active);
        } catch (error) {
            console.error('❌ Error getting active groups:', error);
            return [];
        }
    }

    async toggleGroupStatus(groupId, isActive) {
        try {
            const groups = await this.readJsonFile(this.groupsFile, []);
            const groupIndex = groups.findIndex(g => g.group_id === groupId);
            
            if (groupIndex !== -1) {
                groups[groupIndex].is_active = isActive;
                groups[groupIndex].updated_at = new Date().toISOString();
                await this.writeJsonFile(this.groupsFile, groups);
                console.log(`🔄 Toggled group ${groupId} status to ${isActive ? 'active' : 'inactive'}`);
            }
        } catch (error) {
            console.error('❌ Error toggling group status:', error);
            throw error;
        }
    }

    async logError(error) {
        try {
            const errors = await this.readJsonFile(this.errorsFile, []);
            
            const errorLog = {
                id: Date.now(),
                message: error.message || error.toString(),
                stack: error.stack || '',
                context: error.context || '',
                timestamp: new Date().toISOString()
            };

            errors.unshift(errorLog);
            
            // Keep only last 100 errors
            if (errors.length > 100) {
                errors.splice(100);
            }

            await this.writeJsonFile(this.errorsFile, errors);
            console.log('📝 Error logged to storage');
        } catch (logError) {
            console.error('❌ Error logging error to storage:', logError);
        }
    }

    async getRecentErrors(limit = 50) {
        try {
            const errors = await this.readJsonFile(this.errorsFile, []);
            return errors.slice(0, limit);
        } catch (error) {
            console.error('❌ Error retrieving recent errors:', error);
            return [];
        }
    }
}

module.exports = { FileStorage };