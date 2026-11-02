# Deployment and infrastructure: proxy routing

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 5 - Reverse Proxy & Edge Routing (Caddy / Nginx)

Never expose Node.js runtime servers directly to the public internet. Front them with an edge proxy or reverse proxy (Caddy, Nginx, or AWS ALB) to handle TLS termination, request buffering, HTTP/2, compression, and security headers.

### 5.1 Production Caddyfile (Modern, Fast, Automated TLS)

```caddyfile
# /etc/caddy/Caddyfile
{
    email admin@example.com
    admin off
}

api.example.com {
    # Encode with Zstandard and Gzip
    encode zstd gzip

    # Upstream backend container
    reverse_proxy backend:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}

        # Health checks to upstream container
        health_uri /healthz/ready
        health_interval 5s
        health_timeout 2s
    }

    # Strict Production Security Headers
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server # Strip server identity header
    }

    # Logging in structured JSON
    log {
        output stdout
        format json
    }
}
```

---
