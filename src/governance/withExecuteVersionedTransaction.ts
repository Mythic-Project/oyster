import { type AccountMeta, type PublicKey, TransactionInstruction } from "@solana/web3.js";
import { GOVERNANCE_INSTRUCTION_SCHEMA_V3 } from "./serialisation";
import { serialize } from "borsh";
import { ExecuteVersionedTransactionArgs } from "./instructions";

/**
 * Adds an instruction to execute a versioned transaction for a governance proposal.
 *
 * @param instructions - The array of `TransactionInstruction` objects to which the new instruction will be added.
 * @param programId - The public key of the governance program.
 * @param governance - The public key of the governance account.
 * @param proposal - The public key of the proposal account.
 * @param proposalTransaction - The public key of the proposal transaction account.
 * @param remainingAccountKeys - Additional account metadata required for the transaction execution.
 *
 * This function:
 * 1. Creates an `ExecuteVersionedTransactionArgs` object, which represents the arguments for the instruction.
 * 2. Serializes the arguments using the `GOVERNANCE_INSTRUCTION_SCHEMA_V3` schema.
 * 3. Constructs the required keys for the instruction, including:
 *    - The governance account (read-only).
 *    - The proposal account (writable).
 *    - The proposal transaction account (writable).
 *    - Any additional accounts provided in `remainingAccountKeys`, which will be used in the transaction execution.
 * 4. Creates a new `TransactionInstruction` with the serialized data and the constructed keys.
 * 5. Appends the instruction to the provided `instructions` array.
 *
 * Note:
 * - To execute transactions that use address lookup tables, you must use a `VersionedTransaction` from `@solana/web3.js`.
 * - The required account metas and lookup table accounts can be retrieved using the `getAccountMetasAndLookupTableAccountsForExecuteTransaction` function.
 */
export const withExecuteVersionedTransaction = async (
	instructions: TransactionInstruction[],
	programId: PublicKey,
	governance: PublicKey,
	proposal: PublicKey,
	proposalTransaction: PublicKey,
	remainingAccountKeys: AccountMeta[],
) => {
	const args = new ExecuteVersionedTransactionArgs();
	const data = Buffer.from(serialize(GOVERNANCE_INSTRUCTION_SCHEMA_V3, args));

	const keys = [
		{ pubkey: governance, isWritable: false, isSigner: false },
		{ pubkey: proposal, isWritable: true, isSigner: false },
		{ pubkey: proposalTransaction, isWritable: true, isSigner: false },
	];
	keys.push(...remainingAccountKeys);

	instructions.push(new TransactionInstruction({ keys, programId, data }));
	return proposalTransaction;
};
