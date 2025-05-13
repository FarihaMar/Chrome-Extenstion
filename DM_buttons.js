// ================= DM_buttons.js =================

class DMMessageButtons {
    constructor() {
        this.processedMessageBoxes = new WeakSet();
        this.observer = null;
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
                border-radius: 12px 12px 0 0; /* Rounded top only */
                padding: 10px 10px 5px 10px; /* Less padding at bottom */
                margin: 0;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                box-shadow: 0 0 8px rgba(100, 149, 237, 0.2);
                overflow-x: auto;
                background: #ffffff;
                justify-content: flex-start;
                position: relative;
                border-bottom: none; /* Remove bottom border */
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
                margin-top: 5px;
            }

            /* New positioning wrapper */
            .agentlink-dm-wrapper {
                position: relative;
                margin-bottom: -1px; /* Align with message box */
                z-index: 1;
            }

            /* Adjust LinkedIn's message box to connect visually */
            .msg-form__msg-content-container {
                border-radius: 0 0 12px 12px !important;
                border-top: none !important;
            }

            /* Loading container styles */
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

    showError(message, container) {
        const existingError = container.querySelector('.dm-error-message');
        if (existingError) existingError.remove();

        const error = document.createElement('div');
        error.className = 'dm-error-message';
        error.textContent = `⚠️ ${message}`;
        container.appendChild(error);

        setTimeout(() => error.remove(), 5000);
    }

    async injectButtons(messageContainer) {
        if (this.processedMessageBoxes.has(messageContainer)) return;
        this.processedMessageBoxes.add(messageContainer);

        // Check if wrapper already exists
        let wrapper = messageContainer.previousElementSibling;
        if (wrapper && wrapper.classList.contains('agentlink-dm-wrapper')) {
            return; // Already injected
        }

        // Create wrapper div
        wrapper = document.createElement('div');
        wrapper.className = 'agentlink-dm-wrapper';

        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'dm-buttons-container';

        const { buttonConfigs = [] } = await new Promise(resolve => {
            chrome.storage.local.get(['buttonConfigs'], resolve);
        });

        if (buttonConfigs.length === 0) return;

        buttonConfigs.forEach(config => {
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
                
                // Create abort controller for cancellation
                const abortController = new AbortController();
                let isCancelled = false;

                // Get all buttons in the container
                const buttons = buttonWrapper.querySelectorAll('.dm-template-btn');
                const originalTexts = new Map(Array.from(buttons).map(btn => [btn, btn.textContent]));

                try {
                    // Hide all buttons and show loading message with stop button
                    const loadingContainer = document.createElement('div');
                    loadingContainer.className = 'ai-loading-container';
                    
                    const loadingMessage = document.createElement('div');
                    loadingMessage.className = 'ai-loading-message';
                    loadingMessage.textContent = '🤖 AgentLink is generating your message...';
                    
                    const stopButton = document.createElement('button');
                    stopButton.className = 'stop-button';
                    stopButton.innerHTML = '✕ Stop';
                    
                    stopButton.onmouseover = () => {
                        stopButton.style.background = '#ffcdd2';
                    };
                    stopButton.onmouseout = () => {
                        stopButton.style.background = '#ffebee';
                    };
                    
                    stopButton.onclick = () => {
                        isCancelled = true;
                        abortController.abort();
                        loadingMessage.textContent = '⏹️ Stopping generation...';
                        stopButton.disabled = true;
                    };
                    
                    loadingContainer.appendChild(loadingMessage);
                    loadingContainer.appendChild(stopButton);
                    
                    // Hide all buttons
                    buttons.forEach(btn => {
                        btn.style.display = 'none';
                    });
                    
                    // Insert loading container
                    buttonWrapper.insertBefore(loadingContainer, buttonWrapper.firstChild);

                    const profileData = await gatherCompleteProfileData();
                    const aiSettings = await getAISettings();

                    if (isCancelled) throw new Error('Generation cancelled by user');

                    const response = await chrome.runtime.sendMessage({
                        action: "generateMessage",
                        profileData,
                        config,
                        aiSettings,
                        signal: abortController.signal
                    });

                    if (isCancelled) throw new Error('Generation cancelled by user');
                    if (response?.error) throw new Error(response.error);
                    if (!response?.message) throw new Error('Failed to generate message');

                    const messageBox = messageContainer.querySelector('.msg-form__contenteditable[contenteditable="true"]');
                    if (messageBox) {
                        // Completely clear the message box including any hidden formatting
                        messageBox.innerHTML = '<p><br></p>';
                        
                        // Focus and select all to ensure we're at the start
                        messageBox.focus();
                        document.execCommand('selectAll', false, null);
                        
                        // Insert the text directly at the beginning
                        document.execCommand('insertText', false, response.message);
                        
                        // Trigger necessary events
                        messageBox.dispatchEvent(new Event('input', { bubbles: true }));
                        messageBox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } catch (err) {
                    console.error('Error generating AI message:', err);
                    this.showError(err.message, buttonWrapper);
                } finally {
                    // Remove loading container and restore buttons
                    const loadingContainer = buttonWrapper.querySelector('.ai-loading-container');
                    if (loadingContainer) {
                        loadingContainer.remove();
                    }
                    
                    buttons.forEach(btn => {
                        btn.style.display = '';
                        btn.disabled = false;
                        btn.textContent = originalTexts.get(btn) || btn.getAttribute('data-original-text') || config.name;
                    });
                }
            });

            buttonWrapper.appendChild(btn);
        });

        buttonWrapper.appendChild(this.createAgentLinkBranding());
        wrapper.appendChild(buttonWrapper);

        // Insert the wrapper before the message container
        messageContainer.parentNode.insertBefore(wrapper, messageContainer);
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

        // Process existing message containers
        document.querySelectorAll('.msg-form__msg-content-container').forEach(container => {
            this.injectButtons(container);
        });
    }
}

// Reused from 1st_DM.js
async function getAISettings() {
    const { aiSettings = {} } = await chrome.storage.local.get(['aiSettings']);
    return aiSettings;
}

// Simplified version of gatherCompleteProfileData from 1st_DM.js
async function gatherCompleteProfileData() {
    return {
        name: document.querySelector('h1')?.innerText.trim() || 'Name not found',
        designation: document.querySelector('.text-body-medium.break-words')?.innerText.trim() || 'Designation not found',
        location: document.querySelector('span.text-body-small.inline.t-black--light.break-words')?.innerText.trim() || 'Location not found',
        about: document.querySelector('#about')?.innerText.trim() || ''
    };
}

// Initialize when on LinkedIn
if (window.location.hostname.includes('linkedin.com')) {
    new DMMessageButtons();
}