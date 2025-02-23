import { createInitializeMintInstruction, MintLayout } from '@solana/spl-token'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '../../src/tools/sdk/splToken'


export const withCreateMint = async (
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  ownerPk: PublicKey,
  freezeAuthorityPk: PublicKey | null,
  decimals: number,
  payerPk: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
) => {
  const mintRentExempt = await connection.getMinimumBalanceForRentExemption(
    MintLayout.span
  )

  const mintAccount = new Keypair()

  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payerPk,
      newAccountPubkey: mintAccount.publicKey,
      lamports: mintRentExempt,
      space: MintLayout.span,
      programId: tokenProgram,
    })
  )
  signers.push(mintAccount)

  instructions.push(
    createInitializeMintInstruction(
      mintAccount.publicKey,
      decimals,
      ownerPk,
      freezeAuthorityPk,
      tokenProgram,
    )
  )
  return mintAccount.publicKey
}
