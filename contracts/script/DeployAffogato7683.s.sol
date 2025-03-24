// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25 <0.9.0;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {TypeCasts} from "@hyperlane-xyz/libs/TypeCasts.sol";
import {GasRouter} from "@hyperlane-xyz/client/GasRouter.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import {Hyperlane7683} from "../src/Hyperlane7683.sol";

contract OwnableProxyAdmin is ProxyAdmin {
    constructor(address _owner) {
        _transferOwnership(_owner);
    }
}

contract DeployAffogato7683 is Script {
    uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PK");
    address deployer = vm.addr(deployerPrivateKey);

    uint256 gasByDomain = 1070688;

    uint256 tallForkId = vm.createFork("http://127.0.0.1:7547");
    uint256 tallDomain = 1003202501;
    address tallMailbox = 0xC6a1Ca827d2DDb5c833cc72bf0eC13f74Af4215a;
    address tallPermit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    ProxyAdmin tallProxyAdmin;
    address tallRouterImpl;
    Hyperlane7683 tallRouter;

    uint256 grandeForkId = vm.createFork("http://127.0.0.1:8547");
    uint256 grandeDomain = 1003202502;
    address grandeMailbox = 0x81855457c22A05c2742e8abD03943c335365578D;
    address grandePermit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    ProxyAdmin grandeProxyAdmin;
    address grandeRouterImpl;
    Hyperlane7683 grandeRouter;

    uint256 ventiForkId = vm.createFork("http://127.0.0.1:9547");
    uint256 ventiDomain = 1003202503;
    address ventiMailbox = 0x81855457c22A05c2742e8abD03943c335365578D;
    address ventiPermit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    ProxyAdmin ventiProxyAdmin;
    address ventiRouterImpl;
    Hyperlane7683 ventiRouter;

    function run() public {
        console2.log("Deployer Address: ", deployer);

        deployOnAll();
        configureAll();

        console2.log("Tall Router Address: ", address(tallRouter));
        console2.log(
            "Tall Router Implementation Address: ",
            address(tallRouterImpl)
        );
        console2.log(
            "Tall Router Proxy Admin Address: ",
            address(tallProxyAdmin)
        );

        console2.log("Grande Router Address: ", address(grandeRouter));
        console2.log(
            "Grande Router Implementation Address: ",
            address(grandeRouterImpl)
        );
        console2.log(
            "Grande Router Proxy Admin Address: ",
            address(grandeProxyAdmin)
        );

        console2.log("Venti Router Address: ", address(ventiRouter));
        console2.log(
            "Venti Router Implementation Address: ",
            address(ventiRouterImpl)
        );
        console2.log(
            "Venti Router Proxy Admin Address: ",
            address(ventiProxyAdmin)
        );
    }

    function deployOnAll() internal {
        vm.selectFork(tallForkId);
        vm.startBroadcast();
        tallProxyAdmin = deployProxyAdmin();
        tallRouterImpl = deployImplementation(tallMailbox, tallPermit2);
        tallRouter = deployProxy(tallRouterImpl, address(tallProxyAdmin));
        vm.stopBroadcast();

        vm.selectFork(grandeForkId);
        vm.startBroadcast();
        grandeProxyAdmin = deployProxyAdmin();
        grandeRouterImpl = deployImplementation(grandeMailbox, grandePermit2);
        grandeRouter = deployProxy(grandeRouterImpl, address(grandeProxyAdmin));
        vm.stopBroadcast();

        vm.selectFork(ventiForkId);
        vm.startBroadcast();
        ventiProxyAdmin = deployProxyAdmin();
        ventiRouterImpl = deployImplementation(ventiMailbox, ventiPermit2);
        ventiRouter = deployProxy(ventiRouterImpl, address(ventiProxyAdmin));
        vm.stopBroadcast();
    }

    function configureAll() internal {
        bytes32 tallRouterB32 = TypeCasts.addressToBytes32(address(tallRouter));
        bytes32 grandeRouterB32 = TypeCasts.addressToBytes32(
            address(grandeRouter)
        );
        bytes32 ventiRouterB32 = TypeCasts.addressToBytes32(
            address(ventiRouter)
        );

        vm.selectFork(tallForkId);
        vm.startBroadcast();
        tallRouter.enrollRemoteRouter(uint32(grandeDomain), grandeRouterB32);
        tallRouter.enrollRemoteRouter(uint32(ventiDomain), ventiRouterB32);
        tallRouter.setDestinationGas(uint32(grandeDomain), gasByDomain);
        tallRouter.setDestinationGas(uint32(ventiDomain), gasByDomain);
        tallRouter.transferOwnership(deployer);
        vm.stopBroadcast();

        vm.selectFork(grandeForkId);
        vm.startBroadcast();
        grandeRouter.enrollRemoteRouter(uint32(tallDomain), tallRouterB32);
        grandeRouter.enrollRemoteRouter(uint32(ventiDomain), ventiRouterB32);
        grandeRouter.setDestinationGas(uint32(tallDomain), gasByDomain);
        grandeRouter.setDestinationGas(uint32(ventiDomain), gasByDomain);
        grandeRouter.transferOwnership(deployer);
        vm.stopBroadcast();

        vm.selectFork(ventiForkId);
        vm.startBroadcast();
        ventiRouter.enrollRemoteRouter(uint32(tallDomain), tallRouterB32);
        ventiRouter.enrollRemoteRouter(uint32(grandeDomain), grandeRouterB32);
        ventiRouter.setDestinationGas(uint32(tallDomain), gasByDomain);
        ventiRouter.setDestinationGas(uint32(grandeDomain), gasByDomain);
        ventiRouter.transferOwnership(deployer);
        vm.stopBroadcast();
    }

    function deployProxyAdmin() internal returns (ProxyAdmin proxyAdmin) {
        proxyAdmin = new OwnableProxyAdmin(deployer);
    }

    function deployImplementation(
        address mailbox,
        address permit2
    ) internal returns (address routerImpl) {
        return address(new Hyperlane7683(mailbox, permit2));
    }

    function deployProxy(
        address routerImpl,
        address proxyAdmin
    ) internal returns (Hyperlane7683) {
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            routerImpl,
            proxyAdmin,
            abi.encodeWithSelector(
                Hyperlane7683.initialize.selector,
                address(0),
                address(0),
                deployer
            )
        );

        return Hyperlane7683(address(proxy));
    }
}
