// background.js
importScripts('ExtPay.js');

// Initialize ExtensionPay
const extpay = ExtPay('site-structure-navigator');
extpay.startBackground();

// Welcome email configuration
const WELCOME_EMAIL_CONFIG = {
  endpoint: 'https://cors-proxy-mda.herokuapp.com/https://us-central1-mdamailer313.cloudfunctions.net/app/welcomeMessage',
  productName: 'Site Structure Navigator Pro',
  productSupportLink: 'https://github.com/MatthewMariner/SiteMapperChromeExtension',
  maxRetries: 3,
  retryDelay: 2000 // 2 seconds
};

// Welcome email sender with retry logic
async function sendWelcomeEmail(userEmail, attempt = 1) {
  try {
    console.log(`Sending welcome email to ${userEmail} (attempt ${attempt})`);
    
    const response = await fetch(WELCOME_EMAIL_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'chrome-extension://' + chrome.runtime.id
      },
      body: JSON.stringify({
        to: userEmail,
        productName: WELCOME_EMAIL_CONFIG.productName,
        productSupportLink: WELCOME_EMAIL_CONFIG.productSupportLink,
        from: 'matthew@marinerdigitalagency.com'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('Welcome email sent successfully:', result.messageId);
      // Store that we've sent the welcome email to prevent duplicates
      await chrome.storage.local.set({
        [`welcome_email_sent_${userEmail}`]: {
          sentAt: new Date().toISOString(),
          messageId: result.messageId
        }
      });
      return result;
    } else {
      throw new Error(result.message || 'Email send failed');
    }
  } catch (error) {
    console.error(`Failed to send welcome email (attempt ${attempt}):`, error);
    
    // Retry logic
    if (attempt < WELCOME_EMAIL_CONFIG.maxRetries) {
      console.log(`Retrying in ${WELCOME_EMAIL_CONFIG.retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, WELCOME_EMAIL_CONFIG.retryDelay));
      return sendWelcomeEmail(userEmail, attempt + 1);
    }
    
    // Log final failure but don't throw - we don't want to break the extension
    console.error('Failed to send welcome email after all retries:', error);
    return null;
  }
}

// Listen for first-time payments
extpay.onPaid.addListener(async (user) => {
  console.log('User completed first payment:', user);
  
  if (user.email) {
    // Check if we've already sent a welcome email to this user
    const storage = await chrome.storage.local.get([`welcome_email_sent_${user.email}`]);
    
    if (!storage[`welcome_email_sent_${user.email}`]) {
      // Send welcome email asynchronously (don't block)
      sendWelcomeEmail(user.email).catch(error => {
        console.error('Welcome email process failed:', error);
      });
    } else {
      console.log('Welcome email already sent to this user');
    }
  } else {
    console.warn('No email address available for welcome email');
  }
  
  // Clear any cached license data to force refresh
  const licenseValidator = new LicenseValidator();
  await licenseValidator.validateLicense(true);
});

// Listen for trial starts (optional - you might want to send a different email for trials)
extpay.onTrialStarted.addListener(async (user) => {
  console.log('User started trial:', user);
  // You could implement a trial welcome email here if desired
});

// License validation constants
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const GRACE_PERIOD = 3 * 24 * 60 * 60 * 1000; // 3 days grace period
const VALIDATION_RETRY_DELAY = 5 * 60 * 1000; // 5 minutes retry delay

let tabPageCounts = new Map();

// License validation system
class LicenseValidator {
  constructor() {
    this.isValidating = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.lastValidationTime = 0;
    this.minValidationInterval = 60000; // Minimum 1 minute between validations
    this.validationAttempts = [];
    this.maxAttemptsPerHour = 20; // Rate limit: 20 attempts per hour
  }

  async validateLicense(forceRefresh = false) {
    if (this.isValidating) return;
    
    // Rate limiting check
    if (!this.checkRateLimit()) {
      console.warn('Rate limit exceeded for license validation');
      const cachedData = await this.getCachedLicense();
      return cachedData || { paid: false, rateLimited: true };
    }
    
    // Minimum interval check
    const now = Date.now();
    if (now - this.lastValidationTime < this.minValidationInterval && !forceRefresh) {
      const cachedData = await this.getCachedLicense();
      return cachedData || { paid: false };
    }
    
    try {
      this.isValidating = true;
      this.lastValidationTime = now;
      this.recordValidationAttempt();
      
      // Check cached license data
      const cachedData = await this.getCachedLicense();
      
      // If cache is valid and not forcing refresh, use cached data
      if (!forceRefresh && cachedData && this.isCacheValid(cachedData)) {
        return cachedData;
      }
      
      // Check if we're in grace period (network issues)
      if (cachedData && this.isInGracePeriod(cachedData)) {
        console.log('Network issue - using grace period');
        return cachedData;
      }
      
      // Attempt to validate with ExtensionPay
      const user = await this.fetchLicenseStatus();
      
      // Cache the validated license
      await this.cacheLicense(user);
      
      // Reset retry count on successful validation
      this.retryCount = 0;
      
      return user;
      
    } catch (error) {
      console.error('License validation error:', error);
      
      // Handle network errors with grace period
      const cachedData = await this.getCachedLicense();
      if (cachedData && this.isInGracePeriod(cachedData)) {
        return cachedData;
      }
      
      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.validateLicense(), VALIDATION_RETRY_DELAY);
      }
      
      return { paid: false, error: true };
      
    } finally {
      this.isValidating = false;
    }
  }

  async fetchLicenseStatus() {
    const extpay = ExtPay('site-structure-navigator');
    const user = await extpay.getUser();
    return {
      paid: user.paid,
      email: user.email,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionCancelAt: user.subscriptionCancelAt,
      trialStartedAt: user.trialStartedAt,
      timestamp: Date.now()
    };
  }

  async cacheLicense(licenseData) {
    const encrypted = await this.encryptData(licenseData);
    await chrome.storage.local.set({
      'license_cache': encrypted,
      'license_timestamp': Date.now()
    });
  }

  async getCachedLicense() {
    const data = await chrome.storage.local.get(['license_cache', 'license_timestamp']);
    if (!data.license_cache) return null;
    
    try {
      const decrypted = await this.decryptData(data.license_cache);
      decrypted.cacheTimestamp = data.license_timestamp;
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt license cache:', error);
      return null;
    }
  }

  isCacheValid(cachedData) {
    if (!cachedData.cacheTimestamp) return false;
    const age = Date.now() - cachedData.cacheTimestamp;
    return age < CACHE_DURATION;
  }

  isInGracePeriod(cachedData) {
    if (!cachedData.cacheTimestamp) return false;
    const age = Date.now() - cachedData.cacheTimestamp;
    return age < GRACE_PERIOD;
  }

  // Simple encryption for license data (obfuscation)
  async encryptData(data) {
    const jsonStr = JSON.stringify(data);
    const encoded = btoa(jsonStr);
    // Add some obfuscation
    return encoded.split('').reverse().join('');
  }

  async decryptData(encrypted) {
    // Reverse obfuscation
    const decoded = encrypted.split('').reverse().join('');
    const jsonStr = atob(decoded);
    return JSON.parse(jsonStr);
  }
  
  // Rate limiting methods
  checkRateLimit() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Remove attempts older than 1 hour
    this.validationAttempts = this.validationAttempts.filter(time => time > oneHourAgo);
    
    // Check if under the limit
    return this.validationAttempts.length < this.maxAttemptsPerHour;
  }
  
  recordValidationAttempt() {
    this.validationAttempts.push(Date.now());
  }
}

// Initialize license validator
const licenseValidator = new LicenseValidator();

// Validate license on extension startup
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed - validating license');
  await licenseValidator.validateLicense();
});

// Validate license on browser startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started - validating license');
  await licenseValidator.validateLicense();
});

// Validate license periodically (every 12 hours)
setInterval(async () => {
  await licenseValidator.validateLicense();
}, 12 * 60 * 60 * 1000);

// Clean up old tabs periodically
setInterval(() => {
  chrome.tabs.query({}, (tabs) => {
    const activeTabs = new Set(tabs.map(t => t.id));
    for (const tabId of tabPageCounts.keys()) {
      if (!activeTabs.has(tabId)) {
        tabPageCounts.delete(tabId);
      }
    }
  });
}, 60e3); // Clean every minute

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.startsWith("http")) {
    // Reset the count for this tab
    updateBadge(tabId, 0);
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  tabPageCounts.delete(tabId);
});

// Function to update badge
function updateBadge(tabId, count) {
  tabPageCounts.set(tabId, count);

  // Format the count for display
  let displayCount = count.toString();
  if (count > 999) {
    displayCount = "999+";
  }

  // Set badge background color to Bitwarden-style blue
  chrome.action.setBadgeBackgroundColor({
    tabId: tabId,
    color: "#175DDC", // Bitwarden blue
  });

  // Set badge text color to white
  chrome.action.setBadgeTextColor({
    tabId: tabId,
    color: "#FFFFFF",
  });

  // Update badge text with padding for more rectangular shape
  chrome.action.setBadgeText({
    tabId: tabId,
    text: count > 0 ? ` ${displayCount} ` : "", // Add spaces for padding
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPDATE_PAGE_COUNT") {
    updateBadge(message.tabId, message.count);
  } else if (message.type === "CHECK_PRO_STATUS") {
    // For login flow, check directly with ExtPay first, then fall back to cache
    (async () => {
      try {
        // Try direct ExtPay call first (for fresh login detection)
        const extpay = ExtPay('site-structure-navigator');
        const user = await extpay.getUser();
        
        // If user is authenticated, cache it and return
        if (user && user.paid !== undefined) {
          const licenseData = {
            paid: user.paid,
            email: user.email,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionCancelAt: user.subscriptionCancelAt,
            trialStartedAt: user.trialStartedAt,
            timestamp: Date.now()
          };
          // Cache the fresh data
          await licenseValidator.cacheLicense(licenseData);
          sendResponse(licenseData);
          return;
        }
      } catch (directError) {
        console.warn('Direct ExtPay check failed, falling back to cache:', directError);
      }
      
      // Fall back to cached validation if direct call fails
      try {
        const licenseData = await licenseValidator.validateLicense();
        sendResponse(licenseData);
      } catch (error) {
        console.error('License validation error:', error);
        sendResponse({ paid: false, error: true });
      }
    })();
    return true; // Required for async response
  } else if (message.type === "LOGOUT_USER") {
    // Handle logout request
    (async () => {
      try {
        // Clear license cache
        await chrome.storage.local.remove(['license_cache', 'license_timestamp']);
        
        // Clear ExtensionPay user session if possible
        const extpay = ExtPay('site-structure-navigator');
        // ExtensionPay doesn't have a direct logout, but clearing cache effectively logs out
        
        sendResponse({ success: true });
      } catch (error) {
        console.error('Logout error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep message channel open for async response
  } else if (message.type === "OPEN_PAYMENT_PAGE") {
    try {
      const extpay = ExtPay('site-structure-navigator');
      extpay.openPaymentPage();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error opening payment page:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  } else if (message.type === "OPEN_LOGIN_PAGE") {
    try {
      const extpay = ExtPay('site-structure-navigator');
      extpay.openLoginPage();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error opening login page:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  } else if (message.type === "FORCE_LICENSE_CHECK") {
    // Force a fresh license validation (bypass cache and rate limiting)
    (async () => {
      try {
        // Direct call to ExtPay bypassing all caching and rate limiting
        const extpay = ExtPay('site-structure-navigator');
        const user = await extpay.getUser();
        
        const licenseData = {
          paid: user.paid,
          email: user.email,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionCancelAt: user.subscriptionCancelAt,
          trialStartedAt: user.trialStartedAt,
          timestamp: Date.now()
        };
        
        // Cache the fresh data
        await licenseValidator.cacheLicense(licenseData);
        sendResponse(licenseData);
      } catch (error) {
        console.error('Force license check error:', error);
        sendResponse({ paid: false, error: true });
      }
    })();
    return true;
  } else if (message.type === "CLEAR_LICENSE_CACHE") {
    // Clear cached license data
    chrome.storage.local.remove(['license_cache', 'license_timestamp'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
