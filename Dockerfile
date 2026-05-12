# ──────────────────────────────────────────────
# Runtime
# Image: ghcr.io/rayliu-factory/gwd-pi
# Used by: end users via docker run
# ──────────────────────────────────────────────
FROM node:24-slim AS runtime

# Git is required for GWD's git operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install GWD globally — version is controlled by the build arg
ARG GWD_VERSION=latest
RUN npm install -g @appfiex-rayliu/gwd@${GWD_VERSION}

# Default working directory for user projects
WORKDIR /workspace

ENTRYPOINT ["gwd"]
CMD ["--help"]

# ──────────────────────────────────────────────
# Runtime (local build)
# Image: ghcr.io/rayliu-factory/gwd-pi:local
# Used by: PR-time e2e smoke, builds the *current source* into an image
# instead of pulling from npm. Lets `tests/e2e/docker/` exercise the actual
# runtime container produced by this branch's code.
# Build with:  docker build --target runtime-local \
#                --build-arg TARBALL=appfiex-rayliu-gwd-<version>.tgz -t gwd-pi:local .
# The tarball must be in the build context (created by `npm pack`).
# ──────────────────────────────────────────────
FROM node:24-slim AS runtime-local

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

ARG TARBALL
COPY ${TARBALL} /tmp/gwd.tgz
# Install with --ignore-scripts: postinstall is unnecessary for the
# version / help smoke this image is built for, and skipping it removes
# a class of network-dependent failures.
#
# Diagnostic output: list /usr/local/bin and the installed package layout
# so a regression here fails loudly at build time with the actual file
# state visible in CI logs (instead of silently producing an image that
# fails at run time with exit 127 / command not found).
#
# Verify the loader is invokable. We pin to `node /path/to/loader.js`
# (not the bin shim) because the npm bin shim is fragile against npm
# prefix drift inside slim images; running the loader directly always
# works as long as dist/ is in the tarball.
RUN npm install -g --ignore-scripts /tmp/gwd.tgz \
    && rm /tmp/gwd.tgz \
    && echo "--- /usr/local/bin ---" \
    && ls -la /usr/local/bin | grep -i gwd || echo "(no gwd entries in /usr/local/bin)" \
    && echo "--- /usr/local/lib/node_modules/@appfiex-rayliu/gwd ---" \
    && ls -la /usr/local/lib/node_modules/@appfiex-rayliu/gwd 2>/dev/null | head -10 \
    && test -f /usr/local/lib/node_modules/@appfiex-rayliu/gwd/dist/loader.js \
    && node /usr/local/lib/node_modules/@appfiex-rayliu/gwd/dist/loader.js --version

WORKDIR /workspace

# Invoke the loader directly. Avoids any dependency on the npm bin shim
# being placed correctly in /usr/local/bin (which is platform/prefix
# dependent and has been the source of spurious exit-127 failures).
ENTRYPOINT ["node", "/usr/local/lib/node_modules/@appfiex-rayliu/gwd/dist/loader.js"]
CMD ["--help"]
