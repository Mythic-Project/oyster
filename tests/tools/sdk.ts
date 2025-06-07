import {
	type AddressLookupTableAccount,
	type Connection,
	type Keypair,
	LAMPORTS_PER_SOL,
	type PublicKey,
	SystemProgram,
	Transaction,
	type TransactionInstruction,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";

export async function sendTransaction(
	connection: Connection,
	instructions: TransactionInstruction[],
	signers: Keypair[],
	feePayer: Keypair,
) {
	const transaction = new Transaction({ feePayer: feePayer.publicKey });
	transaction.add(...instructions);
	signers.push(feePayer);
	const tx = await connection.sendTransaction(transaction, signers);

	await connection.confirmTransaction(tx, "confirmed");
}

export async function sendV0Transaction(
	connection: Connection,
	instructions: TransactionInstruction[],
	signers: Keypair[],
	feePayer: Keypair,
	withSimulation: boolean,
	addressLookupTableAccounts: AddressLookupTableAccount[],
) {
	const latestBlockhash = await connection.getLatestBlockhash("confirmed");
	const messageV0 = new TransactionMessage({
		payerKey: feePayer.publicKey,
		recentBlockhash: latestBlockhash.blockhash,
		instructions,
	}).compileToV0Message(addressLookupTableAccounts);

	const transaction = new VersionedTransaction(messageV0);
	transaction.sign([...signers, feePayer]);
	withSimulation && console.log("Simulated Txn", await connection.simulateTransaction(transaction));

	const tx = await connection.sendTransaction(transaction);
	await connection.confirmTransaction(
		{
			signature: tx,
			lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
			blockhash: latestBlockhash.blockhash,
		},
		"confirmed",
	);
}

export async function requestAirdrop(connection: Connection, walletPk: PublicKey) {
	const airdropSignature = await connection.requestAirdrop(walletPk, LAMPORTS_PER_SOL);

	await connection.confirmTransaction(airdropSignature);
}

export function createTestTransferInstruction(authority: PublicKey, recipient: PublicKey, amount = 1000000) {
	return SystemProgram.transfer({
		fromPubkey: authority,
		lamports: amount,
		toPubkey: recipient,
	});
}
