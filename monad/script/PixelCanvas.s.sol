// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {PixelCanvas} from "../src/PixelCanvas.sol";

contract PixelCanvasScript is Script {
    function run() public {
        vm.startBroadcast();
        new PixelCanvas();
        vm.stopBroadcast();
    }
}
