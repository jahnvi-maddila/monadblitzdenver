// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract PixelCanvas {
    uint8 public constant W = 64;
    uint8 public constant H = 64;
    uint8 public constant MAX_BATCH = 32;

    // key = y * 64 + x, value = RGB as bytes3
    mapping(uint256 => bytes3) public pixels;

    event PixelSet(uint8 indexed x, uint8 indexed y, bytes3 color, address indexed by);

    function setPixel(uint8 x, uint8 y, bytes3 color) external {
        require(x < W && y < H, "out of bounds");
        uint256 key = uint256(y) * uint256(W) + uint256(x);
        pixels[key] = color;
        emit PixelSet(x, y, color, msg.sender);
    }

    function setPixels(
        uint8[] calldata xs,
        uint8[] calldata ys,
        bytes3[] calldata colors
    ) external {
        require(
            xs.length <= MAX_BATCH && xs.length == ys.length && xs.length == colors.length,
            "bad batch"
        );
        for (uint256 i = 0; i < xs.length; i++) {
            require(xs[i] < W && ys[i] < H, "out of bounds");
            uint256 k = uint256(ys[i]) * uint256(W) + uint256(xs[i]);
            pixels[k] = colors[i];
            emit PixelSet(xs[i], ys[i], colors[i], msg.sender);
        }
    }

    /// @return 64*64*3 = 12288 bytes, row-major, each pixel 3 bytes (R,G,B)
    function getCanvas() external view returns (bytes memory) {
        bytes memory out = new bytes(uint256(W) * uint256(H) * 3);
        uint256 idx;
        for (uint256 y = 0; y < H; y++) {
            for (uint256 x = 0; x < W; x++) {
                bytes3 c = pixels[y * uint256(W) + x];
                out[idx++] = c[0];
                out[idx++] = c[1];
                out[idx++] = c[2];
            }
        }
        return out;
    }
}
