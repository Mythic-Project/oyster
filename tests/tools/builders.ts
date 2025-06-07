import {
	ASSOCIATED_TOKEN_PROGRAM_ID,
	getAssociatedTokenAddress,
	TOKEN_2022_PROGRAM_ID,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
	type AddressLookupTableAccount,
	Connection,
	Keypair,
	type PublicKey,
	type TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import {
	accountsForTransactionExecute,
	getGovernance,
	getProposal,
	getProposalDepositsByDepositPayer,
	getRealm,
	getRealmConfig,
	getTokenOwnerRecord,
	getVoteRecord,
	GovernanceAccountParser,
	Vote,
	withAddSignatory,
	withCastVote,
	withCloseTransactionBuffer,
	withCreateGovernance,
	withCreateNativeTreasury,
	withCreateProposal,
	withCreateTransactionBuffer,
	withDepositGoverningTokens,
	withExecuteVersionedTransaction,
	withExtendTransactionBuffer,
	withInsertVersionedTransaction,
	withInsertVersionedTransactionFromBuffer,
	withRefundProposalDeposit,
	withRelinquishVote,
	withRevokeGoverningTokens,
	withSignOffProposal,
	withWithdrawGoverningTokens,
	YesNoVote,
} from "../../src";
import {
	getRealmConfigAddress,
	GovernanceConfig,
	GoverningTokenConfigAccountArgs,
	GoverningTokenType,
	MintMaxVoteWeightSource,
	ProposalTransactionBuffer,
	ProposalTransactionMessage,
	ProposalVersionedTransaction,
	TransactionExecutionStatus,
	VoteThreshold,
	VoteThresholdType,
	VoteTipping,
	VoteType,
} from "../../src/governance/accounts";
import { getGovernanceProgramVersion } from "../../src/governance/version";
import { withCreateRealm } from "../../src/governance/withCreateRealm";
import { withSetRealmConfig } from "../../src/governance/withSetRealmConfig";
import { requestAirdrop, sendTransaction, sendV0Transaction } from "./sdk";
import { rpcEndpoint, rpcProgramId } from "./setup";
import { getTimestampFromDays } from "./units";
import { withCreateAssociatedTokenAccount } from "./withCreateAssociatedTokenAccount";
import { withCreateMint } from "./withCreateMint";
import { withMintTo } from "./withMintTo";

export class BenchBuilder {
	connection: Connection;
	programId: PublicKey;
	programVersion: number;

	wallet: Keypair;
	walletPk: PublicKey;

	instructions: TransactionInstruction[] = [];
	signers: Keypair[] = [];

	constructor(connection: Connection, programId: PublicKey, programVersion: number) {
		this.connection = connection;
		this.programId = programId;
		this.programVersion = programVersion;
	}

	static async withConnection(
		requiredProgramVersion?: number | undefined,
		connection?: Connection | undefined,
		programId?: PublicKey | undefined,
	) {
		const connectionFixed = connection ?? new Connection(rpcEndpoint, "confirmed");
		const programIdFixed = programId ?? rpcProgramId;

		const programVersion = await getGovernanceProgramVersion(connectionFixed, programIdFixed);

		if (requiredProgramVersion && programVersion !== requiredProgramVersion) {
			throw new Error(
				`Program VERSION: ${programVersion} detected while VERSION: ${requiredProgramVersion} is required for the test`,
			);
		}

		return new BenchBuilder(connectionFixed, programIdFixed, programVersion);
	}

	async withWallet() {
		this.wallet = Keypair.generate();
		this.walletPk = this.wallet.publicKey;

		await requestAirdrop(this.connection, this.walletPk);
		await new Promise((f) => setTimeout(f, 1000));

		return this;
	}

	async sendTx(withSimulation = false, addressLookupTableAccounts: AddressLookupTableAccount[] = []) {
		await sendV0Transaction(
			this.connection,
			this.instructions,
			this.signers,
			this.wallet,
			withSimulation,
			addressLookupTableAccounts,
		);
		this.instructions = [];
		this.signers = [];

		return this;
	}

	async withRealm(
		communityTokenConfig?: GoverningTokenConfigAccountArgs | undefined,
		councilTokenConfig?: GoverningTokenConfigAccountArgs | undefined,
		useToken2022Community?: boolean | undefined,
		useToken2022Council?: boolean | undefined,
	) {
		return new RealmBuilder(this).withRealm(
			communityTokenConfig,
			councilTokenConfig,
			useToken2022Community,
			useToken2022Council,
		);
	}
}

export class RealmBuilder {
	bench: BenchBuilder;

	realmPk: PublicKey;
	realmAuthorityPk: PublicKey;
	communityMintPk: PublicKey;
	councilMintPk: PublicKey;

	communityOwnerRecordPk: PublicKey;
	governancePk: PublicKey;
	proposalPk: PublicKey;
	signatoryPk: PublicKey | undefined;
	treasuryPk: PublicKey | undefined;
	voteRecordPk: PublicKey;

	proposalTransactionBufferPk: PublicKey;
	proposalVersionedTxPk: PublicKey;

	constructor(bench: BenchBuilder) {
		this.bench = bench;
	}

	async withRealm(
		communityTokenConfig?: GoverningTokenConfigAccountArgs | undefined,
		councilTokenConfig?: GoverningTokenConfigAccountArgs | undefined,
		useToken2022Community?: boolean | undefined,
		useToken2022Council?: boolean | undefined,
	) {
		const name = `Realm-${new Keypair().publicKey.toBase58().slice(0, 6)}`;
		this.realmAuthorityPk = this.bench.walletPk;

		// Create community token
		this.communityMintPk = await withCreateMint(
			this.bench.connection,
			this.bench.instructions,
			this.bench.signers,
			this.bench.walletPk,
			this.bench.walletPk,
			0,
			this.bench.walletPk,
			useToken2022Community ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
		);

		// Create council
		this.councilMintPk = await withCreateMint(
			this.bench.connection,
			this.bench.instructions,
			this.bench.signers,
			this.bench.walletPk,
			this.bench.walletPk,
			0,
			this.bench.walletPk,
			useToken2022Council ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
		);

		const communityMintMaxVoteWeightSource = MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION;

		this.realmPk = await withCreateRealm(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			name,
			this.realmAuthorityPk,
			this.communityMintPk,
			this.bench.walletPk,
			this.councilMintPk,
			communityMintMaxVoteWeightSource,
			new BN(1),
			communityTokenConfig,
			councilTokenConfig,
			useToken2022Community ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
			useToken2022Council ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
		);

		return this;
	}

	async getRealm() {
		return getRealm(this.bench.connection, this.realmPk);
	}

	async setRealmConfig(
		communityTokenConfig?: GoverningTokenConfigAccountArgs | undefined,
		councilTokenConfig?: GoverningTokenConfigAccountArgs | undefined,
	) {
		const communityMintMaxVoteWeightSource = MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION;

		const communityTokenConfigFixed =
			communityTokenConfig ??
			new GoverningTokenConfigAccountArgs({
				voterWeightAddin: Keypair.generate().publicKey,
				maxVoterWeightAddin: Keypair.generate().publicKey,
				tokenType: GoverningTokenType.Liquid,
			});

		await withSetRealmConfig(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.realmPk,
			this.bench.walletPk,
			this.councilMintPk,
			communityMintMaxVoteWeightSource,
			new BN(1),
			communityTokenConfigFixed,
			councilTokenConfig,
			this.bench.walletPk,
		);

		await this.sendTx();
	}

	async getRealmConfig() {
		const realmConfigPk = await getRealmConfigAddress(this.bench.programId, this.realmPk);
		return getRealmConfig(this.bench.connection, realmConfigPk);
	}

	async withdrawGoverningTokens(useToken2022?: boolean | undefined) {
		const ataPk = await getAssociatedTokenAddress(
			this.communityMintPk,
			this.bench.walletPk,
			false,
			useToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
			ASSOCIATED_TOKEN_PROGRAM_ID,
		);

		await withWithdrawGoverningTokens(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.realmPk,
			ataPk,
			this.communityMintPk,
			this.bench.walletPk,
			useToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
		);

		await this.sendTx();
	}

	async withCommunityMember(useToken2022?: boolean | undefined) {
		const ataPk = await withCreateAssociatedTokenAccount(
			this.bench.instructions,
			this.communityMintPk,
			this.bench.walletPk,
			this.bench.walletPk,
			useToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
		);
		await withMintTo(
			this.bench.instructions,
			this.communityMintPk,
			ataPk,
			this.bench.walletPk,
			1,
			useToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
		);

		this.communityOwnerRecordPk = await withDepositGoverningTokens(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.realmPk,
			ataPk,
			this.communityMintPk,
			this.bench.walletPk,
			this.bench.walletPk,
			this.bench.walletPk,
			new BN(1),
			false,
			useToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
		);

		return this;
	}

	async withNativeTreasury() {
		this.treasuryPk = await withCreateNativeTreasury(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.governancePk,
			this.realmAuthorityPk,
		);
		return this;
	}

	async revokeGoverningTokens(useToken2022?: boolean | undefined) {
		await withRevokeGoverningTokens(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,

			this.realmPk,
			this.bench.walletPk,
			this.communityMintPk,
			this.bench.walletPk,
			new BN(1),
			useToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
		);

		await this.sendTx();
	}

	async getTokenOwnerRecord(tokenOwnerRecordPk: PublicKey) {
		return getTokenOwnerRecord(this.bench.connection, tokenOwnerRecordPk);
	}

	async withGovernance(config?: GovernanceConfig | undefined) {
		await this._createGovernance(config);
		return this;
	}

	async createGovernance(config?: GovernanceConfig | undefined) {
		const governancePk = await this._createGovernance(config);
		await this.sendTx();
		return governancePk;
	}

	async _createGovernance(config?: GovernanceConfig | undefined) {
		const configFixed =
			config ??
			new GovernanceConfig({
				communityVoteThreshold: new VoteThreshold({
					type: VoteThresholdType.YesVotePercentage,
					value: 60,
				}),
				minCommunityTokensToCreateProposal: new BN(1),
				minInstructionHoldUpTime: 0,
				baseVotingTime: getTimestampFromDays(3),
				communityVoteTipping: VoteTipping.Strict,
				councilVoteTipping: VoteTipping.Strict,
				minCouncilTokensToCreateProposal: new BN(1),
				councilVoteThreshold: new VoteThreshold({
					type: VoteThresholdType.YesVotePercentage,
					// For VERSION < 3 we have to pass 0
					value: this.bench.programVersion >= 3 ? 10 : 0,
				}),
				councilVetoVoteThreshold: new VoteThreshold({
					type: VoteThresholdType.YesVotePercentage,
					// For VERSION < 3 we have to pass 0
					value: this.bench.programVersion >= 3 ? 10 : 0,
				}),
				communityVetoVoteThreshold: new VoteThreshold({
					type: VoteThresholdType.YesVotePercentage,
					value: 80,
				}),
				votingCoolOffTime: 0,
				depositExemptProposalCount: 0,
			});

		const governedAccountPk = Keypair.generate().publicKey;

		this.governancePk = await withCreateGovernance(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.realmPk,
			governedAccountPk,
			configFixed,
			this.communityOwnerRecordPk,
			this.bench.walletPk,
			this.bench.walletPk,
			undefined,
		);

		return this.governancePk;
	}

	async getGovernance(governancePk: PublicKey) {
		return getGovernance(this.bench.connection, governancePk);
	}

	async withProposal(name?: string) {
		await this._createProposal(name);
		return this;
	}

	async createProposal(name?: string) {
		const proposalPk = await this._createProposal(name);
		await this.sendTx();
		return proposalPk;
	}

	async _createProposal(name?: string) {
		// Create single choice Approve/Deny proposal with instruction to mint more governance tokens
		const voteType = VoteType.SINGLE_CHOICE;
		const options = ["Approve"];
		const useDenyOption = true;

		this.proposalPk = await withCreateProposal(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.realmPk,
			this.governancePk,
			this.communityOwnerRecordPk,
			name ?? "proposal 1",
			"",
			this.communityMintPk,
			this.bench.walletPk,
			0,
			voteType,
			options,
			useDenyOption,
			this.bench.walletPk,
		);

		return this.proposalPk;
	}

	async getProposal(proposalPk: PublicKey) {
		return getProposal(this.bench.connection, proposalPk);
	}

	async getProposalDeposits(depositPayerPk: PublicKey) {
		return getProposalDepositsByDepositPayer(this.bench.connection, this.bench.programId, depositPayerPk);
	}

	async refundProposalDeposit() {
		await this._refundProposalDeposit();
		await this.sendTx();
	}

	async _refundProposalDeposit() {
		await withRefundProposalDeposit(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.proposalPk,
			this.bench.walletPk,
		);
	}

	async withSignatory() {
		this.signatoryPk = await withAddSignatory(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.proposalPk,
			this.communityOwnerRecordPk,
			this.bench.walletPk,
			this.bench.walletPk,
			this.bench.walletPk,
		);

		return this;
	}

	async withProposalSignOff() {
		withSignOffProposal(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.realmPk,
			this.governancePk,
			this.proposalPk,
			this.bench.walletPk,
			this.signatoryPk,
			this.communityOwnerRecordPk,
		);

		return this;
	}

	async withCastVote() {
		await this._castVote();
		return this;
	}

	async castVote() {
		const voteRecordPk = await this._castVote();
		await this.sendTx();
		return voteRecordPk;
	}

	async _castVote() {
		const vote = Vote.fromYesNoVote(YesNoVote.Yes);

		this.voteRecordPk = await withCastVote(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.realmPk,
			this.governancePk,
			this.proposalPk,
			this.communityOwnerRecordPk,
			this.communityOwnerRecordPk,
			this.bench.walletPk,
			this.communityMintPk,
			vote,
			this.bench.walletPk,
		);

		return this.voteRecordPk;
	}

	async getVoteRecord(proposalPk: PublicKey) {
		return getVoteRecord(this.bench.connection, proposalPk);
	}

	async relinquishVote() {
		withRelinquishVote(
			this.bench.instructions,
			this.bench.programId,
			this.bench.programVersion,
			this.realmPk,
			this.governancePk,
			this.proposalPk,
			this.communityOwnerRecordPk,
			this.communityMintPk,
			this.voteRecordPk,
			this.bench.walletPk,
			this.bench.walletPk,
		);

		await this.sendTx();
	}

	async sendTx(withSimulation = false, addressLookupTableAccounts: AddressLookupTableAccount[] = []) {
		await this.bench.sendTx(withSimulation, addressLookupTableAccounts);
		return this;
	}

	async withTransactionBuffer(
		bufferIndex = 0,
		finalBufferHash: Uint8Array = new Uint8Array(32), // 32-byte zero hash
		finalBufferSize = 100,
		buffer: Uint8Array = new Uint8Array(0),
	) {
		this.proposalTransactionBufferPk = await withCreateTransactionBuffer(
			this.bench.instructions,
			this.bench.programId,
			this.governancePk,
			this.proposalPk,
			this.communityOwnerRecordPk,
			this.bench.walletPk,
			this.bench.walletPk,
			bufferIndex,
			finalBufferHash,
			finalBufferSize,
			buffer,
		);
		return this;
	}

	async extendTransactionBuffer(bufferIndex = 0, buffer: Uint8Array = new Uint8Array(0)) {
		await withExtendTransactionBuffer(
			this.bench.instructions,
			this.bench.programId,
			this.governancePk,
			this.proposalPk,
			this.bench.walletPk,
			bufferIndex,
			buffer,
		);
		return this;
	}

	async closeTransactionBuffer(bufferIndex = 0) {
		await withCloseTransactionBuffer(
			this.bench.instructions,
			this.bench.programId,
			this.governancePk,
			this.proposalPk,
			this.communityOwnerRecordPk,
			this.bench.walletPk,
			this.bench.walletPk,
			bufferIndex,
		);
		return this;
	}

	async withVersionedTransactionFromBuffer(
		optionIndex = 0,
		ephemeralSigners = 0,
		transactionIndex = 0,
		bufferIndex = 0,
	) {
		this.proposalVersionedTxPk = await withInsertVersionedTransactionFromBuffer(
			this.bench.instructions,
			this.bench.programId,
			this.governancePk,
			this.proposalPk,
			this.communityOwnerRecordPk,
			this.bench.walletPk,
			this.bench.walletPk,
			optionIndex,
			ephemeralSigners,
			transactionIndex,
			bufferIndex,
		);
		return this;
	}

	async withVersionedTransaction(
		optionIndex = 0,
		ephemeralSigners = 0,
		transactionIndex = 0,
		transactionMessage: Uint8Array = new Uint8Array(0),
	) {
		this.proposalVersionedTxPk = await withInsertVersionedTransaction(
			this.bench.instructions,
			this.bench.programId,
			this.governancePk,
			this.proposalPk,
			this.communityOwnerRecordPk,
			this.bench.walletPk,
			this.bench.walletPk,
			optionIndex,
			ephemeralSigners,
			transactionIndex,
			transactionMessage,
		);
		return this;
	}

	async executeVersionedTransaction(ephemeralSignerCount = 0) {
		const versionedTransaction = await this.getVersionedTransactionProposal(this.proposalVersionedTxPk);
		const { accountMetas, lookupTableAccounts: _lookupTableAccounts } = await accountsForTransactionExecute({
			connection: this.bench.connection,
			transactionProposalPda: this.proposalVersionedTxPk,
			transactionIndex: 0,
			governancePk: this.governancePk,
			treasuryPk: this.treasuryPk ?? this.communityMintPk,
			message: versionedTransaction?.message!,
			ephemeralSignerCount,
			programId: this.bench.programId,
		});
		await withExecuteVersionedTransaction(
			this.bench.instructions,
			this.bench.programId,
			this.governancePk,
			this.proposalPk,
			this.proposalVersionedTxPk,
			accountMetas,
		);
		return this;
	}

	async getTransactionBuffer(bufferPk: PublicKey): Promise<ProposalTransactionBuffer | null> {
		return this.bench.connection.getAccountInfo(bufferPk).then((account) => {
			if (!account) return null;
			return GovernanceAccountParser(ProposalTransactionBuffer)(bufferPk, account).account;
		});
	}

	async getVersionedTransactionProposal(txPk: PublicKey): Promise<ProposalVersionedTransaction | null> {
		return this.bench.connection.getAccountInfo(txPk).then((account) => {
			if (!account) return null;
			return GovernanceAccountParser(ProposalVersionedTransaction)(txPk, account).account;
		});
	}
}
