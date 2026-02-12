import { basename, join } from "node:path";
import { SWARN_WORKTREES } from "./config.js";

export function isGitRepo(dir: string): boolean {
	const result = Bun.spawnSync(["git", "rev-parse", "--is-inside-work-tree"], {
		cwd: dir,
		stdout: "pipe",
		stderr: "pipe",
	});
	return result.exitCode === 0;
}

export function createWorktree(projectDir: string): string {
	const timestamp = Date.now();
	const name = `${basename(projectDir)}-${timestamp}`;
	const worktreePath = join(SWARN_WORKTREES, name);
	const branch = `swarn-${timestamp}`;

	const result = Bun.spawnSync(
		["git", "worktree", "add", "-b", branch, worktreePath],
		{ cwd: projectDir, stdout: "pipe", stderr: "pipe" },
	);

	if (result.exitCode !== 0) {
		const stderr = result.stderr.toString().trim();
		throw new Error(`Failed to create worktree: ${stderr}`);
	}

	return worktreePath;
}

export function removeWorktree(projectDir: string, worktreePath: string): void {
	const result = Bun.spawnSync(
		["git", "worktree", "remove", "--force", worktreePath],
		{ cwd: projectDir, stdout: "pipe", stderr: "pipe" },
	);

	if (result.exitCode !== 0) {
		const stderr = result.stderr.toString().trim();
		throw new Error(`Failed to remove worktree: ${stderr}`);
	}
}
