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
    _getOftContractAddress(token: any, targetChain: any): Promise<Contract>;
    _getTransactionValueHelperContract(): Promise<Contract>;
    _buildOftSendParam(targetChain: any, recipient: any, amount: any): {
        dstEid: any;
        to: string | Uint8Array<ArrayBufferLike>;
        amountLD: any;
        minAmountLD: number;
        extraOptions: Uint8Array<ArrayBufferLike>;
        composeMsg: Uint8Array<ArrayBufferLike>;
        oftCmd: Uint8Array<ArrayBufferLike>;
    };
    _getBridgeTransactions({ targetChain, recipient, token, amount }: {
        targetChain: any;
        recipient: any;
        token: any;
        amount: any;
    }): Promise<{
        approvalTx: {
            from: string;
            to: any;
            data: string;
            value: number;
        };
        oftSendTx: {
            from: string;
            to: string | import("ethers").Addressable;
            data: string;
            value: number;
        };
        bridgeFee: number;
    }>;
    /**
     * Bridges a token to a different blockchain.
     *
     * @param {BridgeOptions} options - The bridge's options.
     * @param {Pick<BridgeProtocolConfig, 'bridgeMaxFee'> & (T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, 'paymasterToken'> : {})} [config] - If set, overrides the 'bridgeMaxFee' and 'paymasterToken' options defined in the manager configuration.
     * @returns {Promise<T extends WalletAccountEvm ? WalletAccountEvmBridgeResult : BridgeResult>} The bridge's result.
     */
    bridge(options: BridgeOptions, config?: Pick<BridgeProtocolConfig, "bridgeMaxFee"> & (T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, "paymasterToken"> : {})): Promise<T extends WalletAccountEvm ? WalletAccountEvmBridgeResult : BridgeResult>;
}
export type BridgeProtocolConfig = import("@wdk/wallet/protocols").BridgeProtocolConfig;
export type BridgeOptions = import("@wdk/wallet/protocols").BridgeOptions;
export type EvmErc4337WalletConfig = import('@wdk/wallet-evm-erc-4337').EvmErc4337WalletConfig;
export type BridgeResult = import("@wdk/wallet/protocols").BridgeResult;
export type WalletAccountEvmBridgeResult = BridgeResult & {
    approvalHash: string;
};
import { WalletAccountEvm } from '@wdk/wallet-evm';
import { WalletAccountEvmErc4337 } from '@wdk/wallet-evm-erc-4337';
import { BridgeProtocol } from '@wdk/wallet/protocols';
import { JsonRpcProvider } from 'ethers';
import { BrowserProvider } from 'ethers';
import { Contract } from 'ethers';
