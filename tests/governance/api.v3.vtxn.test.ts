import {
	AddressLookupTableProgram,
	ComputeBudgetProgram,
	Keypair,
	LAMPORTS_PER_SOL,
	PublicKey,
	type TransactionInstruction,
	TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import {
	getEphemeralSignerPda,
	getProposalVersionedTransactionAddress,
	GovernanceConfig,
	GoverningTokenConfigAccountArgs,
	GoverningTokenType,
	TransactionExecutionStatus,
	VoteThreshold,
	VoteThresholdType,
	VoteTipping,
} from "../../src/governance/accounts";
import { PROGRAM_VERSION_V3 } from "../../src/registry/constants";
import { BenchBuilder } from "../tools/builders";
import { getTimestampFromDays } from "../tools/units";
import { createTestTransferInstruction, sendV0Transaction } from "../tools/sdk";
import { getAddressLookupTableAccounts, transactionMessageToRealmsTransactionMessageBytes } from "../../src";
import * as crypto from "node:crypto";
import { withCreateMint, withCreateMintCustomMint } from "../tools/withCreateMint";
import { withCreateAssociatedTokenAccount } from "../tools/withCreateAssociatedTokenAccount";
import { withMintTo } from "../tools/withMintTo";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

test("getGovernanceProgramVersion", async () => {
	// Arrange
	// Act
	const builder = await BenchBuilder.withConnection();

	// Assert
	expect(builder.programVersion).toEqual(3);
});

test("createRealmWithTokenConfigs", async () => {
	// Arrange
	const bench = await BenchBuilder.withConnection(PROGRAM_VERSION_V3).then((b) => b.withWallet());

	const communityTokenConfig = new GoverningTokenConfigAccountArgs({
		voterWeightAddin: Keypair.generate().publicKey,
		maxVoterWeightAddin: Keypair.generate().publicKey,
		tokenType: GoverningTokenType.Dormant,
	});
	const councilTokenConfig = new GoverningTokenConfigAccountArgs({
		voterWeightAddin: Keypair.generate().publicKey,
		maxVoterWeightAddin: Keypair.generate().publicKey,
		tokenType: GoverningTokenType.Membership,
	});

	// Act
	const realm = await bench.withRealm(communityTokenConfig, councilTokenConfig).then((b) => b.sendTx());

	// Assert
	const realmConfig = await realm.getRealmConfig();

	expect(realmConfig.account.realm).toEqual(realm.realmPk);

	// communityTokenConfig
	expect(realmConfig.account.communityTokenConfig.tokenType).toEqual(communityTokenConfig.tokenType);
	expect(realmConfig.account.communityTokenConfig.voterWeightAddin).toEqual(communityTokenConfig.voterWeightAddin!);
	expect(realmConfig.account.communityTokenConfig.maxVoterWeightAddin).toEqual(
		communityTokenConfig.maxVoterWeightAddin!,
	);

	// councilTokenConfig
	expect(realmConfig.account.councilTokenConfig.tokenType).toEqual(GoverningTokenType.Membership);
	expect(realmConfig.account.councilTokenConfig.voterWeightAddin).toEqual(councilTokenConfig.voterWeightAddin!);
	expect(realmConfig.account.councilTokenConfig.maxVoterWeightAddin).toEqual(councilTokenConfig.maxVoterWeightAddin!);
});

test("createRealmWithTokenConfigsDifferentCouncilTokenTokenStandard", async () => {
	// Arrange
	const bench = await BenchBuilder.withConnection(PROGRAM_VERSION_V3).then((b) => b.withWallet());

	const communityTokenConfig = new GoverningTokenConfigAccountArgs({
		voterWeightAddin: Keypair.generate().publicKey,
		maxVoterWeightAddin: Keypair.generate().publicKey,
		tokenType: GoverningTokenType.Dormant,
	});
	const councilTokenConfig = new GoverningTokenConfigAccountArgs({
		voterWeightAddin: Keypair.generate().publicKey,
		maxVoterWeightAddin: Keypair.generate().publicKey,
		tokenType: GoverningTokenType.Membership,
	});

	// Act
	const realm = await bench.withRealm(communityTokenConfig, councilTokenConfig, false, true).then((b) => b.sendTx());

	// Assert
	const realmConfig = await realm.getRealmConfig();

	expect(realmConfig.account.realm).toEqual(realm.realmPk);

	// communityTokenConfig
	expect(realmConfig.account.communityTokenConfig.tokenType).toEqual(communityTokenConfig.tokenType);
	expect(realmConfig.account.communityTokenConfig.voterWeightAddin).toEqual(communityTokenConfig.voterWeightAddin!);
	expect(realmConfig.account.communityTokenConfig.maxVoterWeightAddin).toEqual(
		communityTokenConfig.maxVoterWeightAddin!,
	);

	// councilTokenConfig
	expect(realmConfig.account.councilTokenConfig.tokenType).toEqual(GoverningTokenType.Membership);
	expect(realmConfig.account.councilTokenConfig.voterWeightAddin).toEqual(councilTokenConfig.voterWeightAddin!);
	expect(realmConfig.account.councilTokenConfig.maxVoterWeightAddin).toEqual(councilTokenConfig.maxVoterWeightAddin!);
});

test("createGovernanceWithConfig", async () => {
	// Arrange
	const realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.sendTx());

	const config = new GovernanceConfig({
		communityVoteThreshold: new VoteThreshold({
			type: VoteThresholdType.YesVotePercentage,
			value: 20,
		}),
		minCommunityTokensToCreateProposal: new BN(1),
		minInstructionHoldUpTime: 0,
		baseVotingTime: getTimestampFromDays(3),
		communityVoteTipping: VoteTipping.Strict,
		councilVoteTipping: VoteTipping.Strict,
		minCouncilTokensToCreateProposal: new BN(1),
		councilVoteThreshold: new VoteThreshold({
			type: VoteThresholdType.YesVotePercentage,
			value: 60,
		}),
		councilVetoVoteThreshold: new VoteThreshold({
			type: VoteThresholdType.YesVotePercentage,
			value: 80,
		}),
		communityVetoVoteThreshold: new VoteThreshold({
			type: VoteThresholdType.YesVotePercentage,
			value: 80,
		}),
		votingCoolOffTime: 5000,
		depositExemptProposalCount: 10,
	});

	// Act
	const governancePk = await realm.createGovernance(config);

	// Assert
	const governance = await realm.getGovernance(governancePk);

	expect(governance.account.config.communityVoteThreshold).toEqual(config.communityVoteThreshold);

	expect(governance.account.config.councilVoteThreshold).toEqual(config.councilVoteThreshold);

	expect(governance.account.config.councilVetoVoteThreshold).toEqual(config.councilVetoVoteThreshold);

	expect(governance.account.config.baseVotingTime).toEqual(getTimestampFromDays(3));

	expect(governance.account.config.votingCoolOffTime).toEqual(5000);

	expect(governance.account.config.depositExemptProposalCount).toEqual(10);
});

test("setRealmConfigWithTokenConfigs", async () => {
	// Arrange
	const realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.sendTx());

	const communityTokenConfig = new GoverningTokenConfigAccountArgs({
		voterWeightAddin: Keypair.generate().publicKey,
		maxVoterWeightAddin: Keypair.generate().publicKey,
		tokenType: GoverningTokenType.Dormant,
	});
	const councilTokenConfig = new GoverningTokenConfigAccountArgs({
		voterWeightAddin: Keypair.generate().publicKey,
		maxVoterWeightAddin: Keypair.generate().publicKey,
		tokenType: GoverningTokenType.Membership,
	});

	// Act
	await realm.setRealmConfig(communityTokenConfig, councilTokenConfig);

	// Assert
	const realmConfig = await realm.getRealmConfig();

	expect(realmConfig.account.realm).toEqual(realm.realmPk);

	// communityTokenConfig
	expect(realmConfig.account.communityTokenConfig.tokenType).toEqual(communityTokenConfig.tokenType);
	expect(realmConfig.account.communityTokenConfig.voterWeightAddin).toEqual(communityTokenConfig.voterWeightAddin!);
	expect(realmConfig.account.communityTokenConfig.maxVoterWeightAddin).toEqual(
		communityTokenConfig.maxVoterWeightAddin!,
	);

	// councilTokenConfig
	expect(realmConfig.account.councilTokenConfig.tokenType).toEqual(GoverningTokenType.Membership);
	expect(realmConfig.account.councilTokenConfig.voterWeightAddin).toEqual(councilTokenConfig.voterWeightAddin!);
	expect(realmConfig.account.councilTokenConfig.maxVoterWeightAddin).toEqual(councilTokenConfig.maxVoterWeightAddin!);
});

test("revokeGoverningToken", async () => {
	// Arrange

	const communityTokenConfig = new GoverningTokenConfigAccountArgs({
		voterWeightAddin: undefined,
		maxVoterWeightAddin: undefined,
		tokenType: GoverningTokenType.Membership,
	});

	const realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm(communityTokenConfig))
		.then((b) => b.withCommunityMember())
		.then((b) => b.sendTx());

	// Act
	await realm.revokeGoverningTokens();

	// Assert
	const tokenOwnerRecord = await realm.getTokenOwnerRecord(realm.communityOwnerRecordPk);

	expect(tokenOwnerRecord.account.governingTokenDepositAmount.toNumber()).toEqual(0);
});

test("createProposal", async () => {
	// Arrange
	const realm = await BenchBuilder.withConnection()
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.sendTx());

	// Act
	const proposalPk = await realm.createProposal("proposal 1");

	// Assert
	const proposal = await realm.getProposal(proposalPk);

	expect(proposal.account.name).toEqual("proposal 1");
	expect(proposal.account.vetoVoteWeight.toNumber()).toEqual(0);

	const governance = await realm.getGovernance(proposal.account.governance);
	expect(governance.account.activeProposalCount.toNumber()).toEqual(1);
});

test("createTransactionBuffer", async () => {
	// Arrange
	const realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.sendTx())
		.then((b) => b.withProposal())
		.then((b) => b.sendTx());
	const bufferIndex = 0;
	const finalBufferHash = new Uint8Array(32).fill(1); // Example hash
	const finalBufferSize = 100;
	const buffer = new Uint8Array([1, 2, 3, 4]);

	// Act
	await realm.withTransactionBuffer(bufferIndex, finalBufferHash, finalBufferSize, buffer).then((b) => b.sendTx());

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.proposal.toBase58()).toEqual(realm.proposalPk.toBase58());
	expect(transactionBuffer.creator.toBase58()).toEqual(realm.bench.walletPk.toBase58());
	expect(transactionBuffer.bufferIndex).toEqual(bufferIndex);
	expect(Buffer.from(transactionBuffer.finalBufferHash)).toEqual(Buffer.from(finalBufferHash));
	expect(transactionBuffer.finalBufferSize).toEqual(finalBufferSize);
	expect(Buffer.from(transactionBuffer.buffer)).toEqual(Buffer.from(buffer));
});

test("extendTransactionBuffer", async () => {
	const bufferIndex = 0;
	const finalBufferHash = new Uint8Array(32).fill(1); // Example hash
	const finalBufferSize = 100;
	const buffer = new Uint8Array([1, 2, 3, 4]);
	// Arrange
	const realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.sendTx())
		.then((b) => b.withProposal())
		.then((b) => b.withTransactionBuffer(bufferIndex, finalBufferHash, finalBufferSize, buffer))
		.then((b) => b.sendTx());

	const extensionBuffer = new Uint8Array([4, 5, 6]);

	// Act
	await realm.extendTransactionBuffer(bufferIndex, extensionBuffer).then((b) => b.sendTx());

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.buffer.length).toBeGreaterThan(4); // Original was [1,2,3]
});

test("closeTransactionBuffer", async () => {
	const bufferIndex = 0;
	const finalBufferHash = new Uint8Array(32).fill(1); // Example hash
	const finalBufferSize = 100;
	const buffer = new Uint8Array([1, 2, 3, 4]);
	// Arrange
	const realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.sendTx())
		.then((b) => b.withProposal())
		.then((b) => b.withTransactionBuffer(bufferIndex, finalBufferHash, finalBufferSize, buffer))
		.then((b) => b.sendTx());

	// Act
	await realm.closeTransactionBuffer(bufferIndex).then((b) => b.sendTx());

	// Assert
	const accountInfo = await realm.bench.connection.getAccountInfo(realm.proposalTransactionBufferPk);
	expect(accountInfo).toBeNull(); // Account should be closed
});

test("insertVersionedTransactionFromBuffer fails if final buffer hash is not correct", async () => {
	const bufferIndex = 0;
	const finalBufferHash = new Uint8Array(32).fill(1); // Example hash
	const finalBufferSize = 4;
	const buffer = new Uint8Array([1, 2, 3, 4]);
	// Arrange
	const realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.sendTx())
		.then((b) => b.withProposal())
		.then((b) => b.withTransactionBuffer(bufferIndex, finalBufferHash, finalBufferSize, buffer))
		.then((b) => b.sendTx());

	const optionIndex = 0;
	const ephemeralSigners = 0;
	const transactionIndex = 0;

	// Act
	const txBuilder = await realm.withVersionedTransactionFromBuffer(
		optionIndex,
		ephemeralSigners,
		transactionIndex,
		bufferIndex,
	);

	await expect(txBuilder.sendTx()).rejects.toThrow();
});

test("insertVersionedTransactionFromBuffer", async () => {
	const testPayee = Keypair.generate();
	const bufferIndex = 0;
	// Arrange
	let realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.withNativeTreasury())
		.then((b) => b.sendTx());

	const testIx = createTestTransferInstruction(realm.governancePk, testPayee.publicKey, 1 * LAMPORTS_PER_SOL);

	const instructions: TransactionInstruction[] = [];

	for (let i = 0; i <= 2; i++) {
		instructions.push(testIx);
	}
	const testTransferMessage = new TransactionMessage({
		payerKey: realm.governancePk,
		recentBlockhash: PublicKey.default.toString(),
		instructions: instructions,
	});

	// // Serialize the message. Must be done with this util function
	const messageBuffer = transactionMessageToRealmsTransactionMessageBytes({
		message: testTransferMessage,
		addressLookupTableAccounts: [],
	});

	const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();

	realm = await realm.withProposal().then((b) => b.sendTx());

	await realm
		.withTransactionBuffer(bufferIndex, messageHash, messageBuffer.length, messageBuffer)
		.then((b) => b.sendTx());

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.buffer.length).toEqual(messageBuffer.length);
	expect(transactionBuffer.finalBufferHash).toEqual(Uint8Array.from(messageHash));
});

test("insertVersionedTransaction", async () => {
	const testPayee = Keypair.generate();
	const bufferIndex = 0;
	// Arrange
	let realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.withNativeTreasury())
		.then((b) => b.sendTx());

	const testIx = createTestTransferInstruction(realm.governancePk, testPayee.publicKey, 1 * LAMPORTS_PER_SOL);

	const instructions: TransactionInstruction[] = [];

	for (let i = 0; i <= 2; i++) {
		instructions.push(testIx);
	}
	const testTransferMessage = new TransactionMessage({
		payerKey: realm.governancePk,
		recentBlockhash: PublicKey.default.toString(),
		instructions: instructions,
	});

	// // Serialize the message. Must be done with this util function
	const messageBuffer = transactionMessageToRealmsTransactionMessageBytes({
		message: testTransferMessage,
		addressLookupTableAccounts: [],
	});

	const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();

	realm = await realm.withProposal().then((b) => b.sendTx());

	await realm
		.withTransactionBuffer(bufferIndex, messageHash, messageBuffer.length, messageBuffer)
		.then((b) => b.sendTx());

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.buffer.length).toEqual(messageBuffer.length);
	expect(transactionBuffer.finalBufferHash).toEqual(Uint8Array.from(messageHash));

	const optionIndex = 0;
	const ephemeralSigners = 0;
	const transactionIndex = 0;
	// Act
	await realm
		.withVersionedTransactionFromBuffer(optionIndex, ephemeralSigners, transactionIndex, bufferIndex)
		.then((b) => b.sendTx());

	// Assert
	const versionedTx = await realm.getVersionedTransactionProposal(realm.proposalVersionedTxPk);
	if (!versionedTx) throw Error("No versioned transaction found");
	expect(versionedTx.proposal.toBase58()).toEqual(realm.proposalPk.toBase58());
	expect(versionedTx.optionIndex).toEqual(optionIndex);
	expect(versionedTx.transactionIndex).toEqual(transactionIndex);
	expect(versionedTx.ephemeralSignerBumps.length).toEqual(ephemeralSigners);
	expect(Buffer.from(versionedTx.message.serialize())).toEqual(Buffer.from(messageBuffer));
});

test("executeVersionedTransaction", async () => {
	const testPayee = Keypair.generate();
	const bufferIndex = 0;
	// Arrange
	let realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.withNativeTreasury())
		.then((b) => b.sendTx());

	// fund the treasury account
	await realm.bench.connection.requestAirdrop(realm.treasuryPk!, LAMPORTS_PER_SOL * 10);
	const testIx = createTestTransferInstruction(realm.treasuryPk!, testPayee.publicKey, 1 * LAMPORTS_PER_SOL);

	const instructions: TransactionInstruction[] = [];

	for (let i = 0; i <= 2; i++) {
		instructions.push(testIx);
	}
	const testTransferMessage = new TransactionMessage({
		payerKey: realm.treasuryPk!,
		recentBlockhash: PublicKey.default.toString(),
		instructions: instructions,
	});

	// // Serialize the message. Must be done with this util function
	const messageBuffer = transactionMessageToRealmsTransactionMessageBytes({
		message: testTransferMessage,
		addressLookupTableAccounts: [],
	});

	const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();

	realm = await realm.withProposal().then((b) => b.sendTx());

	await realm
		.withTransactionBuffer(bufferIndex, messageHash, messageBuffer.length, messageBuffer)
		.then((b) => b.sendTx());

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.buffer.length).toEqual(messageBuffer.length);
	expect(transactionBuffer.finalBufferHash).toEqual(Uint8Array.from(messageHash));

	const optionIndex = 0;
	const ephemeralSigners = 0;
	const transactionIndex = 0;
	// Act
	await realm
		.withVersionedTransactionFromBuffer(optionIndex, ephemeralSigners, transactionIndex, bufferIndex)
		.then((b) => b.sendTx());

	await realm
		.withProposalSignOff()
		.then((b) => b.withCastVote())
		.then((b) => b.sendTx());

	// Assert
	await new Promise((f) => setTimeout(f, 2000));

	await realm.executeVersionedTransaction().then((b) => b.sendTx());

	const versionedTx = await realm.getVersionedTransactionProposal(realm.proposalVersionedTxPk);
	if (!versionedTx) throw Error("No versioned transaction found");

	const executionStatusIndex = Object.values(TransactionExecutionStatus).indexOf(TransactionExecutionStatus.Success);
	expect(versionedTx.executionStatus).toEqual(executionStatusIndex);
	expect(Number(versionedTx?.executedAt)).toBeLessThan(new Date().getTime() / 1000);
});

test("executeVersionedTransaction simple", async () => {
	const testPayee = Keypair.generate();
	const bufferIndex = 0;
	// Arrange
	let realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.withNativeTreasury())
		.then((b) => b.sendTx());

	// fund the treasury account
	await realm.bench.connection.requestAirdrop(realm.treasuryPk!, LAMPORTS_PER_SOL * 10);
	const testIx = createTestTransferInstruction(realm.treasuryPk!, testPayee.publicKey, 1 * LAMPORTS_PER_SOL);

	const testTransferMessage = new TransactionMessage({
		payerKey: realm.treasuryPk!,
		recentBlockhash: PublicKey.default.toString(),
		instructions: [testIx],
	});

	// Serialize the message. Must be done with this util function
	const messageBuffer = transactionMessageToRealmsTransactionMessageBytes({
		message: testTransferMessage,
		addressLookupTableAccounts: [],
	});

	// Act

	const optionIndex = 0;
	const ephemeralSigners = 0;
	const transactionIndex = 0;
	realm = await realm
		.withProposal()
		.then((b) => b.withVersionedTransaction(optionIndex, ephemeralSigners, transactionIndex, messageBuffer))
		.then((b) => b.withProposalSignOff())
		.then((b) => b.withCastVote())
		.then((b) => b.sendTx());

	await new Promise((f) => setTimeout(f, 2000));

	await realm.executeVersionedTransaction().then((b) => b.sendTx());

	// Assert
	const versionedTx = await realm.getVersionedTransactionProposal(realm.proposalVersionedTxPk);
	if (!versionedTx) throw Error("No versioned transaction found");

	const executionStatusIndex = Object.values(TransactionExecutionStatus).indexOf(TransactionExecutionStatus.Success);
	expect(versionedTx.executionStatus).toEqual(executionStatusIndex);
	expect(Number(versionedTx?.executedAt)).toBeLessThan(new Date().getTime() / 1000);
});

test("executeVersionedTransaction with heaps and multiple buffers", async () => {
	const testPayee = Keypair.generate();
	const bufferIndex = 0;
	// Arrange
	let realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.withNativeTreasury())
		.then((b) => b.sendTx());

	// fund the treasury account
	await realm.bench.connection.requestAirdrop(realm.treasuryPk!, LAMPORTS_PER_SOL * 100);
	const testIx = createTestTransferInstruction(realm.treasuryPk!, testPayee.publicKey, 0.01 * LAMPORTS_PER_SOL);

	const instructions: TransactionInstruction[] = [];

	for (let i = 0; i <= 60; i++) {
		instructions.push(testIx);
	}
	const testTransferMessage = new TransactionMessage({
		payerKey: realm.treasuryPk!,
		recentBlockhash: PublicKey.default.toString(),
		instructions: instructions,
	});

	// Serialize the message. Must be done with this util function
	const messageBuffer = transactionMessageToRealmsTransactionMessageBytes({
		message: testTransferMessage,
		addressLookupTableAccounts: [],
	});

	const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();

	realm = await realm.withProposal().then((b) => b.sendTx());
	const CHUNK_SIZE = 800; // Safe chunk size for buffer extension

	const firstSlice = messageBuffer.slice(0, CHUNK_SIZE);

	await realm.withTransactionBuffer(bufferIndex, messageHash, messageBuffer.length, firstSlice).then((b) => b.sendTx());

	const numChunks = Math.ceil(messageBuffer.length / CHUNK_SIZE);
	for (let i = 1; i < numChunks; i++) {
		const start = i * CHUNK_SIZE;
		const end = Math.min(start + CHUNK_SIZE, messageBuffer.length);
		const chunk = messageBuffer.slice(start, end);
		await realm.extendTransactionBuffer(bufferIndex, chunk).then((b) => b.sendTx());
	}

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.buffer.length).toEqual(messageBuffer.length);
	expect(transactionBuffer.finalBufferHash).toEqual(Uint8Array.from(messageHash));

	const optionIndex = 0;
	const ephemeralSigners = 0;
	const transactionIndex = 0;
	// Act
	await realm
		.withVersionedTransactionFromBuffer(optionIndex, ephemeralSigners, transactionIndex, bufferIndex)
		.then((b) => b.sendTx());

	await realm
		.withProposalSignOff()
		.then((b) => b.withCastVote())
		.then((b) => b.sendTx());
	// Assert

	await new Promise((f) => setTimeout(f, 2000));
	// add head frame
	const requestHeapIx = ComputeBudgetProgram.requestHeapFrame({
		bytes: 262144,
	});

	const computeBudgetIxn = ComputeBudgetProgram.setComputeUnitLimit({
		units: 250_000,
	});

	realm.bench.instructions.push(requestHeapIx, computeBudgetIxn);
	await realm.executeVersionedTransaction().then((b) => b.sendTx());

	const versionedTx = await realm.getVersionedTransactionProposal(realm.proposalVersionedTxPk);
	if (!versionedTx) throw Error("No versioned transaction found");

	const executionStatusIndex = Object.values(TransactionExecutionStatus).indexOf(TransactionExecutionStatus.Success);
	expect(versionedTx.executionStatus).toEqual(executionStatusIndex);
	expect(Number(versionedTx?.executedAt)).toBeLessThan(new Date().getTime() / 1000);
});

test("executeVersionedTransaction, with ephemeralSigner token creation and governance as mint authority", async () => {
	const bufferIndex = 0;
	// Arrange
	let realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.withNativeTreasury())
		.then((b) => b.sendTx());

	// fund the treasury account
	await realm.bench.connection.requestAirdrop(realm.treasuryPk!, LAMPORTS_PER_SOL * 10);

	realm = await realm.withProposal().then((b) => b.sendTx());

	const instructions: TransactionInstruction[] = [];
	const optionIndex = 0;
	const ephemeralSigners = 1;
	const transactionIndex = 0;
	const proposalVersionedTxAddress = await getProposalVersionedTransactionAddress(
		realm.bench.programId,
		realm.proposalPk,
		optionIndex,
		transactionIndex,
	);

	const [customMintKeyEphermalSigner, ephemeralSignerBump] = getEphemeralSignerPda({
		transactionProposalPda: proposalVersionedTxAddress,
		transactionIndex,
		ephemeralSignerIndex: 0,
		programId: realm.bench.programId,
	});

	await withCreateMintCustomMint(
		realm.bench.connection,
		instructions,
		customMintKeyEphermalSigner,
		realm.governancePk,
		realm.governancePk,
		6,
		realm.treasuryPk!,
	);

	const ataPk = await withCreateAssociatedTokenAccount(
		instructions,
		customMintKeyEphermalSigner,
		realm.treasuryPk!,
		realm.treasuryPk!,
		TOKEN_PROGRAM_ID,
		true,
	);

	await withMintTo(instructions, customMintKeyEphermalSigner, ataPk, realm.governancePk, 1 * LAMPORTS_PER_SOL);

	const testTransferMessage = new TransactionMessage({
		payerKey: realm.treasuryPk!,
		recentBlockhash: PublicKey.default.toString(),
		instructions: instructions,
	});

	// Serialize the message. Must be done with this util function
	const messageBuffer = transactionMessageToRealmsTransactionMessageBytes({
		message: testTransferMessage,
		addressLookupTableAccounts: [],
	});

	const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();

	await realm
		.withTransactionBuffer(bufferIndex, messageHash, messageBuffer.length, messageBuffer)
		.then((b) => b.sendTx());

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.buffer.length).toEqual(messageBuffer.length);
	expect(transactionBuffer.finalBufferHash).toEqual(Uint8Array.from(messageHash));

	// Act
	await realm
		.withVersionedTransactionFromBuffer(optionIndex, ephemeralSigners, transactionIndex, bufferIndex)
		.then((b) => b.sendTx());

	await realm
		.withProposalSignOff()
		.then((b) => b.withCastVote())
		.then((b) => b.sendTx());

	// Assert
	await new Promise((f) => setTimeout(f, 2000));

	await realm.executeVersionedTransaction(1).then((b) => b.sendTx());

	const versionedTx = await realm.getVersionedTransactionProposal(realm.proposalVersionedTxPk);
	if (!versionedTx) throw Error("No versioned transaction found");

	const executionStatusIndex = Object.values(TransactionExecutionStatus).indexOf(TransactionExecutionStatus.Success);
	expect(versionedTx.executionStatus).toEqual(executionStatusIndex);
	expect(Number(versionedTx?.executedAt)).toBeLessThan(new Date().getTime() / 1000);
});

test("executeVersionedTransaction, with ephemeralSigner token creation and treasury as mint authority", async () => {
	const bufferIndex = 0;
	// Arrange
	let realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.withNativeTreasury())
		.then((b) => b.sendTx());

	// fund the treasury account
	await realm.bench.connection.requestAirdrop(realm.treasuryPk!, LAMPORTS_PER_SOL * 10);

	realm = await realm.withProposal().then((b) => b.sendTx());

	const instructions: TransactionInstruction[] = [];
	const optionIndex = 0;
	const ephemeralSigners = 1;
	const transactionIndex = 0;
	const proposalVersionedTxAddress = await getProposalVersionedTransactionAddress(
		realm.bench.programId,
		realm.proposalPk,
		optionIndex,
		transactionIndex,
	);

	const [customMintKeyEphermalSigner, ephemeralSignerBump] = getEphemeralSignerPda({
		transactionProposalPda: proposalVersionedTxAddress,
		transactionIndex,
		ephemeralSignerIndex: 0,
		programId: realm.bench.programId,
	});

	await withCreateMintCustomMint(
		realm.bench.connection,
		instructions,
		customMintKeyEphermalSigner,
		realm.treasuryPk!,
		realm.treasuryPk!,
		6,
		realm.treasuryPk!,
	);

	const ataPk = await withCreateAssociatedTokenAccount(
		instructions,
		customMintKeyEphermalSigner,
		realm.treasuryPk!,
		realm.treasuryPk!,
		TOKEN_PROGRAM_ID,
		true,
	);

	await withMintTo(instructions, customMintKeyEphermalSigner, ataPk, realm.treasuryPk!, 1 * LAMPORTS_PER_SOL);

	const testTransferMessage = new TransactionMessage({
		payerKey: realm.treasuryPk!,
		recentBlockhash: PublicKey.default.toString(),
		instructions: instructions,
	});

	// Serialize the message. Must be done with this util function
	const messageBuffer = transactionMessageToRealmsTransactionMessageBytes({
		message: testTransferMessage,
		addressLookupTableAccounts: [],
	});

	const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();

	await realm
		.withTransactionBuffer(bufferIndex, messageHash, messageBuffer.length, messageBuffer)
		.then((b) => b.sendTx());

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.buffer.length).toEqual(messageBuffer.length);
	expect(transactionBuffer.finalBufferHash).toEqual(Uint8Array.from(messageHash));

	// Act
	await realm
		.withVersionedTransactionFromBuffer(optionIndex, ephemeralSigners, transactionIndex, bufferIndex)
		.then((b) => b.sendTx());

	await realm
		.withProposalSignOff()
		.then((b) => b.withCastVote())
		.then((b) => b.sendTx());

	// Assert
	await new Promise((f) => setTimeout(f, 2000));

	await realm.executeVersionedTransaction(1).then((b) => b.sendTx());

	const versionedTx = await realm.getVersionedTransactionProposal(realm.proposalVersionedTxPk);
	if (!versionedTx) throw Error("No versioned transaction found");

	const executionStatusIndex = Object.values(TransactionExecutionStatus).indexOf(TransactionExecutionStatus.Success);
	expect(versionedTx.executionStatus).toEqual(executionStatusIndex);
	expect(Number(versionedTx?.executedAt)).toBeLessThan(new Date().getTime() / 1000);
});

test("executeVersionedTransaction, with ephemeralSigner token creation, treasury as mint authority, and lookup tables", async () => {
	const bufferIndex = 0;

	// Arrange
	const realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.withNativeTreasury())
		.then((b) => b.sendTx());

	// fund the treasury account
	await realm.bench.connection.requestAirdrop(realm.treasuryPk!, LAMPORTS_PER_SOL * 10);

	// Create Address Lookup Table
	const recentSlot = await realm.bench.connection.getSlot("finalized");
	const authorityPubkey = realm.bench.wallet.publicKey;
	const payerPubkey = realm.bench.wallet.publicKey;
	const [createLutInstruction, lutAddress] = AddressLookupTableProgram.createLookupTable({
		authority: authorityPubkey,
		payer: payerPubkey,
		recentSlot,
	});
	await sendV0Transaction(realm.bench.connection, [createLutInstruction], [], realm.bench.wallet, false, []);

	const optionIndex = 0;
	const ephemeralSigners = 1;
	const transactionIndex = 0;

	await realm.withProposal().then((b) => b.sendTx());

	const proposalVersionedTxAddress = await getProposalVersionedTransactionAddress(
		realm.bench.programId,
		realm.proposalPk,
		optionIndex,
		transactionIndex,
	);

	const [customMintKeyEphermalSigner, ephemeralSignerBump] = getEphemeralSignerPda({
		transactionProposalPda: proposalVersionedTxAddress,
		transactionIndex,
		ephemeralSignerIndex: 0,
		programId: realm.bench.programId,
	});

	const instructions: TransactionInstruction[] = [];

	await withCreateMintCustomMint(
		realm.bench.connection,
		instructions,
		customMintKeyEphermalSigner,
		realm.treasuryPk!,
		realm.treasuryPk!,
		6,
		realm.treasuryPk!,
	);

	const ataPk = await withCreateAssociatedTokenAccount(
		instructions,
		customMintKeyEphermalSigner,
		realm.treasuryPk!,
		realm.treasuryPk!,
		TOKEN_PROGRAM_ID,
		true,
	);

	const addressesToAdd = [
		Keypair.generate().publicKey,
		Keypair.generate().publicKey,
		Keypair.generate().publicKey,
		Keypair.generate().publicKey,
		// the lookup table is only used if the accounts are not
		// signers
		ataPk,
		proposalVersionedTxAddress,
	];

	const extendLutInstruction = AddressLookupTableProgram.extendLookupTable({
		lookupTable: lutAddress,
		authority: authorityPubkey,
		payer: payerPubkey,
		addresses: addressesToAdd,
	});

	await sendV0Transaction(realm.bench.connection, [extendLutInstruction], [], realm.bench.wallet, false, []);

	await withMintTo(instructions, customMintKeyEphermalSigner, ataPk, realm.treasuryPk!, 1 * LAMPORTS_PER_SOL);

	const testTransferMessage = new TransactionMessage({
		payerKey: realm.treasuryPk!,
		recentBlockhash: PublicKey.default.toString(),
		instructions: instructions,
	});
	const addressLookupTableAccounts = await getAddressLookupTableAccounts(realm.bench.connection, [lutAddress]);

	// Serialize the message. Must be done with this util function
	const messageBuffer = transactionMessageToRealmsTransactionMessageBytes({
		message: testTransferMessage,
		addressLookupTableAccounts,
	});

	const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();

	await realm
		.withTransactionBuffer(bufferIndex, messageHash, messageBuffer.length, messageBuffer)
		.then((b) => b.sendTx());

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.buffer.length).toEqual(messageBuffer.length);
	expect(transactionBuffer.finalBufferHash).toEqual(Uint8Array.from(messageHash));

	// Act
	await realm
		.withVersionedTransactionFromBuffer(optionIndex, ephemeralSigners, transactionIndex, bufferIndex)
		.then((b) => b.sendTx());

	await realm
		.withProposalSignOff()
		.then((b) => b.withCastVote())
		.then((b) => b.sendTx());

	// Assert
	await new Promise((f) => setTimeout(f, 2000));

	await realm.executeVersionedTransaction(1).then((b) => b.sendTx(false, addressLookupTableAccounts));

	const versionedTx = await realm.getVersionedTransactionProposal(realm.proposalVersionedTxPk);
	if (!versionedTx) throw Error("No versioned transaction found");

	const executionStatusIndex = Object.values(TransactionExecutionStatus).indexOf(TransactionExecutionStatus.Success);
	expect(versionedTx.executionStatus).toEqual(executionStatusIndex);
	expect(Number(versionedTx?.executedAt)).toBeLessThan(new Date().getTime() / 1000);
});

test("executeVersionedTransaction failure with luts alteration", async () => {
	const bufferIndex = 0;

	// Arrange
	const realm = await BenchBuilder.withConnection(PROGRAM_VERSION_V3)
		.then((b) => b.withWallet())
		.then((b) => b.withRealm())
		.then((b) => b.withCommunityMember())
		.then((b) => b.withGovernance())
		.then((b) => b.withNativeTreasury())
		.then((b) => b.sendTx());

	// fund the treasury account
	await realm.bench.connection.requestAirdrop(realm.treasuryPk!, LAMPORTS_PER_SOL * 10);

	// Create Address Lookup Table
	const recentSlot = await realm.bench.connection.getSlot("finalized");
	const authorityPubkey = realm.bench.wallet.publicKey;
	const payerPubkey = realm.bench.wallet.publicKey;
	const [createLutInstruction, lutAddress] = AddressLookupTableProgram.createLookupTable({
		authority: authorityPubkey,
		payer: payerPubkey,
		recentSlot,
	});
	await sendV0Transaction(realm.bench.connection, [createLutInstruction], [], realm.bench.wallet, false, []);

	const optionIndex = 0;
	const ephemeralSigners = 1;
	const transactionIndex = 0;

	await realm.withProposal().then((b) => b.sendTx());

	const proposalVersionedTxAddress = await getProposalVersionedTransactionAddress(
		realm.bench.programId,
		realm.proposalPk,
		optionIndex,
		transactionIndex,
	);

	const [customMintKeyEphermalSigner, ephemeralSignerBump] = getEphemeralSignerPda({
		transactionProposalPda: proposalVersionedTxAddress,
		transactionIndex,
		ephemeralSignerIndex: 0,
		programId: realm.bench.programId,
	});

	const instructions: TransactionInstruction[] = [];

	await withCreateMintCustomMint(
		realm.bench.connection,
		instructions,
		customMintKeyEphermalSigner,
		realm.treasuryPk!,
		realm.treasuryPk!,
		6,
		realm.treasuryPk!,
	);

	const ataPk = await withCreateAssociatedTokenAccount(
		instructions,
		customMintKeyEphermalSigner,
		realm.treasuryPk!,
		realm.treasuryPk!,
		TOKEN_PROGRAM_ID,
		true,
	);

	const addressesToAdd = [
		Keypair.generate().publicKey,
		Keypair.generate().publicKey,
		Keypair.generate().publicKey,
		Keypair.generate().publicKey,
		// the lookup table is only used if the accounts are not
		// signers
		ataPk,
	];

	const extendLutInstruction = AddressLookupTableProgram.extendLookupTable({
		lookupTable: lutAddress,
		authority: authorityPubkey,
		payer: payerPubkey,
		addresses: addressesToAdd,
	});

	await sendV0Transaction(realm.bench.connection, [extendLutInstruction], [], realm.bench.wallet, false, []);

	await withMintTo(instructions, customMintKeyEphermalSigner, ataPk, realm.treasuryPk!, 1 * LAMPORTS_PER_SOL);

	const testTransferMessage = new TransactionMessage({
		payerKey: realm.treasuryPk!,
		recentBlockhash: PublicKey.default.toString(),
		instructions: instructions,
	});
	const addressLookupTableAccounts = await getAddressLookupTableAccounts(realm.bench.connection, [lutAddress]);

	// Serialize the message. Must be done with this util function
	const messageBuffer = transactionMessageToRealmsTransactionMessageBytes({
		message: testTransferMessage,
		addressLookupTableAccounts,
	});

	const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();

	await realm
		.withTransactionBuffer(bufferIndex, messageHash, messageBuffer.length, messageBuffer)
		.then((b) => b.sendTx());

	// Assert
	const transactionBuffer = await realm.getTransactionBuffer(realm.proposalTransactionBufferPk);
	if (!transactionBuffer) throw Error("No transaction buffer found");
	expect(transactionBuffer.buffer.length).toEqual(messageBuffer.length);
	expect(transactionBuffer.finalBufferHash).toEqual(Uint8Array.from(messageHash));

	// Act
	await realm
		.withVersionedTransactionFromBuffer(optionIndex, ephemeralSigners, transactionIndex, bufferIndex)
		.then((b) => b.sendTx());

	await realm.withProposalSignOff().then((b) => b.sendTx());
	// Assert
	await new Promise((f) => setTimeout(f, 2000));
	const extendLutInstruction2 = AddressLookupTableProgram.extendLookupTable({
		lookupTable: lutAddress,
		authority: authorityPubkey,
		payer: payerPubkey,
		addresses: [proposalVersionedTxAddress],
	});

	await sendV0Transaction(realm.bench.connection, [extendLutInstruction2], [], realm.bench.wallet, false, []);

	await realm.withCastVote().then((b) => b.sendTx());
	await new Promise((f) => setTimeout(f, 2000));

	const txBuilder = await realm.executeVersionedTransaction(1);
	await expect(txBuilder.sendTx(false, addressLookupTableAccounts)).rejects.toThrow();
});
