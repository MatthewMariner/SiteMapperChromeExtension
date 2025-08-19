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
  let allPaths = [];

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
      const path = item.textContent;
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

    const siteMapper = new SiteMapper(baseUrl);
    const paths = await siteMapper.getAllPaths();

    if (paths.length === 0) {
      throw new Error("No paths found on this site");
    }

    allPaths = paths;

    // Group paths by source/section
    const sections = {
      "Main Pages": paths.filter((p) => p.split("/").length === 2),
      "Sub Pages": paths.filter((p) => p.split("/").length === 3),
      "Deep Pages": paths.filter((p) => p.split("/").length > 3),
    };

    // Render sections
    Object.entries(sections).forEach(([title, sectionPaths]) => {
      if (sectionPaths.length > 0) {
        const section = document.createElement("div");
        section.className = "source-section";

        const header = document.createElement("div");
        header.className = "source-header";
        header.textContent = `${title} (${sectionPaths.length})`;
        section.appendChild(header);

        sectionPaths.forEach((path) => {
          const div = document.createElement("div");
          div.className = "nav-item";
          div.textContent = path;
          div.onclick = () => {
            chrome.tabs.create({ url: baseUrl + path });
          };
          div.onmousedown = (e) => {
            if (e.button === 1) {
              e.preventDefault();
              chrome.tabs.create({ url: baseUrl + path, active: false });
              return false;
            }
          };
          div.onmouseup = (e) => {
            if (e.button === 1) {
              e.preventDefault();
              return false;
            }
          };
          section.appendChild(div);
        });

        navMenu.appendChild(section);
      }
    });
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
