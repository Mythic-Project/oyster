import { type PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getGovernanceInstructionSchema } from "./serialisation";
import { serialize } from "borsh";
import { SetGovernanceDelegateArgs } from "./instructions";
import { getTokenOwnerRecordAddress } from "./accounts";

export const withSetGovernanceDelegate = async (
	instructions: TransactionInstruction[],
	programId: PublicKey,
	programVersion: number,
	realm: PublicKey,
	governingTokenMint: PublicKey,
	governingTokenOwner: PublicKey,
	governanceAuthority: PublicKey,
	newGovernanceDelegate: PublicKey | undefined,
) => {
	const args = new SetGovernanceDelegateArgs({
		newGovernanceDelegate: newGovernanceDelegate,
	});
	const data = Buffer.from(serialize(getGovernanceInstructionSchema(programVersion), args));

	const tokenOwnerRecordAddress = await getTokenOwnerRecordAddress(
		programId,
		realm,
		governingTokenMint,
		governingTokenOwner,
	);

	const keys = [
		{
			pubkey: governanceAuthority,
			isWritable: false,
			isSigner: true,
		},
		{
			pubkey: tokenOwnerRecordAddress,
			isWritable: true,
			isSigner: false,
		},
	];

	instructions.push(
		new TransactionInstruction({
			keys,
			programId,
			data,
		}),
	);
};
