import { type PublicKey, SYSVAR_RENT_PUBKEY, TransactionInstruction } from "@solana/web3.js";
import { GOVERNANCE_INSTRUCTION_SCHEMA_V3 } from "./serialisation";
import { serialize } from "borsh";
import { InsertVersionedTransactionFromBufferArgs } from "./instructions";
import { getProposalTransactionBufferAddress, getProposalVersionedTransactionAddress } from "./accounts";
import { SYSTEM_PROGRAM_ID } from "../tools";

export const withInsertVersionedTransactionFromBuffer = (
	instructions: TransactionInstruction[],
	programId: PublicKey,
	governance: PublicKey,
	proposal: PublicKey,
	tokenOwnerRecord: PublicKey,
	governanceAuthority: PublicKey,
	payer: PublicKey,
	optionIndex: number,
	ephemeralSigners: number,
	transactionIndex: number,
	bufferIndex: number,
) => {
	const args = new InsertVersionedTransactionFromBufferArgs({
		optionIndex,
		ephemeralSigners,
		transactionIndex,
		bufferIndex,
	});
	const data = Buffer.from(serialize(GOVERNANCE_INSTRUCTION_SCHEMA_V3, args));

	const proposalVersionedTxAddress = getProposalVersionedTransactionAddress(
		programId,
		proposal,
		optionIndex,
		transactionIndex,
	);
	const proposalTransactionBufferAddress = getProposalTransactionBufferAddress(programId, proposal, payer, bufferIndex);

	const keys = [
		{ pubkey: governance, isWritable: false, isSigner: false },
		{ pubkey: proposal, isWritable: true, isSigner: false },
		{ pubkey: tokenOwnerRecord, isWritable: false, isSigner: false },
		{ pubkey: governanceAuthority, isWritable: false, isSigner: true },
		{ pubkey: proposalVersionedTxAddress, isWritable: true, isSigner: false },
		{ pubkey: proposalTransactionBufferAddress, isWritable: true, isSigner: false },
		{ pubkey: payer, isWritable: true, isSigner: true },
		{ pubkey: SYSTEM_PROGRAM_ID, isWritable: false, isSigner: false },
		{ pubkey: SYSVAR_RENT_PUBKEY, isWritable: false, isSigner: false },
	];

	instructions.push(new TransactionInstruction({ keys, programId, data }));
	return proposalVersionedTxAddress;
};
