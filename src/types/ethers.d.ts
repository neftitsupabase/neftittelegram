// Type definitions for ethers v5.8.0
declare module 'ethers' {
  export namespace providers {
    export class Web3Provider {
      constructor(ethereum: any);
      getSigner(): Signer;
      getNetwork(): Promise<{ name: string; chainId: number }>;
      getGasPrice(): Promise<BigNumber>;
      getBalance(address: string): Promise<BigNumber>;
      send(method: string, params: any[]): Promise<any>;
    }
    
    export class JsonRpcProvider {
      constructor(url: string);
      getSigner(): Signer;
      getNetwork(): Promise<{ name: string; chainId: number }>;
      getGasPrice(): Promise<BigNumber>;
      getBalance(address: string): Promise<BigNumber>;
      send(method: string, params: any[]): Promise<any>;
    }
  }

  export class Contract {
    constructor(address: string, abi: any[], providerOrSigner: providers.Web3Provider | providers.JsonRpcProvider | Signer);
    address: string;
    ownerOf(tokenId: string): Promise<string>;
    tokenURI(tokenId: string): Promise<string>;
    balanceOf(address: string): Promise<BigNumber>;
    getApproved(tokenId: string): Promise<string>;
    isApprovedForAll(owner: string, operator: string): Promise<boolean>;
    owner(): Promise<string>;
    uriFrozen(): Promise<boolean>;
    mintTo(to: string, uri: string, options?: any): Promise<TransactionResponse>;
    estimateGas: {
      mintTo(to: string, uri: string): Promise<BigNumber>;
      transferFrom(from: string, to: string, tokenId: string): Promise<BigNumber>;
    };
  }

  export class Signer {
    getAddress(): Promise<string>;
    signMessage(message: string): Promise<string>;
    signTransaction(transaction: TransactionRequest): Promise<string>;
    sendTransaction(transaction: TransactionRequest): Promise<TransactionResponse>;
  }

  export class BigNumber {
    static from(value: string | number): BigNumber;
    toString(): string;
    mul(value: number): BigNumber;
    div(value: number): BigNumber;
  }

  export namespace constants {
    export const AddressZero: string;
  }

  export namespace utils {
    export function formatUnits(value: BigNumber | string, decimals: number | string): string;
    export function parseUnits(value: string, decimals: number | string): BigNumber;
    export function formatEther(value: BigNumber | string): string;
    export function parseEther(value: string): BigNumber;
  }

  export interface TransactionRequest {
    to?: string;
    from?: string;
    nonce?: number;
    gasLimit?: BigNumber;
    gasPrice?: BigNumber;
    data?: string;
    value?: BigNumber;
    chainId?: number;
  }

  export interface TransactionResponse {
    hash: string;
    wait(confirmations?: number): Promise<TransactionReceipt>;
  }

  export interface TransactionReceipt {
    hash: string;
    blockNumber: number;
    blockHash: string;
    status: number;
    logs: Array<{
      topics: string[];
      data: string;
    }>;
    events?: Array<{
      event: string;
      args?: any[];
    }>;
  }
}