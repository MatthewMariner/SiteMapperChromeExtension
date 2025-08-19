// background.js
importScripts('ExtPay.js');

// Initialize ExtensionPay
const extpay = ExtPay('site-structure-navigator');
extpay.startBackground();

let tabPageCounts = new Map();

// Keep service worker alive
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

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
    // Check user's Pro status with ExtensionPay
    const extpay = ExtPay('site-structure-navigator');
    extpay.getUser().then(user => {
      sendResponse({
        paid: user.paid,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionCancelAt: user.subscriptionCancelAt,
        trialStartedAt: user.trialStartedAt
      });
    }).catch(error => {
      console.error('ExtensionPay error:', error);
      sendResponse({ paid: false, error: true });
    });
    return true; // Required for async response
  } else if (message.type === "OPEN_PAYMENT_PAGE") {
    const extpay = ExtPay('site-structure-navigator');
    extpay.openPaymentPage();
  } else if (message.type === "OPEN_LOGIN_PAGE") {
    const extpay = ExtPay('site-structure-navigator');
    extpay.openLoginPage();
  }
});
