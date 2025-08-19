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
        const url = loc.textContent.trim();
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
        const path = urlObj.pathname;
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
  let isUsingCache = false;

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
    });
  });

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
          div.className = "nav-item";
          div.dataset.path = path;
          
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
      
      // Check statuses in the background after rendering
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
  } catch (err) {
    const error = document.createElement("div");
    error.className = "error";
    error.style.display = "block";
    error.textContent = err.message;
    navMenu.appendChild(error);
  } finally {
    loading.style.display = "none";
  }
});
