FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 8080
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node_modules/.bin/next start -p ${PORT:-8080} -H 0.0.0.0"]
