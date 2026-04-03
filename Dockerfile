FROM node:24-slim

RUN npm install -g pnpm@10.26.1

WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./

COPY lib/json-control ./lib/json-control
COPY lib/control-testing ./lib/control-testing

RUN pnpm install --filter @workspace/json-control --filter @workspace/control-testing

CMD ["pnpm", "--filter", "@workspace/control-testing", "run", "test"]
