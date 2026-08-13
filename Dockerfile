# ==========================================
# Stage 1: Build & Compile React Application
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

# Install git to allow Vite build to extract SCM metadata (commit, tag, dirty-state)
RUN apk add --no-cache git

# Copy dependency manifests first for Docker layer caching
COPY package*.json ./

# Install clean dependencies
RUN npm ci

# Copy application source code (including .git for version resolution)
COPY . .

# Compile TypeScript and bundle production distribution to /app/dist
RUN npm run build

# ==========================================
# Stage 2: Minimal Production Nginx Server
# ==========================================
FROM nginx:alpine AS production

# Remove default nginx static page
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration with SPA fallback and gzip
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Basic container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
