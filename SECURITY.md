# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within CC-Anywhere, please send an email to the maintainers. All security vulnerabilities will be promptly addressed.

Please do not open a public issue for security vulnerabilities.

## Security Best Practices

When deploying CC-Anywhere:

1. **API Keys**: Always use strong, unique API keys in production
2. **Environment Variables**: Never commit `.env` files or expose API keys
3. **Network Security**: Use HTTPS in production and restrict access as needed
4. **Database**: Ensure proper file permissions on the SQLite database
5. **Claude API Key**: Keep your Claude API key secure and rotate it regularly

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < 1.0   | :x:                |