import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import BigNumber from "bignumber.js";
import { type Vote, VoteKind } from "./instructions";
import { ACCOUNT_VERSION_V1, ACCOUNT_VERSION_V2, PROGRAM_VERSION_V1 } from "../registry/constants";

/// Seed  prefix for Governance Program PDAs
export const GOVERNANCE_PROGRAM_SEED = "governance";

export enum GovernanceAccountType {
	Uninitialized = 0,
	RealmV1 = 1,
	TokenOwnerRecordV1 = 2,
	GovernanceV1 = 3,
	ProgramGovernanceV1 = 4,
	ProposalV1 = 5,
	SignatoryRecordV1 = 6,
	VoteRecordV1 = 7,
	ProposalInstructionV1 = 8,
	MintGovernanceV1 = 9,
	TokenGovernanceV1 = 10,
	RealmConfig = 11,
	VoteRecordV2 = 12,
	ProposalTransactionV2 = 13,
	ProposalV2 = 14,
	ProgramMetadata = 15,
	RealmV2 = 16,
	TokenOwnerRecordV2 = 17,
	GovernanceV2 = 18,
	ProgramGovernanceV2 = 19,
	MintGovernanceV2 = 20,
	TokenGovernanceV2 = 21,
	SignatoryRecordV2 = 22,
	ProposalDeposit = 23,
	RequiredSignatory = 24,
	ProposalVersionedTransaction = 25,
	ProposalTransactionBuffer = 26,
}

export interface GovernanceAccount {
	accountType: GovernanceAccountType;
}

export type GovernanceAccountClass =
	| typeof Realm
	| typeof TokenOwnerRecord
	| typeof Governance
	| typeof Proposal
	| typeof SignatoryRecord
	| typeof VoteRecord
	| typeof ProposalTransaction
	| typeof ProposalVersionedTransaction
	| typeof ProposalTransactionBuffer
	| typeof RealmConfigAccount
	| typeof ProgramMetadata
	| typeof ProposalDeposit;

export function getAccountTypes(accountClass: GovernanceAccountClass) {
	switch (accountClass) {
		case Realm:
			return [GovernanceAccountType.RealmV1, GovernanceAccountType.RealmV2];
		case TokenOwnerRecord:
			return [GovernanceAccountType.TokenOwnerRecordV1, GovernanceAccountType.TokenOwnerRecordV2];
		case Proposal:
			return [GovernanceAccountType.ProposalV1, GovernanceAccountType.ProposalV2];
		case ProposalDeposit:
			return [GovernanceAccountType.ProposalDeposit];
		case SignatoryRecord:
			return [GovernanceAccountType.SignatoryRecordV1, GovernanceAccountType.SignatoryRecordV2];
		case VoteRecord:
			return [GovernanceAccountType.VoteRecordV1, GovernanceAccountType.VoteRecordV2];
		case ProposalTransaction:
			return [GovernanceAccountType.ProposalInstructionV1, GovernanceAccountType.ProposalTransactionV2];
		case ProposalVersionedTransaction:
			return [GovernanceAccountType.ProposalVersionedTransaction, GovernanceAccountType.ProposalTransactionBuffer];
		case RealmConfigAccount:
			return [GovernanceAccountType.RealmConfig];
		case Governance:
			return [
				GovernanceAccountType.GovernanceV1,
				GovernanceAccountType.ProgramGovernanceV1,
				GovernanceAccountType.MintGovernanceV1,
				GovernanceAccountType.TokenGovernanceV1,
				GovernanceAccountType.GovernanceV2,
				GovernanceAccountType.ProgramGovernanceV2,
				GovernanceAccountType.MintGovernanceV2,
				GovernanceAccountType.TokenGovernanceV2,
			];
		case ProgramMetadata:
			return [GovernanceAccountType.ProgramMetadata];
		default:
			throw Error(`${accountClass} account is not supported`);
	}
}

export function getGovernanceAccountVersion(accountType: GovernanceAccountType) {
	switch (accountType) {
		case GovernanceAccountType.VoteRecordV2:
		case GovernanceAccountType.ProposalTransactionV2:
		case GovernanceAccountType.ProposalV2:
		case GovernanceAccountType.RealmV2:
		case GovernanceAccountType.TokenOwnerRecordV2:
		case GovernanceAccountType.GovernanceV2:
		case GovernanceAccountType.ProgramGovernanceV2:
		case GovernanceAccountType.MintGovernanceV2:
		case GovernanceAccountType.TokenGovernanceV2:
		case GovernanceAccountType.SignatoryRecordV2:
		case GovernanceAccountType.ProposalTransactionBuffer:
		case GovernanceAccountType.ProposalVersionedTransaction:
			return ACCOUNT_VERSION_V2;
		default:
			return ACCOUNT_VERSION_V1;
	}
}

export enum VoteThresholdType {
	// Approval Quorum
	YesVotePercentage = 0,
	// Not supported in the current version
	QuorumPercentage = 1,
	// Supported for VERSION >= 3
	Disabled = 2,
}

export class VoteThreshold {
	type: VoteThresholdType;
	value: number | undefined;

	constructor(args: { type: VoteThresholdType; value?: number | undefined }) {
		this.type = args.type;
		this.value = args.value;
	}
}

export enum VoteTipping {
	Strict = 0,
	Early = 1, // V2 Only
	Disabled = 2, // V2 Only
}

export enum InstructionExecutionStatus {
	None = 0,
	Success = 1,
	Error = 2,
}

export enum InstructionExecutionFlags {
	None = 0,
	Ordered = 1,
	UseTransaction = 2,
}

export enum MintMaxVoteWeightSourceType {
	SupplyFraction = 0,
	Absolute = 1,
}

export class MintMaxVoteWeightSource {
	type: MintMaxVoteWeightSourceType;
	value: BN;

	constructor(args: { type: MintMaxVoteWeightSourceType; value: BN }) {
		this.type = args.type;
		this.value = args.value;
	}

	static SUPPLY_FRACTION_BASE = new BN(10000000000);
	static SUPPLY_FRACTION_DECIMALS = 10;

	static FULL_SUPPLY_FRACTION = new MintMaxVoteWeightSource({
		type: MintMaxVoteWeightSourceType.SupplyFraction,
		value: MintMaxVoteWeightSource.SUPPLY_FRACTION_BASE,
	});

	isFullSupply() {
		return (
			this.type === MintMaxVoteWeightSourceType.SupplyFraction &&
			this.value.cmp(MintMaxVoteWeightSource.SUPPLY_FRACTION_BASE) === 0
		);
	}
	getSupplyFraction() {
		if (this.type !== MintMaxVoteWeightSourceType.SupplyFraction) {
			throw new Error("Max vote weight is not fraction");
		}

		return this.value;
	}
	fmtSupplyFractionPercentage() {
		return new BigNumber(this.getSupplyFraction() as any)
			.shiftedBy(-MintMaxVoteWeightSource.SUPPLY_FRACTION_DECIMALS + 2)
			.toFormat();
	}
}

export enum VoteTypeKind {
	SingleChoice = 0,
	MultiChoice = 1,
}

export enum MultiChoiceType {
	FullWeight = 0,
	Weighted = 1,
}

export class VoteType {
	type: VoteTypeKind;
	choiceType: MultiChoiceType | undefined;
	minVoterOptions: number | undefined;
	maxVoterOptions: number | undefined;
	maxWinningOptions: number | undefined;

	constructor(args: {
		type: VoteTypeKind;
		choiceType: MultiChoiceType | undefined;
		minVoterOptions: number | undefined;
		maxVoterOptions: number | undefined;
		maxWinningOptions: number | undefined;
	}) {
		this.type = args.type;
		this.choiceType = args.choiceType;
		this.minVoterOptions = args.minVoterOptions;
		this.maxVoterOptions = args.maxVoterOptions;
		this.maxWinningOptions = args.maxWinningOptions;
	}

	static SINGLE_CHOICE = new VoteType({
		type: VoteTypeKind.SingleChoice,
		choiceType: undefined,
		minVoterOptions: undefined,
		maxVoterOptions: undefined,
		maxWinningOptions: undefined,
	});

	static MULTI_CHOICE = (
		choiceType: MultiChoiceType,
		minVoterOptions: number,
		maxVoterOptions: number,
		maxWinningOptions: number,
	) =>
		new VoteType({
			type: VoteTypeKind.MultiChoice,
			choiceType,
			minVoterOptions,
			maxVoterOptions,
			maxWinningOptions,
		});

	isSingleChoice() {
		return this.type === VoteTypeKind.SingleChoice;
	}
}

export class RealmConfigArgs {
	useCouncilMint: boolean;
	communityMintMaxVoteWeightSource: MintMaxVoteWeightSource;
	minCommunityTokensToCreateGovernance: BN;

	// Version == 2
	useCommunityVoterWeightAddin: boolean;
	useMaxCommunityVoterWeightAddin: boolean;

	// Versions >= 3
	communityTokenConfigArgs: GoverningTokenConfigArgs;
	councilTokenConfigArgs: GoverningTokenConfigArgs;

	constructor(args: {
		useCouncilMint: boolean;

		minCommunityTokensToCreateGovernance: BN;
		communityMintMaxVoteWeightSource: MintMaxVoteWeightSource;

		// Version == 2
		useCommunityVoterWeightAddin: boolean;
		useMaxCommunityVoterWeightAddin: boolean;

		// Versions >= 3
		communityTokenConfigArgs: GoverningTokenConfigArgs;
		councilTokenConfigArgs: GoverningTokenConfigArgs;
	}) {
		this.useCouncilMint = !!args.useCouncilMint;
		this.communityMintMaxVoteWeightSource = args.communityMintMaxVoteWeightSource;
		this.minCommunityTokensToCreateGovernance = args.minCommunityTokensToCreateGovernance;

		this.useCommunityVoterWeightAddin = args.useCommunityVoterWeightAddin;
		this.useMaxCommunityVoterWeightAddin = args.useMaxCommunityVoterWeightAddin;

		this.communityTokenConfigArgs = args.communityTokenConfigArgs;
		this.councilTokenConfigArgs = args.councilTokenConfigArgs;
	}
}

export enum GoverningTokenType {
	Liquid = 0,
	Membership = 1,
	Dormant = 2,
}

export class GoverningTokenConfigArgs {
	useVoterWeightAddin: boolean;
	useMaxVoterWeightAddin: boolean;
	tokenType: GoverningTokenType;

	constructor(args: {
		useVoterWeightAddin: boolean;
		useMaxVoterWeightAddin: boolean;
		tokenType: GoverningTokenType;
	}) {
		this.useVoterWeightAddin = args.useVoterWeightAddin;
		this.useMaxVoterWeightAddin = args.useMaxVoterWeightAddin;
		this.tokenType = args.tokenType;
	}
}

export class GoverningTokenConfigAccountArgs {
	voterWeightAddin: PublicKey | undefined;
	maxVoterWeightAddin: PublicKey | undefined;
	tokenType: GoverningTokenType;

	constructor(args: {
		voterWeightAddin: PublicKey | undefined;
		maxVoterWeightAddin: PublicKey | undefined;
		tokenType: GoverningTokenType;
	}) {
		this.voterWeightAddin = args.voterWeightAddin;
		this.maxVoterWeightAddin = args.maxVoterWeightAddin;
		this.tokenType = args.tokenType;
	}
}

export class RealmConfig {
	councilMint: PublicKey | undefined;
	communityMintMaxVoteWeightSource: MintMaxVoteWeightSource;
	minCommunityTokensToCreateGovernance: BN;

	// VERSION == 2
	useCommunityVoterWeightAddin: boolean;
	useMaxCommunityVoterWeightAddin: boolean;

	reserved: Uint8Array;

	constructor(args: {
		councilMint: PublicKey | undefined;
		communityMintMaxVoteWeightSource: MintMaxVoteWeightSource;
		minCommunityTokensToCreateGovernance: BN;
		reserved: Uint8Array;
		useCommunityVoterWeightAddin: boolean;
		useMaxCommunityVoterWeightAddin: boolean;
	}) {
		this.councilMint = args.councilMint;
		this.communityMintMaxVoteWeightSource = args.communityMintMaxVoteWeightSource;
		this.minCommunityTokensToCreateGovernance = args.minCommunityTokensToCreateGovernance;
		this.useCommunityVoterWeightAddin = !!args.useCommunityVoterWeightAddin;
		this.useMaxCommunityVoterWeightAddin = !!args.useMaxCommunityVoterWeightAddin;
		this.reserved = args.reserved;
	}
}

export class Realm {
	accountType = GovernanceAccountType.RealmV1;

	communityMint: PublicKey;

	config: RealmConfig;

	reserved: Uint8Array;

	// Not used in versions >= V3 / legacy1
	votingProposalCount: number;

	authority: PublicKey | undefined;

	name: string;

	constructor(args: {
		communityMint: PublicKey;
		reserved: Uint8Array;
		config: RealmConfig;
		votingProposalCount: number;
		authority: PublicKey | undefined;
		name: string;
	}) {
		this.communityMint = args.communityMint;
		this.config = args.config;
		this.reserved = args.reserved;
		this.votingProposalCount = args.votingProposalCount;
		this.authority = args.authority;
		this.name = args.name;
	}
}

export async function getTokenHoldingAddress(programId: PublicKey, realm: PublicKey, governingTokenMint: PublicKey) {
	const [tokenHoldingAddress] = await PublicKey.findProgramAddress(
		[Buffer.from(GOVERNANCE_PROGRAM_SEED), realm.toBuffer(), governingTokenMint.toBuffer()],
		programId,
	);

	return tokenHoldingAddress;
}

export class GoverningTokenConfig {
	voterWeightAddin: PublicKey | undefined;
	maxVoterWeightAddin: PublicKey | undefined;
	tokenType: GoverningTokenType;
	reserved: Uint8Array;

	constructor(args: {
		voterWeightAddin: PublicKey | undefined;
		maxVoterWeightAddin: PublicKey | undefined;
		tokenType: GoverningTokenType;
		reserved: Uint8Array;
	}) {
		this.voterWeightAddin = args.voterWeightAddin;
		this.maxVoterWeightAddin = args.maxVoterWeightAddin;
		this.tokenType = args.tokenType;
		this.reserved = args.reserved;
	}
}

export class RealmConfigAccount {
	accountType = GovernanceAccountType.RealmConfig;

	realm: PublicKey;
	communityTokenConfig: GoverningTokenConfig;
	councilTokenConfig: GoverningTokenConfig;

	reserved: Uint8Array;

	constructor(args: {
		realm: PublicKey;
		communityTokenConfig: GoverningTokenConfig;
		councilTokenConfig: GoverningTokenConfig;
		reserved: Uint8Array;
	}) {
		this.realm = args.realm;
		this.communityTokenConfig = args.communityTokenConfig;
		this.councilTokenConfig = args.councilTokenConfig;
		this.reserved = args.reserved;
	}
}

export async function getRealmConfigAddress(programId: PublicKey, realm: PublicKey) {
	const [realmConfigAddress] = await PublicKey.findProgramAddress(
		[Buffer.from("realm-config"), realm.toBuffer()],
		programId,
	);

	return realmConfigAddress;
}

export class GovernanceConfig {
	communityVoteThreshold: VoteThreshold;

	minCommunityTokensToCreateProposal: BN;
	minInstructionHoldUpTime: number;
	baseVotingTime: number;
	communityVoteTipping: VoteTipping;
	minCouncilTokensToCreateProposal: BN;

	// VERSION >= 3
	councilVoteThreshold: VoteThreshold;
	councilVetoVoteThreshold: VoteThreshold;
	communityVetoVoteThreshold: VoteThreshold;
	councilVoteTipping: VoteTipping;
	votingCoolOffTime: number;
	depositExemptProposalCount: number;

	constructor(args: {
		communityVoteThreshold: VoteThreshold;
		minCommunityTokensToCreateProposal: BN;
		minInstructionHoldUpTime: number;
		baseVotingTime: number;
		communityVoteTipping?: VoteTipping;
		minCouncilTokensToCreateProposal: BN;

		// VERSION >= 3
		// For versions < 3 must be set to YesVotePercentage(0)
		councilVoteThreshold: VoteThreshold;
		councilVetoVoteThreshold: VoteThreshold;
		communityVetoVoteThreshold: VoteThreshold;
		councilVoteTipping: VoteTipping;
		votingCoolOffTime: number;
		depositExemptProposalCount: number;
	}) {
		this.communityVoteThreshold = args.communityVoteThreshold;
		this.minCommunityTokensToCreateProposal = args.minCommunityTokensToCreateProposal;
		this.minInstructionHoldUpTime = args.minInstructionHoldUpTime;
		this.baseVotingTime = args.baseVotingTime;
		this.communityVoteTipping = args.communityVoteTipping ?? VoteTipping.Strict;
		this.minCouncilTokensToCreateProposal = args.minCouncilTokensToCreateProposal;

		// VERSION >= 3
		this.councilVoteThreshold = args.councilVoteThreshold ?? args.communityVoteThreshold;
		this.councilVetoVoteThreshold = args.councilVetoVoteThreshold ?? args.communityVoteThreshold;

		this.communityVetoVoteThreshold =
			args.communityVetoVoteThreshold ?? new VoteThreshold({ type: VoteThresholdType.Disabled });

		this.councilVoteTipping = args.councilVoteTipping ?? this.communityVoteTipping;

		this.votingCoolOffTime = args.votingCoolOffTime;
		this.depositExemptProposalCount = args.depositExemptProposalCount;
	}
}

export class Governance {
	accountType: GovernanceAccountType;
	realm: PublicKey;
	governedAccount: PublicKey;
	config: GovernanceConfig;
	// proposalCount is not used for  >= V3
	proposalCount: number;
	reserved?: Uint8Array;

	// V3
	activeProposalCount: BN;

	constructor(args: {
		realm: PublicKey;
		governedAccount: PublicKey;
		accountType: number;
		config: GovernanceConfig;
		reserved?: Uint8Array;
		proposalCount: number;
		activeProposalCount: BN;
	}) {
		this.accountType = args.accountType;
		this.realm = args.realm;
		this.governedAccount = args.governedAccount;
		this.config = args.config;
		this.reserved = args.reserved;
		this.proposalCount = args.proposalCount;
		this.activeProposalCount = args.activeProposalCount;
	}

	isProgramGovernance() {
		return (
			this.accountType === GovernanceAccountType.ProgramGovernanceV1 ||
			this.accountType === GovernanceAccountType.ProgramGovernanceV2
		);
	}

	isAccountGovernance() {
		return (
			this.accountType === GovernanceAccountType.GovernanceV1 || this.accountType === GovernanceAccountType.GovernanceV2
		);
	}

	isMintGovernance() {
		return (
			this.accountType === GovernanceAccountType.MintGovernanceV1 ||
			this.accountType === GovernanceAccountType.MintGovernanceV2
		);
	}

	isTokenGovernance() {
		return (
			this.accountType === GovernanceAccountType.TokenGovernanceV1 ||
			this.accountType === GovernanceAccountType.TokenGovernanceV2
		);
	}
}

export class TokenOwnerRecord {
	accountType = GovernanceAccountType.TokenOwnerRecordV1;

	realm: PublicKey;

	governingTokenMint: PublicKey;

	governingTokenOwner: PublicKey;

	governingTokenDepositAmount: BN;

	unrelinquishedVotesCount: number;

	// Not used in versions >= V3 / I'ts the upper 4 bytes of unrelinquishedVotesCount
	totalVotesCount: number;

	outstandingProposalCount: number;

	reserved: Uint8Array;

	governanceDelegate?: PublicKey;

	// V3
	version: number;

	constructor(args: {
		realm: PublicKey;
		governingTokenMint: PublicKey;
		governingTokenOwner: PublicKey;
		governingTokenDepositAmount: BN;
		unrelinquishedVotesCount: number;
		totalVotesCount: number;
		outstandingProposalCount: number;
		reserved: Uint8Array;
		governanceDelegate: PublicKey | undefined;
		version: number;
	}) {
		this.realm = args.realm;
		this.governingTokenMint = args.governingTokenMint;
		this.governingTokenOwner = args.governingTokenOwner;
		this.governingTokenDepositAmount = args.governingTokenDepositAmount;
		this.unrelinquishedVotesCount = args.unrelinquishedVotesCount;
		this.totalVotesCount = args.totalVotesCount;
		this.outstandingProposalCount = args.outstandingProposalCount;
		this.reserved = args.reserved;
		this.governanceDelegate = args.governanceDelegate;
		this.version = args.version;
	}
}

export async function getTokenOwnerRecordAddress(
	programId: PublicKey,
	realm: PublicKey,
	governingTokenMint: PublicKey,
	governingTokenOwner: PublicKey,
) {
	const [tokenOwnerRecordAddress] = await PublicKey.findProgramAddress(
		[
			Buffer.from(GOVERNANCE_PROGRAM_SEED),
			realm.toBuffer(),
			governingTokenMint.toBuffer(),
			governingTokenOwner.toBuffer(),
		],
		programId,
	);

	return tokenOwnerRecordAddress;
}

export enum ProposalState {
	Draft = 0,

	SigningOff = 1,

	Voting = 2,

	Succeeded = 3,

	Executing = 4,

	Completed = 5,

	Cancelled = 6,

	Defeated = 7,

	ExecutingWithErrors = 8,

	Vetoed = 9,
}

export enum OptionVoteResult {
	None = 0,
	Succeeded = 1,
	Defeated = 2,
}

export class ProposalOption {
	label: string;
	voteWeight: BN;
	voteResult: OptionVoteResult;

	instructionsExecutedCount: number;
	instructionsCount: number;
	instructionsNextIndex: number;

	constructor(args: {
		label: string;
		voteWeight: BN;
		voteResult: OptionVoteResult;
		instructionsExecutedCount: number;
		instructionsCount: number;
		instructionsNextIndex: number;
	}) {
		this.label = args.label;
		this.voteWeight = args.voteWeight;
		this.voteResult = args.voteResult;
		this.instructionsExecutedCount = args.instructionsExecutedCount;
		this.instructionsCount = args.instructionsCount;
		this.instructionsNextIndex = args.instructionsNextIndex;
	}
}

export class Proposal {
	accountType: GovernanceAccountType;

	governance: PublicKey;

	governingTokenMint: PublicKey;

	state: ProposalState;

	tokenOwnerRecord: PublicKey;

	signatoriesCount: number;

	signatoriesSignedOffCount: number;

	// V1 -----------------------------
	yesVotesCount: BN;
	noVotesCount: BN;
	instructionsExecutedCount: number;
	instructionsCount: number;
	instructionsNextIndex: number;
	// --------------------------------

	// V2 -----------------------------
	voteType: VoteType;
	options: ProposalOption[];
	denyVoteWeight: BN | undefined;
	reserved1: number;
	abstainVoteWeight: BN | undefined;
	startVotingAt: BN | null;
	maxVotingTime: number | null;
	// --------------------------------

	draftAt: BN;

	signingOffAt: BN | null;

	votingAt: BN | null;

	votingAtSlot: BN | null;

	votingCompletedAt: BN | null;

	executingAt: BN | null;

	closedAt: BN | null;

	executionFlags: InstructionExecutionFlags;

	maxVoteWeight: BN | null;
	voteThreshold: VoteThreshold | null;

	name: string;

	descriptionLink: string;

	// V3
	vetoVoteWeight: BN;

	constructor(args: {
		accountType: GovernanceAccountType;
		governance: PublicKey;
		governingTokenMint: PublicKey;
		state: ProposalState;
		tokenOwnerRecord: PublicKey;
		signatoriesCount: number;
		signatoriesSignedOffCount: number;
		descriptionLink: string;
		name: string;
		// V1
		yesVotesCount: BN;
		noVotesCount: BN;
		instructionsExecutedCount: number;
		instructionsCount: number;
		instructionsNextIndex: number;
		//

		// V2
		voteType: VoteType;
		options: ProposalOption[];
		denyVoteWeight: BN | undefined;
		reserved1: number;
		abstainVoteWeight: BN | undefined;
		startVotingAt: BN | null;
		maxVotingTime: number | null;
		//

		draftAt: BN;
		signingOffAt: BN | null;
		votingAt: BN | null;
		votingAtSlot: BN | null;
		votingCompletedAt: BN | null;
		executingAt: BN | null;
		closedAt: BN | null;

		executionFlags: InstructionExecutionFlags;
		maxVoteWeight: BN | null;
		voteThreshold: VoteThreshold | null;

		// V3
		vetoVoteWeight: BN;
	}) {
		this.accountType = args.accountType;
		this.governance = args.governance;
		this.governingTokenMint = args.governingTokenMint;
		this.state = args.state;
		this.tokenOwnerRecord = args.tokenOwnerRecord;
		this.signatoriesCount = args.signatoriesCount;
		this.signatoriesSignedOffCount = args.signatoriesSignedOffCount;
		this.descriptionLink = args.descriptionLink;
		this.name = args.name;

		// V1
		this.yesVotesCount = args.yesVotesCount;
		this.noVotesCount = args.noVotesCount;
		this.instructionsExecutedCount = args.instructionsExecutedCount;
		this.instructionsCount = args.instructionsCount;
		this.instructionsNextIndex = args.instructionsNextIndex;
		//

		// V2
		this.voteType = args.voteType;
		this.options = args.options;
		this.denyVoteWeight = args.denyVoteWeight;
		this.reserved1 = args.reserved1;
		this.abstainVoteWeight = args.abstainVoteWeight;

		this.startVotingAt = args.startVotingAt;
		this.maxVotingTime = args.maxVotingTime;

		this.draftAt = args.draftAt;
		this.signingOffAt = args.signingOffAt;
		this.votingAt = args.votingAt;
		this.votingAtSlot = args.votingAtSlot;
		this.votingCompletedAt = args.votingCompletedAt;
		this.executingAt = args.executingAt;
		this.closedAt = args.closedAt;

		this.executionFlags = args.executionFlags;
		this.maxVoteWeight = args.maxVoteWeight;
		this.voteThreshold = args.voteThreshold;

		// V3
		this.vetoVoteWeight = args.vetoVoteWeight;
	}

	/// Returns true if Proposal is in state when no voting can happen any longer
	isVoteFinalized(): boolean {
		switch (this.state) {
			case ProposalState.Succeeded:
			case ProposalState.Executing:
			case ProposalState.Completed:
			case ProposalState.Cancelled:
			case ProposalState.Defeated:
			case ProposalState.ExecutingWithErrors:
			case ProposalState.Vetoed:
				return true;
			case ProposalState.Draft:
			case ProposalState.SigningOff:
			case ProposalState.Voting:
				return false;
		}
	}

	isFinalState(): boolean {
		// 1) ExecutingWithErrors is not really a final state, it's undefined.
		//    However it usually indicates none recoverable execution error so we treat is as final for the ui purposes
		// 2) Succeeded with no instructions is also treated as final since it can't transition any longer
		//    It really doesn't make any sense but until it's solved in the program we have to consider it as final in the ui
		switch (this.state) {
			case ProposalState.Completed:
			case ProposalState.Cancelled:
			case ProposalState.Defeated:
			case ProposalState.ExecutingWithErrors:
			case ProposalState.Vetoed:
				return true;
			case ProposalState.Succeeded:
				return this.instructionsCount === 0;
			case ProposalState.Executing:
			case ProposalState.Draft:
			case ProposalState.SigningOff:
			case ProposalState.Voting:
				return false;
		}
	}

	getStateTimestamp(): number {
		switch (this.state) {
			case ProposalState.Succeeded:
			case ProposalState.Defeated:
			case ProposalState.Vetoed:
				return this.votingCompletedAt ? this.votingCompletedAt.toNumber() : 0;
			case ProposalState.Completed:
			case ProposalState.Cancelled:
				return this.closedAt ? this.closedAt.toNumber() : 0;
			case ProposalState.Executing:
			case ProposalState.ExecutingWithErrors:
				return this.executingAt ? this.executingAt.toNumber() : 0;
			case ProposalState.Draft:
				return this.draftAt.toNumber();
			case ProposalState.SigningOff:
				return this.signingOffAt ? this.signingOffAt.toNumber() : 0;
			case ProposalState.Voting:
				return this.votingAt ? this.votingAt.toNumber() : 0;
		}
	}

	getStateSortRank(): number {
		// Always show proposals in voting state at the top
		if (this.state === ProposalState.Voting) {
			return 2;
		}
		// Then show proposals in pending state and finalized at the end
		return this.isFinalState() ? 0 : 1;
	}

	/// Returns true if Proposal has not been voted on yet
	isPreVotingState() {
		return !this.votingAtSlot;
	}

	getYesVoteOption() {
		if (this.options.length !== 1 && !this.voteType.isSingleChoice()) {
			throw new Error("Proposal is not Yes/No vote");
		}

		return this.options[0];
	}

	getYesVoteCount() {
		switch (this.accountType) {
			case GovernanceAccountType.ProposalV1:
				return this.yesVotesCount;
			case GovernanceAccountType.ProposalV2:
				return this.getYesVoteOption().voteWeight;
			default:
				throw new Error(`Invalid account type ${this.accountType}`);
		}
	}

	getNoVoteCount() {
		switch (this.accountType) {
			case GovernanceAccountType.ProposalV1:
				return this.noVotesCount;
			case GovernanceAccountType.ProposalV2:
				return this.denyVoteWeight as BN;
			default:
				throw new Error(`Invalid account type ${this.accountType}`);
		}
	}

	getTimeToVoteEnd(governance: Governance) {
		const unixTimestampInSeconds = Date.now() / 1000;

		const baseVotingTime = this.isPreVotingState()
			? governance.config.baseVotingTime
			: (this.votingAt?.toNumber() ?? 0) + governance.config.baseVotingTime - unixTimestampInSeconds;

		return baseVotingTime + governance.config.votingCoolOffTime;
	}

	hasVoteTimeEnded(governance: Governance) {
		return this.getTimeToVoteEnd(governance) <= 0;
	}

	canCancel(governance: Governance) {
		if (this.state === ProposalState.Draft || this.state === ProposalState.SigningOff) {
			return true;
		}

		if (this.state === ProposalState.Voting && !this.hasVoteTimeEnded(governance)) {
			return true;
		}

		return false;
	}

	canWalletCancel(governance: Governance, proposalOwner: TokenOwnerRecord, walletPk: PublicKey) {
		if (!this.canCancel(governance)) {
			return false;
		}
		return proposalOwner.governingTokenOwner.equals(walletPk) || proposalOwner.governanceDelegate?.equals(walletPk);
	}
}

export class ProposalDeposit {
	accountType: GovernanceAccountType = GovernanceAccountType.ProposalDeposit;
	proposal: PublicKey;
	depositPayer: PublicKey;

	constructor(args: { proposal: PublicKey; depositPayer: PublicKey }) {
		this.proposal = args.proposal;
		this.depositPayer = args.depositPayer;
	}
}

export class SignatoryRecord {
	accountType: GovernanceAccountType = GovernanceAccountType.SignatoryRecordV1;
	proposal: PublicKey;
	signatory: PublicKey;
	signedOff: boolean;

	constructor(args: {
		proposal: PublicKey;
		signatory: PublicKey;
		signedOff: boolean;
	}) {
		this.proposal = args.proposal;
		this.signatory = args.signatory;
		this.signedOff = !!args.signedOff;
	}
}

export async function getSignatoryRecordAddress(programId: PublicKey, proposal: PublicKey, signatory: PublicKey) {
	const [signatoryRecordAddress] = await PublicKey.findProgramAddress(
		[Buffer.from(GOVERNANCE_PROGRAM_SEED), proposal.toBuffer(), signatory.toBuffer()],
		programId,
	);

	return signatoryRecordAddress;
}

export class VoteWeight {
	yes: BN;
	no: BN;

	constructor(args: { yes: BN; no: BN }) {
		this.yes = args.yes;
		this.no = args.no;
	}
}

export class VoteRecord {
	accountType: GovernanceAccountType;
	proposal: PublicKey;
	governingTokenOwner: PublicKey;
	isRelinquished: boolean;

	// V1
	voteWeight: VoteWeight | undefined;

	// V2 -------------------------------
	voterWeight: BN | undefined;
	vote: Vote | undefined;
	// -------------------------------

	constructor(args: {
		accountType: GovernanceAccountType;
		proposal: PublicKey;
		governingTokenOwner: PublicKey;
		isRelinquished: boolean;
		// V1
		voteWeight: VoteWeight | undefined;
		// V2 -------------------------------
		voterWeight: BN | undefined;
		vote: Vote | undefined;
		// -------------------------------
	}) {
		this.accountType = args.accountType;
		this.proposal = args.proposal;
		this.governingTokenOwner = args.governingTokenOwner;
		this.isRelinquished = !!args.isRelinquished;
		// V1
		this.voteWeight = args.voteWeight;
		// V2 -------------------------------
		this.voterWeight = args.voterWeight;
		this.vote = args.vote;
		// -------------------------------
	}

	getNoVoteWeight() {
		switch (this.accountType) {
			case GovernanceAccountType.VoteRecordV1: {
				return this.voteWeight?.no;
			}
			case GovernanceAccountType.VoteRecordV2: {
				switch (this.vote?.voteType) {
					case VoteKind.Approve: {
						return undefined;
					}
					case VoteKind.Deny: {
						return this.voterWeight;
					}
					default:
						throw new Error("Invalid voteKind");
				}
			}
			default:
				throw new Error(`Invalid account type ${this.accountType} `);
		}
	}
	getYesVoteWeight() {
		switch (this.accountType) {
			case GovernanceAccountType.VoteRecordV1: {
				return this.voteWeight?.yes;
			}
			case GovernanceAccountType.VoteRecordV2: {
				switch (this.vote?.voteType) {
					case VoteKind.Approve: {
						return this.voterWeight;
					}
					case VoteKind.Deny: {
						return undefined;
					}
					default:
						throw new Error("Invalid voteKind");
				}
			}
			default:
				throw new Error(`Invalid account type ${this.accountType} `);
		}
	}
}

export async function getVoteRecordAddress(programId: PublicKey, proposal: PublicKey, tokenOwnerRecord: PublicKey) {
	const [voteRecordAddress] = await PublicKey.findProgramAddress(
		[Buffer.from(GOVERNANCE_PROGRAM_SEED), proposal.toBuffer(), tokenOwnerRecord.toBuffer()],
		programId,
	);

	return voteRecordAddress;
}

export class AccountMetaData {
	pubkey: PublicKey;
	isSigner: boolean;
	isWritable: boolean;

	constructor(args: {
		pubkey: PublicKey;
		isSigner: boolean;
		isWritable: boolean;
	}) {
		this.pubkey = args.pubkey;
		this.isSigner = !!args.isSigner;
		this.isWritable = !!args.isWritable;
	}
}

export class InstructionData {
	programId: PublicKey;
	accounts: AccountMetaData[];
	data: Uint8Array;

	constructor(args: {
		programId: PublicKey;
		accounts: AccountMetaData[];
		data: Uint8Array;
	}) {
		this.programId = args.programId;
		this.accounts = args.accounts;
		this.data = args.data;
	}
}

export class ProposalTransaction {
	accountType;
	proposal: PublicKey;
	instructionIndex: number;

	// V1
	instruction: InstructionData;

	// V2
	optionIndex: number;
	instructions: InstructionData[];

	holdUpTime: number;

	executedAt: BN | null;
	executionStatus: InstructionExecutionStatus;

	constructor(args: {
		accountType: GovernanceAccountType;
		proposal: PublicKey;
		instructionIndex: number;
		optionIndex: number;
		holdUpTime: number;
		instruction: InstructionData;
		executedAt: BN | null;
		executionStatus: InstructionExecutionStatus;
		instructions: InstructionData[];
	}) {
		this.accountType = args.accountType;
		this.proposal = args.proposal;
		this.instructionIndex = args.instructionIndex;
		this.optionIndex = args.optionIndex;
		this.holdUpTime = args.holdUpTime;
		this.instruction = args.instruction;
		this.executedAt = args.executedAt;
		this.executionStatus = args.executionStatus;
		this.instructions = args.instructions;
	}

	getSingleInstruction() {
		if (this.accountType === GovernanceAccountType.ProposalInstructionV1) {
			return this.instruction;
		}

		if (this.instructions.length === 0) {
			throw new Error("Transaction has no instructions");
		}
		if (this.instructions.length > 1) {
			throw new Error("Transaction has multiple instructions");
		}

		return this.instructions[0];
	}

	getAllInstructions() {
		if (this.accountType === GovernanceAccountType.ProposalInstructionV1) {
			return [this.instruction];
		}

		return this.instructions;
	}
}

export class ProposalTransactionBuffer {
	accountType: GovernanceAccountType;
	proposal: PublicKey;
	creator: PublicKey;
	bufferIndex: number;
	finalBufferHash: Uint8Array;
	finalBufferSize: number;
	buffer: Uint8Array;

	constructor(args: {
		accountType: GovernanceAccountType;
		proposal: PublicKey;
		creator: PublicKey;
		bufferIndex: number;
		finalBufferHash: Uint8Array;
		finalBufferSize: number;
		buffer: Uint8Array;
	}) {
		// Validate buffer hash length
		if (args.finalBufferHash.length !== 32) {
			throw new Error("Final buffer hash must be 32 bytes");
		}

		this.accountType = args.accountType;
		this.proposal = args.proposal;
		this.creator = args.creator;
		this.bufferIndex = args.bufferIndex;
		this.finalBufferHash = args.finalBufferHash;
		this.finalBufferSize = args.finalBufferSize;
		this.buffer = args.buffer;
	}

	validateBuffer(): boolean {
		return this.buffer.length === this.finalBufferSize;
	}

	// Method to serialize the buffer for on-chain storage
	serialize(): Uint8Array {
		// Implementation would depend on your specific serialization needs
		// This is a basic example
		const serialized = new Uint8Array(this.buffer.length + 40); // 40 bytes for metadata
		let offset = 0;

		// Write metadata
		serialized.set([this.accountType], offset);
		offset += 1;

		serialized.set(this.proposal.toBytes(), offset);
		offset += 32;

		serialized.set([this.bufferIndex], offset);
		offset += 1;

		serialized.set(new Uint8Array(new Uint16Array([this.finalBufferSize]).buffer), offset);
		offset += 2;

		// Write buffer content
		serialized.set(this.buffer, offset);

		return serialized;
	}
}

// Enum for transaction execution status
export enum TransactionExecutionStatus {
	None = "None",
	Success = "Success",
	Error = "Error",
}

export class VersionedTransactionMessageAddressTableLookup {
	accountKey: PublicKey;
	writableIndexes: number[];
	readonlyIndexes: number[];

	constructor(args: {
		accountKey: PublicKey;
		writableIndexes: number[];
		readonlyIndexes: number[];
	}) {
		this.accountKey = args.accountKey;
		this.writableIndexes = args.writableIndexes;
		this.readonlyIndexes = args.readonlyIndexes;
	}
}

export class ProposalCompiledInstruction {
	programIdIndex: number;
	accountIndexes: number[];
	data: Uint8Array;

	constructor(args: {
		programIdIndex: number;
		accountIndexes: number[];
		data: Uint8Array;
	}) {
		for (const index of args.accountIndexes) {
			if (index > 255) {
				throw new Error("Account indexes must be u8 (0-255)");
			}
		}
		this.programIdIndex = args.programIdIndex;
		this.accountIndexes = args.accountIndexes;
		this.data = args.data;
	}

	getProgramIdIndex(): number {
		return this.programIdIndex;
	}

	getAccountIndexes(): number[] {
		return this.accountIndexes;
	}

	getData(): Uint8Array {
		return this.data;
	}

	serialize(): Uint8Array {
		// Layout:
		// 1 byte - programIdIndex (u8)
		// 4 bytes - accountIndexes length (u32)
		// N bytes - accountIndexes array
		// 4 bytes - data length (u32)
		// M bytes - data array
		const buffer = new Uint8Array(1 + 4 + this.accountIndexes.length + 4 + this.data.length);
		let offset = 0;

		// Write programIdIndex
		buffer[offset] = this.programIdIndex;
		offset += 1;

		// Write accountIndexes length (u32)
		buffer[offset++] = this.accountIndexes.length & 0xff;
		buffer[offset++] = (this.accountIndexes.length >> 8) & 0xff;
		buffer[offset++] = (this.accountIndexes.length >> 16) & 0xff;
		buffer[offset++] = (this.accountIndexes.length >> 24) & 0xff;

		// Write accountIndexes
		buffer.set(this.accountIndexes, offset);
		offset += this.accountIndexes.length;

		// Write data length (u32)
		buffer[offset++] = this.data.length & 0xff;
		buffer[offset++] = (this.data.length >> 8) & 0xff;
		buffer[offset++] = (this.data.length >> 16) & 0xff;
		buffer[offset++] = (this.data.length >> 24) & 0xff;

		// Write data
		buffer.set(this.data, offset);

		return buffer;
	}
}

// Class for transaction message
export class ProposalTransactionMessage {
	numSigners: number;
	numWritableSigners: number;
	numWritableNonSigners: number;
	accountKeys: PublicKey[];
	instructions: ProposalCompiledInstruction[];
	addressTableLookups: VersionedTransactionMessageAddressTableLookup[];

	constructor(args: {
		numSigners: number;
		numWritableSigners: number;
		numWritableNonSigners: number;
		accountKeys: PublicKey[];
		instructions: ProposalCompiledInstruction[];
		addressTableLookups: VersionedTransactionMessageAddressTableLookup[];
	}) {
		if (args.numSigners > 255) throw new Error("Number of signers must be a u8 (0-255)");
		if (args.numWritableSigners > 255) throw new Error("Number of writable signers must be a u8 (0-255)");
		if (args.numWritableNonSigners > 255) throw new Error("Number of writable non-signers must be a u8 (0-255)");
		this.numSigners = args.numSigners;
		this.numWritableSigners = args.numWritableSigners;
		this.numWritableNonSigners = args.numWritableNonSigners;
		this.accountKeys = args.accountKeys;
		this.instructions = args.instructions;
		this.addressTableLookups = args.addressTableLookups;
	}
	getNumSigners(): number {
		return this.numSigners;
	}
	getNumWritableSigners(): number {
		return this.numWritableSigners;
	}
	getNumWritableNonSigners(): number {
		return this.numWritableNonSigners;
	}
	getAccountKeys(): PublicKey[] {
		return this.accountKeys;
	}
	getInstructions(): ProposalCompiledInstruction[] {
		return this.instructions;
	}
	getAddressTableLookups(): VersionedTransactionMessageAddressTableLookup[] {
		return this.addressTableLookups;
	}

	serialize(): Uint8Array {
		// Calculate total size needed
		const accountKeysSize = this.accountKeys.length * 32; // Each PublicKey is 32 bytes
		const instructionsSize = this.instructions.reduce((sum, instruction) => sum + instruction.serialize().length, 0);
		const addressTableLookupsSize = this.addressTableLookups.reduce(
			(sum, lookup) => sum + 32 + 4 + lookup.writableIndexes.length + 4 + lookup.readonlyIndexes.length,
			0,
		);

		// 3 bytes for the header numbers (numSigners, numWritableSigners, numWritableNonSigners)
		// 4 bytes for number of account keys
		// 4 bytes for number of instructions
		// 4 bytes for number of address table lookups
		const headerSize = 3 + 4 + 4 + 4;
		const totalSize = headerSize + accountKeysSize + instructionsSize + addressTableLookupsSize;

		const buffer = new Uint8Array(totalSize);
		let offset = 0;

		// Write header
		buffer[offset++] = this.numSigners;
		buffer[offset++] = this.numWritableSigners;
		buffer[offset++] = this.numWritableNonSigners;

		// Write account keys length (u32)
		buffer[offset++] = this.accountKeys.length & 0xff;
		buffer[offset++] = (this.accountKeys.length >> 8) & 0xff;
		buffer[offset++] = (this.accountKeys.length >> 16) & 0xff;
		buffer[offset++] = (this.accountKeys.length >> 24) & 0xff;

		// Write account keys
		for (const key of this.accountKeys) {
			buffer.set(key.toBytes(), offset);
			offset += 32;
		}

		// Write instructions length (u32)
		buffer[offset++] = this.instructions.length & 0xff;
		buffer[offset++] = (this.instructions.length >> 8) & 0xff;
		buffer[offset++] = (this.instructions.length >> 16) & 0xff;
		buffer[offset++] = (this.instructions.length >> 24) & 0xff;

		// Write instructions
		for (const instruction of this.instructions) {
			const serializedInstruction = instruction.serialize();
			buffer.set(serializedInstruction, offset);
			offset += serializedInstruction.length;
		}

		// Write address table lookups length (u32)
		buffer[offset++] = this.addressTableLookups.length & 0xff;
		buffer[offset++] = (this.addressTableLookups.length >> 8) & 0xff;
		buffer[offset++] = (this.addressTableLookups.length >> 16) & 0xff;
		buffer[offset++] = (this.addressTableLookups.length >> 24) & 0xff;

		// Write address table lookups
		for (const lookup of this.addressTableLookups) {
			// Write account key
			buffer.set(lookup.accountKey.toBytes(), offset);
			offset += 32;

			// Write writable indexes
			buffer[offset++] = lookup.writableIndexes.length & 0xff;
			buffer[offset++] = (lookup.writableIndexes.length >> 8) & 0xff;
			buffer[offset++] = (lookup.writableIndexes.length >> 16) & 0xff;
			buffer[offset++] = (lookup.writableIndexes.length >> 24) & 0xff;
			buffer.set(new Uint8Array(lookup.writableIndexes), offset);
			offset += lookup.writableIndexes.length;

			// Write readonly indexes
			buffer[offset++] = lookup.readonlyIndexes.length & 0xff;
			buffer[offset++] = (lookup.readonlyIndexes.length >> 8) & 0xff;
			buffer[offset++] = (lookup.readonlyIndexes.length >> 16) & 0xff;
			buffer[offset++] = (lookup.readonlyIndexes.length >> 24) & 0xff;
			buffer.set(new Uint8Array(lookup.readonlyIndexes), offset);
			offset += lookup.readonlyIndexes.length;
		}

		return buffer;
	}
}

// Main class for versioned transaction
export class ProposalVersionedTransaction {
	accountType: GovernanceAccountType;
	proposal: PublicKey;
	optionIndex: number;
	transactionIndex: number;
	executionIndex: number;
	executedAt: number | null;
	executionStatus: TransactionExecutionStatus;
	ephemeralSignerBumps: number[];
	message: ProposalTransactionMessage;

	constructor(args: {
		accountType: GovernanceAccountType;
		proposal: PublicKey;
		optionIndex: number;
		transactionIndex: number;
		executionIndex: number;
		executedAt: number | null;
		executionStatus: TransactionExecutionStatus;
		ephemeralSignerBumps: number[];
		message: ProposalTransactionMessage;
	}) {
		if (args.optionIndex > 255) throw new Error("Option index must be a u8 (0-255)");
		if (args.transactionIndex > 65535) throw new Error("Transaction index must be a u16 (0-65535)");
		if (args.executionIndex > 255) throw new Error("Execution index must be a u8 (0-255)");
		for (const bump of args.ephemeralSignerBumps) {
			if (bump > 255) throw new Error("Ephemeral signer bumps must be u8 (0-255)");
		}
		this.accountType = args.accountType;
		this.proposal = args.proposal;
		this.optionIndex = args.optionIndex;
		this.transactionIndex = args.transactionIndex;
		this.executionIndex = args.executionIndex;
		this.executedAt = args.executedAt;
		this.executionStatus = args.executionStatus;
		this.ephemeralSignerBumps = args.ephemeralSignerBumps;
		this.message = args.message;
	}

	getAccountType(): GovernanceAccountType {
		return this.accountType;
	}
	getProposal(): PublicKey {
		return this.proposal;
	}
	getOptionIndex(): number {
		return this.optionIndex;
	}
	getTransactionIndex(): number {
		return this.transactionIndex;
	}
	getExecutionIndex(): number {
		return this.executionIndex;
	}
	getExecutedAt(): number | null {
		return this.executedAt;
	}
	getExecutionStatus(): TransactionExecutionStatus {
		return this.executionStatus;
	}
	getEphemeralSignerBumps(): number[] {
		return this.ephemeralSignerBumps;
	}
	getMessage(): ProposalTransactionMessage {
		return this.message;
	}

	isExecuted(): boolean {
		return this.executionStatus === TransactionExecutionStatus.Success;
	}

	hasError(): boolean {
		return this.executionStatus === TransactionExecutionStatus.Error;
	}

	getAllSigners(): PublicKey[] {
		return this.message.getAccountKeys().slice(0, this.message.getNumSigners());
	}

	getWritableAccounts(): PublicKey[] {
		const writableCount = this.message.getNumWritableSigners() + this.message.getNumWritableNonSigners();
		return this.message.getAccountKeys().slice(0, writableCount);
	}
}

export function getProposalTransactionAddress(
	programId: PublicKey,
	programVersion: number,
	proposal: PublicKey,
	optionIndex: number,
	transactionIndex: number,
) {
	const optionIndexBuffer = Buffer.alloc(1);
	optionIndexBuffer.writeUInt8(optionIndex);

	const instructionIndexBuffer = Buffer.alloc(2);
	instructionIndexBuffer.writeInt16LE(transactionIndex, 0);

	const seeds =
		programVersion === PROGRAM_VERSION_V1
			? [Buffer.from(GOVERNANCE_PROGRAM_SEED), proposal.toBuffer(), instructionIndexBuffer]
			: [Buffer.from(GOVERNANCE_PROGRAM_SEED), proposal.toBuffer(), optionIndexBuffer, instructionIndexBuffer];

	const [instructionAddress] = PublicKey.findProgramAddressSync(seeds, programId);

	return instructionAddress;
}

export class ProgramMetadata {
	accountType = GovernanceAccountType.ProgramMetadata;

	updatedAt: BN;

	version: string;

	reserved: Uint8Array;

	constructor(args: {
		updatedAt: BN;
		reserved: Uint8Array;

		version: string;
	}) {
		this.updatedAt = args.updatedAt;
		this.reserved = args.reserved;
		this.version = args.version;
	}
}

export async function getProgramMetadataAddress(programId: PublicKey) {
	const [signatoryRecordAddress] = await PublicKey.findProgramAddress([Buffer.from("metadata")], programId);

	return signatoryRecordAddress;
}

export async function getNativeTreasuryAddress(programId: PublicKey, governance: PublicKey) {
	const [signatoryRecordAddress] = await PublicKey.findProgramAddress(
		[Buffer.from("native-treasury"), governance.toBuffer()],
		programId,
	);

	return signatoryRecordAddress;
}

export async function getGoverningTokenHoldingAddress(
	programId: PublicKey,
	realm: PublicKey,
	governingTokenMint: PublicKey,
) {
	const [governingTokenHoldingAddress] = await PublicKey.findProgramAddress(
		[Buffer.from(GOVERNANCE_PROGRAM_SEED), realm.toBuffer(), governingTokenMint.toBuffer()],
		programId,
	);

	return governingTokenHoldingAddress;
}

export async function getProposalDepositAddress(
	programId: PublicKey,
	proposal: PublicKey,
	proposalDepositPayer: PublicKey,
) {
	const [proposalDepositAddress] = await PublicKey.findProgramAddress(
		[Buffer.from("proposal-deposit"), proposal.toBuffer(), proposalDepositPayer.toBuffer()],
		programId,
	);

	return proposalDepositAddress;
}

export function getEphemeralSignerPda({
	transactionProposalPda,
	transactionIndex,
	ephemeralSignerIndex,
	programId,
}: {
	transactionProposalPda: PublicKey;
	transactionIndex: number;
	ephemeralSignerIndex: number;
	programId: PublicKey;
}): [PublicKey, number] {
	const transactionIndexBuffer = Buffer.alloc(2);
	transactionIndexBuffer.writeInt16LE(transactionIndex, 0);

	const ephemeralSignerIndexBuffer = Buffer.alloc(1);
	ephemeralSignerIndexBuffer.writeUInt8(ephemeralSignerIndex);

	return PublicKey.findProgramAddressSync(
		[
			Buffer.from("version_transaction"),
			transactionProposalPda.toBytes(),
			Buffer.from("ephemeral_signer"),
			transactionIndexBuffer,
			ephemeralSignerIndexBuffer,
		],
		programId,
	);
}

export function getProposalVersionedTransactionAddress(
	programId: PublicKey,
	proposal: PublicKey,
	optionIndex: number,
	transactionIndex: number,
) {
	const optionIndexBuffer = Buffer.alloc(1);
	optionIndexBuffer.writeUInt8(optionIndex);

	const transactionIndexBuffer = Buffer.alloc(2);
	transactionIndexBuffer.writeInt16LE(transactionIndex, 0);

	const seeds = [Buffer.from("version_transaction"), proposal.toBuffer(), optionIndexBuffer, transactionIndexBuffer];

	const [instructionAddress] = PublicKey.findProgramAddressSync(seeds, programId);

	return instructionAddress;
}

export function getProposalTransactionBufferAddress(
	programId: PublicKey,
	proposal: PublicKey,
	creator: PublicKey,
	bufferIndex: number,
) {
	const bufferIndexBuffer = Buffer.alloc(1);
	bufferIndexBuffer.writeUInt8(bufferIndex, 0);

	const seeds = [Buffer.from("transaction_buffer"), proposal.toBuffer(), creator.toBuffer(), bufferIndexBuffer];

	const [transactionBufferAddress] = PublicKey.findProgramAddressSync(seeds, programId);

	return transactionBufferAddress;
}
