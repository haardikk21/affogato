# Affogato

A hack built for the Espresso Build & Brew Hackathon.

## Overview

Affogato showcases a Swap + Bridge solver system operating over three Espresso powered rollups supercharged by Espresso Confirmations. The goal is to highlight the speed and security offered by Espresso Confirmations for multi-chain applications along with the usage of the Open Intents Framework to make building a solver simple and secure.

Consider two chains, A and B, both operating as rollups to a parent chain. The following examples demonstrate a cross-chain ETH/USDC swap in two ways - traditional, optimistic, and affogato.

### Traditional

1. User initiates intent to sell 1 ETH for USDC on Chain A, and locks up 1 ETH on the origin chain settler contract
2. Solver waits for finality on Chain A to be assured this transaction will not be re-orged (~15-20 minutes if not more)
3. Once transaction has finality, solver releases USDC on Chain B to the User's address
4. At some point later, transaction is marked settled on Chain A through a settlement system and solver is paid their ETH

### Optimistic (e.g. with Across)

Fast bridges like Across simplify the above workflow, but take on quite different trust assumptions. Across in particular relies on the UMA Optimistic Oracle to verify transactions have taken place on the origin chain. In case something goes wrong, Across also maintains a security budget to help cover costs of lost funds.

This is a decent approach, but can be made better by relying on much stronger confirmations like the one we get from Espresso which guarantees finality for a transaction without needing to wait for 15-20 minutes or relying on a backup security budget.

### Affogato

1. User initiates intent to sell 1 ETH for USDC on Chain A, and locks up 1 ETH on the origin chain settler contract
2. Solver receives the Espresso confirmation for this transaction and is assured this transaction will be finalized (~10-15 seconds)
3. Solver releases USDC on Chian B to the User's address
4. At some point later, transaction is marked settled on Chain A through a settlement system and solver is paid their ETH

Periodically (in practice, with a large enough inventory, once every day or few days), the filler runs a rebalancer to move ETH and USDC around across different rollups using the Arbitrum ETH and ERC20 bridges as inventory starts getting biased towards certain chains.

The faster speed here comes with zero tradeoffs unlike optimistic bridges because Espresso's confirmations guarantee the transaction will be included and finalized in the batch later on.

## Project Elements

This project has a variety of moving parts. On a high level, it includes the following elements:

1. Rollups: Three caffeinated rollups deployed with Arbitrum Sepolia as the parent chain
2. Hyperlane Core: Core Hyperlane contracts deployed on each rollup to enable message passing between chains
3. Token Bridges: Arbitrum token bridge contracts deployed on each rollup + a bridged USDC token for filler inventory rebalancing in demo ETH/USDC swaps
4. Open Intents Contracts: ERC-7683 based contracts from the Open Intents Framework used for the onchain intent creation and settlement across all rollups
5. Filler: Offchain filler/solver node listening to the caffeinated nodes for new intents being created, and subsequently filling the orders on the destination chains from a token inventory it maintains
6. Rebalancer: Offchain component of the filler node that is periodically rebalancing its own token inventory across the different rollups utilizing Arbitrum's native ETH bridge and deployed token bridges
7. UI: Frontend interface

## Rollups

Affogato consists of three rollups that were deployed. All three are following the Arbitrum Nitro stack integrated with Espresso confirmations.

> The naming scheme follows Starbucks cup sizes :D

#### Affogato Tall

- Chain Name: Tall
- Chain Slug: `affogato-tall`
- Chain ID: `1003202501`
- RPC URL: `https://nitro.tall.affogato.haardik.dev`
- CreateRollup Transaction: [Sepolia ArbiScan](https://sepolia.arbiscan.io/tx/0x3f683bf71c1d7e377d8606a77c005923df7a31f548d1160dd282434d921d02af)
- Chain Contracts: [Contracts](./config/tall/nitro-contracts.deployment.md)
- Token Bridge Contracts: [Contracts](./config/tall/token-bridge-contracts.deployment.md)
- Hyperlane Contracts: [Contracts](./config/tall/hyperlane-contracts.deployment.md)

#### Affogato Grande

- Chain Name: Grande
- Chain Slug: `affogato-grande`
- Chain ID: `1003202502`
- RPC URL: `https://nitro.grande.affogato.haardik.dev`
- CreateRollup Transaction: [Sepolia ArbiScan](https://sepolia.arbiscan.io/tx/0x25fc87fcede6197c7b1da4f2fb496994a2d2ddeea20df126432f38ae9eeb7d54)
- Chain Contracts: [Contracts](./config/grande/nitro-contracts.deployment.md)
- Token Bridge Contracts: [Contracts](./config/grande/token-bridge-contracts.deployment.md)
- Hyperlane Contracts: [Contracts](./config/grande/hyperlane-contracts.deployment.md)

#### Affogato Venti

- Chain Name: Venti
- Chain Slug: `affogato-venti`
- Chain ID: `1003202503`
- RPC URL: `https://nitro.venti.affogato.haardik.dev`
- CreateRollup Transaction: [Sepolia ArbiScan](https://sepolia.arbiscan.io/tx/0x95d75352afcbe2fc1986b549ea86e4d396fe40c20a36201643a6da2302326b11)
- Chain Contracts: [Contracts](./config/venti/nitro-contracts.deployment.md)
- Token Bridge Contracts: [Contracts](./config/venti/token-bridge-contracts.deployment.md)
- Hyperlane Contracts: [Contracts](./config/venti/hyperlane-contracts.deployment.md)

## Infrastructure

Each chain has Hyperlane contracts deployed on it. The Hyperlane nodes (validator and relayer) are listening to the Caffeinated Nodes for each chain, enabling them to act as soon as an Espresso Confirmation is received without waiting for finality.

Each chain also has Arbitrum's token bridge contracts deployed on it, used to enable USDC bridging from L2 <> L3.

Each chain uses the same three accounts for Validator/Staker, Batch Poster, and Solver

- Validator: 0x76C0e3C7b6d7a3EF29B0D9fCAf19926a8c9dEfBe
- Batch Poster: 0x09Ae7beCfA1b627890e151F173BF728b419B2d5f
- Solver: 0x82328a10707D760528bE24A5B0516E80d9a5fa57

## Local Development

- For each chain, copy `config/{chain}/full_node_template.json` to `config/{chain}/full_node.json`
- Replace `WEBSOCKET_ARBITRUM_SEPOLIA_RPC_URL`, `AFFOGATO_VALIDATOR_PRIVATE_KEY`, and `AFFOGATO_BATCHER_PRIVATE_KEY` with valid values
- Run `docker compose up -d` in the project root to start up 1x Nitro Node (w/ Espresso), 1x Validation Node, and 1x Caffeinated Node for each chain

## Notes

Random notes.

- Bridge from Arb Sep to Rollup: `cast send --rpc-url https://arbitrum-sepolia-rpc.publicnode.com YOUR_INBOX_CONTRACT_ADDRESS 'depositEth() external payable returns (uint256)' --private-key YOUR_PRIVATE_KEY --value 10000000000 -vvvv`
- ETH Balance on Rollup: `cast balance YOUR_PRIVATE_KEY_PUBLIC_ADDRESS --rpc-url http://127.0.0.1:8547`
