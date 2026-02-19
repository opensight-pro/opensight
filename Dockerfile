FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/

RUN pnpm install --filter @opensight/api... --no-frozen-lockfile

COPY apps/api apps/api

RUN pnpm --filter @opensight/api db:generate
RUN pnpm --filter @opensight/api build

ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["pnpm", "start"]
