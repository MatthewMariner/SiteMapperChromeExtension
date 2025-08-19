# Privacy Policy - Site Structure Navigator

**Effective Date: January 2025**

## Overview
Site Structure Navigator ("the Extension") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our Chrome extension.

## Information We Collect

### License Information
When you purchase a Pro subscription, we collect:
- Email address (for license validation)
- Payment information (processed securely by Stripe)
- Subscription status and type
- License validation timestamps

### Usage Data
The Extension collects:
- Discovered website URLs and structure (stored locally only)
- Extension settings and preferences (stored locally)
- License validation attempts (for rate limiting)

### No Personal Browsing Data
We do NOT collect:
- Your browsing history
- Personal information from websites you visit
- Cookies or tracking data
- Any data unrelated to site structure mapping

## How We Use Information

### License Management
- Validate Pro subscription status
- Provide access to premium features
- Prevent unauthorized use
- Handle subscription renewals

### Extension Functionality
- Store your preferences locally
- Cache discovered site structures
- Enable export features for Pro users

## Data Storage

### Local Storage
- All discovered URLs and site structures are stored locally on your device
- Settings and preferences are stored in Chrome's local storage
- Cached license data is encrypted and stored locally for 24 hours

### Remote Storage
- Only license validation data is transmitted to ExtensionPay/Stripe servers
- Payment processing is handled entirely by Stripe's secure infrastructure
- We do not store payment card details

## Third-Party Services

### ExtensionPay
We use ExtensionPay for subscription management, which:
- Processes payments through Stripe
- Validates license status
- Manages subscription lifecycles

### Stripe
Payment processing is handled by Stripe, which:
- Securely processes payment information
- Complies with PCI DSS standards
- Has its own privacy policy at https://stripe.com/privacy

## Data Security

We implement security measures including:
- Encryption of cached license data
- Rate limiting on license validation attempts
- 3-day grace period for network issues
- Secure HTTPS connections for all external requests

## Data Retention

- Local site structure data: Until manually cleared by user
- Cached license data: 24 hours
- License validation logs: Session only (not persisted)

## Your Rights

You have the right to:
- Clear all locally stored data at any time
- Cancel your subscription
- Request information about data we hold
- Contact us with privacy concerns

## Children's Privacy

The Extension is not intended for users under 13 years of age. We do not knowingly collect information from children under 13.

## Changes to This Policy

We may update this Privacy Policy periodically. Changes will be noted with an updated "Effective Date" at the top of this document.

## Contact Information

For privacy-related questions or concerns:
- GitHub Issues: https://github.com/MatthewMariner/SiteMapperChromeExtension/issues
- Email: [Your contact email]

## Compliance

This Extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) requirements where applicable

## License Validation Details

### What happens during validation:
1. Extension checks local cache (24 hours validity)
2. If cache expired, validates with ExtensionPay
3. Stores encrypted result locally
4. Uses grace period if network unavailable

### Rate Limiting:
- Maximum 20 validation attempts per hour
- Minimum 1 minute between validation attempts
- Automatic retry with 5-minute delays on failure

## Data Minimization

We follow the principle of data minimization:
- Only collect data necessary for functionality
- Store data locally when possible
- Delete unnecessary data automatically
- Never sell or share user data

By using Site Structure Navigator, you agree to this Privacy Policy.