import {
	type AccountKeysFromLookups,
	type AddressLookupTableAccount,
	MessageAccountKeys,
	type MessageAddressTableLookup,
	MessageV0,
	type PublicKey,
	type TransactionInstruction,
} from "@solana/web3.js";
import { CompiledKeys } from "./compiledKeys";

/// This function compiles a set of transaction instructions into a wrapped message format
/// for version 0 of the Solana transaction message. It extracts address lookup table accounts
/// and compiles the instructions into a format suitable for the message to be used in
/// transactionMessageToRealmsTransactionMessageBytes function.
export function compileToWrappedMessageV0({
	payerKey,
	recentBlockhash,
	instructions,
	addressLookupTableAccounts,
}: {
	payerKey: PublicKey;
	recentBlockhash: string;
	instructions: TransactionInstruction[];
	addressLookupTableAccounts?: AddressLookupTableAccount[];
}) {
	const compiledKeys = CompiledKeys.compile(instructions, payerKey);

	const addressTableLookups = new Array<MessageAddressTableLookup>();
	const accountKeysFromLookups: AccountKeysFromLookups = {
		writable: [],
		readonly: [],
	};
	const lookupTableAccounts = addressLookupTableAccounts || [];
	for (const lookupTable of lookupTableAccounts) {
		const extractResult = compiledKeys.extractTableLookup(lookupTable);
		if (extractResult !== undefined) {
			const [addressTableLookup, { writable, readonly }] = extractResult;
			addressTableLookups.push(addressTableLookup);
			accountKeysFromLookups.writable.push(...writable);
			accountKeysFromLookups.readonly.push(...readonly);
		}
	}

	const [header, staticAccountKeys] = compiledKeys.getMessageComponents();
	const accountKeys = new MessageAccountKeys(staticAccountKeys, accountKeysFromLookups);
	const compiledInstructions = accountKeys.compileInstructions(instructions);
	return new MessageV0({
		header,
		staticAccountKeys,
		recentBlockhash,
		compiledInstructions,
		addressTableLookups,
	});
}
