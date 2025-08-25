# Site Structure Navigator Extension

A premium Chrome extension that automatically discovers and maps website structure using multiple sources. Features a modern Figma-inspired UI with dark/light themes, professional SEO analysis tools, and comprehensive site mapping capabilities. Available here: https://chromewebstore.google.com/detail/site-structure-navigator/jcidaogiecfddcmhcnplfagahimdmied

## 💎 Pro Version Available
Unlock advanced features with our Pro subscription:
- **Monthly**: $4.99/month
- **Annual**: $20/year (save 66%)
- **Lifetime**: $39 one-time payment

## ✨ Features

### 🔍 **Intelligent Discovery Engine**
- **Robots.txt parsing** - Extracts allowed/disallowed paths and sitemap locations
- **XML Sitemap processing** - Recursively processes nested sitemaps
- **HTML Sitemap detection** - Finds and parses HTML-based sitemaps
- **Current page link scanning** - Analyzes all links on the active page
- **Common path checking** - Tests standard URL patterns
- **Meta tag analysis** - Extracts navigation hints from page metadata

### 🎨 **Modern UI with Theme Support (2025 Design)**
- **Figma-inspired interface** - Professional design with blue accents
- **Dark/Light theme switcher** - Automatic theme detection with manual override
- **Site favicons** - Displays website icons for visual recognition
- **Badge counter** - Shows discovered page count on extension icon
- **Smooth animations** - Cubic-bezier transitions throughout
- **Auto-focus search** - Instant search capability on popup open
- **Responsive layout** - Optimized 400x600px design
- **Settings panel** - Customizable preferences with persistent storage

### 🌳 **Visual Sitemap Tree View**
- **Interactive tree visualization** - Parent-child relationship display
- **Expandable/collapsible nodes** - Navigate complex structures easily
- **Gradient visual indicators** - Beautiful depth visualization
- **Node counters** - Shows child count at each level
- **Favicon integration** - Root node displays site favicon
- **One-click navigation** - Open any page from the tree
- **Response status indicators** - Visual badges for 200/301/404 status codes
- **Auto status checking** - Configurable automatic HTTP status verification

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

### 🔍 **SEO Analysis Tools**

#### Free Features:
- **Basic page analysis** - Extract key SEO metrics from any page
- **Heading structure** - H1, H2, H3 hierarchy and content
- **Meta data extraction** - Title tags and meta descriptions
- **Content metrics** - Word count analysis
- **Image audit** - Total images and alt text coverage
- **Link analysis** - Internal vs external link counts

#### Pro Features ($4.99/mo):
- **SEO Performance Score (0-100)** - Comprehensive scoring algorithm
- **SERP Preview** - See exactly how your page appears in Google
- **Core Web Vitals** - LCP, FID, CLS performance indicators
- **Competitor Benchmarking** - Compare against industry standards
- **Actionable Recommendations** - Prioritized issues and fixes
- **Structured Data Detection** - Schema.org implementation check
- **Open Graph Analysis** - Social media optimization audit
- **Canonical URL Detection** - Duplicate content prevention
- **Mobile Optimization Check** - Viewport and responsive design
- **Performance Metrics** - DOM size, scripts, and stylesheet analysis
- **Content Analysis** - Reading time and content depth assessment

### ⚙️ **Customizable Settings**
- **File type filtering** - Hide/show XML files and other file types
- **Auto status checking** - Toggle automatic HTTP status verification
- **Theme preferences** - Choose between dark and light modes
- **Persistent storage** - Settings saved across sessions
- **Figma-style toggles** - Beautiful animated switch controls

### 📊 **Export Capabilities**

#### Free Version:
- **Limited Export** - Up to 10 URLs per export
- **Basic CSV/JSON** - Standard format with essential data

#### Pro Version:
- **Unlimited Export** - Export entire site structure
- **Bulk Export Mode** - Select and export specific URLs
- **Advanced Filtering**:
  - Status code filtering (200, 301, 404, etc.)
  - File type filtering (HTML, PDF, images, etc.)
  - URL pattern matching
  - Depth-based filtering
- **Smart naming** - `sitemap_domain_YYYY-MM-DD` format

### 🖱️ **Enhanced Navigation**
- **Click to open** - Single click opens in new tab
- **Middle-click support** - Open in background tab
- **Copy URL button** - One-click copy for any discovered path
- **3-dot menu** - Additional actions including SEO analysis
- **View source** - Quick access to page source code
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
- **scripting** - Inject scripts to analyze page links and SEO metrics
- **storage** - Cache discovered paths and user settings
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
- Figma's modern UI/UX design patterns
- Professional SEO audit tools
- Modern Chrome extension architecture
- Web accessibility standards

## 📈 Recent Updates (v1.2.0)

### Free Features Added:
- ✅ SEO Analysis Tool - Basic page metrics extraction
- ✅ Dark/Light Theme Support - Full theme switching capability
- ✅ Response Status Indicators - Visual 200/301/404 badges
- ✅ Settings Panel - Customizable preferences with Figma-style UI
- ✅ File Type Filtering - Hide/show XML and other file types
- ✅ 3-Dot Actions Menu - Quick access to SEO tools and utilities
- ✅ Auto Status Checking - Configurable HTTP status verification

### Pro Features Added:
- ✅ **SEO Performance Scoring** - 0-100 score with visual indicator
- ✅ **SERP Preview** - Google search result preview
- ✅ **Core Web Vitals** - Estimated LCP, FID, CLS metrics
- ✅ **Competitor Benchmarking** - Industry comparison
- ✅ **Bulk Export Mode** - Select and export specific URLs
- ✅ **Advanced SEO Filtering** - Status codes, file types, patterns
- ✅ **Actionable Recommendations** - Prioritized SEO fixes
- ✅ **ExtensionPay Integration** - Secure subscription management

## 🆚 Free vs Pro Comparison

| Feature | Free | Pro |
|---------|------|-----|
| **Site Structure Discovery** | ✅ | ✅ |
| **Tree & Flat View** | ✅ | ✅ |
| **Search & Filter** | ✅ | ✅ |
| **Dark/Light Theme** | ✅ | ✅ |
| **Export Limit** | 10 URLs | Unlimited |
| **Bulk Export Mode** | ❌ | ✅ |
| **SEO Score (0-100)** | ❌ | ✅ |
| **SERP Preview** | ❌ | ✅ |
| **Core Web Vitals** | ❌ | ✅ |
| **Competitor Benchmarks** | ❌ | ✅ |
| **SEO Recommendations** | ❌ | ✅ |
| **Structured Data Check** | ❌ | ✅ |
| **Open Graph Analysis** | ❌ | ✅ |
| **Advanced Filtering** | ❌ | ✅ |
| **Priority Support** | ❌ | ✅ |

## 🚧 Future Roadmap

- [ ] Page speed insights integration
- [ ] Keyword density analysis
- [ ] Backlink checker
- [ ] XML sitemap generator
- [ ] Scheduled site audits
- [ ] Export to Google Sheets
- [ ] Team collaboration features
- [ ] White-label options

## 💬 Support

For issues and feature requests:
1. Check existing GitHub issues
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

---

**Version:** 1.2.0  
**Last Updated:** January 2025  
**Compatibility:** Chrome 88+, Edge 88+, Brave, Opera

## 💰 Pricing

- **Free Version**: Core features with 10 URL export limit
- **Pro Monthly**: $4.99/month - Cancel anytime
- **Pro Annual**: $20/year - Best value (66% off)
- **Pro Lifetime**: $39 - One-time payment, lifetime access

All Pro plans include unlimited exports, advanced SEO analysis, and priority support.