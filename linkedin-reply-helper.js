class LinkedInReplyHelper {
    constructor() {
      this.processedReplyBoxes = new WeakSet();
      this.MAX_RETRIES = 3;
      this.RETRY_DELAY = 500;
      this.observer = null; //newly added line
      this.routeChangeHandler = null; //new added line
  
      // Initialize live log
      this.loadLiveLog().then(() => {
        createLiveLog();
        updateLiveLog('Ready to reply', 1);
        this.initObserver();
      });
    }
  
    async loadLiveLog() {
      return new Promise((resolve) => {
        if (window.createLiveLog && window.updateLiveLog) {
          resolve(); // Already loaded
          return;
        }
  
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('livelog.js');
        script.onload = resolve;
        (document.head || document.documentElement).appendChild(script);
      });
    }
  
    initStyles() {
        if (document.getElementById('dynamic-reply-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'dynamic-reply-styles';
        style.textContent = `
          .dynamic-reply-buttons {
              border: 1px solid #24268d;
              border-radius: 12px;
              padding: 10px;
              margin: 16px;
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
              box-shadow: 0 0 8px rgba(100, 149, 237, 0.2);
              overflow-x: auto;
              background: #ffffff;
              justify-content: flex-start;
          }
          .reply-btn {
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
          .reply-btn:hover {
              background: rgb(0, 51, 204);
              color: #ffffff;
          }
          .reply-btn:active {
              transform: scale(0.98);
          }
          .reply-btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
              transform: none !important;
              background: #24268d;
              border: 1px solid #24268d;
          }
          .ai-loading-container {
              display: flex;
              align-items: center;
              justify-content: space-between;
              width: 100%;
              padding: 10px;
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
              background: #ffcdd2;
          }
        `;
        document.head.appendChild(style);
      }
  
    async extractCommentText(commentContainer) {
      const selectors = [
        '.comments-comment-item__inline-show-more-text span',
        '.update-components-text span',
        '.comments-comment-item__main-content',
        '[data-test-id="comment-text"]'
      ];
      
      for (const selector of selectors) {
        const element = commentContainer.querySelector(selector);
        if (element) {
          return (element.innerText || element.textContent)
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
      
      // Fallback: Search through all text nodes
      const walker = document.createTreeWalker(
        commentContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let textNodes = [];
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent.trim();
        if (text) textNodes.push(text);
      }
      
      if (textNodes.length > 0) {
        return textNodes.join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      console.warn('Comment text not found in container:', commentContainer);
      return null;
    }
  
    async pasteReply(commentText, replyContainer) {
      const selector = 'div.ql-editor[contenteditable="true"]';
      const replyBox = replyContainer.querySelector(selector);
      
      if (replyBox) {
        replyBox.focus();
        
        // Save original mention elements
        const mentionElements = Array.from(replyBox.querySelectorAll('a.ql-mention'));
        
        // Create new content
        const fragment = document.createDocumentFragment();
        const p = document.createElement('p');
        p.textContent = commentText;
        fragment.appendChild(p);
        
        // Clear box and re-add mentions
        replyBox.innerHTML = '';
        mentionElements.forEach(mention => {
          replyBox.appendChild(mention);
          replyBox.appendChild(document.createTextNode(' '));
        });
        
        replyBox.appendChild(fragment);
        
        // Move cursor to end
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(replyBox);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Trigger events
        replyBox.dispatchEvent(new Event('input', { bubbles: true }));
        replyBox.dispatchEvent(new Event('change', { bubbles: true }));
        
        return true;
      }
      return false;
    }
  
    async getAISettings() {
      try {
        return new Promise(resolve => {
          chrome.storage.local.get(['aiSettings'], (result) => {
            resolve(result.aiSettings || {});
          });
        });
      } catch (error) {
        console.error('Extension context invalidated, reloading...');
        window.location.reload();
        return {};
      }
    }
  
    async handleReplyButtonClick(button, config, commentContainer, replyContainer) {
      const container = button.closest('.dynamic-reply-buttons');
      const buttons = container ? container.querySelectorAll('.reply-btn') : [button];
      const originalTexts = new Map(Array.from(buttons).map(btn => [btn, btn.textContent]));
      
      // Create abort controller for cancellation
      const abortController = new AbortController();
      let isCancelled = false;
  
      try {
        // Hide all buttons and show loading message with stop button
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'ai-loading-container';
        loadingContainer.style.display = 'flex';
        loadingContainer.style.alignItems = 'center';
        loadingContainer.style.justifyContent = 'space-between';
        loadingContainer.style.width = '100%';
        loadingContainer.style.padding = '10px';
        
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'ai-loading-message';
        loadingMessage.textContent = '🤖 AgentLink is generating your reply...';
        
        const stopButton = document.createElement('button');
        stopButton.className = 'stop-button';
        stopButton.innerHTML = '✕ Stop';
        stopButton.style.marginLeft = '10px';
        stopButton.style.padding = '3px 8px';
        stopButton.style.fontSize = '12px';
        stopButton.style.background = '#ffebee';
        stopButton.style.color = '#c62828';
        stopButton.style.border = '1px solid #ef9a9a';
        stopButton.style.borderRadius = '4px';
        stopButton.style.cursor = 'pointer';
        stopButton.style.transition = 'all 0.2s';
        
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
        container.insertBefore(loadingContainer, container.firstChild);
        
        updateLiveLog('Finding original post', 1);
        const postContainer = commentContainer.closest(
          '.feed-shared-update-v2, ' +
          '.update-components-update-v2, ' +
          '.scaffold-finite-scroll__content > div > div'
        ) || document.querySelector('.main-feed');
        
        if (!postContainer) throw new Error('Could not find original post');
  
        updateLiveLog('Extracting post and comment text', 2);
        const [postText, commentText] = await Promise.all([
          this.extractPostText(postContainer),
          this.extractCommentText(commentContainer)
        ]);
  
        if (!postText) throw new Error('No post text found');
        if (!commentText) throw new Error('No comment text found');
  
        if (isCancelled) throw new Error('Generation cancelled by user');
  
        updateLiveLog('Generating AI reply', 2);
        const response = await chrome.runtime.sendMessage({
          action: "generateComment",
          postText: `${postText}\n\nComment to reply to: "${commentText}"`,
          config,
          aiSettings: await this.getAISettings(),
          signal: abortController.signal
        });
  
        if (isCancelled) throw new Error('Generation cancelled by user');
        if (response?.error) throw new Error(response.error);
        if (!response?.comment) throw new Error('Failed to generate reply');
  
        updateLiveLog('Posting reply', 2);
        let replyInserted = false;
        for (let i = 0; i < this.MAX_RETRIES; i++) {
          if (isCancelled) break;
          replyInserted = await this.pasteReply(response.comment, replyContainer);
          if (replyInserted) break;
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (i + 1)));
        }
  
        if (isCancelled) throw new Error('Generation cancelled by user');
        updateLiveLog('Reply posted!', 1);
  
        if (!replyInserted) throw new Error('Could not paste reply');
  
      } catch (error) {
        updateLiveLog(`Error: ${error.message}`, 0);
        
        if (error.message !== 'Generation cancelled by user') {
          console.error('Reply Error:', error);
          showError(error.message);
        }
        
        // Show cancellation/error state
        const loadingContainer = container.querySelector('.ai-loading-container');
        if (loadingContainer) {
          const loadingMessage = loadingContainer.querySelector('.ai-loading-message');
          const stopButton = loadingContainer.querySelector('.stop-button');
          
          if (isCancelled) {
            loadingMessage.textContent = '❌ Generation stopped';
            loadingMessage.style.color = '#c62828';
          } else {
            loadingMessage.textContent = '❌ Error generating reply';
            loadingMessage.style.color = '#c62828';
          }
          
          if (stopButton) stopButton.remove();
          
          setTimeout(() => {
            loadingContainer.remove();
            buttons.forEach(btn => {
              btn.style.display = '';
              btn.textContent = originalTexts.get(btn);
            });
          }, isCancelled ? 1000 : 2000);
        }
        
        if (!isCancelled) {
          chrome.runtime.sendMessage({
            action: "logError",
            error: error.message,
            context: "handleReplyButtonClick"
          });
        }
      } finally {
        if (!isCancelled) {
          // Remove loading container and restore buttons
          const loadingContainer = container.querySelector('.ai-loading-container');
          if (loadingContainer) {
            loadingContainer.remove();
          }
          
          buttons.forEach(btn => {
            btn.style.display = '';
            btn.disabled = false;
            btn.textContent = originalTexts.get(btn) || btn.getAttribute('data-original-text') || config.name;
          });
        }
      }
    }
  
    async addDynamicButtonsToReplyBox(replyBox) {
      if (this.processedReplyBoxes.has(replyBox)) return;
      this.processedReplyBoxes.add(replyBox);
      this.initStyles();
  
      const commentContainer = replyBox.closest('.comments-comment-box--cr, .comments-comment-box--reply');
      if (!commentContainer) return;
  
      const existing = replyBox.querySelector('.dynamic-reply-buttons');
      if (existing) return;
  
      try {
        const { commentConfigs = [] } = await new Promise(resolve => {
          chrome.storage.local.get(['commentConfigs'], resolve);
        });
      
        if (commentConfigs.length === 0) return;
      
        const container = document.createElement('div');
        container.className = 'dynamic-reply-buttons';
      
        commentConfigs.forEach(config => {
          const button = document.createElement('button');
          button.className = 'reply-btn';
          button.textContent = config.name;
          button.setAttribute('data-original-text', config.name);
      
          button.addEventListener('click', () => {
            this.handleReplyButtonClick(button, config, commentContainer, replyBox);
          });
      
          container.appendChild(button);
        });
  
        // Powered by AgentLink line at the very bottom
        const powered = document.createElement('div');
        powered.style.width = '100%';
        powered.style.borderTop = '1px solid #e5e7eb';
        powered.style.paddingTop = '8px';
        powered.style.display = 'flex';
        powered.style.alignItems = 'center';
        powered.style.justifyContent = 'center';
        powered.style.gap = '6px';
        powered.style.fontSize = '14px';
        powered.style.color = '#24268d';
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
        container.appendChild(powered);
  
        commentContainer.appendChild(container);
      } catch (error) {
        console.error('Extension context error:', error);
      }
    }
  //modified initObserver
    initObserver() {
        // Disconnect existing observer if any
        if (this.observer) this.observer.disconnect();
      
        // Create new observer with persistent tracking
        this.observer = new MutationObserver(mutations => {
          if (!document.body) return;
          
          // Always check all existing reply boxes on any DOM change
          document.querySelectorAll('.comments-comment-box--reply').forEach(box => {
            if (!this.processedReplyBoxes.has(box)) {
              this.addDynamicButtonsToReplyBox(box);
            }
          });
        });
      
        // Start observing
        this.observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      
        // Also listen for LinkedIn's route changes
        if (!this.routeChangeHandler) {
          this.routeChangeHandler = () => {
            setTimeout(() => {
              document.querySelectorAll('.comments-comment-box--reply').forEach(box => {
                this.addDynamicButtonsToReplyBox(box);
              });
            }, 1000); // Delay to allow LinkedIn's lazy loading
          };
          window.addEventListener('popstate', this.routeChangeHandler);
        }
      }
  }

  //optional cleanup method
  destroy() {
    if (this.observer) this.observer.disconnect();
    if (this.routeChangeHandler) {
      window.removeEventListener('popstate', this.routeChangeHandler);
    }
  }
  
  if (window.location.href.includes('linkedin.com/feed')) {
    try {
      new LinkedInReplyHelper();
    } catch (error) {
      console.error('Failed to initialize LinkedInReplyHelper:', error);
    }
  }
