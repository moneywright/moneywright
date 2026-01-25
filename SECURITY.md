# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Moneywright, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report security issues by emailing the maintainers directly or using GitHub's private vulnerability reporting feature.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- We will acknowledge receipt within 48 hours
- We will provide an initial assessment within 7 days
- We will work with you to understand and resolve the issue

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Considerations

### Data Privacy

Moneywright is designed to run locally. Your financial data:

- Is stored locally on your machine (SQLite by default)
- Is never sent to external servers (except for AI features if configured)
- Can optionally use your own PostgreSQL database

### Encryption

- Sensitive data (API keys, account numbers) is encrypted at rest using AES-256-GCM
- JWT tokens are signed with HS256
- All secrets are stored in environment variables or encrypted in the database

### Network Security

- The server only listens on localhost by default
- CORS is restricted to known origins
- Security headers (CSP, HSTS, etc.) are applied in production

### Authentication

- Google OAuth with PKCE flow (when auth is enabled)
- HttpOnly, Secure cookies for tokens
- Session binding with fingerprint cookies
- Automatic token refresh

## Best Practices for Users

1. **Keep your installation updated** - Security fixes are included in updates
2. **Protect your data directory** - The SQLite database contains your financial data
3. **Secure your API keys** - Don't commit `.env` files or share API keys
4. **Use strong encryption keys** - Let the app generate keys automatically
5. **Review OAuth permissions** - Only grant necessary permissions
