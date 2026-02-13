const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

const TOKEN_FORMATTER = new Intl.NumberFormat(undefined, {
	notation: "compact",
	maximumFractionDigits: 1,
});

const WHOLE_NUMBER_FORMATTER = new Intl.NumberFormat(undefined, {
	maximumFractionDigits: 0,
});

const COST_FORMATTER = new Intl.NumberFormat(undefined, {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 4,
});

export function formatDateTime(value: string | number | Date): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "--";
	}

	return DATE_TIME_FORMATTER.format(date);
}

export function formatDurationMs(durationMs: number): string {
	if (!Number.isFinite(durationMs) || durationMs <= 0) {
		return "0s";
	}

	const totalSeconds = Math.round(durationMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}

export function formatDurationBetween(
	start: string | number | Date,
	end?: string | number | Date,
): string {
	const startDate = start instanceof Date ? start : new Date(start);
	if (Number.isNaN(startDate.getTime())) {
		return "--";
	}

	const endDate =
		end instanceof Date ? end : end === undefined ? new Date() : new Date(end);
	if (Number.isNaN(endDate.getTime())) {
		return "--";
	}

	return formatDurationMs(endDate.getTime() - startDate.getTime());
}

export function formatTokenCount(tokens: number): string {
	if (!Number.isFinite(tokens)) {
		return "0";
	}

	if (Math.abs(tokens) < 1_000) {
		return WHOLE_NUMBER_FORMATTER.format(tokens);
	}

	return TOKEN_FORMATTER.format(tokens);
}

export function formatCostUsd(cost: number): string {
	if (!Number.isFinite(cost)) {
		return COST_FORMATTER.format(0);
	}

	return COST_FORMATTER.format(cost);
}

export function formatProgressPercent(ratio: number): string {
	if (!Number.isFinite(ratio)) {
		return "0%";
	}

	const boundedRatio = Math.max(0, Math.min(1, ratio));
	return `${Math.round(boundedRatio * 100)}%`;
}

export function formatProgressFromCounts(
	completed: number,
	total: number,
): string {
	if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) {
		return "0%";
	}

	return formatProgressPercent(completed / total);
}
