export type AvailabilityStatus = "available" | "limited" | "unavailable";

export type AvailabilityPeriod = {
  key: string;
  short: string;
  startsAt: string;
  endsAt: string;
  status?: AvailabilityStatus;
};

export type AvailabilitySegment = {
  start: number;
  end: number;
  startsAt: string;
  endsAt: string;
  status: AvailabilityStatus;
};

export type AvailabilityResult = {
  date: string;
  segments: AvailabilitySegment[];
  periods: Array<AvailabilityPeriod & { status: AvailabilityStatus }>;
  status: AvailabilityStatus;
  defaultOpen: boolean;
  activeIntervals: Array<Record<string, unknown>>;
};

export const CALENDAR_SUMMARY_PERIODS: AvailabilityPeriod[];
export function timeToMinutes(value: unknown): number;
export function minutesToTime(value: unknown): string;
export function intervalsOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string): boolean;
export function intervalHasUnavailableSegment(segments: AvailabilitySegment[], startTime: string, endTime: string): boolean;
export function recurringBlockMatchesDate(block: Record<string, unknown>, date: string): boolean;
export function recurringBlockHasException(block: Record<string, unknown>, date: string, exceptions?: Array<Record<string, unknown>>): boolean;
export function summarizeAvailability(segments: AvailabilitySegment[], startsAt?: string, endsAt?: string): AvailabilityStatus;
export function availabilityAt(result: AvailabilityResult, time: string): AvailabilityStatus;
export function calculateAvailability(input: {
  date: string;
  singleDay?: Array<Record<string, unknown>>;
  recurringBlocks?: Array<Record<string, unknown>>;
  recurringExceptions?: Array<Record<string, unknown>>;
  orders?: Array<Record<string, unknown>>;
  monthlyOrderLimit?: number | null;
  monthlyOrderCount?: number;
  summaryPeriods?: AvailabilityPeriod[];
}): AvailabilityResult;
