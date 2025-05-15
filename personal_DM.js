// ================= ContextAwareLinkedInAssistant.js =================

class ContextAwareLinkedInAssistant {
    constructor() {
        this.processedMessageBoxes = new WeakSet();
        this.observer = null;
        this.currentUser = this.detectCurrentUser();
        this.initObserver();
        this.initStyles();
    }

    initStyles() {
        if (document.getElementById('dm-button-styles')) return;

        const style = document.createElement('style');
        style.id = 'dm-button-styles';
        style.textContent = `
            .dm-buttons-container {
                border: 1px solid #24268d;
                border-radius: 12px;
                padding: 12px;
                margin: 12px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                box-shadow: 0 0 8px rgba(100, 149, 237, 0.2);
                overflow: hidden;
                background: #ffffff;
                position: relative;
                max-width: 100%;
            }

            .dm-buttons-scrollable {
                display: flex;
                flex-wrap: nowrap;
                gap: 10px;
                overflow-x: auto;
                scroll-behavior: smooth;
                width: 100%;
                margin: 0;
                padding: 0 4px 4px 4px;
                -ms-overflow-style: none;
                scrollbar-width: none;
            }

            .dm-buttons-scrollable::-webkit-scrollbar {
                display: none;
            }

            .dm-template-btn {
                position: relative;
                overflow: hidden;
                background: #ffffff;
                color: rgb(0, 51, 204);
                border: 1px solid rgb(0, 51, 204);
                padding: 8px 16px;
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
                padding-top: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                font-size: 14px;
                color: #24268d;
                margin-top: auto;
            }

            .agentlink-dm-wrapper {
                position: relative;
                z-index: 1;
            }

            .ai-loading-container {
                animation: fadeIn 0.3s ease-out;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background: #f5f5f5;
                margin-bottom: 10px;
                width: 100%;
                padding: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .ai-loading-message {
                font-size: 14px;
                color: #424242;
            }

            .stop-button {
                margin-left: 10px;
                padding: 3px 8px;
                font-size: 12px;
                background: #ffebee;
                color: #c62828;
                border: 1px solid #ef9a9a;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .stop-button:hover {
                background: #ffcdd2 !important;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .dm-error-message {
                color: #c62828;
                font-size: 14px;
                margin-top: 5px;
                text-align: center;
                width: 100%;
            }

            .scroll-arrow {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                width: 30px;
                height: 30px;
                background: white;
                border: 1px solid #e0e0e0;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 2;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: all 0.2s;
                opacity: 1;
                visibility: visible;
                transition: opacity 0.2s ease, visibility 0.2s ease;
            }

            .scroll-arrow.hidden {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
            }

            .scroll-arrow:hover {
                background: #f0f0f0;
            }

            .scroll-arrow.left {
                left: 5px;
            }

            .scroll-arrow.right {
                right: 5px;
            }

            .scroll-arrow svg {
                width: 16px;
                height: 16px;
                fill: #24268d;
            }
        `;
        document.head.appendChild(style);
    }

    createBranding() {
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

    showError(message, container) {
        const existingError = container.querySelector('.dm-error-message');
        if (existingError) existingError.remove();

        const error = document.createElement('div');
        error.className = 'dm-error-message';
        error.textContent = `⚠️ ${message}`;
        container.appendChild(error);

        setTimeout(() => error.remove(), 5000);
    }

    detectCurrentUser() {
        const selectors = [
            '.global-nav__me-content .t-16',
            '.msg-s-message-group__name',
            '.feed-identity-module__actor-link',
            '.profile-rail-card__actor-link'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                const name = element.textContent.trim();
                if (name && name.length > 0) {
                    return name.split('\n')[0].trim();
                }
            }
        }

        return 'You';
    }

    updateArrowVisibility(scrollableContainer, leftArrow, rightArrow) {
        const scrollLeft = scrollableContainer.scrollLeft;
        const scrollWidth = scrollableContainer.scrollWidth;
        const clientWidth = scrollableContainer.clientWidth;
        
        if (scrollLeft <= 10) {
            leftArrow.classList.add('hidden');
        } else {
            leftArrow.classList.remove('hidden');
        }
        
        if (scrollLeft >= scrollWidth - clientWidth - 10) {
            rightArrow.classList.add('hidden');
        } else {
            rightArrow.classList.remove('hidden');
        }
    }

    async injectButtons(messageContainer) {
        if (this.processedMessageBoxes.has(messageContainer)) return;
        this.processedMessageBoxes.add(messageContainer);

        let wrapper = messageContainer.previousElementSibling;
        if (wrapper && wrapper.classList.contains('agentlink-dm-wrapper')) {
            return;
        }

        wrapper = document.createElement('div');
        wrapper.className = 'agentlink-dm-wrapper';

        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'dm-buttons-container';

        const scrollableContainer = document.createElement('div');
        scrollableContainer.className = 'dm-buttons-scrollable';

        const poweredBy = this.createBranding();

        const replyTemplates = [
            { name: "Short Reply", style: "concise" },
            { name: "Friendly Reply", style: "friendly" },
            { name: "Professional Reply", style: "professional" },
            { name: "Detailed Reply", style: "detailed" }
        ];

        // Create scroll arrows
        const leftArrow = document.createElement('button');
        leftArrow.className = 'scroll-arrow left hidden';
        leftArrow.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>`;
        leftArrow.addEventListener('click', () => {
            scrollableContainer.scrollBy({ left: -200, behavior: 'smooth' });
        });

        const rightArrow = document.createElement('button');
        rightArrow.className = 'scroll-arrow right';
        rightArrow.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>`;
        rightArrow.addEventListener('click', () => {
            scrollableContainer.scrollBy({ left: 200, behavior: 'smooth' });
        });

        // Add scroll event listener
        scrollableContainer.addEventListener('scroll', () => {
            this.updateArrowVisibility(scrollableContainer, leftArrow, rightArrow);
        });

        replyTemplates.forEach(config => {
            const btn = document.createElement('button');
            btn.className = 'dm-template-btn';
            btn.textContent = config.name;
            btn.setAttribute('data-style', config.style);
            btn.type = 'button';

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
                e.preventDefault();
                if (btn.disabled) return;
                
                const abortController = new AbortController();
                let isCancelled = false;

                const buttons = scrollableContainer.querySelectorAll('.dm-template-btn');
                const originalTexts = new Map(Array.from(buttons).map(btn => [btn, btn.textContent]));

                try {
                    const loadingContainer = document.createElement('div');
                    loadingContainer.className = 'ai-loading-container';
                    
                    const loadingMessage = document.createElement('div');
                    loadingMessage.className = 'ai-loading-message';
                    loadingMessage.textContent = '🤖 AgentLink is generating your reply...';
                    
                    const stopButton = document.createElement('button');
                    stopButton.className = 'stop-button';
                    stopButton.innerHTML = '✕ Stop';
                    stopButton.type = 'button';
                    
                    stopButton.onmouseover = () => stopButton.style.background = '#ffcdd2';
                    stopButton.onmouseout = () => stopButton.style.background = '#ffebee';
                    stopButton.onclick = () => {
                        isCancelled = true;
                        abortController.abort();
                        loadingMessage.textContent = '⏹️ Stopping generation...';
                        stopButton.disabled = true;
                    };
                    
                    loadingContainer.appendChild(loadingMessage);
                    loadingContainer.appendChild(stopButton);
                    
                    buttonWrapper.insertBefore(loadingContainer, buttonWrapper.firstChild);
                    buttons.forEach(btn => btn.style.display = 'none');

                    const conversationContext = await this.analyzeConversation();
                    
                    if (!conversationContext.participant.name || conversationContext.participant.name === 'Unknown') {
                        throw new Error('Could not identify conversation participant. Please make sure you\'re in a conversation.');
                    }

                    const response = await chrome.runtime.sendMessage({
                        action: "generateContextualResponse",
                        conversationContext: conversationContext,
                        responseStyle: btn.getAttribute('data-style'),
                        signal: abortController.signal
                    });

                    if (isCancelled) throw new Error('Generation cancelled by user');
                    if (response?.error) throw new Error(response.error);
                    if (!response?.message) throw new Error('Failed to generate message');

                    this.insertMessage(response.message, messageContainer);
                } catch (err) {
                    console.error('Error generating AI message:', err);
                    this.showError(err.message, buttonWrapper);
                } finally {
                    const loadingContainer = buttonWrapper.querySelector('.ai-loading-container');
                    if (loadingContainer) loadingContainer.remove();

                    buttons.forEach(btn => {
                        btn.style.display = '';
                        btn.disabled = false;
                        btn.textContent = originalTexts.get(btn) || btn.textContent;
                    });
                    this.updateArrowVisibility(scrollableContainer, leftArrow, rightArrow);
                }
            });

            scrollableContainer.appendChild(btn);
        });

        // Initial arrow visibility check
        setTimeout(() => {
            this.updateArrowVisibility(scrollableContainer, leftArrow, rightArrow);
        }, 100);

        buttonWrapper.appendChild(leftArrow);
        buttonWrapper.appendChild(scrollableContainer);
        buttonWrapper.appendChild(rightArrow);
        buttonWrapper.appendChild(poweredBy);
        wrapper.appendChild(buttonWrapper);

        messageContainer.parentNode.insertBefore(wrapper, messageContainer);
    }

    async analyzeConversation() {
        const participantData = this.extractParticipantData();
        const chatHistory = this.extractMessages(5);
        const conversationAnalysis = this.analyzeMessages(chatHistory);
        
        return {
            participant: participantData,
            history: chatHistory,
            analysis: conversationAnalysis,
            currentUser: this.currentUser,
            timestamp: new Date().toISOString()
        };
    }

    extractParticipantData() {
        // First try to get data from the profile card in the conversation
        const profileCard = document.querySelector('.msg-s-profile-card');
        
        if (profileCard) {
            const nameElement = profileCard.querySelector('.artdeco-entity-lockup__title span');
            const titleElement = profileCard.querySelector('.artdeco-entity-lockup__subtitle div');
            const degreeElement = profileCard.querySelector('.artdeco-entity-lockup__degree');
            const pronounsElement = profileCard.querySelector('.t-14.t-black--light');
            const profileLink = profileCard.querySelector('a[href*="/in/"]');
            
            let name = nameElement?.textContent.trim() || 'Unknown';
            // Skip if the name is the current user
            if (name === this.currentUser) {
                const otherParticipant = document.querySelector('.msg-s-message-group__name:not(:contains(' + this.currentUser + '))');
                if (otherParticipant) {
                    name = otherParticipant.textContent.trim();
                }
            }

            return {
                name: name,
                title: titleElement?.textContent.trim() || '',
                connectionDegree: degreeElement?.textContent.replace('·', '').trim() || '',
                pronouns: pronounsElement?.textContent.replace(/[()]/g, '').trim() || '',
                profileUrl: profileLink ? `https://linkedin.com${new URL(profileLink.href).pathname}` : ''
            };
        }

        // Fallback to other selectors if profile card not found
        const nameElement = document.querySelector('.msg-conversation-card__participant-names span') || 
                         document.querySelector('.msg-thread-sender__name') ||
                         document.querySelector('.msg-s-message-group__name:not(:has(+ .msg-s-message-group__name))') ||
                         document.querySelector('.msg-s-message-group__name');

        let name = nameElement?.textContent.trim() || 'Unknown';
        if (name === this.currentUser) {
            const otherParticipant = document.querySelector('.msg-s-message-group__name:not(:contains(' + this.currentUser + '))');
            if (otherParticipant) {
                name = otherParticipant.textContent.trim();
            }
        }

        const titleElement = document.querySelector('.msg-thread-sender__occupation');
        const degreeElement = document.querySelector('.artdeco-entity-lockup__degree');
        const pronounsElement = document.querySelector('.msg-s-message-group__meta .t-12.t-black--light');
        const profileLink = document.querySelector('a[href*="/in/"]');

        return {
            name,
            title: titleElement?.textContent.trim() || '',
            connectionDegree: degreeElement?.textContent.replace('·', '').trim() || '',
            pronouns: pronounsElement?.textContent.replace(/[()]/g, '').trim() || '',
            profileUrl: profileLink ? `https://linkedin.com${new URL(profileLink.href).pathname}` : ''
        };
    }

    extractMessages(limit) {
        // First try to get messages from the active conversation thread
        const messageContainer = document.querySelector('.msg-s-message-list-content') || 
                               document.querySelector('.msg-thread');
        
        if (!messageContainer) return [];

        const messageItems = Array.from(messageContainer.querySelectorAll('.msg-s-event-listitem, .msg-s-message-group'));
        const messages = [];
        let count = 0;

        const reversedItems = [...messageItems].reverse();

        for (const item of reversedItems) {
            if (count >= limit) break;

            // Try different selectors for sender name
            const senderElement = item.querySelector('.msg-s-message-group__name') || 
                                item.querySelector('.msg-sender__name') ||
                                item.closest('.msg-s-message-group')?.querySelector('.msg-s-message-group__name');
            
            // Try different selectors for message content
            const messageElement = item.querySelector('.msg-s-event-listitem__body') || 
                                 item.querySelector('.msg-s-message-group__bubble') ||
                                 item.querySelector('.msg-s-message-group__message');

            if (!messageElement) continue;

            const sender = senderElement ? senderElement.textContent.trim() : null;
            const message = messageElement.textContent.trim();
            
            if (message && message !== "This message has been deleted.") {
                messages.unshift({
                    sender,
                    message,
                    isCurrentUser: sender === this.currentUser
                });
                count++;
            }
        }

        return messages;
    }

    analyzeMessages(messages) {
        if (!messages || messages.length === 0) {
            return {
                lastMessage: '',
                lastMessageText: '',
                isQuestion: false,
                tone: 'neutral',
                isCurrentUserLastSender: false,
                requiresResponse: false,
                isUrgent: false,
                topics: []
            };
        }
        
        const lastMessage = messages[messages.length - 1];
        const lastMessageText = lastMessage.message.toLowerCase();
        
        let tone = 'neutral';
        const positiveWords = ['great', 'happy', 'excited', 'thanks', 'thank you', 'wonderful', 'appreciate'];
        const negativeWords = ['angry', 'unhappy', 'disappointed', 'problem', 'issue', 'concern', 'frustrated'];
        
        if (positiveWords.some(word => lastMessageText.includes(word))) {
            tone = 'positive';
        } else if (negativeWords.some(word => lastMessageText.includes(word))) {
            tone = 'negative';
        }
        
        const isQuestion = lastMessageText.includes('?') || 
                          /^(what|how|can you|could you|would you|do you|who|when|where|why)/i.test(lastMessageText);
        
        const isUrgent = /\b(urgent|asap|immediately|soon|quick)\b/i.test(lastMessageText);
        
        // Extract potential topics from messages
        const topics = [];
        const topicKeywords = {
            'data science': ['data scien', 'machine learning', 'ml', 'ai', 'artificial intelligence'],
            'job opportunity': ['job', 'opportunity', 'position', 'hire', 'hiring'],
            'networking': ['connect', 'network', 'introduction', 'linkedin'],
            'education': ['study', 'university', 'course', 'learn', 'education']
        };
        
        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(keyword => lastMessageText.includes(keyword))) {
                topics.push(topic);
            }
        }
        
        return {
            lastMessage: lastMessage.message,
            lastMessageText,
            isQuestion,
            tone,
            isCurrentUserLastSender: lastMessage.isCurrentUser,
            requiresResponse: !lastMessage.isCurrentUser,
            isUrgent,
            topics
        };
    }

    insertMessage(message, messageContainer) {
        const messageBox = messageContainer.querySelector('.msg-form__contenteditable[contenteditable="true"]');
        if (messageBox) {
            messageBox.innerHTML = '<p><br></p>';
            messageBox.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, message);
            
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });
            messageBox.dispatchEvent(inputEvent);
            messageBox.dispatchEvent(changeEvent);
        }
    }

    initObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }

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

        document.querySelectorAll('.msg-form__msg-content-container').forEach(container => {
            this.injectButtons(container);
        });
    }
}

if (window.location.hostname.includes('linkedin.com')) {
    new ContextAwareLinkedInAssistant();
}
