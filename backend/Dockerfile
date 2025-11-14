FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN pnpm install

COPY . .

EXPOSE 3001

CMD ["pnpm", "run", "dev"]
