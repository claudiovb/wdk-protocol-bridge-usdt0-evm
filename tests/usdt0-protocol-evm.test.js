import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { TRANSACTION_VALUE_HELPER_ABI } from '../src/abi.js'
import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '@wdk/wallet-evm'
import { WalletAccountEvmErc4337, WalletAccountReadOnlyEvmErc4337 } from '@wdk/wallet-evm-erc-4337'

import * as ethers from 'ethers'

const CHAIN_ID = 42161

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const ABSTRACTED_ADDRESS = '0x120Ac3c0B46fBAf2e8452A23BD61a2Da9B139551'

const TOKEN_ADDRESS = '0x1234567890123456789012345678901234567890'

const BRIDGE_OPTIONS_EVM = {
  token: TOKEN_ADDRESS,
  amount: 1000000,
  targetChain: 'ethereum',
  recipient: '0x1111111111111111111111111111111111111111'
}

const BRIDGE_OPTIONS_TON = {
  token: TOKEN_ADDRESS,
  amount: 1000000,
  targetChain: 'ton',
  recipient: 'UQDHMVv2BWBhqBdLIVkuAl_JFQCzN_MihUQK1njmLw5XM8FP'
}

const BRIDGE_OPTIONS_TRON = {
  token: TOKEN_ADDRESS,
  amount: 1000000,
  targetChain: 'tron',
  recipient: 'TRaE66C8RRyjjWXvVMPLJMXNTwy7jSfRA7'
}

const EXPECTED_BRIDGE_RESULT = {
  fee: 1000,
  bridgeFee: 1100,
  approvalHash: '0x5c62a5df5647b2af14fcde187685d96a63f2648bf8664b53d3c97377fe510523',
  hash: '0x4eacf4e26e238208723117d3fed02e79f1933890153e58e7b659e3871c5cca11'
}

await jest.unstable_mockModule('ethers', async () => {
  return {
    ...ethers,
    Contract: jest.fn().mockImplementation((address, abi, provider) => {
      const contract = new ethers.Contract(address, abi, provider)

      const isTransactionValueHelperAbi = abi === TRANSACTION_VALUE_HELPER_ABI

      contract.token = jest.fn().mockResolvedValue(TOKEN_ADDRESS)

      if (isTransactionValueHelperAbi) {
        contract.quoteSend = jest.fn().mockResolvedValue(EXPECTED_BRIDGE_RESULT.bridgeFee)
      } else {
        contract.quoteSend = jest.fn().mockResolvedValue({ nativeFee: EXPECTED_BRIDGE_RESULT.bridgeFee, lzTokenFee: 0 })
      }

      return contract
    })
  }
})

const { default: Usdt0ProtocolEvm } = await import('../index.js')

describe('Usdt0ProtocolEvm', () => {
  let accountEvm
  let usdt0ProtocolEvm

  describe('WalletAccountEvm', () => {
    beforeEach(() => {
      accountEvm = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", { provider: 'https://mock-rpc-url.com' })

      const sendTransactionFee = EXPECTED_BRIDGE_RESULT.fee / 2 // fee is halved because there are two transactions: approval and bridge

      accountEvm.quoteSendTransaction = jest.fn().mockResolvedValue({
        fee: sendTransactionFee
      })
      accountEvm.sendTransaction = jest.fn().mockImplementation((tx) => ({
        fee: sendTransactionFee,
        hash: tx.to === TOKEN_ADDRESS ? EXPECTED_BRIDGE_RESULT.approvalHash : EXPECTED_BRIDGE_RESULT.hash
      }))

      usdt0ProtocolEvm = new Usdt0ProtocolEvm(accountEvm)

      usdt0ProtocolEvm._provider.getNetwork = async () => ({ chainId: BigInt(CHAIN_ID) })
    })

    describe('quoteBridge', () => {
      test('should successfully quote a bridge operation to evm chain', async () => {
        const quote = await usdt0ProtocolEvm.quoteBridge(BRIDGE_OPTIONS_EVM)

        expect(quote.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(quote.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should successfully quote a bridge operation to ton chain', async () => {
        const quote = await usdt0ProtocolEvm.quoteBridge(BRIDGE_OPTIONS_TON)

        expect(quote.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(quote.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should successfully quote a bridge operation to tron chain', async () => {
        const quote = await usdt0ProtocolEvm.quoteBridge(BRIDGE_OPTIONS_TRON)

        expect(quote.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(quote.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should throw if the account is not connected to a provider', async () => {
        const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")
        const usdt0ProtocolEvm = new Usdt0ProtocolEvm(account)

        await expect(usdt0ProtocolEvm.quoteBridge(BRIDGE_OPTIONS_TON)).rejects.toThrow('The wallet must be connected to a provider to quote bridge.')
      })

      test('should successfully quote a bridge operation if account is read only', async () => {
        const readOnlyAccount = new WalletAccountReadOnlyEvm(await accountEvm.getAddress(), { provider: 'https://mock-rpc-url.com' })

        readOnlyAccount.quoteSendTransaction = accountEvm.quoteSendTransaction

        const usdt0ProtocolReadOnlyEvm = new Usdt0ProtocolEvm(readOnlyAccount)

        usdt0ProtocolReadOnlyEvm._provider.getNetwork = usdt0ProtocolEvm._provider.getNetwork

        const quote = await usdt0ProtocolReadOnlyEvm.quoteBridge(BRIDGE_OPTIONS_EVM)

        expect(quote.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(quote.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })
    })

    describe('bridge', () => {
      test('should successfully bridge a token to evm chain', async () => {
        const result = await usdt0ProtocolEvm.bridge(BRIDGE_OPTIONS_EVM)

        expect(result.hash).toBe(EXPECTED_BRIDGE_RESULT.hash)
        expect(result.approvalHash).toBe(EXPECTED_BRIDGE_RESULT.approvalHash)
        expect(result.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(result.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should successfully bridge a token to ton chain', async () => {
        const result = await usdt0ProtocolEvm.bridge(BRIDGE_OPTIONS_TON)

        expect(result.hash).toBe(EXPECTED_BRIDGE_RESULT.hash)
        expect(result.approvalHash).toBe(EXPECTED_BRIDGE_RESULT.approvalHash)
        expect(result.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(result.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should successfully bridge a token to tron chain', async () => {
        const result = await usdt0ProtocolEvm.bridge(BRIDGE_OPTIONS_TRON)

        expect(result.hash).toBe(EXPECTED_BRIDGE_RESULT.hash)
        expect(result.approvalHash).toBe(EXPECTED_BRIDGE_RESULT.approvalHash)
        expect(result.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(result.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should throw if the account is not connected to a provider', async () => {
        accountEvm = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

        const usdt0ProtocolEvm = new Usdt0ProtocolEvm(accountEvm)

        await expect(usdt0ProtocolEvm.bridge(BRIDGE_OPTIONS_TON)).rejects.toThrow('The wallet must be connected to a provider to bridge.')
      })

      test('should throw if the account is read only', async () => {
        const readOnlyAccount = new WalletAccountReadOnlyEvm(await accountEvm.getAddress(), { provider: 'https://mock-rpc-url.com' })

        const usdt0ProtocolEvm = new Usdt0ProtocolEvm(readOnlyAccount)

        await expect(usdt0ProtocolEvm.bridge(BRIDGE_OPTIONS_EVM)).rejects.toThrow('Bridge operation cannot be performed with this account type.')
      })

      test('should throw if the bridge max fee is exceeded', async () => {
        const usdt0ProtocolEvmMaxFee = new Usdt0ProtocolEvm(accountEvm, { bridgeMaxFee: EXPECTED_BRIDGE_RESULT.fee - 1 })

        usdt0ProtocolEvmMaxFee._provider.getNetwork = usdt0ProtocolEvm._provider.getNetwork

        await expect(usdt0ProtocolEvmMaxFee.bridge(BRIDGE_OPTIONS_EVM)).rejects.toThrow('Exceeded maximum fee cost for bridge operation.')
      })
    })
  })

  describe('WalletAccountEvmErc4337', () => {
    let accountEvmErc4337
    let usdt0ProtocolEvmErc4337

    beforeEach(() => {
      accountEvmErc4337 = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", { provider: 'https://mock-rpc-url.com', chainId: CHAIN_ID })

      accountEvmErc4337.getAddress = jest.fn().mockResolvedValue(ABSTRACTED_ADDRESS)

      accountEvmErc4337.quoteSendTransaction = jest.fn().mockResolvedValue({
        fee: EXPECTED_BRIDGE_RESULT.fee
      })

      accountEvmErc4337.sendTransaction = jest.fn().mockImplementation((tx) => ({
        fee: EXPECTED_BRIDGE_RESULT.fee,
        hash: EXPECTED_BRIDGE_RESULT.hash
      }))

      usdt0ProtocolEvmErc4337 = new Usdt0ProtocolEvm(accountEvmErc4337)

      usdt0ProtocolEvmErc4337._provider.getNetwork = async () => ({ chainId: BigInt(CHAIN_ID) })
    })

    describe('quoteBridge', () => {
      test('should successfully quote a bridge operation to evm chain', async () => {
        const quote = await usdt0ProtocolEvmErc4337.quoteBridge(BRIDGE_OPTIONS_EVM)

        expect(quote.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(quote.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should successfully quote a bridge operation to ton chain', async () => {
        const quote = await usdt0ProtocolEvmErc4337.quoteBridge(BRIDGE_OPTIONS_TON)

        expect(quote.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(quote.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should successfully quote a bridge operation to tron chain', async () => {
        const quote = await usdt0ProtocolEvmErc4337.quoteBridge(BRIDGE_OPTIONS_TRON)

        expect(quote.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(quote.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should throw if the account is not connected to a provider', async () => {
        const accountEvmErc4337 = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", { chainId: CHAIN_ID })
        const usdt0ProtocolEvmErc4337 = new Usdt0ProtocolEvm(accountEvmErc4337)

        await expect(usdt0ProtocolEvmErc4337.quoteBridge(BRIDGE_OPTIONS_TON)).rejects.toThrow('The wallet must be connected to a provider to quote bridge.')
      })

      test('should successfully quote a bridge operation if account is read only erc4337', async () => {
        const readOnlyAccountErc4337 = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", { provider: 'https://mock-rpc-url.com', chainId: CHAIN_ID })

        readOnlyAccountErc4337.getAddress = accountEvmErc4337.getAddress

        readOnlyAccountErc4337.quoteSendTransaction = accountEvmErc4337.quoteSendTransaction

        const usdt0ProtocolReadOnlyErc4337 = new Usdt0ProtocolEvm(readOnlyAccountErc4337)

        usdt0ProtocolReadOnlyErc4337._provider.getNetwork = usdt0ProtocolEvmErc4337._provider.getNetwork

        const quote = await usdt0ProtocolReadOnlyErc4337.quoteBridge(BRIDGE_OPTIONS_EVM)

        expect(quote.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(quote.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })
    })

    describe('bridge', () => {
      test('should successfully bridge a token to evm chain', async () => {
        const result = await usdt0ProtocolEvmErc4337.bridge(BRIDGE_OPTIONS_EVM)

        expect(result.hash).toBe(EXPECTED_BRIDGE_RESULT.hash)
        expect(result.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(result.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should successfully bridge a token to ton chain', async () => {
        const result = await usdt0ProtocolEvmErc4337.bridge(BRIDGE_OPTIONS_TON)

        expect(result.hash).toBe(EXPECTED_BRIDGE_RESULT.hash)
        expect(result.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(result.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should successfully bridge a token to tron chain', async () => {
        const result = await usdt0ProtocolEvmErc4337.bridge(BRIDGE_OPTIONS_TRON)

        expect(result.hash).toBe(EXPECTED_BRIDGE_RESULT.hash)
        expect(result.fee).toBe(EXPECTED_BRIDGE_RESULT.fee)
        expect(result.bridgeFee).toBe(EXPECTED_BRIDGE_RESULT.bridgeFee)
      })

      test('should throw if the account is not connected to a provider', async () => {
        const accountEvmErc4337 = new WalletAccountEvmErc4337(SEED_PHRASE, "0'/0/0", { chainId: CHAIN_ID })
        const usdt0ProtocolEvmErc4337 = new Usdt0ProtocolEvm(accountEvmErc4337)

        await expect(usdt0ProtocolEvmErc4337.bridge(BRIDGE_OPTIONS_TON)).rejects.toThrow('The wallet must be connected to a provider to bridge.')
      })

      test('should throw if the account is read only', async () => {
        const readOnlyAccountErc4337 = new WalletAccountReadOnlyEvmErc4337(ABSTRACTED_ADDRESS, { provider: 'https://mock-rpc-url.com', chainId: CHAIN_ID })

        const usdt0ProtocolEvmErc4337ReadOnly = new Usdt0ProtocolEvm(readOnlyAccountErc4337)

        await expect(usdt0ProtocolEvmErc4337ReadOnly.bridge(BRIDGE_OPTIONS_EVM)).rejects.toThrow('Bridge operation cannot be performed with this account type.')
      })
    })

    test('should throw if the bridge max fee is exceeded', async () => {
      const usdt0ProtocolEvmMaxFee = new Usdt0ProtocolEvm(accountEvmErc4337, { bridgeMaxFee: EXPECTED_BRIDGE_RESULT.fee - 1 })

      usdt0ProtocolEvmMaxFee._provider.getNetwork = usdt0ProtocolEvm._provider.getNetwork

      await expect(usdt0ProtocolEvmMaxFee.bridge(BRIDGE_OPTIONS_EVM)).rejects.toThrow('Exceeded maximum fee cost for bridge operation.')
    })
  })
})
