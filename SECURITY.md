# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x | ✅ |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue
2. Open a private security advisory on GitHub
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgment | Within 48 hours |
| Initial Assessment | Within 7 days |
| Critical Fix | 24-72 hours |
| Standard Fix | Based on severity |

---

## Security Architecture

### Authentication

| Layer | Implementation |
|-------|----------------|
| User Auth | Supabase JWT (RS256) |
| Service Auth | API keys with SHA-256 hashing |
| Admin Auth | Role-based with database lookup |
| Mobile Auth | OAuth via system browser |

### Data Protection

| Feature | Implementation |
|---------|----------------|
| Encryption | AES-256-GCM for sensitive data |
| Database | Parameterized queries (Drizzle ORM) |
| Secrets | Environment variables only |
| API Keys | SHA-256 hashed, timing-safe comparison |

### API Security

| Feature | Implementation |
|---------|----------------|
| Rate Limiting | Per-user throttling with presets |
| Input Validation | class-validator with strict DTOs |
| CORS | Configurable allowed origins |
| Headers | Helmet.js security headers |
| SSRF Protection | URL validation (no private IPs) |

### Mobile App Security

| Feature | Implementation |
|---------|----------------|
| OAuth | System browser (not WebView) |
| URL Allowlisting | Only trusted domains load |
| Deep Links | Verified app links |
| No Local Storage | Auth via web cookies |

---

## Security Checklist

### Production Deployment

- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGINS` set to specific domains
- [ ] `MASTER_API_KEY` set (32+ chars)
- [ ] `ENCRYPTION_KEY` set for data encryption
- [ ] Database uses SSL (`?sslmode=require`)
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Dependencies audited (`npm audit`)

### Generate Secure Keys

```bash
openssl rand -hex 32  # For MASTER_API_KEY
openssl rand -hex 32  # For ENCRYPTION_KEY
```

---

## Contact

For security concerns, open a private security advisory on GitHub.
