# Build-Kontext ist das Repo-Root (nicht server/), weil der Client mitgebaut wird.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

# Icons aus den Screenshots freistellen — braucht sharp aus den devDependencies.
FROM deps AS assets
COPY assets-src assets-src
COPY server/scripts server/scripts
RUN npm run assets --workspace server

FROM deps AS client-build
COPY client client
COPY --from=assets /app/client/public/assets client/public/assets
RUN npm run build --workspace client

FROM deps AS server-build
COPY server server
RUN npm run build --workspace server

FROM server-build AS prod-deps
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules node_modules
# server/package.json, nicht das Root-Manifest: nur dort steht "type": "module".
# Mit dem Root-Manifest muss Node dist/index.js als CommonJS anparsen, scheitern und als
# ES-Modul neu einlesen (MODULE_TYPELESS_PACKAGE_JSON).
COPY --from=prod-deps /app/server/package.json package.json
COPY --from=server-build /app/server/dist dist
COPY --from=server-build /app/server/prisma prisma
COPY --from=client-build /app/client/dist public
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
