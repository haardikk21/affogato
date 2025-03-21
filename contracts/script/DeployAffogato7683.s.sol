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

    function run() public {
        // vm.startBroadcast();
        // vm.stopBroadcast();
    }

    function deployProxyAdmin() internal returns (ProxyAdmin proxyAdmin) {
        address proxyAdminOwner = vm.envAddress("PROXY_ADMIN_OWNER");

        proxyAdmin = new OwnableProxyAdmin(proxyAdminOwner);
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
    ) internal returns (TransparentUpgradeableProxy proxy) {
        proxy = new TransparentUpgradeableProxy(
            routerImpl,
            proxyAdmin,
            abi.encodeWithSelector(
                Hyperlane7683.initialize.selector,
                address(0),
                address(0),
                deployer
            )
        );
    }
}
