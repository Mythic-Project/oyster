import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "../../src/tools/sdk/splToken";
import { createMintToInstruction } from "@solana/spl-token";

export const withMintTo = async (
	instructions: TransactionInstruction[],
	mintPk: PublicKey,
	destinationPk: PublicKey,
	mintAuthorityPk: PublicKey,
	amount: number,
	tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
) => {
	instructions.push(createMintToInstruction(mintPk, destinationPk, mintAuthorityPk, amount, [], tokenProgram));
};
