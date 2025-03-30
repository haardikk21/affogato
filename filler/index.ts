import { Wallet } from "ethers";
import { Filler } from "./filler";
import { log } from "./logger";
import { Rebalancer } from "./rebalancer";

const main = async () => {
  log.info("🙍 Affogato Solver 📝");
  log.info("Starting...");

  const wallet = new Wallet(process.env.FILLER_PRIVATE_KEY!);
  const rebalancer = new Rebalancer(wallet);
  const filler = new Filler(wallet);

  await rebalancer.attemptRebalanceIfNecessary();

  const SIXTY_MINUTES = 60 * 60 * 1000;
  setInterval(async () => {
    // Check if we need rebalancing once every hour
    await rebalancer.attemptRebalanceIfNecessary();
  }, SIXTY_MINUTES);

  filler.start();
  // await rebalancer.rebalanceFunds();
  // await rebalancer.bridgeEthL2ToL1(chainsMetadata[1].id, 1);
  // await rebalancer.bridgeEthL1ToL2(chainsMetadata[2].id, parseEther("0.2"));
  // await rebalancer.bridgeEthL1ToL2(chainsMetadata[3].id, parseEther("0.2"));
  // await rebalancer.bridgeUsdcL1ToL2(chainsMetadata[3].id);

  // Handle shutdown gracefully
  process.on("SIGINT", () => {
    log.debug("Received SIGINT signal");
    filler.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log.debug("Received SIGTERM signal");
    filler.stop();
    process.exit(0);
  });

  try {
    log.info("All solvers initialized successfully");
  } catch (error) {
    log.error("Failed to initialize solvers:", error);
    process.exit(1);
  }
};

await main();
