import { type PublicKey, TransactionInstruction } from "@solana/web3.js";
import { GOVERNANCE_INSTRUCTION_SCHEMA_V3 } from "./serialisation";
import { serialize } from "borsh";
import { CloseTransactionBufferArgs } from "./instructions";
import { getProposalTransactionBufferAddress } from "./accounts";

export const withCloseTransactionBuffer = (
	instructions: TransactionInstruction[],
	programId: PublicKey,
	governance: PublicKey,
	proposal: PublicKey,
	tokenOwnerRecord: PublicKey,
	governanceAuthority: PublicKey,
	beneficiary: PublicKey,
	bufferIndex: number,
) => {
	const args = new CloseTransactionBufferArgs({ bufferIndex });
	const data = Buffer.from(serialize(GOVERNANCE_INSTRUCTION_SCHEMA_V3, args));

	const proposalTransactionBufferAddress = getProposalTransactionBufferAddress(
		programId,
		proposal,
		beneficiary,
		bufferIndex,
	);

	const keys = [
		{ pubkey: governance, isWritable: false, isSigner: false },
		{ pubkey: proposal, isWritable: true, isSigner: false },
		{ pubkey: tokenOwnerRecord, isWritable: false, isSigner: false },
		{ pubkey: governanceAuthority, isWritable: false, isSigner: true },
		{ pubkey: proposalTransactionBufferAddress, isWritable: true, isSigner: false },
		{ pubkey: beneficiary, isWritable: true, isSigner: true },
	];

	instructions.push(new TransactionInstruction({ keys, programId, data }));
	return proposalTransactionBufferAddress;
};
