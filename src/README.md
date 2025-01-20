# Site Structure Navigator Extension

A Chrome extension that automatically discovers and maps website structure using multiple sources including robots.txt, sitemaps, and common paths. It creates an easy-to-navigate menu of all discovered URLs organized by depth.

## Features

- 🔍 Multiple Source Discovery

  - Robots.txt parsing
  - XML Sitemap processing (including nested sitemaps)
  - HTML Sitemap detection
  - Current page link scanning
  - Common path checking
  - Meta tag analysis

- 📊 Smart Organization

  - URLs grouped by depth (main pages, sub-pages, deep pages)
  - Clean path presentation
  - Click-to-navigate functionality

- 🛡️ Security & Performance
  - URL scheme validation
  - Timeout handling
  - Error recovery
  - Parallel processing
  - Cross-origin protection

## Installation

1. Clone this repository or download the source code

```bash
git clone [repository-url]
```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

## Project Structure

```
site-mapper-extension/
├── manifest.json        # Extension configuration
├── popup.html          # Extension popup interface
├── popup.js            # Main functionality
└── background.js       # Background service worker
```

## Usage

1. Click the extension icon while on any webpage
2. The extension will scan the website using multiple methods
3. Discovered URLs will be displayed in a hierarchical menu
4. Click any URL to open it in a new tab

## Security Features

- Only works on http/https URLs
- Prevents access to chrome:// and other restricted URLs
- Sanitizes paths to prevent directory traversal
- Implements fetch timeouts
- Removes credentials from requests
- Validates all URLs before processing

## Error Handling

The extension provides clear feedback for common issues:

- Non-web pages (chrome://, file://, etc.)
- Inaccessible resources
- Empty results
- Network timeouts
- Invalid URLs

## Limitations

- Only works on regular web pages (http/https)
- Cannot access chrome:// or other restricted URLs
- Subject to website's robots.txt restrictions
- Network requests may timeout on slow connections

## Development

### Prerequisites

- Google Chrome
- Basic understanding of JavaScript and Chrome Extension APIs

### Making Changes

1. Modify the source files as needed
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension
4. Test your changes

### Adding New Features

To add new URL discovery methods:

1. Create a new method in the `SiteMapper` class
2. Add it to the `getAllPaths()` method
3. Implement appropriate error handling
4. Test thoroughly with different websites

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Best Practices

When contributing, please:

- Add comments for complex logic
- Follow existing error handling patterns
- Test on various website types
- Update documentation as needed

## License

MIT License - feel free to use this code for any purpose

## Support

For issues and feature requests, please:

1. Check existing issues
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected behavior
   - Screenshots if applicable

## Acknowledgments

This extension draws inspiration from:

- Web crawlers
- Site mapping tools
- Chrome's extension architecture
- Various sitemap standards

# Privacy Policy

## Site Structure Navigator Chrome Extension

Last updated: January 20, 2025

### Overview

Site Structure Navigator is committed to protecting your privacy. This privacy policy explains our data collection, use, and disclosure practices for the Site Structure Navigator Chrome extension.

### Data Collection and Use

The Site Structure Navigator extension:

- Does not collect any personal information
- Does not track your browsing history
- Does not store any user data
- Does not use cookies
- Does not transmit any data to external servers
- Processes all information locally within your browser

### Website Access

The extension requires access to website data solely to:

1. Analyze site structure and navigation
2. Discover available pages and endpoints
3. Create a local site map for navigation purposes

All processing is done locally in your browser, and no information is transmitted externally.

### Required Permissions

The extension requires certain permissions to function:

- `activeTab`: Required to analyze the current webpage's structure
- `scripting`: Needed to detect and process navigation elements
- `webNavigation`: Used to track page loads for badge counter updates
- `host permissions`: Required to access site resources like robots.txt and sitemaps

These permissions are used exclusively for site structure discovery and navigation purposes.

### Data Storage

The extension:

- Does not maintain any persistent storage
- Does not save browsing history
- Only keeps temporary site structure information while you're actively using it
- Clears all data when you close the tab or navigate away

### Third-Party Services

The extension:

- Does not integrate with any third-party services
- Does not share any data with third parties
- Does not include any tracking or analytics tools

### Updates

We may update this privacy policy from time to time. Any changes will be reflected in the "Last updated" date at the top of the policy.

### Contact

If you have any questions about this privacy policy or the extension's privacy practices, please open an issue in our GitHub repository.

### Source Code

The extension is open source, and the complete source code is available for review in our GitHub repository.
