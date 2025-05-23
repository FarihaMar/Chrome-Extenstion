// content.js 
console.log('LinkedIn Chat Enhancer: Content script loaded');

class LinkedInChatEnhancer {
    constructor() {
        this.processedMessageBoxes = new WeakSet();
        this.currentConversation = null;
        this.lastMessages = [];
        this.observer = null;
        this.messageObserver = null;
        this.initStyles();
        this.initObservers();
        this.setupGlobalListeners();
        this.loadLiveLog();
    }

    async loadLiveLog() {
        if (window.createLiveLog && window.updateLiveLog) return;

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('livelog.js');
        await new Promise(resolve => {
            script.onload = resolve;
            (document.head || document.documentElement).appendChild(script);
        });
    }

    initStyles() {
        if (document.getElementById('dm-button-styles')) return;

        const style = document.createElement('style');
        style.id = 'dm-button-styles';
        style.textContent = `
            .dm-buttons-container {
            border: 1px solid #24268d;
            border-radius: 12px;
            padding: 10px;
            margin: 8px 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: #ffffff;
            box-shadow: 0 0 8px rgba(100, 149, 237, 0.2);
            }
            
            .dm-scroll-row {
            display: flex;
            flex-wrap: nowrap;
            gap: 10px;
            overflow-x: auto;
            padding-bottom: 4px;
            scrollbar-width: thin;
            scrollbar-color: #888 transparent;
            }
            
            .dm-scroll-row::-webkit-scrollbar {
            height: 6px;
            }
            
            .dm-scroll-row::-webkit-scrollbar-thumb {
            background-color: #888;
            border-radius: 10px;
            }

            .dm-template-btn {
                position: relative;
                overflow: hidden;
                background: #ffffff;
                color: rgb(0, 51, 204);
                border: 1px solid rgb(0, 51, 204);
                padding: 5px 10px;
                border-radius: 50px;
                font-size: 14px;
                font-weight: normal;
                cursor: pointer;
                white-space: nowrap;
                flex-shrink: 0;
                min-width: unset;
                text-align: center;
                transition: all 0.4s ease;
            }

            .dm-template-btn:hover {
                background: rgb(0, 51, 204);
                color: #ffffff;
            }

            .dm-template-btn:active {
                transform: scale(0.98);
            }

            .dm-template-btn::after {
                content: '';
                position: absolute;
                top: var(--y);
                left: var(--x);
                width: 0;
                height: 0;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                opacity: 0;
            }

            .dm-template-btn.active::after {
                width: 200px;
                height: 200px;
                opacity: 1;
                transition: width 0.5s ease-out, height 0.5s ease-out, opacity 1s ease;
            }

            .dm-template-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none !important;
                background: #24268d;
                border: 1px solid #24268d;
                color: #ffffff;
            }

            .powered-by {
                width: 100%;
                border-top: 1px solid #e5e7eb;
                padding-top: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                font-size: 14px;
                color: #24268d;
            }

            .ai-status-popup {
                position: fixed;
                top: 100px;
                left: 100px;
                color: #e0e0ff;
                background: #1a1a2e;
                padding: 0;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(110, 46, 220, 0.3);
                z-index: 9999;
                font-family: 'Segoe UI', Roboto, sans-serif;
                width: 450px;
                max-height: 600px;
                display: flex;
                flex-direction: column;
                border: 1px solid #6e2edc;
                overflow: hidden;
                cursor: move;
            }

            .ai-status-header {
                background: linear-gradient(90deg, #0033cc, #6e2edc);
                color: white;
                padding: 12px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: bold;
                font-size: 16px;
                user-select: none;
                border-bottom: 1px solid #6e2edc;
            }

            .ai-status-content {
                padding: 15px;
                overflow-y: auto;
                flex-grow: 1;
                background: #1a1a2e;
            }

            .status-message {
                margin-bottom: 15px;
                padding-bottom: 15px;
                border-bottom: 1px solid #2a2a3a;
            }

            .status-message.error {
                border-left: 3px solid #ff4d4d;
                padding-left: 10px;
            }

            .status-message.success {
                border-left: 3px solid #4dff4d;
                padding-left: 10px;
            }

            .status-message.info {
                border-left: 3px solid #4d4dff;
                padding-left: 10px;
            }

            .status-message.ai-message {
                border-left: 3px solid #6e2edc;
                padding-left: 10px;
            }

            .status-meta {
                font-size: 12px;
                margin-bottom: 5px;
                font-weight: bold;
            }

            .status-text {
                font-size: 14px;
                line-height: 1.5;
                white-space: pre-wrap;
            }
        `;
        document.head.appendChild(style);
    }

    createAgentLinkBranding() {
        const powered = document.createElement('div');
        powered.className = 'powered-by';
        powered.innerHTML = `
            <span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;background:linear-gradient(to right,#4d7cfe,#9f7aea);border-radius:5px;">
                <svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none'>
                <path d='M12 8V4H8' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>
                <rect width='16' height='12' x='4' y='8' rx='2' stroke='white' stroke-width='2'/>
                <path d='M2 14h2' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>
                <path d='M20 14h2' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>
                <path d='M15 13v2' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>
                <path d='M9 13v2' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>
                </svg>
            </span>
            <span style="font-weight:500;">Powered by AgentLink</span>
        `;
        return powered;
    }

    createLoadingIndicator(button) {
        const originalText = button.textContent;
        button.textContent = 'Generating...';
        button.disabled = true;

        return {
            restore: () => {
                button.textContent = originalText;
                button.disabled = false;
            }
        };
    }

    updateStatusDisplay() {
        const popup = document.getElementById('ai-status-popup') || this.createStatusPopup();
        const content = document.getElementById('status-messages');
        
        const messagesHtml = (this.statusMessages || []).map(status => `
            <div class="status-message ${status.type}">
                <div class="status-meta" style="color: ${status.type === 'error' ? '#ff8080' : 
                    status.type === 'success' ? '#80ff80' : 
                    status.type === 'ai-message' ? '#b388ff' : '#9e9eff'}">
                    ${status.time} • ${status.type.toUpperCase()}
                </div>
                <div class="status-text" style="color: ${status.type === 'error' ? '#ffb3b3' : '#e0e0ff'};
                    font-weight: ${status.type === 'error' ? 'bold' : 'normal'}">
                    ${status.message}
                </div>
            </div>
        `).join('');

        content.innerHTML = messagesHtml;
        content.scrollTop = content.scrollHeight;
    }

    updateStatusDetailed(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        
        if (!this.statusMessages) this.statusMessages = [];
        this.statusMessages.push({
            message,
            type,
            time: new Date().toLocaleTimeString()
        });

        this.updateStatusDisplay();
        
        // Ensure popup is visible when new messages arrive
        if (!this.isPopupVisible) {
            document.getElementById('status-messages').style.display = 'block';
            document.getElementById('toggle-status').textContent = 'HIDE';
            this.isPopupVisible = true;
        }
    }

    async injectButtons(messageContainer) {
        if (this.processedMessageBoxes.has(messageContainer)) return;
        this.processedMessageBoxes.add(messageContainer);

        if (messageContainer.querySelector('.dm-buttons-container')) return;

        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'dm-buttons-container';

        const scrollRow = document.createElement('div');
        scrollRow.className = 'dm-scroll-row';

        const { buttonConfigs = [] } = await new Promise(resolve => {
            chrome.storage.local.get(['buttonConfigs'], resolve);
        });

        buttonConfigs.forEach(config => {
            const btn = this.createButton(config, messageContainer);
            scrollRow.appendChild(btn);
        });
    
        // Add scroll row and branding to wrapper
        buttonWrapper.appendChild(scrollRow);
        buttonWrapper.appendChild(this.createAgentLinkBranding());

        // Find the best place to insert the buttons
        const targetElement = messageContainer.closest('.msg-form__container') || 
                             messageContainer.closest('footer.msg-messaging-form__footer') || 
                             messageContainer.parentNode;
        
        if (targetElement) {
            targetElement.insertBefore(buttonWrapper, messageContainer);
        }
    }

    createButton(config, messageContainer) {
        const btn = document.createElement('button');
        btn.className = 'dm-template-btn';
        btn.textContent = config.name || config.label || 'Template';
        btn.setAttribute('data-original-text', config.name);

        // Add ripple effect
        btn.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.style.setProperty('--x', x + 'px');
            this.style.setProperty('--y', y + 'px');
            
            this.classList.add('active');
            
            setTimeout(() => {
                this.classList.remove('active');
            }, 1000);
        });

        btn.addEventListener('click', async (e) => {
            if (btn.disabled) return;

            const loadingContainer = document.createElement('div');
            loadingContainer.className = 'ai-loading-container';

            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'ai-loading-message';
            loadingMessage.innerHTML = `
                <span style="display:inline-flex;align-items:center;">
                    <svg width="20" height="20" viewBox="0 0 50 50" style="margin-right:8px;">
                        <circle cx="25" cy="25" r="20" fill="none" stroke="#7f00ff" stroke-width="5" stroke-linecap="round" stroke-dasharray="31.4 31.4" transform="rotate(-90 25 25)">
                            <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                    Generating response...
                </span>
            `;

            const stopButton = document.createElement('button');
            stopButton.className = 'stop-button';
            stopButton.textContent = '✕ Stop';

            let isCancelled = false;
            const abortController = new AbortController();

            stopButton.onclick = () => {
                isCancelled = true;
                abortController.abort();
                loadingMessage.textContent = '⏹️ Stopping generation...';
                stopButton.disabled = true;
            };

            const buttonWrapper = messageContainer.closest('.msg-form__container')?.querySelector('.dm-buttons-container');
            if (!buttonWrapper) return;

            const allBtns = buttonWrapper.querySelectorAll('.dm-template-btn');
            allBtns.forEach(b => b.style.display = 'none');

            loadingContainer.appendChild(loadingMessage);
            loadingContainer.appendChild(stopButton);
            buttonWrapper.insertBefore(loadingContainer, buttonWrapper.firstChild);

            try {
                if (config.name === 'Clear') {
                    this.clearMessageText(messageContainer);
                } else {
                    await this.updateConversationContext();
                    const profileData = await this.gatherCompleteProfileData();
                    const aiSettings = await this.getAISettings();

                    // Save conversation context to local storage
                    chrome.storage.local.set({
                        conversationContext: {
                            lastMessages: this.lastMessages,
                            isNewConversation: this.lastMessages.length === 0
                        }
                    });

                    const response = await chrome.runtime.sendMessage({
                        action: "generateMessage",
                        profileData,
                        config,
                        aiSettings,
                        signal: abortController.signal,
                        conversationContext: {
                            lastMessages: this.lastMessages,
                            isNewConversation: this.lastMessages.length === 0
                        }
                    });

                    if (isCancelled) return;

                    if (response?.message) {
                        this.insertTemplate(response.message, messageContainer);
                        this.updateStatusDetailed(`Message generated successfully!`, 'success');
                    } else {
                        throw new Error("AI is not responding. Please try again later.");
                    }
                }
            } catch (err) {
                console.error('AI Error:', err);
                const existingError = buttonWrapper.querySelector('.dm-error-message');
                if (existingError) existingError.remove();

                const error = document.createElement('div');
                error.className = 'dm-error-message';
                error.textContent = '⚠️ AI is not responding. Please try again later.';
                buttonWrapper.insertBefore(error, buttonWrapper.firstChild);
            } finally {
                loadingContainer.remove();
                allBtns.forEach(b => {
                    b.style.display = '';
                    b.disabled = false;
                });
            }
        });

        return btn;
    }

    async updateConversationContext() {
        try {
            // Get the active conversation
            const activeConversation = document.querySelector('.msg-s-message-list') || 
                                     document.querySelector('.msg-thread');
            
            if (!activeConversation) {
                this.lastMessages = [];
                return;
            }

            // Extract the last 5 messages
            this.lastMessages = this.extractMessages(5);
            
            // Get participant name
            const participantName = document.querySelector('.msg-thread-breadcrumb__participant-name')?.textContent.trim() || 
                                  document.querySelector('.msg-s-message-group__name')?.textContent.trim() || 
                                  'Unknown';
            
            this.currentConversation = {
                participantName,
                lastMessages: this.lastMessages
            };
            
            // Save to local storage
            chrome.storage.local.set({
                conversationContext: {
                    participantName,
                    lastMessages: this.lastMessages
                }
            });
            
        } catch (error) {
            console.error('Error updating conversation context:', error);
            this.lastMessages = [];
        }
    }

    extractMessages(limit = 5) {
        const messages = [];
        const messageContainer = document.querySelector('.msg-s-message-list') || 
                               document.querySelector('.msg-thread');
        
        if (!messageContainer) return messages;

        // Variables to store the last known sender, time, and date
        let lastKnownSender = null;
        let lastKnownTime = null;
        let lastKnownDate = null;
        
        // Select all message list items
        const messageItems = messageContainer.querySelectorAll('.msg-s-message-list__event, .msg-event');
        
        // Iterate over all message items
        messageItems.forEach(item => {
            // Extract date if available
            const dateHeading = item.querySelector('.msg-s-message-list__time-heading, .msg-time-heading');
            if (dateHeading) {
                lastKnownDate = dateHeading.textContent.trim();
            }
            
            // Extract all messages within this event
            const messageElements = item.querySelectorAll('.msg-s-event-listitem, .msg-event-listitem');
            
            messageElements.forEach(messageItem => {
                const senderElement = messageItem.querySelector('.msg-s-message-group__name, .msg-sender');
                const timeElement = messageItem.querySelector('.msg-s-message-group__timestamp, .msg-timestamp');
                const messageElement = messageItem.querySelector('.msg-s-event-listitem__body, .msg-content');
                
                // Use the last known sender, time, and date if current ones are missing
                const sender = senderElement ? senderElement.textContent.trim() : lastKnownSender;
                const time = timeElement ? timeElement.textContent.trim() : lastKnownTime;
                const message = messageElement ? messageElement.textContent.trim() : null;
                
                // Update last known sender, time, and date if current ones are valid
                if (senderElement) lastKnownSender = sender;
                if (timeElement) lastKnownTime = time;
                
                // Add the message to the array
                if (message) {
                    messages.push({
                        sender,
                        message,
                        time,
                        date: lastKnownDate
                    });
                }
            });
        });
        
        // Return only the last `limit` messages
        return messages.slice(-limit);
    }

    insertTemplate(templateText, messageContainer) {
        const textbox = messageContainer.querySelector('.msg-form__contenteditable[contenteditable="true"]') || 
                       messageContainer.querySelector('div[role="textbox"][aria-label*="message"]') || 
                       messageContainer.querySelector('div.msg-form__contenteditable');
        
        if (textbox) {
            textbox.innerHTML = '';
            document.execCommand("insertText", false, templateText);
            textbox.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    clearMessageText(messageContainer) {
        const textbox = messageContainer.querySelector('.msg-form__contenteditable[contenteditable="true"]') || 
                       messageContainer.querySelector('div[role="textbox"][aria-label*="message"]') || 
                       messageContainer.querySelector('div.msg-form__contenteditable');
        
        if (textbox) {
            textbox.innerHTML = '';
            textbox.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    async getAISettings() {
        const { aiSettings = {} } = await chrome.storage.local.get(['aiSettings']);
        return aiSettings;
    }

    async gatherCompleteProfileData() {
        // If we're on a profile page, get detailed profile data
        if (window.location.href.includes('linkedin.com/in/')) {
            return {
                name: document.querySelector('h1')?.innerText.trim() || 'Name not found',
                designation: document.querySelector('.text-body-medium.break-words')?.innerText.trim() || 'Designation not found',
                location: document.querySelector('span.text-body-small.inline.t-black--light.break-words')?.innerText.trim() || 'Location not found',
                about: await this.getAboutSection(),
                experience: await this.extractExperienceData()
            };
        }
        
        // For messaging pages, try to get basic info from the conversation
        const participantName = document.querySelector('.msg-thread-breadcrumb__participant-name')?.textContent.trim() || 
                              document.querySelector('.msg-s-message-group__name')?.textContent.trim() || 
                              'Unknown';
        
        return {
            name: participantName,
            designation: '',
            location: '',
            about: '',
            experience: []
        };
    }

    async getAboutSection() {
        let aboutSection = document.querySelector('#about');
        if (aboutSection) {
            let section = aboutSection.closest('section');
            let contentDiv = section.querySelector('div.display-flex.ph5.pv3');
            
            if (contentDiv) {
                return Array.from(contentDiv.querySelectorAll('span:not(.visually-hidden)'))
                    .map(span => span.innerText.trim())
                    .join(' ');
            }
        }
        return "";
    }

    async extractExperienceData() {
        const experienceData = { experience: [] };
        const experienceHeading = [...document.querySelectorAll('h2')].find(h =>
            h.textContent.trim().includes('Experience')
        );

        if (experienceHeading) {
            const experienceSection = experienceHeading.closest('section');
            if (experienceSection) {
                const experienceItems = experienceSection.querySelectorAll('li.artdeco-list__item');

                experienceItems.forEach(item => {
                    let texts = [];
                    const allTextElements = item.querySelectorAll('.t-bold, .t-14.t-normal, .t-black--light, strong');

                    allTextElements.forEach(element => {
                        let text = element.textContent
                            .replace(/<!---->/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();

                        if (text.length > 1) {
                            const halfLength = Math.floor(text.length / 2);
                            if (text.substring(0, halfLength) === text.substring(halfLength)) {
                                text = text.substring(0, halfLength);
                            }
                        }

                        if (text && !texts.includes(text)) {
                            texts.push(text);
                        }
                    });

                    texts = [...new Set(texts)].filter(text => text && text !== 'Experience');
                    if (texts.length > 0) experienceData.experience.push({ texts });
                });
            }
        }

        return experienceData;
    }

    setupGlobalListeners() {
        // Listen for message button clicks to open chat windows
        document.addEventListener('click', async (e) => {
            const messageButton = e.target.closest('button[aria-label*="Message"], button[aria-label*="message"]');
            if (messageButton) {
                setTimeout(() => {
                    this.updateConversationContext();
                }, 3000); // Wait for chat window to open
            }
        });

        // Handle SPA navigation
        let lastUrl = location.href;
        new MutationObserver(() => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                this.updateConversationContext();
            }
        }).observe(document, { subtree: true, childList: true });
    }

    initObservers() {
        // Observer for message containers
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const messageContainer = node.querySelector('.msg-form__msg-content-container') || 
                                               node.closest('.msg-form__msg-content-container');
                        if (messageContainer) {
                            this.injectButtons(messageContainer);
                        }
                    }
                });
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Observer for message changes in active conversation
        this.messageObserver = new MutationObserver(() => {
            this.updateConversationContext();
        });

        const messageList = document.querySelector('.msg-s-message-list') || 
                          document.querySelector('.msg-thread');
        if (messageList) {
            this.messageObserver.observe(messageList, {
                childList: true,
                subtree: true
            });
        }

        // Process existing message containers
        document.querySelectorAll('.msg-form__msg-content-container').forEach(container => {
            this.injectButtons(container);
        });
    }
}

// Initialize when on LinkedIn
if (window.location.hostname.includes('linkedin.com')) {
    const enhancer = new LinkedInChatEnhancer();
    
    // Make available globally for debugging
    window.LinkedInChatEnhancer = enhancer;
}
