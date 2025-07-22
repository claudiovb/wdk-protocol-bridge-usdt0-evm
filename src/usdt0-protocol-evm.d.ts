export namespace CHAIN_CONFIG {
    namespace ethereum {
        let oftContract: string;
        let legacyMeshContract: string;
        let xautOftContract: string;
        let eid: number;
        let chainId: number;
    }
    namespace arbitrum {
        let oftContract_1: string;
        export { oftContract_1 as oftContract };
        let legacyMeshContract_1: string;
        export { legacyMeshContract_1 as legacyMeshContract };
        let xautOftContract_1: string;
        export { xautOftContract_1 as xautOftContract };
        export let transactionValueHelper: string;
        let eid_1: number;
        export { eid_1 as eid };
        let chainId_1: number;
        export { chainId_1 as chainId };
    }
    namespace berachain {
        let oftContract_2: string;
        export { oftContract_2 as oftContract };
        let eid_2: number;
        export { eid_2 as eid };
        let chainId_2: number;
        export { chainId_2 as chainId };
    }
    namespace ink {
        let oftContract_3: string;
        export { oftContract_3 as oftContract };
        let eid_3: number;
        export { eid_3 as eid };
        let chainId_3: number;
        export { chainId_3 as chainId };
    }
    namespace tron {
        let eid_4: number;
        export { eid_4 as eid };
        let chainId_4: number;
        export { chainId_4 as chainId };
    }
    namespace ton {
        let eid_5: number;
        export { eid_5 as eid };
        let chainId_5: number;
        export { chainId_5 as chainId };
    }
    namespace polygon {
        let eid_6: number;
        export { eid_6 as eid };
        let xautOftContract_2: string;
        export { xautOftContract_2 as xautOftContract };
        let chainId_6: number;
        export { chainId_6 as chainId };
    }
}
export default class Usdt0ProtocolEvm {
    /**
     * Creates a new interface to the usdt0 protocol for evm blockchains.
     *
     * @param {WalletAccountEvm} account - The wallet account to use to interact with the protocol.
     * @param {BridgeProtocolConfig} config - The bridge protocol configuration.
     */
    constructor(account: WalletAccountEvm, config?: BridgeProtocolConfig);
    _provider: any;
    _getOftContractAddress(token: any, targetChain: any): unknown;
    _buildOftSendParam(targetChain: any, recipient: any, amount: any): {
        dstEid: any;
        to: any;
        amountLD: any;
        minAmountLD: number;
        extraOptions: any;
        composeMsg: any;
        oftCmd: any;
    };
    _getBridgeTransactions({ targetChain, recipient, token, amount }: {
        targetChain: any;
        recipient: any;
        token: any;
        amount: any;
    }): unknown;
    /**
     * Quotes a bridge operation to estimate fees.
     *
     * @param {BridgeOptions} options - The bridge's options.
     * @returns {Promise<Omit<BridgeResult, 'hash'>>} The quote result with fee estimates.
     */
    quoteBridge(options: BridgeOptions): Promise<Omit<BridgeResult, "hash">>;
    /**
     * Bridges a token to a different blockchain.
     *
     * @param {BridgeOptions} options - The bridge's options.
     * @returns {Promise<BridgeResult>} The bridge's result.
     */
    bridge(options: BridgeOptions): Promise<BridgeResult>;
}
export type BridgeProtocolConfig = import('@wdk/wallet/protocols').BridgeProtocolConfig;
export type BridgeOptions = import('@wdk/wallet/protocols').BridgeOptions;
export type BridgeResult = import('@wdk/wallet/protocols').BridgeResult & {
    approvalHash?: string;
};
