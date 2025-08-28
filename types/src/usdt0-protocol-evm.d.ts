/**
 * @template {WalletAccountEvm | WalletAccountEvmErc4337} T
 */
export default class Usdt0ProtocolEvm<T extends WalletAccountEvm | WalletAccountEvmErc4337> extends BridgeProtocol {
    /**
     * Creates a new interface to the usdt0 protocol for evm blockchains.
     *
     * @param {T} account - The wallet account to use to interact with the protocol.
     * @param {BridgeProtocolConfig} config - The bridge protocol configuration.
     */
    constructor(account: T, config?: BridgeProtocolConfig);
    _provider: JsonRpcProvider | BrowserProvider;
    /**
     * Bridges a token to a different blockchain.
     *
     * @param {BridgeOptions} options - The bridge's options.
     * @param {Pick<BridgeProtocolConfig, 'bridgeMaxFee'> & (T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, 'paymasterToken'> : {})} [config] - If set, overrides the 'bridgeMaxFee' and 'paymasterToken' options defined in the manager configuration.
     * @returns {Promise<T extends WalletAccountEvm ? WalletAccountEvmBridgeResult : BridgeResult>} The bridge's result.
     */
    bridge(options: BridgeOptions, config?: Pick<BridgeProtocolConfig, "bridgeMaxFee"> & (T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, "paymasterToken"> : {})): Promise<T extends WalletAccountEvm ? WalletAccountEvmBridgeResult : BridgeResult>;
    /** @private */
    private _quoteBridgeInternal;
    /** @private */
    private _getSourceChainConfig;
    /** @private */
    private _validateTargetChain;
    /** @private */
    private _checkContractForToken;
    /** @private */
    private _getOftContractAddress;
    /** @private */
    private _getTransactionValueHelperContract;
    /** @private */
    private _buildOftSendParam;
    /** @private */
    private _createApprovalTxData;
    /** @private */
    private _getBridgeTransactions;
}
export type BridgeProtocolConfig = import("@wdk/wallet/protocols").BridgeProtocolConfig;
export type BridgeOptions = import("@wdk/wallet/protocols").BridgeOptions;
export type BridgeResult = import("@wdk/wallet/protocols").BridgeResult;
export type EvmErc4337WalletConfig = import('@wdk/wallet-evm-erc-4337').EvmErc4337WalletConfig;
export type WalletAccountEvmBridgeResult = BridgeResult & {
    approvalHash: string;
};
import { BridgeProtocol } from '@wdk/wallet/protocols';
import { JsonRpcProvider } from 'ethers';
import { BrowserProvider } from 'ethers';
