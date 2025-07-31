// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { JsonRpcProvider, BrowserProvider, Contract, getBytes } from 'ethers'

import { addressToBytes32, Options } from '@layerzerolabs/lz-v2-utilities'

import { Address } from '@ton/core'

import { TronWeb } from 'tronweb'

import { BridgeProtocol } from '@wdk/wallet/protocols'

import { WalletAccountEvmErc4337 } from '@wdk/wallet-evm-erc-4337'

/** @typedef {import('@wdk/wallet/protocols').BridgeProtocolConfig} BridgeProtocolConfig */

/** @typedef {import('@wdk/wallet/protocols').BridgeOptions} BridgeOptions */

/**
 * @typedef {import('@wdk/wallet/protocols').BridgeResult} BridgeResult
 * @property {string} [approvalHash] - The transaction hash of the approval transaction, if applicable.
 */

const CHAIN_CONFIG = {
  ethereum: {
    oftContract: '0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee',
    legacyMeshContract: '0x811ed79dB9D34E83BDB73DF6c3e07961Cfb0D5c0',
    xautOftContract: '0xb9c2321BB7D0Db468f570D10A424d1Cc8EFd696C',
    eid: 30101,
    chainId: 1
  },
  arbitrum: {
    oftContract: '0x14E4A1B13bf7F943c8ff7C51fb60FA964A298D92',
    legacyMeshContract: '0x238A52455a1EF6C987CaC94b28B4081aFE50ba06',
    xautOftContract: '0xf40542a7B66AD7C68C459EE3679635D2fDB6dF39',
    transactionValueHelper: '0xa90f03c856D01F698E7071B393387cd75a8a319A',
    eid: 30110,
    chainId: 42161
  },
  berachain: {
    oftContract: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
    eid: 30362,
    chainId: 80094
  },
  ink: {
    oftContract: '0x0200C29006150606B650577BBE7B6248F58470c1',
    eid: 30339,
    chainId: 57073
  },
  tron: {
    eid: 30420,
    chainId: 728126428
  },
  ton: {
    eid: 30343,
    chainId: 30343
  },
  polygon: {
    eid: 30109,
    xautOftContract: '0x5421Cf4288d8007D3c43AC4246eaFCe5b049e352',
    chainId: 137
  }
}

const OFT_ABI = [
  'function token() view returns (address)',
  'function send(tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) _sendParam, tuple(uint256 nativeFee, uint256 lzTokenFee) _fee, address _refundAddress) payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee) msgReceipt, tuple(uint256 amountSentLD, uint256 amountReceivedLD) oftReceipt)',
  'function quoteSend(tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) _sendParam, bool _payInLzToken) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee) msgFee)',
  'event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)',
  'event OFTReceived(bytes32 indexed guid, uint32 srcEid, address indexed toAddress, uint256 amountReceivedLD)'
]

const TRANSACTION_VALUE_HELPER_ABI = [
  'function quoteSend((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) _sendParam, (uint256 nativeFee, uint256 lzTokenFee) _fee) view returns (uint256 totalAmount)',
  'function send(address _oft, (uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) _sendParam, (uint256 nativeFee, uint256 lzTokenFee) _fee) payable returns ((bytes32 guid, uint64 nonce, (uint256 nativeFee, uint256 lzTokenFee) fee) msgReceipt, (uint256 amountSentLD, uint256 amountReceivedLD) oftReceipt)'
]

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)'
]

export default class Usdt0ProtocolEvm extends BridgeProtocol {
  /**
   * Creates a new interface to the usdt0 protocol for evm blockchains.
   *
   * @param {WalletAccountEvm} account - The wallet account to use to interact with the protocol.
   * @param {BridgeProtocolConfig} config - The bridge protocol configuration.
   */
  constructor (account, config = {}) {
    super(account, config)

    if (account._config.provider) {
      this._provider = typeof account._config.provider === 'string'
        ? new JsonRpcProvider(account._config.provider)
        : new BrowserProvider(account._config.provider)
    }
  }

  async _getOftContractAddress (token, targetChain) {
    const network = await this._provider.getNetwork()
    const chainId = Number(network.chainId)

    const [sourceChain] = Object.entries(CHAIN_CONFIG).find(
      ([, config]) => config.chainId === +chainId
    ) || []

    if (!CHAIN_CONFIG[sourceChain]) {
      throw new Error(`${chainId} is not supported`)
    }

    if (!CHAIN_CONFIG[targetChain]) {
      throw new Error(`Taget chain with id ${targetChain} is not supported`)
    }

    const sourceChainConfig = CHAIN_CONFIG[sourceChain]

    if (
      sourceChainConfig.oftContract && !['ton', 'tron'].includes(targetChain)
    ) {
      const oftContract = new Contract(sourceChainConfig.oftContract, OFT_ABI, this._provider)

      const oftToken = await oftContract.token()

      if (oftToken.toLowerCase() === token.toLowerCase()) {
        return oftContract
      }
    }

    if (sourceChainConfig.legacyMeshContract) {
      const legacyMeshContract = new Contract(sourceChainConfig.legacyMeshContract, OFT_ABI, this._provider)

      const legacyMeshToken = await legacyMeshContract.token()

      if (legacyMeshToken.toLowerCase() === token.toLowerCase()) {
        return legacyMeshContract
      }
    }

    if (sourceChainConfig.xautOftContract) {
      const xautContract = new Contract(sourceChainConfig.xautOftContract, OFT_ABI, this._provider)

      const xautToken = await xautContract.token()

      if (xautToken.toLowerCase() === token.toLowerCase()) {
        return xautContract
      }
    }

    throw new Error(`USDT0 Bridge is not supported for token '${token}' on this chain`)
  }

  async _getTransactionValueHelperContract () {
    const network = await this._provider.getNetwork()
    const chainId = Number(network.chainId)

    const [sourceChain] = Object.entries(CHAIN_CONFIG).find(
      ([, config]) => config.chainId === +chainId
    ) || []

    if (!CHAIN_CONFIG[sourceChain]) {
      throw new Error(`${chainId} is not supported`)
    }

    const sourceChainConfig = CHAIN_CONFIG[sourceChain]

    if (!sourceChainConfig.transactionValueHelper) {
      throw new Error(`Erc4337 account abstraction is not supported on this chain with id ${chainId}`)
    }

    return new Contract(sourceChainConfig.transactionValueHelper, TRANSACTION_VALUE_HELPER_ABI, this._provider)
  }

  _buildOftSendParam (targetChain, recipient, amount) {
    const options = Options.newOptions()

    let to

    if (targetChain === 'ton') {
      to = '0x' + Address.parse(recipient).toRawString().slice(2)
    } else if (targetChain === 'tron') {
      const hexAddress = `0x${TronWeb.address.toHex(recipient)}`
      to = addressToBytes32(hexAddress)
    } else {
      to = addressToBytes32(recipient)
    }

    return {
      dstEid: CHAIN_CONFIG[targetChain].eid,
      to,
      amountLD: amount,
      minAmountLD: (amount * 999) / 1000, // 0.1% fee tolerance
      extraOptions: options.toBytes(),
      composeMsg: getBytes('0x'), // Assuming no composed message
      oftCmd: getBytes('0x') // Assuming no OFT command is needed
    }
  }

  async _getBridgeTransactions ({ targetChain, recipient, token, amount }) {
    const oftContract = await this._getOftContractAddress(token, targetChain)

    const tokenContract = new Contract(token, ERC20_ABI)

    const sendParam = this._buildOftSendParam(targetChain, recipient, amount)

    const refundAddress = await this._account.getAddress()

    if (this._account instanceof WalletAccountEvmErc4337) {
      const transactionValueHelper = await this._getTransactionValueHelperContract()

      const { nativeFee, lzTokenFee } = await oftContract.quoteSend(sendParam, false)

      const feeQuoteInTokens = await transactionValueHelper.quoteSend(sendParam, [nativeFee, lzTokenFee])

      const approvalTxData = await tokenContract.interface.encodeFunctionData('approve', [transactionValueHelper.target, Math.ceil(amount + Number(feeQuoteInTokens) * 1.1)])

      const transactionValueHelperSendData = transactionValueHelper.interface.encodeFunctionData('send', [
        oftContract.target,
        sendParam,
        { nativeFee, lzTokenFee: 0 }
      ])

      return {
        approvalTx: {
          from: await this._account.getAddress(),
          to: token,
          data: approvalTxData,
          value: 0
        },
        oftSendTx: {
          from: await this._account.getAddress(),
          to: transactionValueHelper.target,
          data: transactionValueHelperSendData,
          value: 0
        },
        bridgeFee: Number(feeQuoteInTokens)
      }
    } else {
      const approvalTxData = await tokenContract.interface.encodeFunctionData('approve', [oftContract.target, amount])

      const { nativeFee } = await oftContract.quoteSend(sendParam, false)
      const bridgeFee = Number(nativeFee)

      const oftSendData = oftContract.interface.encodeFunctionData('send', [
        sendParam,
        {
          nativeFee: bridgeFee,
          lzTokenFee: 0
        },
        refundAddress
      ])

      return {
        approvalTx: {
          from: await this._account.getAddress(),
          to: token,
          data: approvalTxData,
          value: 0
        },
        oftSendTx: {
          from: await this._account.getAddress(),
          to: oftContract.target,
          data: oftSendData,
          value: bridgeFee
        },
        bridgeFee
      }
    }
  }

  /**
   * Quotes a bridge operation to estimate fees.
   *
   * @param {BridgeOptions} options - The bridge's options.
   * @returns {Promise<Omit<BridgeResult, 'hash'>>} The quote result with fee estimates.
   */
  async quoteBridge (options) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to quote bridge.')
    }

    const { approvalTx, oftSendTx, bridgeFee } = await this._getBridgeTransactions(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      const { fee } = await this._account.quoteSendTransaction([approvalTx, oftSendTx])

      return {
        fee,
        bridgeFee
      }
    } else {
      const { fee: approvalFee } = await this._account.quoteSendTransaction(approvalTx)
      const { fee: bridgingGasFee } = await this._account.quoteSendTransaction(oftSendTx)

      return {
        fee: approvalFee + bridgingGasFee,
        bridgeFee
      }
    }
  }

  /**
   * Bridges a token to a different blockchain.
   *
   * @param {BridgeOptions} options - The bridge's options.
   * @returns {Promise<BridgeResult>} The bridge's result.
   */
  async bridge (options) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to bridge.')
    }

    const { fee, bridgeFee } = await this.quoteBridge(options)

    if (this._config.bridgeMaxFee > fee) {
      throw new Error('Exceeded maximum fee cost for bridge operation.')
    }

    const { approvalTx, oftSendTx } = await this._getBridgeTransactions(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      const { hash } = await this._account.sendTransaction([approvalTx, oftSendTx])

      return {
        hash,
        fee,
        bridgeFee
      }
    } else {
      const { hash: approvalHash } = await this._account.sendTransaction(approvalTx)
      const { hash: oftSendHash } = await this._account.sendTransaction(oftSendTx)

      return {
        hash: oftSendHash,
        fee,
        bridgeFee,
        approvalHash
      }
    }
  }
}
