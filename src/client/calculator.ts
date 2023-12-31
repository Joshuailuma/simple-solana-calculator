/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';
import * as BufferLayout from "@solana/buffer-layout";
import { Buffer } from "buffer";

import { getPayer, getRpcUrl, createKeypairFromFile } from './utils';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer
 */
let payer: Keypair;

/**
 * Hello world's program id
 */
let programId: PublicKey;

/**
 * The public key of the account we are saying hello to
 */
let calculatorPubKey: PublicKey;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   - `npm run build:program-c`
 *   - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'solana_calculator.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/helloworld.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'solana_calculator-keypair.json');

/**
 * The state of a greeting account managed by the hello world program
 */
class CalculatorAccount {
  result = 0;
  constructor(fields: { result: number } | undefined = undefined) {
    if (fields) {
      this.result = fields.result;
    }
  }
}

/**
 * Borsh schema definition for calculator accounts
 */
const CalculatorSchema = new Map([
  [CalculatorAccount, { kind: 'struct', fields: [['result', 'u32']] }],
]);

/**
 * The expected size of each greeting account.
 */
const CALCULATOR_SIZE = borsh.serialize(
  CalculatorSchema,
  new CalculatorAccount(),
).length;

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payer) {
    const { feeCalculator } = await connection.getRecentBlockhash();

    // Calculate the cost to fund the greeter account
    fees += await connection.getMinimumBalanceForRentExemption(CALCULATOR_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    payer = await getPayer();
  }

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }

  console.log(
    'Using account',
    payer.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees',
  );
}

/**
 * Check if the hello world BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/helloworld.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy dist/program/solana_balance.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);

  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  const GREETING_SEED = 'helloworl';
  calculatorPubKey = await PublicKey.createWithSeed(
    payer.publicKey,
    GREETING_SEED,
    programId,
  );

  // Check if the calculator account has already been created
  const calculatorAccount = await connection.getAccountInfo(calculatorPubKey);
  if (calculatorAccount === null) {
    console.log(
      'Calculator account',
      calculatorPubKey.toBase58(),
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      CALCULATOR_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: GREETING_SEED,
        newAccountPubkey: calculatorPubKey,
        lamports,
        space: CALCULATOR_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
}


function addInstruction(num1: number, num2: number): Buffer {
  const layout = BufferLayout.struct([
    BufferLayout.u8("instruction"),
    BufferLayout.u32("num1"),
    BufferLayout.u32("num2"),
  ]);
  const data = Buffer.alloc(layout.span);
  layout.encode({ instruction: 0, num1, num2 }, data);

  return data;
}

function subtractInstruction(num1: number, num2: number): Buffer {
  const layout = BufferLayout.struct([
    BufferLayout.u8("instruction"),
    BufferLayout.u32("num1"),
    BufferLayout.u32("num2"),
  ]);
  const data = Buffer.alloc(layout.span);
  layout.encode({ instruction: 1, num1, num2 }, data);
  return data;
}
const instructionMap: Record<string, (num1: number, num2: number) => Buffer> = {
  add: addInstruction,
  subtract: subtractInstruction,
};


export async function calculate(
  operation: string,
  num1: number,
  num2: number
): Promise<void> {
  console.log("Sending request to", calculatorPubKey.toBase58());
  const instructionHandler = instructionMap[operation];
  const instruction = new TransactionInstruction({
    keys: [{ pubkey: calculatorPubKey, isSigner: false, isWritable: true }],
    programId,
    data: instructionHandler(num1, num2), // The instruction
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );
}

export async function displayResult(
  operation: string,
  num1: number,
  num2: number
): Promise<void> {
  const accountInfo = await connection.getAccountInfo(calculatorPubKey);
  if (accountInfo === null) {
    throw "Error: Account not found";
  }
  const calculator = borsh.deserialize(
    CalculatorSchema,
    CalculatorAccount,
    accountInfo.data
  );

  const operationType = operation === "add" ? "+" : "-";
  console.log(`Calculator is `, calculator)

  console.log(`${num1} ${operationType} ${num2} = ${calculator.result}`);
}