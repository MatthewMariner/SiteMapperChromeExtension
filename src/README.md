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
