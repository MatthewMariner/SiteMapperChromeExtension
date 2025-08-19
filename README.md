# Site Structure Navigator Extension

A premium Chrome extension that automatically discovers and maps website structure using multiple sources. Features a modern Bitwarden-inspired dark UI with advanced visualization capabilities.

## ✨ Features

### 🔍 **Intelligent Discovery Engine**
- **Robots.txt parsing** - Extracts allowed/disallowed paths and sitemap locations
- **XML Sitemap processing** - Recursively processes nested sitemaps
- **HTML Sitemap detection** - Finds and parses HTML-based sitemaps
- **Current page link scanning** - Analyzes all links on the active page
- **Common path checking** - Tests standard URL patterns
- **Meta tag analysis** - Extracts navigation hints from page metadata

### 🎨 **Modern Dark UI (2025 Design)**
- **Bitwarden-inspired interface** - Professional dark theme with blue accents
- **Site favicons** - Displays website icons for visual recognition
- **Badge counter** - Shows discovered page count on extension icon
- **Smooth animations** - Cubic-bezier transitions throughout
- **Auto-focus search** - Instant search capability on popup open
- **Responsive layout** - Optimized 400x600px design

### 🌳 **Visual Sitemap Tree View**
- **Interactive tree visualization** - Parent-child relationship display
- **Expandable/collapsible nodes** - Navigate complex structures easily
- **Gradient visual indicators** - Beautiful depth visualization
- **Node counters** - Shows child count at each level
- **Favicon integration** - Root node displays site favicon
- **One-click navigation** - Open any page from the tree

### 💾 **Smart Caching & Persistence**
- **Permanent cache storage** - Discovered paths persist until manually cleared
- **Instant loading** - Cached results display immediately
- **Manual refresh control** - Clear cache with refresh button
- **Per-domain storage** - Each site maintains its own cache
- **Visual indicators** - Shows when viewing cached vs fresh data

### 🔎 **Advanced Search & Filter**
- **Wildcard support** - Use `*` for single segment, `**` for multiple
- **Path segment search** - Use `/` to search specific URL segments
- **Real-time filtering** - Instant results with debounced input
- **Filter persistence** - Export respects active search filters

### 📊 **Export Capabilities**
- **CSV Export** - Perfect for spreadsheet analysis and SEO audits
  - URL, Path, Depth, Timestamp columns
  - Compatible with Excel, Google Sheets
- **JSON Export** - Structured data for programmatic access
  - Hierarchical data structure
  - Includes metadata and timestamps
- **Smart naming** - `sitemap_domain_YYYY-MM-DD` format

### 🖱️ **Enhanced Navigation**
- **Click to open** - Single click opens in new tab
- **Middle-click support** - Open in background tab
- **Copy URL button** - One-click copy for any discovered path
- **Keyboard friendly** - Full keyboard navigation support

### 🛡️ **Security & Performance**
- **URL validation** - Only processes http/https URLs
- **Chrome URL protection** - Blocks access to restricted URLs
- **Timeout handling** - 5-second timeout for all requests
- **Parallel processing** - Concurrent fetching for speed
- **No credentials** - Strips authentication from requests
- **Cross-origin safety** - Respects browser security policies

## 📦 Installation

### From Source
1. Clone this repository:
```bash
git clone [repository-url]
cd WebsiteNavigator
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

### From Chrome Web Store
Coming soon!

## 🚀 Usage

### Basic Navigation
1. **Click the extension icon** on any website
2. **Wait for discovery** (or instant load from cache)
3. **Browse discovered pages** in List or Tree view
4. **Click any path** to navigate to that page

### Search & Filter
- Type in the search box to filter results
- Use `*` for wildcard matching
- Use `/` to match path segments
- Examples:
  - `blog` - finds all paths containing "blog"
  - `/api/*` - finds all API endpoints
  - `**/*.pdf` - finds all PDF files

### Tree View
1. Click the **Tree** tab at the bottom
2. Click arrows to expand/collapse branches
3. View parent-child relationships
4. Click any node to navigate

### Exporting Data
1. Click **Export CSV** for spreadsheet format
2. Click **Export JSON** for structured data
3. Files download automatically with timestamp

## 🏗️ Project Structure

```
WebsiteNavigator/
├── src/                 # Source files
│   ├── manifest.json    # Extension configuration (Manifest V3)
│   ├── popup.html       # Main UI interface
│   ├── popup.js         # Core functionality & site mapping
│   ├── background.js    # Service worker for badge updates
│   └── icons/           # Extension icons (16, 48, 128px)
├── dist/                # Built extension (auto-generated)
├── webpack.config.js    # Build configuration
├── package.json         # Dependencies and scripts
└── extension.zip        # Chrome Web Store package
```

## 🔧 Development

### Prerequisites
- Node.js 14+ and npm
- Google Chrome or Chromium-based browser
- Basic knowledge of JavaScript and Chrome Extension APIs

### Build Commands
```bash
npm install          # Install dependencies
npm run build        # Build extension to dist/
npm run zip          # Create extension.zip for distribution
npm run generate-icons  # Generate icons from SVG source
```

### Making Changes
1. Edit source files in `src/` directory
2. Run `npm run build` to compile
3. Reload extension in Chrome
4. Test your changes thoroughly

### Architecture Notes
- **Pure JavaScript** - No heavy frameworks, ~28KB minified
- **Chrome Storage API** - For persistent caching
- **Webpack bundling** - Modern build pipeline
- **Manifest V3** - Latest Chrome extension standard

## 🎯 Permissions

The extension requires minimal permissions:
- **activeTab** - Access current tab for scanning
- **scripting** - Inject scripts to analyze page links
- **storage** - Cache discovered paths
- **host_permissions** - Fetch sitemaps and robots.txt

## 🐛 Troubleshooting

### Extension not working?
- Ensure you're on an http/https website
- Check if the site has a restrictive robots.txt
- Try the refresh button to clear cache

### No paths found?
- Some sites block automated discovery
- Try navigating to different pages
- Check browser console for errors

### Slow discovery?
- Large sites may take longer
- Network speed affects discovery time
- Cached results load instantly

## 📝 License

MIT License - Free for personal and commercial use

## 🙏 Acknowledgments

This extension draws inspiration from:
- Bitwarden's elegant dark UI design
- Professional SEO audit tools
- Modern Chrome extension architecture
- Web accessibility standards

## 📈 Future Roadmap

- [ ] Bulk URL operations
- [ ] Response status indicators (200/404)
- [ ] Advanced filtering with regex
- [ ] Page metadata preview on hover
- [ ] Change detection between scans
- [ ] Cloud sync for settings
- [ ] Export scheduling

## 💬 Support

For issues and feature requests:
1. Check existing GitHub issues
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

---

**Version:** 1.0.1  
**Last Updated:** 2025  
**Compatibility:** Chrome 88+, Edge 88+, Brave, Opera