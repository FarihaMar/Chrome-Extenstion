// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handleRequest = async () => {
      try {
        if (request.action === "generateComment") {
          const result = await handleCommentGeneration(request);
          sendResponse(result);
        } else if (request.action === "generateMessage") {
          const result = await handleMessageGeneration(request);
          sendResponse(result);
        } else if (request.action === "generatePersonalDm") {
          const result = await getPersonalizedDm(request);
          sendResponse(result)
        }else if (request.action === "logError") {
          console.error('Client Error:', request.error);
          sendResponse({ status: 'logged' });
        } else if (request.action === "generatePersonalDm") {
  const result = await getPersonalizedDm(request);
  sendResponse(result)
}  else if (request.action === "generateContextualResponse") {
  const { conversationContext, responseStyle } = request;
  const { participant, history } = conversationContext;

  const prompt = `Generate a ${responseStyle} reply to this conversation:\n\n` +
                 history.map(m => `${m.sender}: ${m.message}`).join('\n');

  const config = {
    systemPrompt: "You're a helpful assistant writing LinkedIn DMs.",
    userPrompt: prompt,
    temperature: 0.7,
    maxTokens: 500
  };

  try {
    const result = await getPersonalizedDm({
      participantData: {
        participantName: participant.name || "Unknown",
        messages: history || []
      },
      config,
      aiSettings: {
        apiKey: "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", 
        apiUrl: "https://openrouter.ai/api/v1/chat/completions" 
      }
    });
    sendResponse(result);
  } catch (err) {
    sendResponse({ error: err.message });
  }
}


        
      } catch (error) {
        console.error('Background Error:', error);
        sendResponse({ 
          error: error.message || 'An unexpected error occurred',
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
      }
      if (request.action === "getDmTemplates") {
        sendResponse({
          templates: [
            { label: "Short Message", text: "Hi! Great to connect with you." },
            { label: "Friendly Message", text: "Hey there! Excited to be connected. Hope you're doing well!" },
            { label: "Detailed Message", text: "Hello! I really appreciate the connection. Looking forward to engaging with your content and learning from you." }
          ]
        });
        return true;
      }
    };
  
    handleRequest();
    return true; // Keep message port open for async response
  });
  
  // ========== COMMENT GENERATION ========== //
  async function handleCommentGeneration(request) {
    const { postText, config, aiSettings } = request;
    
    // Validate inputs
    if (!postText?.trim()) throw new Error('Post text is required');
    if (!config?.systemPrompt) throw new Error('System prompt is required');
    
    try {
      if (aiSettings?.apiKey && aiSettings?.apiUrl) {
        return await withRetry(
          () => generateWithCustomAI(postText, config, aiSettings),
          'Custom AI'
        );
      }
      return await withRetry(
        () => generateWithVercel(postText, config),
        'Vercel API'
      );
    } catch (error) {
      console.error('Comment Generation Failed:', error);
      throw new Error(`Failed to generate comment: ${error.message}`);
    }
  }
  
  async function generateWithCustomAI(postText, config, aiSettings) {
    const messages = [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: `${config.userPrompt || 'Respond to this post:'}\n\n${postText}` }
    ];
  
    const payload = {
      model: aiSettings.model || "gpt-3.5-turbo",
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 500
    };
  
    const response = await fetchWithTimeout(aiSettings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiSettings.apiKey}`,
        'X-Request-Source': 'linkedin-extension'
      },
      body: JSON.stringify(payload)
    }, 15000);
  
    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error(data.error?.message || 'Invalid response format from AI');
    }
  
    return { comment: data.choices[0].message.content.trim() };
  }
  
  // ========== MESSAGE GENERATION ========== //
  async function handleMessageGeneration(request) {
    const { profileData, config, aiSettings } = request;
    
    if (!profileData) throw new Error('Profile data is required');
    if (!config?.systemPrompt) throw new Error('System prompt is required');
    
    try {
      if (aiSettings?.apiKey && aiSettings?.apiUrl) {
        return await withRetry(
          () => generateMessageWithCustomAI(profileData, config, aiSettings),
          'Custom AI'
        );
      }
      return await withRetry(
        () => generateMessageWithVercel(profileData, config),
        'Vercel API'
      );
    } catch (error) {
      console.error('Message Generation Failed:', error);
      throw new Error(`Failed to generate message: ${error.message}`);
    }
  }
  
  async function generateMessageWithCustomAI(profileData, config, aiSettings) {
    const messages = [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: `${config.userPrompt}\n\n${JSON.stringify(profileData)}` }
    ];
  
    const payload = {
      model: aiSettings.model || "gpt-3.5-turbo",
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000
    };
  
    const response = await fetchWithTimeout(aiSettings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiSettings.apiKey}`,
        'X-Request-Source': 'linkedin-extension'
      },
      body: JSON.stringify(payload)
    }, 15000);
  
    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error(data.error?.message || 'Invalid response format from AI');
    }
  
    return { message: data.choices[0].message.content.trim() };
  }
  
  // ========== SHARED UTILITIES ========== //
  async function generateWithVercel(postText, config) {
    const response = await fetchWithTimeout(
      "https://your-vercel-app.vercel.app/api/generate-comment",
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postText, config })
      },
      10000
    );
  
    const data = await response.json();
    
    if (!data?.comment) {
      throw new Error(data?.error || 'Invalid response from Vercel');
    }
  
    return { comment: data.comment.trim() };
  }
  
  async function generateMessageWithVercel(profileData, config) {
    const response = await fetchWithTimeout(
      "https://your-vercel-app.vercel.app/api/generate-message",
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData, config })
      },
      10000
    );
  
    const data = await response.json();
    
    if (!data?.message) {
      throw new Error(data?.error || 'Invalid response from Vercel');
    }
  
    return { message: data.message.trim() };
  }
  
  async function withRetry(fn, serviceName = 'Service', retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries) {
          console.error(`${serviceName} failed after ${retries} retries`);
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  async function fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
  
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
  
      clearTimeout(timeoutId);
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
  
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`${options.method || 'GET'} request to ${url} timed out`);
      }
      throw error;
    }
  }
  
  // Error tracking (optional)
  function logErrorToService(error) {
    if (process.env.NODE_ENV === 'production') {
      fetch('https://error-tracking-service.com/log', {
        method: 'POST',
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          version: chrome.runtime.getManifest().version
        })
      }).catch(e => console.error('Failed to log error:', e));
    }
  }
  
  // ========== MESSAGE GENERATION ========== //
  
  async function getPersonalizedMessage(profileData, config, aiSettings) {
    try {
      const messages = [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: `${config.userPrompt}\n\nProfile Data:\n${JSON.stringify(profileData, null, 2)}` }
      ];
  
      const payload = {
        model: aiSettings.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      };
  
      const response = await fetch(aiSettings.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiSettings.apiKey}`,
          'HTTP-Referer': 'https://github.com/CodyAI',
          'X-Title': 'LinkedIn Message Generator'
        },
        body: JSON.stringify(payload)
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, response.statusText, errorText);
        throw new Error(`API request failed: ${response.statusText || 'unknown error'}`);
      }
  
      const data = await response.json();
      return { message: data.choices[0].message.content };
  
    } catch (error) {
      console.error('Error in getPersonalizedMessage:', error);
      return { error: error.message };
    }
  }
  
  async function getFromVercel(profileData, config) {
    try {
      const response = await fetch("https://your-vercel-app.vercel.app/api/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileData,
          config
        })
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Vercel response error:', response.status, response.statusText, errorText);
        throw new Error(`Vercel API failed: ${response.statusText || 'unknown error'}`);
      }
  
      const data = await response.json();
      return { message: data.message };
  
    } catch (error) {
      console.error('Error in getFromVercel:', error);
      return { error: error.message };
    }
  }
  
  // ========== COMMENT GENERATION ========== //
  
  async function getPersonalizedComment(postText, config, aiSettings) {
    try {
      const messages = [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: `${config.userPrompt}\n\nPost Content:\n${postText}` }
      ];
  
      const payload = {
        model: aiSettings.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500 // Comments are typically shorter than messages
      };
  
      const response = await fetch(aiSettings.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiSettings.apiKey}`,
          'HTTP-Referer': 'https://github.com/CodyAI',
          'X-Title': 'LinkedIn Comment Generator'
        },
        body: JSON.stringify(payload)
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, response.statusText, errorText);
        throw new Error(`API request failed: ${response.statusText || 'unknown error'}`);
      }
  
      const data = await response.json();
      return { comment: data.choices[0].message.content };
  
    } catch (error) {
      console.error('Error in getPersonalizedComment:', error);
      return { error: error.message };
    }
  }
  
  async function getCommentFromVercel(postText, config) {
    try {
      const response = await fetch("https://your-vercel-app.vercel.app/api/generate-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postText,
          config
        })
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Vercel response error:', response.status, response.statusText, errorText);
        throw new Error(`Vercel API failed: ${response.statusText || 'unknown error'}`);
      }
  
      const data = await response.json();
      return { comment: data.comment };
  
    } catch (error) {
      console.error('Error in getCommentFromVercel:', error);
      return { error: error.message };
    }
  }
  
  // ========== MESSAGE REPLY ========== //
  
  // ========== DM GENERATION ========== //
  async function getPersonalizedDm(request) {
    const { participantData, config, aiSettings } = request;
    
    // Validate inputs
    if (!participantData?.participantName) throw new Error('Participant data is required');
    if (!config?.systemPrompt) throw new Error('System prompt is required');
    
    try {
      if (aiSettings?.apiKey && aiSettings?.apiUrl) {
        return await withRetry(
          () => generateDmWithCustomAI(participantData, config, aiSettings),
          'Custom AI'
        );
      }
      return await withRetry(
        () => generateDmWithVercel(participantData, config),
        'Vercel API'
      );
    } catch (error) {
      console.error('DM Generation Failed:', error);
      throw new Error(`Failed to generate DM: ${error.message}`);
    }
  }
  
  async function generateDmWithCustomAI(participantData, config, aiSettings) {
    const messages = [
      { role: "system", content: config.systemPrompt },
      { 
        role: "user", 
        content: `${config.userPrompt}\n\nParticipant Data:\n${JSON.stringify({
          name: participantData.participantName,
          messages: participantData.messages,
          // Add any other relevant participant data
        }, null, 2)}`
      }
    ];
  
    const payload = {
      model: aiSettings.model || "gpt-3.5-turbo",
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000
    };
  
    const response = await fetchWithTimeout(aiSettings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiSettings.apiKey}`,
        'X-Request-Source': 'linkedin-extension'
      },
      body: JSON.stringify(payload)
    }, 15000);
  
    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error(data.error?.message || 'Invalid response format from AI');
    }
  
    return { message: data.choices[0].message.content.trim() };
  }
  
  async function generateDmWithVercel(participantData, config) {
    const response = await fetchWithTimeout(
      "https://your-vercel-app.vercel.app/api/generate-dm",
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantData, config })
      },
      10000
    );
  
    const data = await response.json();
    
    if (!data?.message) {
      throw new Error(data?.error || 'Invalid response from Vercel');
    }
  
    return { message: data.message.trim() };
  }