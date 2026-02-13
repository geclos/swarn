import type { Accessor } from "solid-js";
import { createEffect, createSignal, onCleanup } from "solid-js";
import type { SwarmDetailDto, SwarmListItemDto } from "./types.js";

const DEFAULT_POLLING_INTERVAL_MS = 2_000;

export interface PollingOptions {
	enabled: Accessor<boolean>;
	refresh: () => Promise<unknown> | unknown;
	intervalMs?: number;
	pauseWhenHidden?: boolean;
	runImmediately?: boolean;
}

export interface PollingController {
	readonly isActive: Accessor<boolean>;
	readonly isVisible: Accessor<boolean>;
	triggerRefresh: () => Promise<void>;
}

export function createPolling(options: PollingOptions): PollingController {
	const [isVisible, setIsVisible] = createSignal(readVisibility());
	const [isActive, setIsActive] = createSignal(false);
	const pauseWhenHidden = options.pauseWhenHidden ?? true;
	const runImmediately = options.runImmediately ?? true;
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let inFlight = false;
	let shouldRunAgain = false;

	const executeRefresh = async (): Promise<void> => {
		if (inFlight) {
			shouldRunAgain = true;
			return;
		}

		inFlight = true;
		try {
			await options.refresh();
		} finally {
			inFlight = false;
			if (shouldRunAgain) {
				shouldRunAgain = false;
				await executeRefresh();
			}
		}
	};

	const stopTimer = (): void => {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
		setIsActive(false);
	};

	const startTimer = (): void => {
		if (intervalId !== null) {
			return;
		}

		const intervalMs = Math.max(
			250,
			options.intervalMs ?? DEFAULT_POLLING_INTERVAL_MS,
		);
		intervalId = setInterval(() => {
			void executeRefresh();
		}, intervalMs);
		setIsActive(true);
	};

	const shouldPoll = (): boolean => {
		if (!options.enabled()) {
			return false;
		}

		if (!pauseWhenHidden) {
			return true;
		}

		return isVisible();
	};

	createEffect((previouslyEnabled) => {
		const active = shouldPoll();

		if (active) {
			startTimer();
			if (runImmediately && !previouslyEnabled) {
				void executeRefresh();
			}
		} else {
			stopTimer();
		}

		return active;
	}, false);

	if (typeof document !== "undefined") {
		const onVisibilityChange = (): void => {
			setIsVisible(readVisibility());
			if (readVisibility() && options.enabled()) {
				void executeRefresh();
			}
		};

		document.addEventListener("visibilitychange", onVisibilityChange);
		onCleanup(() => {
			document.removeEventListener("visibilitychange", onVisibilityChange);
		});
	}

	onCleanup(() => {
		stopTimer();
	});

	return {
		isActive,
		isVisible,
		triggerRefresh: executeRefresh,
	};
}

export function shouldPollSwarmList(
	swarms: readonly SwarmListItemDto[],
): boolean {
	for (const swarm of swarms) {
		if (swarm.status === "running") {
			return true;
		}
	}

	return false;
}

export function shouldPollSwarmDetail(
	swarm: SwarmDetailDto | null | undefined,
): boolean {
	if (!swarm) {
		return false;
	}

	return swarm.status === "running";
}

function readVisibility(): boolean {
	if (typeof document === "undefined") {
		return true;
	}

	return document.visibilityState !== "hidden";
}
