FROM node:22-alpine

WORKDIR /relayer

RUN apk add --update --no-cache python3 build-base gcc && ln -sf /usr/bin/python3 /usr/bin/python
RUN npm install -g node-gyp
RUN npm install -g husky
RUN npm install -g @hyperlane-xyz/cli

RUN mkdir -p /relayer/.hyperlane/chains/tall /relayer/.hyperlane/chains/grande /relayer/.hyperlane/chains/venti

COPY ./config/tall/hyperlane_addresses.yaml /relayer/.hyperlane/chains/tall/addresses.yaml
COPY ./config/grande/hyperlane_addresses.yaml /relayer/.hyperlane/chains/grande/addresses.yaml
COPY ./config/venti/hyperlane_addresses.yaml /relayer/.hyperlane/chains/venti/addresses.yaml

COPY ./config/tall/hyperlane_metadata.yaml /relayer/.hyperlane/chains/tall/metadata.yaml
COPY ./config/grande/hyperlane_metadata.yaml /relayer/.hyperlane/chains/grande/metadata.yaml
COPY ./config/venti/hyperlane_metadata.yaml /relayer/.hyperlane/chains/venti/metadata.yaml

CMD ["hyperlane", "relayer", "--chains", "tall,grande,venti", "--registry", "/relayer/.hyperlane"]