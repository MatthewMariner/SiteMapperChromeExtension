// background.js
let tabPageCounts = new Map();

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
  }
});
