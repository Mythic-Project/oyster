export function parseVersion(version: string) {
	const arr = version.split(".");

	// parse int or default to 0
	const major = Number.parseInt(arr[0]) || 0;
	const minor = Number.parseInt(arr[1]) || 0;
	const patch = Number.parseInt(arr[2]) || 0;
	return {
		major,
		minor,
		patch,
	};
}
