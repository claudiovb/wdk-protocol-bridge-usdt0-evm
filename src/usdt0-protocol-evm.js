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
import { WalletAccountEvm } from '@wdk/wallet-evm'
import { WalletAccountEvmErc4337 } from '@wdk/wallet-evm-erc-4337'

import { OFT_ABI, TRANSACTION_VALUE_HELPER_ABI, ERC20_ABI } from './abi.js'

/** @typedef {import('@wdk/wallet/protocols').BridgeProtocolConfig} BridgeProtocolConfig */
/** @typedef {import('@wdk/wallet/protocols').BridgeOptions} BridgeOptions */
/** @typedef {import('@wdk/wallet/protocols').BridgeResult} BridgeResult */
/** @typedef {import('@wdk/wallet-evm-erc-4337').EvmErc4337WalletConfig} EvmErc4337WalletConfig */

/**
 * @typedef {BridgeResult & {
 *   approvalHash: string
 * }} WalletAccountEvmBridgeResult
 */

const FEE_TOLERANCE = 0.999 // 0.1% fee tolerance
const ERC4337_FEE_BUFFER = 1.1 // 10% buffer for ERC4337 fee estimation

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

/**
 * @template {WalletAccountEvm | WalletAccountEvmErc4337} T
 */
export default class Usdt0ProtocolEvm extends BridgeProtocol {
  /**
   * Creates a new interface to the usdt0 protocol for evm blockchains.
   *
   * @param {T} account - The wallet account to use to interact with the protocol.
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

    const { fee, bridgeFee } = await this._quoteBridgeInternal(options)
    return { fee, bridgeFee }
  }

  /**
   * Bridges a token to a different blockchain.
   *
   * @param {BridgeOptions} options - The bridge's options.
   * @param {Pick<BridgeProtocolConfig, 'bridgeMaxFee'> & (T extends WalletAccountEvmErc4337 ? Pick<EvmErc4337WalletConfig, 'paymasterToken'> : {})} [config] - If set, overrides the 'bridgeMaxFee' and 'paymasterToken' options defined in the manager configuration.
   * @returns {Promise<T extends WalletAccountEvm ? WalletAccountEvmBridgeResult : BridgeResult>} The bridge's result.
   */
  async bridge (options, config) {
    if (!(this._account instanceof WalletAccountEvm) && !(this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('Bridge operation cannot be performed with this account type.')
    }

    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to bridge.')
    }

    const { fee, bridgeFee, approvalTx, oftSendTx } = await this._quoteBridgeInternal(options)
    const { bridgeMaxFee, paymasterToken } = config ?? this._config

    if (bridgeMaxFee && fee + bridgeFee > bridgeMaxFee) {
      throw new Error('Exceeded maximum fee cost for bridge operation.')
    }

    if (this._account instanceof WalletAccountEvmErc4337) {
      const sendTransactionConfig = paymasterToken ? { paymasterToken } : undefined
      const { hash } = await this._account.sendTransaction([approvalTx, oftSendTx], sendTransactionConfig)

      return { hash, fee, bridgeFee }
    } else {
      const [{ hash: approvalHash }, { hash: oftSendHash }] = await Promise.all([
        this._account.sendTransaction(approvalTx),
        this._account.sendTransaction(oftSendTx)
      ])

      return {
        hash: oftSendHash,
        fee,
        bridgeFee,
        approvalHash
      }
    }
  }

  /** @private */
  async _quoteBridgeInternal (options) {
    const { approvalTx, oftSendTx, bridgeFee } = await this._getBridgeTransactions(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      const { fee } = await this._account.quoteSendTransaction([approvalTx, oftSendTx])
      return { fee, bridgeFee, approvalTx, oftSendTx }
    } else {
      const [{ fee: approvalFee }, { fee: bridgingGasFee }] = await Promise.all([
        this._account.quoteSendTransaction(approvalTx),
        this._account.quoteSendTransaction(oftSendTx)
      ])

      return {
        fee: approvalFee + bridgingGasFee,
        bridgeFee,
        approvalTx,
        oftSendTx
      }
    }
  }

  /** @private */
  async _getSourceChainConfig () {
    const network = await this._provider.getNetwork()
    const chainId = Number(network.chainId)

    const [sourceChain] = Object.entries(CHAIN_CONFIG).find(
      ([, config]) => config.chainId === chainId
    ) || []

    if (!sourceChain || !CHAIN_CONFIG[sourceChain]) {
      throw new Error(`Chain ID ${chainId} is not supported`)
    }

    return { sourceChain, sourceChainConfig: CHAIN_CONFIG[sourceChain] }
  }

  /** @private */
  _validateTargetChain (targetChain) {
    if (!CHAIN_CONFIG[targetChain]) {
      throw new Error(`Target chain '${targetChain}' is not supported`)
    }
  }

  /** @private */
  async _checkContractForToken (contractAddress, token) {
    if (!contractAddress) return null

    const contract = new Contract(contractAddress, OFT_ABI, this._provider)
    const contractToken = await contract.token()

    return contractToken.toLowerCase() === token.toLowerCase() ? contract : null
  }

  /** @private */
  async _getOftContractAddress (token, targetChain) {
    this._validateTargetChain(targetChain)
    const { sourceChainConfig } = await this._getSourceChainConfig()

    const contractTypes = [
      { key: 'oftContract', condition: () => !['ton', 'tron'].includes(targetChain) },
      { key: 'legacyMeshContract', condition: () => true },
      { key: 'xautOftContract', condition: () => true }
    ]

    for (const { key, condition } of contractTypes) {
      if (condition() && sourceChainConfig[key]) {
        const contract = await this._checkContractForToken(sourceChainConfig[key], token)
        if (contract) return contract
      }
    }

    throw new Error(`USDT0 Bridge is not supported for token '${token}' on this chain`)
  }

  /** @private */
  async _getTransactionValueHelperContract () {
    const { sourceChainConfig } = await this._getSourceChainConfig()

    if (!sourceChainConfig.transactionValueHelper) {
      throw new Error('ERC4337 account abstraction is not supported on this chain')
    }

    return new Contract(sourceChainConfig.transactionValueHelper, TRANSACTION_VALUE_HELPER_ABI, this._provider)
  }

  /** @private */
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
      minAmountLD: amount * FEE_TOLERANCE,
      extraOptions: options.toBytes(),
      composeMsg: getBytes('0x'),
      oftCmd: getBytes('0x')
    }
  }

  /** @private */
  async _createApprovalTxData (tokenContract, spender, amount) {
    return tokenContract.interface.encodeFunctionData('approve', [spender, amount])
  }

  /** @private */
  async _getBridgeTransactions ({ targetChain, recipient, token, amount }) {
    const oftContract = await this._getOftContractAddress(token, targetChain)
    const tokenContract = new Contract(token, ERC20_ABI)
    const sendParam = this._buildOftSendParam(targetChain, recipient, amount)
    const fromAddress = await this._account.getAddress()

    if (this._account instanceof WalletAccountEvmErc4337) {
      const transactionValueHelper = await this._getTransactionValueHelperContract()
      const { nativeFee, lzTokenFee } = await oftContract.quoteSend(sendParam, false)
      const feeQuoteInTokens = await transactionValueHelper.quoteSend(sendParam, [nativeFee, lzTokenFee])

      const approvalAmount = Math.ceil(amount + Number(feeQuoteInTokens) * ERC4337_FEE_BUFFER)
      const approvalTxData = await this._createApprovalTxData(tokenContract, transactionValueHelper.target, approvalAmount)
      const transactionValueHelperSendData = transactionValueHelper.interface.encodeFunctionData('send', [
        oftContract.target,
        sendParam,
        { nativeFee, lzTokenFee: 0 }
      ])

      const approvalTx = {
        from: fromAddress,
        to: token,
        data: approvalTxData,
        value: 0
      }

      const oftSendTx = {
        from: fromAddress,
        to: transactionValueHelper.target,
        data: transactionValueHelperSendData,
        value: 0
      }

      return {
        approvalTx,
        oftSendTx,
        bridgeFee: Number(feeQuoteInTokens)
      }
    } else {
      const approvalTxData = await this._createApprovalTxData(tokenContract, oftContract.target, amount)
      const { nativeFee } = await oftContract.quoteSend(sendParam, false)
      const bridgeFee = Number(nativeFee)

      const oftSendData = oftContract.interface.encodeFunctionData('send', [
        sendParam,
        { nativeFee: bridgeFee, lzTokenFee: 0 },
        fromAddress
      ])

      const approvalTx = {
        from: fromAddress,
        to: token,
        data: approvalTxData,
        value: 0
      }

      const oftSendTx = {
        from: fromAddress,
        to: oftContract.target,
        data: oftSendData,
        value: bridgeFee
      }

      return {
        approvalTx,
        oftSendTx,
        bridgeFee
      }
    }
  }
}
