# Affogato

A hack built for the Espresso Build & Brew Hackathon.

## Chains

Affogato consists of three rollups that were deployed. All three are following the Arbitrum Nitro stack integrated with Espresso confirmations.

> The naming scheme follows Starbucks cup sizes :D

#### Affogato Tall

- Chain Name: Tall
- Chain Slug: `affogato-tall`
- Chain ID: `1003202501`
- Chain Contracts: [Contracts](./config/tall/nitro-contracts.deployment.md)
- Hyperlane Contracts: [Contracts](./config/tall/hyperlane-contracts.deployment.md)

#### Affogato Grande

- Chain Name: Grande
- Chain Slug: `affogato-grande`
- Chain ID: `1003202502`
- Chain Contracts: [Contracts](./config/grande/nitro-contracts.deployment.md)
- Hyperlane Contracts: [Contracts](./config/grande/hyperlane-contracts.deployment.md)

#### Affogato Venti

- Chain Name: Venti
- Chain Slug: `affogato-venti`
- Chain ID: `1003202503`
- Chain Contracts: [Contracts](./config/venti/nitro-contracts.deployment.md)
- Hyperlane Contracts: [Contracts](./config/venti/hyperlane-contracts.deployment.md)

## Infrastructure

Each chain has Hyperlane contracts deployed on it as well. The Hyperlane nodes (validator and relayer) are listening to the Caffeinated Nodes for each chain, enabling them to act as soon as an Espresso Confirmation is received without waiting for finality.

## Local Development

- For each chain, copy `config/{chain}/full_node_template.json` to `config/{chain}/full_node.json`
- Replace `WEBSOCKET_ARBITRUM_SEPOLIA_RPC_URL`, `AFFOGATO_VALIDATOR_PRIVATE_KEY`, and `AFFOGATO_BATCHER_PRIVATE_KEY` with valid values
- Run `docker compose up -d` in the project root to start up 1x Nitro Node (w/ Espresso), 1x Validation Node, and 1x Caffeinated Node for each chain

## Notes

Random notes.

- Bridge from Arb Sep to Rollup: `cast send --rpc-url https://arbitrum-sepolia-rpc.publicnode.com YOUR_INBOX_CONTRACT_ADDRESS 'depositEth() external payable returns (uint256)' --private-key YOUR_PRIVATE_KEY --value 10000000000 -vvvv`
- ETH Balance on Rollup: `cast balance YOUR_PRIVATE_KEY_PUBLIC_ADDRESS --rpc-url http://127.0.0.1:8547`
