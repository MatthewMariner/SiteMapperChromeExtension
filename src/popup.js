// Pro Status Manager
class ProManager {
  constructor() {
    this.isPro = false;
    this.userInfo = null;
    this.selectedUrls = new Set();
  }

  async checkStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "CHECK_PRO_STATUS" });
      this.isPro = response.paid;
      this.userInfo = response;
      return this.isPro;
    } catch (error) {
      console.error('Failed to check Pro status:', error);
      return false;
    }
  }

  async openPaymentPage() {
    chrome.runtime.sendMessage({ type: "OPEN_PAYMENT_PAGE" });
  }

  async openLoginPage() {
    chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE" });
  }

  enableProFeatures() {
    // Show bulk selection UI
    const bulkActions = document.getElementById('bulkActions');
    if (bulkActions) bulkActions.style.display = 'flex';
    
    // Add checkboxes to path items
    this.addBulkCheckboxes();
  }

  addBulkCheckboxes() {
    document.querySelectorAll('.path-item').forEach(item => {
      if (item.querySelector('.bulk-checkbox')) return; // Already added
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'bulk-checkbox';
      checkbox.addEventListener('change', (e) => {
        const url = item.dataset.url;
        if (e.target.checked) {
          this.selectedUrls.add(url);
        } else {
          this.selectedUrls.delete(url);
        }
        this.updateSelectedCount();
      });
      item.prepend(checkbox);
    });
  }

  updateSelectedCount() {
    const countElement = document.querySelector('.selected-count');
    if (countElement) {
      countElement.textContent = `${this.selectedUrls.size} selected`;
    }
  }

  async bulkExport(format = 'csv') {
    if (!this.isPro) {
      this.showUpgradePrompt();
      return;
    }

    const urls = Array.from(this.selectedUrls);
    if (urls.length === 0) {
      alert('Please select URLs to export');
      return;
    }

    // Export selected URLs
    const data = urls.map(url => ({
      url,
      path: new URL(url).pathname,
      depth: url.split('/').length - 3,
      selected: new Date().toISOString()
    }));

    if (format === 'csv') {
      this.downloadCSV(data);
    } else {
      this.downloadJSON(data);
    }
  }

  downloadCSV(data) {
    const csv = [
      ['URL', 'Path', 'Depth', 'Selected At'],
      ...data.map(row => [row.url, row.path, row.depth, row.selected])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  downloadJSON(data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }

  showUpgradePrompt() {
    const modal = document.createElement('div');
    modal.className = 'upgrade-modal';
    modal.innerHTML = `
      <div class="upgrade-content">
        <h2>🚀 Upgrade to Pro</h2>
        <p>Unlock bulk export and advanced features!</p>
        <div class="pricing-cards">
          <div class="price-card">
            <h3>Monthly</h3>
            <div class="price">$4.99/mo</div>
          </div>
          <div class="price-card featured">
            <span class="badge">BEST VALUE</span>
            <h3>Annual</h3>
            <div class="price">$20/yr</div>
            <small>Save 67%</small>
          </div>
          <div class="price-card">
            <h3>Lifetime</h3>
            <div class="price">$39</div>
            <small>One-time</small>
          </div>
        </div>
        <div class="upgrade-actions">
          <button id="upgradeBtn" class="btn-primary">Upgrade Now</button>
          <button id="loginBtn" class="btn-secondary">Already Pro? Login</button>
          <button id="closeUpgrade" class="btn-text">Maybe Later</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('upgradeBtn').addEventListener('click', () => {
      this.openPaymentPage();
      document.body.removeChild(modal);
    });

    document.getElementById('loginBtn').addEventListener('click', () => {
      this.openLoginPage();
      document.body.removeChild(modal);
    });

    document.getElementById('closeUpgrade').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }
}

// Initialize Pro Manager
const proManager = new ProManager();

class PathFilter {
  constructor(pattern) {
    this.pattern = pattern.toLowerCase();
    this.segments = pattern.split("/").filter(Boolean);
    this.regexPattern = this.createRegexPattern(pattern);
  }

  createRegexPattern(pattern) {
    // If no pattern, match everything
    if (!pattern) return new RegExp(".*");

    // Convert the pattern into a regex pattern
    const regexPattern = pattern
      .toLowerCase()
      // Escape special regex characters except *
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      // Replace ** with special temporary token
      .replace(/\*\*/g, "___DOUBLE_WILDCARD___")
      // Replace * with regex for single segment
      .replace(/\*/g, "[^/]*")
      // Replace double wildcard token with regex for multiple segments
      .replace(/___DOUBLE_WILDCARD___/g, ".*");

    // Add start anchor but make it a partial match (don't add end anchor)
    return new RegExp(`^${regexPattern}`, "i");
  }

  matches(path) {
    // If no pattern, show everything
    if (!this.pattern) return true;

    // Normalize path for comparison
    const normalizedPath = path.toLowerCase();

    // If the pattern includes slashes, use segment matching
    if (this.pattern.includes("/")) {
      const pathSegments = path.split("/").filter(Boolean);

      // For each segment in the search pattern
      return this.segments.every((searchSegment, index) => {
        // If we've run out of path segments, no match
        if (index >= pathSegments.length) return false;

        const pathSegment = pathSegments[index].toLowerCase();

        if (searchSegment === "*") return true;
        if (searchSegment === "**") return true;

        // Partial segment matching
        return pathSegment.includes(searchSegment.toLowerCase());
      });
    }

    // For non-segmented searches (no slashes), do a simple includes check
    // This allows matching any part of any segment
    return normalizedPath.includes(this.pattern);
  }
}

class SiteMapper {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.paths = new Map(); // Changed to Map to store path with status
  }

  isValidUrl(url) {
    try {
      const urlObj = new URL(url);
      // Only allow http and https schemes
      return ["http:", "https:"].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  async getAllPaths() {
    if (!this.isValidUrl(this.baseUrl)) {
      throw new Error("Cannot scan chrome:// or other restricted URLs");
    }

    await Promise.all([
      this.getRobotsTxt(),
      this.getSitemap(),
      this.getHTMLSitemap(),
      this.scanMetaTags(),
      this.checkCommonPaths(),
    ]);

    // Convert to array with path and status info
    const pathsArray = Array.from(this.paths.entries())
      .map(([path, status]) => ({ path, status }))
      .sort((a, b) => a.path.localeCompare(b.path));

    // Get current tab ID and update badge
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab) {
        chrome.runtime.sendMessage({
          type: "UPDATE_PAGE_COUNT",
          tabId: tab.id,
          count: pathsArray.length,
        });
      }
    } catch (error) {
      console.warn("Error updating badge:", error);
    }

    return pathsArray;
  }

  async batchCheckStatuses(pathsArray, batchSize = 5, maxChecks = 50, onStatusUpdate = null) {
    // Limit the number of status checks for performance
    const pathsToCheck = pathsArray.filter(item => !item.status).slice(0, maxChecks);
    
    if (pathsToCheck.length === 0) return;
    
    // Use HEAD requests for faster status checks
    for (let i = 0; i < pathsToCheck.length; i += batchSize) {
      const batch = pathsToCheck.slice(i, i + batchSize);
      
      const promises = batch.map(async (item) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          const response = await fetch(`${this.baseUrl}${item.path}`, {
            method: 'HEAD',
            signal: controller.signal,
            credentials: 'omit',
            mode: 'no-cors'
          });
          
          clearTimeout(timeoutId);
          item.status = response.status || (response.type === 'opaque' ? 200 : null);
          
          // Callback to update UI dynamically
          if (onStatusUpdate) {
            onStatusUpdate(item.path, item.status);
          }
        } catch (error) {
          // Default to unknown status
          item.status = null;
          if (onStatusUpdate) {
            onStatusUpdate(item.path, null);
          }
        }
      });
      await Promise.all(promises);
    }
  }

  async fetchWithTimeout(url, timeout = 5000) {
    if (!this.isValidUrl(url)) {
      throw new Error(`Invalid URL scheme: ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: "omit", // Don't send cookies
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async getRobotsTxt() {
    try {
      const robotsUrl = `${this.baseUrl}/robots.txt`;
      const response = await this.fetchWithTimeout(robotsUrl);
      if (!response.ok) return;

      const text = await response.text();
      const lines = text.split("\n");

      for (const line of lines) {
        const match = line.match(/^(?:Allow|Disallow|Sitemap):\s*(\S+)/i);
        if (match) {
          let path = match[1];
          if (match[0].startsWith("Sitemap")) {
            if (this.isValidUrl(path)) {
              await this.parseSitemapUrl(path);
            }
          } else {
            this.addCleanPath(path);
          }
        }
      }
    } catch (error) {
      console.warn("Error fetching robots.txt:", error);
    }
  }

  async getSitemap() {
    try {
      const sitemapUrls = [
        `${this.baseUrl}/sitemap.xml`,
        `${this.baseUrl}/sitemap_index.xml`,
        `${this.baseUrl}/sitemap/sitemap.xml`,
      ];

      for (const url of sitemapUrls) {
        if (this.isValidUrl(url)) {
          await this.parseSitemapUrl(url);
        }
      }
    } catch (error) {
      console.warn("Error fetching sitemaps:", error);
    }
  }

  async parseSitemapUrl(url) {
    try {
      if (!this.isValidUrl(url)) return;

      const response = await this.fetchWithTimeout(url);
      if (!response.ok) return;

      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");

      // Handle both sitemap index files and regular sitemaps
      const locations = [
        ...xmlDoc.getElementsByTagName("loc"),
        ...xmlDoc.getElementsByTagName("url"),
      ];

      for (const loc of locations) {
        let url = loc.textContent.trim();
        
        // Decode URL-encoded characters to handle %20 and other encoded characters
        try {
          url = decodeURIComponent(url);
        } catch {
          // If decoding fails, use the original URL
        }
        
        // Skip URLs that look like timestamps or contain invalid patterns
        if (url.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
          continue; // Skip timestamp-like URLs
        }
        
        // Clean up multiple spaces but preserve single spaces as %20
        url = url.replace(/\s+/g, ' ').trim();
        
        if (url.endsWith(".xml") && this.isValidUrl(url)) {
          await this.parseSitemapUrl(url);
        } else {
          this.addCleanPath(url);
        }
      }
    } catch (error) {
      console.warn("Error parsing sitemap:", error);
    }
  }

  async getHTMLSitemap() {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/sitemap.html`
      );
      if (!response.ok) return;

      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");

      const links = doc.getElementsByTagName("a");
      for (const link of links) {
        if (this.isValidUrl(link.href)) {
          this.addCleanPath(link.href);
        }
      }
    } catch (error) {
      console.warn("Error fetching HTML sitemap:", error);
    }
  }

  async scanMetaTags() {
    try {
      // Inject content script to scan current page
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Only scan web pages
      if (!tab.url.startsWith("http")) {
        throw new Error("Can only scan web pages");
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const links = document.getElementsByTagName("a");
          const paths = new Set();

          for (const link of links) {
            if (link.href.startsWith(window.location.origin)) {
              try {
                paths.add(new URL(link.href).pathname);
              } catch {
                // Skip invalid URLs
              }
            }
          }

          return Array.from(paths);
        },
      });

      if (results && results[0]) {
        results[0].result.forEach((path) => this.addCleanPath(path));
      }
    } catch (error) {
      console.warn("Error scanning page:", error);
    }
  }

  async checkCommonPaths() {
    const commonPaths = [
      "/about",
      "/contact",
      "/privacy",
      "/terms",
      "/faq",
      "/blog",
      "/news",
      "/products",
      "/services",
      "/support",
    ];

    const promises = commonPaths.map(async (path) => {
      try {
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}${path}`,
          2000
        );
        if (response.ok) {
          this.paths.set(path, response.status);
        }
      } catch {
        // Ignore errors for common paths
      }
    });

    await Promise.all(promises);
  }

  addCleanPath(url, status = null) {
    try {
      let urlObj;
      if (url.startsWith("/")) {
        urlObj = new URL(url, this.baseUrl);
      } else {
        urlObj = new URL(url);
      }

      // Only process URLs from the same domain
      if (urlObj.hostname === new URL(this.baseUrl).hostname) {
        let path = urlObj.pathname;
        
        // Decode any remaining URL encoding in the path
        try {
          path = decodeURIComponent(path);
        } catch {
          // Use original if decoding fails
        }
        
        // Skip paths that look like timestamps
        if (path.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
          return;
        }
        
        // Clean up multiple spaces
        path = path.replace(/\s+/g, ' ').trim();
        
        if (
          path &&
          path !== "/" &&
          !path.includes("*") &&
          !path.includes("$") &&
          !path.includes("..")
        ) {
          if (!this.paths.has(path)) {
            this.paths.set(path, status);
          }
        }
      }
    } catch {
      // Skip invalid URLs
    }
  }
}

// Settings manager
class SettingsManager {
  constructor() {
    this.settings = {
      hideXml: true,
      hideFiles: true,
      autoPing: true,
      theme: 'dark'
    };
    this.loadSettings();
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem('siteNavigatorSettings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('siteNavigatorSettings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  }

  shouldShowPath(path) {
    if (this.settings.hideXml && path.toLowerCase().endsWith('.xml')) {
      return false;
    }
    
    if (this.settings.hideFiles) {
      const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
      const isHtml = /\.(html?|php|asp|jsp)$/i.test(path);
      if (hasExtension && !isHtml) {
        return false;
      }
    }
    
    return true;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const loading = document.getElementById("loading");
  const navMenu = document.getElementById("nav-menu");
  const searchInput = document.getElementById("search-input");
  const noResults = document.getElementById("no-results");
  const exportContainer = document.getElementById("export-container");
  const exportCsvBtn = document.getElementById("export-csv");
  const exportJsonBtn = document.getElementById("export-json");
  const refreshBtn = document.getElementById("refresh-btn");
  let allPaths = [];
  let currentDomain = "";

  // Check Pro status
  await proManager.checkStatus();
  if (proManager.isPro) {
    // Add Pro badge to header
    const header = document.querySelector('h1');
    if (header) {
      const proBadge = document.createElement('span');
      proBadge.className = 'pro-badge';
      proBadge.textContent = 'PRO';
      header.appendChild(proBadge);
    }
  }
  let isUsingCache = false;

  // Initialize settings
  const settings = new SettingsManager();

  // Apply initial theme
  if (settings.get('theme') === 'light') {
    document.body.classList.add('light-theme');
  }

  // Focus search input on load
  setTimeout(() => searchInput.focus(), 100);

  // Store favicon URL globally
  let globalFaviconUrl = '';

  // Tab switching
  const navTabs = document.querySelectorAll('.nav-tab');
  const viewContainers = document.querySelectorAll('.view-container');
  
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.view;
      
      // Update active states
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Switch views
      viewContainers.forEach(container => {
        container.classList.remove('active');
        if (container.id === `${targetView}-view`) {
          container.classList.add('active');
        }
      });
      
      // Build tree view if switching to it
      if (targetView === 'tree' && allPaths.length > 0) {
        buildTreeView(allPaths, currentDomain, globalFaviconUrl);
      }
      
      // Initialize settings if switching to settings view
      if (targetView === 'settings') {
        initializeSettingsUI();
      }
    });
  });
  
  // Initialize settings UI
  function initializeSettingsUI() {
    // Set initial toggle states
    document.getElementById('hide-xml').checked = settings.get('hideXml');
    document.getElementById('hide-files').checked = settings.get('hideFiles');
    document.getElementById('auto-ping').checked = settings.get('autoPing');
    
    // Set active theme button
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === settings.get('theme'));
    });
    
    // Add event listeners for toggles
    document.getElementById('hide-xml').addEventListener('change', (e) => {
      settings.set('hideXml', e.target.checked);
      renderPaths(allPaths, currentDomain, globalFaviconUrl);
    });
    
    document.getElementById('hide-files').addEventListener('change', (e) => {
      settings.set('hideFiles', e.target.checked);
      renderPaths(allPaths, currentDomain, globalFaviconUrl);
    });
    
    document.getElementById('auto-ping').addEventListener('change', (e) => {
      settings.set('autoPing', e.target.checked);
    });
    
    // Add event listeners for theme buttons
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        settings.set('theme', theme);
        
        // Update UI
        document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Apply theme
        if (theme === 'light') {
          document.body.classList.add('light-theme');
        } else {
          document.body.classList.remove('light-theme');
        }
      });
    });
  }

  // Build tree structure from paths
  function buildTreeStructure(pathsData) {
    const root = { name: 'Home', path: '/', children: {}, count: 0 };
    
    // Normalize the data structure
    let pathItems = [];
    if (Array.isArray(pathsData)) {
      pathItems = pathsData.map(item => {
        if (typeof item === 'string') {
          return { path: item };
        } else if (item && typeof item === 'object') {
          return { path: item.path || '' };
        }
        return { path: '' };
      }).filter(item => item.path); // Filter out any empty paths
    }
    
    pathItems.forEach(item => {
      const path = item.path || '';
      if (!path) return; // Skip empty paths
      
      const segments = path.split('/').filter(Boolean);
      let current = root;
      let currentPath = '';
      
      segments.forEach((segment, index) => {
        currentPath += '/' + segment;
        
        if (!current.children[segment]) {
          current.children[segment] = {
            name: segment,
            path: currentPath,
            children: {},
            count: 0,
            isLeaf: index === segments.length - 1
          };
        }
        
        current.children[segment].count++;
        current = current.children[segment];
      });
      
      root.count++;
    });
    
    return root;
  }

  // Render tree view
  function buildTreeView(pathsData, baseUrl, faviconUrl) {
    const treeContent = document.getElementById('tree-content');
    const tree = buildTreeStructure(pathsData);
    
    treeContent.innerHTML = '';
    
    // Create root node
    const rootNode = createTreeNode(tree, baseUrl, true, faviconUrl);
    treeContent.appendChild(rootNode);
  }

  // Create tree node element
  function createTreeNode(node, baseUrl, isRoot = false, faviconUrl = null) {
    const nodeEl = document.createElement('div');
    nodeEl.className = `tree-node ${isRoot ? 'root' : ''}`;
    
    // Node content
    const content = document.createElement('div');
    content.className = 'tree-node-content';
    
    // Toggle button
    const hasChildren = Object.keys(node.children).length > 0;
    const toggle = document.createElement('div');
    toggle.className = `tree-toggle ${hasChildren ? '' : 'no-children'}`;
    toggle.innerHTML = hasChildren ? `
      <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
      </svg>
    ` : '';
    
    // Icon
    const icon = document.createElement('div');
    icon.className = 'tree-icon';
    
    // Use favicon for root node
    if (isRoot && faviconUrl) {
      const favicon = document.createElement('img');
      favicon.src = faviconUrl;
      favicon.style.width = '16px';
      favicon.style.height = '16px';
      favicon.style.objectFit = 'contain';
      favicon.onerror = () => {
        icon.innerHTML = '';
        icon.textContent = node.name[0].toUpperCase();
      };
      icon.appendChild(favicon);
    } else {
      icon.textContent = node.name[0].toUpperCase();
    }
    
    // Label
    const label = document.createElement('div');
    label.className = 'tree-label';
    label.textContent = node.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Count
    if (node.count > 0) {
      const count = document.createElement('div');
      count.className = 'tree-count';
      count.textContent = node.count;
      content.appendChild(toggle);
      content.appendChild(icon);
      content.appendChild(label);
      content.appendChild(count);
    } else {
      content.appendChild(toggle);
      content.appendChild(icon);
      content.appendChild(label);
    }
    
    // Click handler for navigation
    content.addEventListener('click', (e) => {
      if (!e.target.closest('.tree-toggle') && node.path !== '/') {
        chrome.tabs.create({ url: baseUrl + node.path });
      }
    });
    
    nodeEl.appendChild(content);
    
    // Children container
    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      
      Object.values(node.children).forEach(child => {
        const childNode = createTreeNode(child, baseUrl);
        childrenContainer.appendChild(childNode);
      });
      
      nodeEl.appendChild(childrenContainer);
      
      // Toggle functionality
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle.classList.toggle('expanded');
        childrenContainer.classList.toggle('expanded');
      });
      
      // Auto-expand root
      if (isRoot) {
        toggle.classList.add('expanded');
        childrenContainer.classList.add('expanded');
      }
    }
    
    return nodeEl;
  }

  async function getCachedPaths(domain) {
    try {
      const result = await chrome.storage.local.get([domain]);
      if (result[domain] && result[domain].paths) {
        return result[domain].paths;
      }
    } catch (error) {
      console.warn("Error retrieving cached paths:", error);
    }
    return null;
  }

  async function cachePaths(domain, paths) {
    try {
      await chrome.storage.local.set({
        [domain]: {
          paths: paths,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.warn("Error caching paths:", error);
    }
  }

  async function clearCache(domain) {
    try {
      await chrome.storage.local.remove([domain]);
    } catch (error) {
      console.warn("Error clearing cache:", error);
    }
  }

  function getVisiblePaths() {
    return Array.from(document.querySelectorAll(".nav-item"))
      .filter(item => !item.classList.contains("hidden"))
      .map(item => {
        const path = item.querySelector(".nav-item-path")?.textContent || item.dataset.path;
        const statusText = item.querySelector(".status-pill span:last-child")?.textContent;
        const status = statusText && statusText !== '?' ? parseInt(statusText) : null;
        return { path: item.dataset.path, status };
      });
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAsCSV() {
    const items = searchInput.value.trim() ? getVisiblePaths() : allPaths;
    const timestamp = new Date().toISOString().split("T")[0];
    const domain = currentDomain.replace(/[^a-z0-9]/gi, "_");
    
    let csv = "URL,Path,Status,Depth,Timestamp\n";
    items.forEach(item => {
      const path = (item && item.path) ? item.path : (typeof item === 'string' ? item : '');
      if (!path) return; // Skip empty paths
      const status = (item && item.status) || '';
      const fullUrl = `${currentDomain}${path}`;
      const depth = path.split("/").filter(Boolean).length;
      csv += `"${fullUrl}","${path}","${status}",${depth},"${timestamp}"\n`;
    });
    
    downloadFile(csv, `sitemap_${domain}_${timestamp}.csv`, "text/csv");
  }

  function exportAsJSON() {
    const items = searchInput.value.trim() ? getVisiblePaths() : allPaths;
    const timestamp = new Date().toISOString();
    const domain = currentDomain.replace(/[^a-z0-9]/gi, "_");
    
    const pages = [];
    items.forEach(item => {
      const path = (item && item.path) ? item.path : (typeof item === 'string' ? item : '');
      if (!path) return; // Skip empty paths
      const status = (item && item.status) || null;
      pages.push({
        path,
        url: `${currentDomain}${path}`,
        status,
        depth: path.split("/").filter(Boolean).length
      });
    });
    
    const data = {
      domain: currentDomain,
      timestamp,
      totalPages: pages.length,
      pages
    };
    
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `sitemap_${domain}_${timestamp.split("T")[0]}.json`, "application/json");
  }

  function filterPaths(searchText) {
    if (!searchText.trim()) {
      // Show all paths if search is empty
      document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.remove("hidden");
      });
      document.querySelectorAll(".source-section").forEach((section) => {
        section.style.display = "block";
      });
      noResults.style.display = "none";
      return;
    }

    const filter = new PathFilter(searchText.trim());
    let hasVisibleItems = false;

    // Filter items
    document.querySelectorAll(".nav-item").forEach((item) => {
      const path = item.querySelector(".nav-item-path")?.textContent || item.dataset.path;
      const matches = filter.matches(path);
      item.classList.toggle("hidden", !matches);
      if (matches) hasVisibleItems = true;
    });

    // Hide empty sections
    document.querySelectorAll(".source-section").forEach((section) => {
      const hasVisibleChildren = Array.from(
        section.querySelectorAll(".nav-item")
      ).some((item) => !item.classList.contains("hidden"));
      section.style.display = hasVisibleChildren ? "block" : "none";
    });

    noResults.style.display = hasVisibleItems ? "none" : "block";
  }

  // Add search input handler with debounce
  let debounceTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      filterPaths(e.target.value);
    }, 300);
  });

  // Add export button handlers
  exportCsvBtn.addEventListener("click", exportAsCSV);
  exportJsonBtn.addEventListener("click", exportAsJSON);
  
  // Add bulk action handlers (Pro features)
  const selectAllBtn = document.getElementById("selectAll");
  const deselectAllBtn = document.getElementById("deselectAll");
  const bulkExportCsvBtn = document.getElementById("bulkExportCsv");
  const bulkExportJsonBtn = document.getElementById("bulkExportJson");
  
  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      document.querySelectorAll('.bulk-checkbox').forEach(cb => {
        cb.checked = true;
        const url = cb.parentElement.dataset.url;
        if (url) proManager.selectedUrls.add(url);
      });
      proManager.updateSelectedCount();
    });
  }
  
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener("click", () => {
      document.querySelectorAll('.bulk-checkbox').forEach(cb => {
        cb.checked = false;
      });
      proManager.selectedUrls.clear();
      proManager.updateSelectedCount();
    });
  }
  
  if (bulkExportCsvBtn) {
    bulkExportCsvBtn.addEventListener("click", () => {
      proManager.bulkExport('csv');
    });
  }
  
  if (bulkExportJsonBtn) {
    bulkExportJsonBtn.addEventListener("click", () => {
      proManager.bulkExport('json');
    });
  }
  
  // Add refresh button handler
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      if (currentDomain) {
        await clearCache(currentDomain);
      }
      window.location.reload();
    });
  }

  function getStatusClass(status) {
    if (!status) return 'status-unknown';
    if (status >= 200 && status < 300) return 'status-2xx';
    if (status >= 300 && status < 400) return 'status-3xx';
    if (status >= 400 && status < 500) return 'status-4xx';
    if (status >= 500 && status < 600) return 'status-5xx';
    return 'status-unknown';
  }

  function updateStatusPill(path, status) {
    // Find the nav item with this path
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      if (item.dataset.path === path) {
        const statusPill = item.querySelector('.status-pill');
        if (statusPill) {
          // Update the pill class and text
          statusPill.className = `status-pill ${getStatusClass(status)}`;
          statusPill.innerHTML = `
            <span class="status-dot"></span>
            <span>${status || '?'}</span>
          `;
        }
      }
    });
  }

  function renderPaths(pathsData, baseUrl, faviconUrl) {
    // Clear existing content
    navMenu.innerHTML = "";
    
    // Normalize the data structure
    let pathItems = [];
    if (Array.isArray(pathsData)) {
      pathItems = pathsData.map(item => {
        if (typeof item === 'string') {
          return { path: item, status: null };
        } else if (item && typeof item === 'object') {
          return { path: item.path || '', status: item.status || null };
        }
        return { path: '', status: null };
      }).filter(item => item.path); // Filter out any empty paths
    }
    
    // Apply settings filters
    pathItems = pathItems.filter(item => settings.shouldShowPath(item.path));
    
    // Group paths by source/section
    const sections = {
      "Main Pages": pathItems.filter((p) => {
        const path = p.path || '';
        return path && path.split("/").length === 2;
      }),
      "Sub Pages": pathItems.filter((p) => {
        const path = p.path || '';
        return path && path.split("/").length === 3;
      }),
      "Deep Pages": pathItems.filter((p) => {
        const path = p.path || '';
        return path && path.split("/").length > 3;
      }),
    };

    // Render sections with new design
    Object.entries(sections).forEach(([title, sectionPaths]) => {
      if (sectionPaths.length > 0) {
        const section = document.createElement("div");
        section.className = "source-section";

        // Section header with count
        const header = document.createElement("div");
        header.className = "source-header";
        header.innerHTML = `
          <span>${title}${isUsingCache ? " (cached)" : ""}</span>
          <span class="source-count">${sectionPaths.length}</span>
        `;
        section.appendChild(header);

        sectionPaths.forEach((item) => {
          const path = item.path || item;
          const status = item.status;
          const div = document.createElement("div");
          div.className = "nav-item path-item";
          div.dataset.path = path;
          div.dataset.url = baseUrl + path;
          
          // Icon with favicon or first letter
          const icon = document.createElement("div");
          icon.className = "nav-icon";
          
          // Try to use favicon
          const favicon = document.createElement("img");
          favicon.src = faviconUrl;
          favicon.onerror = () => {
            // Fallback to text if favicon fails
            icon.innerHTML = '';
            const iconText = document.createElement("span");
            iconText.className = "nav-icon-text";
            const pathSegments = path.split("/").filter(Boolean);
            const lastSegment = pathSegments[pathSegments.length - 1] || "H";
            iconText.textContent = lastSegment[0].toUpperCase();
            icon.appendChild(iconText);
          };
          icon.appendChild(favicon);
          
          // Content wrapper
          const content = document.createElement("div");
          content.className = "nav-content";
          
          // Path name - make it more readable
          const pathEl = document.createElement("div");
          pathEl.className = "nav-item-path";
          // Get last meaningful segment for display
          const pathSegments = path.split("/").filter(Boolean);
          const displayName = pathSegments[pathSegments.length - 1] || "Home";
          // Convert kebab/snake case to title case
          pathEl.textContent = displayName
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          
          // URL preview - show the path
          const urlEl = document.createElement("div");
          urlEl.className = "nav-item-url";
          urlEl.textContent = path;
          
          content.appendChild(pathEl);
          content.appendChild(urlEl);
          
          // Set click handlers on content
          content.onclick = () => {
            chrome.tabs.create({ url: baseUrl + path });
          };
          content.onmousedown = (e) => {
            if (e.button === 1) {
              e.preventDefault();
              chrome.tabs.create({ url: baseUrl + path, active: false });
              return false;
            }
          };
          content.onmouseup = (e) => {
            if (e.button === 1) {
              e.preventDefault();
              return false;
            }
          };
          
          // Actions container
          const actions = document.createElement("div");
          actions.className = "nav-item-actions";
          
          // Status pill
          const statusPill = document.createElement("div");
          statusPill.className = `status-pill ${getStatusClass(status)}`;
          statusPill.innerHTML = `
            <span class="status-dot"></span>
            <span>${status || '?'}</span>
          `;
          actions.appendChild(statusPill);
          
          // Copy button
          const copyBtn = document.createElement("button");
          copyBtn.className = "action-btn";
          copyBtn.title = "Copy URL";
          copyBtn.innerHTML = `
            <svg class="icon-sm" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          `;
          copyBtn.onclick = async (e) => {
            e.stopPropagation();
            const fullUrl = baseUrl + path;
            try {
              await navigator.clipboard.writeText(fullUrl);
              copyBtn.classList.add("copied");
              copyBtn.innerHTML = `
                <svg class="icon-sm" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              `;
              setTimeout(() => {
                copyBtn.classList.remove("copied");
                copyBtn.innerHTML = `
                  <svg class="icon-sm" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                  </svg>
                `;
              }, 2000);
            } catch (err) {
              console.error("Failed to copy:", err);
            }
          };
          
          actions.appendChild(copyBtn);
          
          // Three-dot menu button
          const menuContainer = document.createElement("div");
          menuContainer.className = "dropdown-container";
          
          const menuBtn = document.createElement("button");
          menuBtn.className = "action-btn";
          menuBtn.title = "More actions";
          menuBtn.innerHTML = `
            <svg class="icon-sm" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          `;
          
          // Dropdown menu
          const dropdownMenu = document.createElement("div");
          dropdownMenu.className = "dropdown-menu";
          dropdownMenu.innerHTML = `
            <button class="dropdown-item" data-action="seo-analysis">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 4v1.38c-.83-.33-1.72-.5-2.61-.5-1.79 0-3.58.68-4.95 2.05l3.33 3.33h1.11v1.11c.86.86 1.98 1.31 3.11 1.36V15H6v3c0 1.1.9 2 2 2h10c1.66 0 3-1.34 3-3V4H9zm-1.11 6.41V8.26H5.61L4.57 7.22a5.07 5.07 0 0 1 1.82-.34c1.34 0 2.59.52 3.54 1.46l1.41 1.41-.2.2a2.7 2.7 0 0 1-1.92.8c-.47 0-.93-.12-1.33-.34zM19 17c0 .55-.45 1-1 1s-1-.45-1-1v-2h-6v2c0 .55-.45 1-1 1s-1-.45-1-1v-3h8v3z"/>
              </svg>
              SEO Analysis
            </button>
            <button class="dropdown-item" data-action="open-new-tab">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
              </svg>
              Open in New Tab
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" data-action="view-source">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
              </svg>
              View Source
            </button>
          `;
          
          menuBtn.onclick = (e) => {
            e.stopPropagation();
            // Close all other dropdowns
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
              if (menu !== dropdownMenu) menu.classList.remove('show');
            });
            dropdownMenu.classList.toggle('show');
          };
          
          // Handle dropdown item clicks
          dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
            item.onclick = async (e) => {
              e.stopPropagation();
              dropdownMenu.classList.remove('show');
              
              const action = item.dataset.action;
              const fullUrl = baseUrl + path;
              
              switch(action) {
                case 'seo-analysis':
                  showSEOModal(fullUrl);
                  break;
                case 'open-new-tab':
                  chrome.tabs.create({ url: fullUrl });
                  break;
                case 'view-source':
                  chrome.tabs.create({ url: 'view-source:' + fullUrl });
                  break;
              }
            };
          });
          
          menuContainer.appendChild(menuBtn);
          menuContainer.appendChild(dropdownMenu);
          actions.appendChild(menuContainer);
          
          div.appendChild(icon);
          div.appendChild(content);
          div.appendChild(actions);
          section.appendChild(div);
        });

        navMenu.appendChild(section);
      }
    });
    
    // Show export buttons once paths are loaded
    exportContainer.classList.add("visible");
    
    // Enable Pro features if user is Pro
    if (proManager.isPro) {
      proManager.enableProFeatures();
    }
  }

  try {
    // Get current tab URL
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Check if we're on a webpage
    if (!tab.url.startsWith("http")) {
      throw new Error("This extension only works on web pages");
    }

    const url = new URL(tab.url);
    const baseUrl = `${url.protocol}//${url.hostname}`;
    currentDomain = baseUrl;
    
    // Get favicon URL
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
    globalFaviconUrl = faviconUrl;

    // Check for cached paths first
    const cachedPaths = await getCachedPaths(baseUrl);
    
    if (cachedPaths && cachedPaths.length > 0) {
      // Use cached paths
      isUsingCache = true;
      allPaths = cachedPaths;
      loading.style.display = "none";
      renderPaths(cachedPaths, baseUrl, faviconUrl);
    } else {
      // Fetch fresh paths
      isUsingCache = false;
      const siteMapper = new SiteMapper(baseUrl);
      const pathsData = await siteMapper.getAllPaths();

      if (pathsData.length === 0) {
        throw new Error("No paths found on this site");
      }

      allPaths = pathsData;
      
      // Cache the paths for future use
      await cachePaths(baseUrl, pathsData);
      
      loading.style.display = "none";
      renderPaths(pathsData, baseUrl, faviconUrl);
      
      // Check statuses in the background after rendering (if enabled)
      if (settings.get('autoPing')) {
        siteMapper.batchCheckStatuses(pathsData, 5, 50, (path, status) => {
          updateStatusPill(path, status);
          // Update the cached data with status
          const item = pathsData.find(p => p.path === path);
          if (item) {
            item.status = status;
          }
        }).then(() => {
          // Re-cache with status information
          cachePaths(baseUrl, pathsData);
        });
      }
    }
  } catch (err) {
    const error = document.createElement("div");
    error.className = "error";
    error.style.display = "block";
    error.textContent = err.message;
    navMenu.appendChild(error);
  } finally {
    loading.style.display = "none";
  }
  
  // SEO Modal functionality
  function showSEOModal(url) {
    const modal = document.getElementById('seo-modal');
    const modalBody = document.getElementById('seo-content');
    
    // Show modal with loading state
    modal.classList.add('show');
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div class="loading-spinner"></div>
        <div style="margin-top: 12px; color: var(--text-secondary);">Analyzing page...</div>
      </div>
    `;
    
    // Fetch and analyze the page
    analyzePage(url).then(seoData => {
      displaySEOData(seoData);
    }).catch(err => {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--error-red);">
          <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <div style="margin-top: 12px;">Failed to analyze page</div>
          <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">${err.message}</div>
        </div>
      `;
    });
  }
  
  async function analyzePage(url) {
    try {
      // Create a new tab with the URL
      const tab = await chrome.tabs.create({ url, active: false });
      
      // Wait for the tab to load
      await new Promise(resolve => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });
      
      // Execute script to extract SEO data
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function() {
          const data = {
            title: document.title || 'No title',
            description: document.querySelector('meta[name="description"]')?.content || 'No description',
            h1: [],
            h2: [],
            h3: [],
            wordCount: 0,
            images: { total: 0, withoutAlt: 0 },
            links: { internal: 0, external: 0 },
            meta: {}
          };
          
          // Get H1 tags
          document.querySelectorAll('h1').forEach(h => {
            if (h.textContent.trim()) data.h1.push(h.textContent.trim());
          });
          
          // Get H2 tags
          document.querySelectorAll('h2').forEach(h => {
            if (h.textContent.trim()) data.h2.push(h.textContent.trim());
          });
          
          // Get H3 tags
          document.querySelectorAll('h3').forEach(h => {
            if (h.textContent.trim()) data.h3.push(h.textContent.trim());
          });
          
          // Count words
          const text = document.body.innerText || '';
          data.wordCount = text.trim().split(/\s+/).length;
          
          // Analyze images
          const images = document.querySelectorAll('img');
          data.images.total = images.length;
          images.forEach(img => {
            if (!img.alt) data.images.withoutAlt++;
          });
          
          // Analyze links
          const links = document.querySelectorAll('a[href]');
          links.forEach(link => {
            const href = link.href;
            if (href.startsWith(window.location.origin)) {
              data.links.internal++;
            } else if (href.startsWith('http')) {
              data.links.external++;
            }
          });
          
          // Get meta tags
          document.querySelectorAll('meta').forEach(meta => {
            if (meta.name && meta.content) {
              data.meta[meta.name] = meta.content;
            } else if (meta.property && meta.content) {
              data.meta[meta.property] = meta.content;
            }
          });
          
          return data;
        }
      });
      
      // Close the tab
      await chrome.tabs.remove(tab.id);
      
      return results[0].result;
    } catch (err) {
      throw new Error('Failed to analyze page: ' + err.message);
    }
  }
  
  function displaySEOData(data) {
    const modalBody = document.getElementById('seo-content');
    
    modalBody.innerHTML = `
      <div class="seo-section">
        <h3 class="seo-section-title">Page Title</h3>
        <div class="seo-content">${data.title}</div>
      </div>
      
      <div class="seo-section">
        <h3 class="seo-section-title">Meta Description</h3>
        <div class="seo-content">${data.description}</div>
      </div>
      
      <div class="seo-section">
        <h3 class="seo-section-title">Headings</h3>
        <div class="seo-content">
          ${data.h1.length > 0 ? `
            <div style="margin-bottom: 12px;">
              <strong style="color: var(--text-secondary); font-size: 11px;">H1 (${data.h1.length})</strong>
              <ul class="seo-list" style="margin-top: 4px;">
                ${data.h1.map(h => `<li>• ${h}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${data.h2.length > 0 ? `
            <div style="margin-bottom: 12px;">
              <strong style="color: var(--text-secondary); font-size: 11px;">H2 (${data.h2.length})</strong>
              <ul class="seo-list" style="margin-top: 4px;">
                ${data.h2.slice(0, 5).map(h => `<li>• ${h}</li>`).join('')}
                ${data.h2.length > 5 ? `<li style="color: var(--text-muted);">... and ${data.h2.length - 5} more</li>` : ''}
              </ul>
            </div>
          ` : ''}
          ${data.h3.length > 0 ? `
            <div>
              <strong style="color: var(--text-secondary); font-size: 11px;">H3 (${data.h3.length})</strong>
              <ul class="seo-list" style="margin-top: 4px;">
                ${data.h3.slice(0, 3).map(h => `<li>• ${h}</li>`).join('')}
                ${data.h3.length > 3 ? `<li style="color: var(--text-muted);">... and ${data.h3.length - 3} more</li>` : ''}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="seo-section">
        <h3 class="seo-section-title">Page Statistics</h3>
        <div class="seo-content">
          <div class="seo-stat">
            <span class="seo-stat-label">Word Count</span>
            <span class="seo-stat-value">${data.wordCount.toLocaleString()}</span>
          </div>
          <div class="seo-stat">
            <span class="seo-stat-label">Images</span>
            <span class="seo-stat-value">${data.images.total}</span>
          </div>
          <div class="seo-stat">
            <span class="seo-stat-label">Images without Alt</span>
            <span class="seo-stat-value">${data.images.withoutAlt}</span>
          </div>
          <div class="seo-stat">
            <span class="seo-stat-label">Internal Links</span>
            <span class="seo-stat-value">${data.links.internal}</span>
          </div>
          <div class="seo-stat">
            <span class="seo-stat-label">External Links</span>
            <span class="seo-stat-value">${data.links.external}</span>
          </div>
        </div>
      </div>
    `;
    
    // Store data for export
    window.currentSEOData = data;
  }
  
  // Modal close handlers
  document.getElementById('close-modal')?.addEventListener('click', () => {
    document.getElementById('seo-modal').classList.remove('show');
  });
  
  document.getElementById('seo-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove('show');
    }
  });
  
  // Export SEO data
  document.getElementById('export-seo')?.addEventListener('click', () => {
    if (window.currentSEOData) {
      const json = JSON.stringify(window.currentSEOData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seo-analysis-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });
  
  // Copy SEO data to clipboard
  document.getElementById('copy-seo')?.addEventListener('click', async () => {
    if (window.currentSEOData) {
      const text = JSON.stringify(window.currentSEOData, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('copy-seo');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      menu.classList.remove('show');
    });
  });
});
