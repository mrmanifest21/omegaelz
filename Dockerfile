# Fly.io Dockerfile for OmegaElz CRM
FROM node:20-slim

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "dist/boot.js"]
