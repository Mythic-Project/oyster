import { type PublicKey, TransactionInstruction } from "@solana/web3.js";
import { GOVERNANCE_INSTRUCTION_SCHEMA_V3 } from "./serialisation";
import { serialize } from "borsh";
import { ExtendTransactionBufferArgs } from "./instructions";
import { getProposalTransactionBufferAddress } from "./accounts";

// Transaction instruction to extend the transaction buffer of a proposal
// This instruction allows the creator of a proposal to extend the transaction buffer
// by providing a new buffer of instructions. The buffer index indicates which
// transaction buffer is being extended.
// NOTE: This is only used when the transaction byte size exceeds the 800 byte safe limit
export const withExtendTransactionBuffer = (
	instructions: TransactionInstruction[],
	programId: PublicKey,
	governance: PublicKey,
	proposal: PublicKey,
	creator: PublicKey,
	bufferIndex: number,
	buffer: Uint8Array,
) => {
	const args = new ExtendTransactionBufferArgs({ bufferIndex, buffer });
	const data = Buffer.from(serialize(GOVERNANCE_INSTRUCTION_SCHEMA_V3, args));

	const proposalTransactionBufferAddress = getProposalTransactionBufferAddress(
		programId,
		proposal,
		creator,
		bufferIndex,
	);

	const keys = [
		{ pubkey: governance, isWritable: false, isSigner: false },
		{ pubkey: proposal, isWritable: false, isSigner: false },
		{ pubkey: proposalTransactionBufferAddress, isWritable: true, isSigner: false },
		{ pubkey: creator, isWritable: false, isSigner: true },
	];

	instructions.push(new TransactionInstruction({ keys, programId, data }));
	return proposalTransactionBufferAddress;
};
