FROM node:18-bullseye

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# install expo cli
RUN npm install -g expo-cli

# copy manifests for cached install
COPY package.json package-lock.json* yarn.lock* ./

RUN if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi

# copy app
COPY . .

EXPOSE 19000 19001 19002 8081

# default dev start; use --lan for LAN (change in compose if desired)
CMD ["expo", "start", "--tunnel", "--non-interactive"]