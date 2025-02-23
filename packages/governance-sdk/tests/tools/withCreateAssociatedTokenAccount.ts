import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'

export const withCreateAssociatedTokenAccount = async (
  instructions: TransactionInstruction[],
  mintPk: PublicKey,
  ownerPk: PublicKey,
  payerPk: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
) => {
  const ataPk = await getAssociatedTokenAddress(
    mintPk,
    ownerPk, // owner
    false,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )

  instructions.push(
    createAssociatedTokenAccountInstruction(
      payerPk,
      ataPk,
      ownerPk,
      mintPk,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
  )

  return ataPk
}
