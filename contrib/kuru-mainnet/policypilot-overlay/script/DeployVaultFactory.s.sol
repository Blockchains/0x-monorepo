// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console} from "forge-std/Script.sol";
import {AgentVaultFactory} from "../src/AgentVaultFactory.sol";

/// Usage (alpha / demo): VAULT_CAP=1e18 GLOBAL_CAP=1e19 forge script script/DeployVaultFactory.s.sol --rpc-url $RPC --broadcast --private-key $KEY
/// Usage (wild Kuru trading): VAULT_CAP=100e18 GLOBAL_CAP=10000e18 forge script ...
/// Then point the UI at the new factory with ?factory=0x...
contract DeployVaultFactory is Script {
    function run() external returns (AgentVaultFactory f) {
        uint256 vaultCap = vm.envOr("VAULT_CAP", uint256(1 ether));
        uint256 globalCap = vm.envOr("GLOBAL_CAP", uint256(10 ether));
        // Allow up to 100 MON per vault / 10_000 MON global for high-activity Kuru agent trading.
        require(vaultCap <= 100 ether, "vault cap must be <= 100 MON");
        require(globalCap <= 10_000 ether, "global cap must be <= 10000 MON");
        require(globalCap >= vaultCap, "global cap must be >= vault cap");
        vm.startBroadcast();
        f = new AgentVaultFactory(vaultCap, globalCap);
        vm.stopBroadcast();
        console.log("AgentVaultFactory", address(f));
        console.log("vaultCap", vaultCap, "globalCap", globalCap);
    }
}
