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

    return Array.from(this.paths).sort();
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
