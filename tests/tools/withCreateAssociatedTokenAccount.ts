import {
	ASSOCIATED_TOKEN_PROGRAM_ID,
	createAssociatedTokenAccountInstruction,
	getAssociatedTokenAddress,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";

export const withCreateAssociatedTokenAccount = async (
	instructions: TransactionInstruction[],
	mintPk: PublicKey,
	ownerPk: PublicKey,
	payerPk: PublicKey,
	tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
	allowOwnerOffCurve = false,
) => {
	const ataPk = await getAssociatedTokenAddress(
		mintPk,
		ownerPk, // owner
		allowOwnerOffCurve,
		tokenProgram,
		ASSOCIATED_TOKEN_PROGRAM_ID,
	);

	instructions.push(
		createAssociatedTokenAccountInstruction(payerPk, ataPk, ownerPk, mintPk, tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID),
	);

	return ataPk;
};
