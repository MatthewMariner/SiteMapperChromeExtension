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
    this.paths = new Set();
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

    const paths = Array.from(this.paths).sort();

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
          count: paths.length,
        });
      }
    } catch (error) {
      console.warn("Error updating badge:", error);
    }

    return paths;
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
          this.paths.add(path);
        }
      } catch {
        // Ignore errors for common paths
      }
    });

    await Promise.all(promises);
  }

  addCleanPath(url) {
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
          this.paths.add(path);
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
  function buildTreeStructure(paths) {
    const root = { name: 'Home', path: '/', children: {}, count: 0 };
    
    paths.forEach(path => {
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
  function buildTreeView(paths, baseUrl, faviconUrl) {
    const treeContent = document.getElementById('tree-content');
    const tree = buildTreeStructure(paths);
    
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
      .map(item => item.querySelector(".nav-item-path")?.textContent || item.dataset.path);
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
    const paths = searchInput.value.trim() ? getVisiblePaths() : allPaths;
    const timestamp = new Date().toISOString().split("T")[0];
    const domain = currentDomain.replace(/[^a-z0-9]/gi, "_");
    
    let csv = "URL,Path,Depth,Timestamp\n";
    paths.forEach(path => {
      const fullUrl = `${currentDomain}${path}`;
      const depth = path.split("/").filter(Boolean).length;
      csv += `"${fullUrl}","${path}",${depth},"${timestamp}"\n`;
    });
    
    downloadFile(csv, `sitemap_${domain}_${timestamp}.csv`, "text/csv");
  }

  function exportAsJSON() {
    const paths = searchInput.value.trim() ? getVisiblePaths() : allPaths;
    const timestamp = new Date().toISOString();
    const domain = currentDomain.replace(/[^a-z0-9]/gi, "_");
    
    const data = {
      domain: currentDomain,
      timestamp,
      totalPages: paths.length,
      pages: paths.map(path => ({
        path,
        url: `${currentDomain}${path}`,
        depth: path.split("/").filter(Boolean).length
      }))
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

  function renderPaths(paths, baseUrl, faviconUrl) {
    // Clear existing content
    navMenu.innerHTML = "";
    
    // Group paths by source/section
    const sections = {
      "Main Pages": paths.filter((p) => p.split("/").length === 2),
      "Sub Pages": paths.filter((p) => p.split("/").length === 3),
      "Deep Pages": paths.filter((p) => p.split("/").length > 3),
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

        sectionPaths.forEach((path) => {
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
      const paths = await siteMapper.getAllPaths();

      if (paths.length === 0) {
        throw new Error("No paths found on this site");
      }

      allPaths = paths;
      
      // Cache the paths for future use
      await cachePaths(baseUrl, paths);
      
      loading.style.display = "none";
      renderPaths(paths, baseUrl, faviconUrl);
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
