import {
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@oyster/common';
import { Keypair, PublicKey } from '@solana/web3.js';

import { AccountLayout, Token } from '@solana/spl-token';
import {
  SystemProgram,
  TransactionInstruction,
  Connection,
} from '@solana/web3.js';

/**
 * Get the address for the associated token account
 *
 * @param mint Token mint account
 * @param owner Owner of the new account
 * @return Public key of the associated token account
 */
export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): Promise<PublicKey> {
  return (
    await PublicKey.findProgramAddress(
      [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    )
  )[0];
}

export function createTokenAccount(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  accountRentExempt: number,
  mint: PublicKey,
  owner: PublicKey,
  signers: Keypair[],
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
) {
  const account = createUninitializedTokenAccount(
    instructions,
    payer,
    accountRentExempt,
    signers,
  );

  instructions.push(
    Token.createInitAccountInstruction(tokenProgram, mint, account, owner),
  );

  return account;
}

export function createUninitializedTokenAccount(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  amount: number,
  signers: Keypair[],
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
) {
  const account = new Keypair();
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: amount,
      space: AccountLayout.span,
      programId: tokenProgram,
    }),
  );

  signers.push(account);

  return account.publicKey;
}

export const withCreateSplTokenAccount = async (
  instructions: TransactionInstruction[],
  signers: Keypair[],
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
) => {
  const tokenAccountRentExempt = await connection.getMinimumBalanceForRentExemption(
    AccountLayout.span,
  );

  const tokenAccountAddress = createTokenAccount(
    instructions,
    payer,
    tokenAccountRentExempt,
    mint,
    owner,
    signers,
    tokenProgram
  );

  return tokenAccountAddress;
};
