import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import { addressToBytes32 } from '@layerzerolabs/lz-v2-utilities'

import * as ethers from 'ethers'

import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '@wdk/wallet-evm'

import { WalletAccountEvmErc4337, WalletAccountReadOnlyEvmErc4337 } from '@wdk/wallet-evm-erc-4337'

import { OFT_ABI, TRANSACTION_VALUE_HELPER_ABI } from '../src/abi.js'

const SEED = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const USER_ADDRESS = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'

const TOKEN = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'

const tokenMock = jest.fn()

const quoteSendMock = jest.fn()

jest.unstable_mockModule('ethers', () => ({
  ...ethers,
  JsonRpcProvider: jest.fn().mockImplementation(() => ({
    getNetwork: jest.fn().mockResolvedValue({ chainId: 42_161n })
  })),
  Contract: jest.fn().mockImplementation((target, abi, provider) => {
    const contract = new ethers.Contract(target, abi, provider)

    if (abi === OFT_ABI || abi === TRANSACTION_VALUE_HELPER_ABI) {
      contract.token = tokenMock

      contract.quoteSend = quoteSendMock
    }

    return contract
  })
}))

const { default: Usdt0ProtocolEvm } = await import('../index.js')

describe('Usdt0ProtocolEvm', () => {
  const DUMMY_SEND_PARAM = {
    dstEid: 30_110,
    to: addressToBytes32(USER_ADDRESS),
    amountLD: 100n,
    minAmountLD: 99n,
    extraOptions: new Uint8Array([0, 3]),
    composeMsg: new Uint8Array([ ]),
    oftCmd: new Uint8Array([ ])
  }

  let account,
      protocol

  describe('with WalletAccountEvm', () => {
    const DUMMY_APPROVE_TRANSACTION = {
      to: TOKEN,
      value: 0,
      data: '0x095ea7b300000000000000000000000014e4a1b13bf7f943c8ff7c51fb60fa964a298d920000000000000000000000000000000000000000000000000000000000000064'
    }

    const DUMMY_BRIDGE_TRANSACTION = {
      to: '0x14E4A1B13bf7F943c8ff7C51fb60FA964A298D92',
      value: 10_000n,
      data: '0xc7c7f5b3000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a460aebce0d3a4becad8ccf9d6d4861296c503bd000000000000000000000000000000000000000000000000000000000000759e000000000000000000000000a460aebce0d3a4becad8ccf9d6d4861296c503bd0000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000006300000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000002000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    }

    beforeEach(() => {
      account = new WalletAccountEvm(SEED, "0'/0/0", {
        provider: 'https://mock-rpc-url.com'
      })

      account.getAddress = jest.fn().mockResolvedValue(USER_ADDRESS)

      protocol = new Usdt0ProtocolEvm(account)
    })

    describe('bridge', () => {
      beforeEach(() => {
        tokenMock.mockResolvedValue(TOKEN)

        quoteSendMock.mockResolvedValue({ nativeFee: 10_000n })

        account.quoteSendTransaction = jest.fn()
          .mockResolvedValueOnce({ fee: 12_345n })
          .mockResolvedValueOnce({ fee: 67_890n })

        account.sendTransaction = jest.fn()
          .mockResolvedValueOnce({ hash: 'dummy-approve-hash', fee: 12_345n })
          .mockResolvedValueOnce({ hash: 'dummy-bridge-hash', fee: 67_890n })
      })

      test('should successfully perform a bridge operation', async () => {
        const result = await protocol.bridge({
          targetChain: 'arbitrum',
          recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
          token: TOKEN,
          amount: 100
        })

        expect(tokenMock).toHaveBeenCalled()

        expect(quoteSendMock).toHaveBeenCalledWith(DUMMY_SEND_PARAM, false)

        expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_APPROVE_TRANSACTION)
        expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_BRIDGE_TRANSACTION)

        expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_APPROVE_TRANSACTION)
        expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_BRIDGE_TRANSACTION)

        expect(result).toEqual({
          approveHash: 'dummy-approve-hash',
          hash: 'dummy-bridge-hash',
          fee: 80_235n,
          bridgeFee: 10_000n
        })
      })

      test('should throw if the bridge fee exceeds the bridge max fee configuration', async () => {
        const OPTIONS = {
          targetChain: 'arbitrum',
          recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
          token: TOKEN,
          amount: 100
        }

        const protocol = new Usdt0ProtocolEvm(account, {
          bridgeMaxFee: 0
        })

        await expect(protocol.bridge(OPTIONS))
          .rejects.toThrow('Exceeded maximum fee cost for bridge operation.')
      })

      test('should throw if the account is read-only', async () => {
        const account = new WalletAccountReadOnlyEvm(USER_ADDRESS, {
          provider: 'https://mock-rpc-url.com'
        })

        const protocol = new Usdt0ProtocolEvm(account)

        await expect(protocol.bridge({ }))
          .rejects.toThrow("The 'bridge(options)' method requires the protocol to be initialized with a non read-only account.")
      })

      test('should throw if the account is not connected to a provider', async () => {
        const account = new WalletAccountEvm(SEED, "0'/0/0")

        const protocol = new Usdt0ProtocolEvm(account)

        await expect(protocol.bridge({ }))
          .rejects.toThrow('The wallet must be connected to a provider in order to perform bridge operations.')
      })
    })

    describe('quoteBridge', () => {
      beforeEach(() => {
        tokenMock.mockResolvedValue(TOKEN)

        quoteSendMock.mockResolvedValue({ nativeFee: 10_000n })

        account.quoteSendTransaction = jest.fn()
          .mockResolvedValueOnce({ fee: 12_345n })
          .mockResolvedValueOnce({ fee: 67_890n })
      })

      test('should successfully quote a bridge operation', async () => {
        const result = await protocol.quoteBridge({
          targetChain: 'arbitrum',
          recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
          token: TOKEN,
          amount: 100
        })

        expect(tokenMock).toHaveBeenCalled()

        expect(quoteSendMock).toHaveBeenCalledWith(DUMMY_SEND_PARAM, false)

        expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_APPROVE_TRANSACTION)
        expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_BRIDGE_TRANSACTION)

        expect(result).toEqual({
          fee: 80_235n,
          bridgeFee: 10_000n
        })
      })

      test('should throw if the account is not connected to a provider', async () => {
        const account = new WalletAccountEvm(SEED, "0'/0/0")

        const protocol = new Usdt0ProtocolEvm(account)

        await expect(protocol.quoteBridge({ }))
          .rejects.toThrow('The wallet must be connected to a provider in order to quote bridge operations.')
      })
    })
  })

  describe('with WalletAccountEvmErc4337', () => {
    const DUMMY_APPROVE_TRANSACTION = {
      to: TOKEN,
      value: 0,
      data: '0x095ea7b3000000000000000000000000a90f03c856d01f698e7071b393387cd75a8a319a0000000000000000000000000000000000000000000000000000000000002b5c'
    }

    const DUMMY_BRIDGE_TRANSACTION = {
      to: '0xa90f03c856D01F698E7071B393387cd75a8a319A',
      value: 0,
      data: '0x11bbdd1400000000000000000000000014e4a1b13bf7f943c8ff7c51fb60fa964a298d92000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000013880000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000759e000000000000000000000000a460aebce0d3a4becad8ccf9d6d4861296c503bd0000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000006300000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000002000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    }

    beforeEach(() => {
      account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 42_161,
        provider: 'https://mock-rpc-url.com'
      })

      account.getAddress = jest.fn().mockResolvedValue(USER_ADDRESS)

      protocol = new Usdt0ProtocolEvm(account)
    })

    describe('bridge', () => {
      beforeEach(() => {
        tokenMock.mockResolvedValue(TOKEN)

        quoteSendMock
          .mockResolvedValueOnce({ nativeFee: 5_000n, lzTokenFee: 0n })
          .mockResolvedValueOnce(10_000n)

        account.quoteSendTransaction = jest.fn()
          .mockResolvedValueOnce({ fee: 80_235n })

        account.sendTransaction = jest.fn()
          .mockResolvedValueOnce({ hash: 'dummy-user-operation-hash', fee: 80_235n })
      })

      test('should successfully perform a bridge operation', async () => {
        const result = await protocol.bridge({
          targetChain: 'arbitrum',
          recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
          token: TOKEN,
          amount: 100
        })

        expect(tokenMock).toHaveBeenCalled()

        expect(quoteSendMock).toHaveBeenCalledWith(DUMMY_SEND_PARAM, false)
        expect(quoteSendMock).toHaveBeenCalledWith(DUMMY_SEND_PARAM, [5_000n, 0n])

        expect(account.quoteSendTransaction).toHaveBeenCalledWith([DUMMY_APPROVE_TRANSACTION, DUMMY_BRIDGE_TRANSACTION], undefined)

        expect(account.sendTransaction).toHaveBeenCalledWith([DUMMY_APPROVE_TRANSACTION, DUMMY_BRIDGE_TRANSACTION], undefined)

        expect(result).toEqual({
          hash: 'dummy-user-operation-hash',
          fee: 80_235n,
          bridgeFee: 10_000n
        })
      })

      test('should throw if the bridge fee exceeds the bridge max fee configuration', async () => {
        const OPTIONS = {
          targetChain: 'arbitrum',
          recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
          token: TOKEN,
          amount: 100
        }

        const protocol = new Usdt0ProtocolEvm(account, {
          bridgeMaxFee: 0
        })

        await expect(protocol.bridge(OPTIONS))
          .rejects.toThrow('Exceeded maximum fee cost for bridge operation.')
      })

      test('should throw if the account is read-only', async () => {
        const account = new WalletAccountReadOnlyEvmErc4337(USER_ADDRESS, {
          chainId: 42_161,
          provider: 'https://mock-rpc-url.com'
        })

        const protocol = new Usdt0ProtocolEvm(account)

        await expect(protocol.bridge({ }))
          .rejects.toThrow("The 'bridge(options)' method requires the protocol to be initialized with a non read-only account.")
      })

      test('should throw if the account is not connected to a provider', async () => {
        const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
          chainId: 42_161
        })

        const protocol = new Usdt0ProtocolEvm(account)

        await expect(protocol.bridge({ }))
          .rejects.toThrow('The wallet must be connected to a provider in order to perform bridge operations.')
      })
    })

    describe('quoteBridge', () => {
      beforeEach(() => {
        tokenMock.mockResolvedValue(TOKEN)

        quoteSendMock
          .mockResolvedValue({ nativeFee: 5_000n, lzTokenFee: 0n })
          .mockResolvedValue(10_000n)

        account.quoteSendTransaction = jest.fn()
          .mockResolvedValueOnce({ fee: 80_235n })
      })

      test('should successfully quote a bridge operation', async () => {
        const result = await protocol.quoteBridge({
          targetChain: 'arbitrum',
          recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
          token: TOKEN,
          amount: 100
        })

        expect(tokenMock).toHaveBeenCalled()

        expect(quoteSendMock).toHaveBeenCalledWith(DUMMY_SEND_PARAM, false)
        expect(quoteSendMock).toHaveBeenCalledWith(DUMMY_SEND_PARAM, [5_000n, 0n])

        expect(account.quoteSendTransaction).toHaveBeenCalledWith([DUMMY_APPROVE_TRANSACTION, DUMMY_BRIDGE_TRANSACTION], undefined)

        expect(result).toEqual({
          fee: 80_235n,
          bridgeFee: 10_000n
        })
      })

      test('should throw if the account is not connected to a provider', async () => {
        const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
          chainId: 42_161
        })

        const protocol = new Usdt0ProtocolEvm(account)

        await expect(protocol.quoteBridge({ }))
          .rejects.toThrow('The wallet must be connected to a provider in order to quote bridge operations.')
      })
    })
  })
})
