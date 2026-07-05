// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @title ConfidentialToken
/// @notice Testnet ERC-7984 confidential token used as the base/quote leg of the DEX.
/// @dev Thin wrapper over the audited OpenZeppelin ERC7984 implementation. Adds an open `mint`
///      for faucet-style testnet funding. Balances and transfer amounts are FHE ciphertexts;
///      only the owner (and approved operators) can decrypt their own balance.
contract ConfidentialToken is ERC7984 {
    constructor(string memory name_, string memory symbol_)
        ERC7984(name_, symbol_, "")
    {
        // Wire the FHEVM coprocessor / ACL / KMS config for the target network.
        FHE.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig());
    }

    /// @notice Mint `amount` tokens to `to` (testnet faucet — unrestricted on purpose).
    /// @param to Recipient.
    /// @param amount Plaintext amount to mint (encrypted on-chain).
    /// @return minted Encrypted amount actually credited.
    function mint(address to, uint64 amount) external returns (euint64 minted) {
        euint64 encAmount = FHE.asEuint64(amount);
        FHE.allowThis(encAmount);
        FHE.allow(encAmount, to);
        return _mint(to, encAmount);
    }
}
