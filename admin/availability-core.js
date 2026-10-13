const DAY_START = 0;
const DAY_END = 24 * 60;

const STATUS_WEIGHT = {
  available: 0,
  limited: 1,
  unavailable: 2
};

export const CALENDAR_SUMMARY_PERIODS = [
  { key: "morning", short: "早", startsAt: "00:00", endsAt: "12:00" },
  { key: "afternoon", short: "午", startsAt: "12:00", endsAt: "18:00" },
  { key: "evening", short: "晚", startsAt: "18:00", endsAt: "24:00" }
];

export function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
    return Number.NaN;
  }
  if (hours === 24 && minutes !== 0) return Number.NaN;
  return hours * 60 + minutes;
}

export function minutesToTime(value) {
  const safe = Math.max(DAY_START, Math.min(DAY_END, Number(value) || 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function intervalsOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return timeToMinutes(leftStart) < timeToMinutes(rightEnd) && timeToMinutes(leftEnd) > timeToMinutes(rightStart);
}

export function intervalHasUnavailableSegment(segments, startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return segments.some(segment => segment.status === "unavailable" && segment.start < end && segment.end > start);
}

export function recurringBlockMatchesDate(block, date) {
  if (!block || block.is_enabled === false) return false;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return Number(block.weekday) === weekday &&
    String(block.effective_from || "") <= date &&
    (!block.effective_until || String(block.effective_until) >= date);
}

export function recurringBlockHasException(block, date, exceptions = []) {
  return exceptions.some(exception =>
    Number(exception.recurring_block_id) === Number(block.recurring_block_id) &&
    String(exception.exception_date) === date
  );
}

function normalizedInterval(record, fallbackStatus, fallbackSource) {
  const hasStart = Boolean(record?.starts_at ?? record?.startsAt);
  const hasEnd = Boolean(record?.ends_at ?? record?.endsAt);
  const start = hasStart ? timeToMinutes(record.starts_at ?? record.startsAt) : DAY_START;
  const end = hasEnd ? timeToMinutes(record.ends_at ?? record.endsAt) : DAY_END;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null;
  const candidate = String(record.availability_status || record.status || fallbackStatus || "available");
  const status = Object.hasOwn(STATUS_WEIGHT, candidate) ? candidate : "available";
  return {
    start,
    end,
    status,
    source: String(record.source || fallbackSource || "single_day"),
    sourceId: record.availability_id ?? record.recurring_block_id ?? record.order_id ?? record.orderId ?? null
  };
}

function statusForSlice(intervals, start, end) {
  const overlaps = intervals.filter(interval => interval.start < end && interval.end > start);
  if (!overlaps.length) return "available";
  return overlaps.reduce((status, interval) =>
    STATUS_WEIGHT[interval.status] > STATUS_WEIGHT[status] ? interval.status : status
  , "available");
}

function mergeAdjacentSegments(segments) {
  return segments.reduce((merged, segment) => {
    const previous = merged.at(-1);
    if (previous && previous.status === segment.status) {
      previous.end = segment.end;
      previous.endsAt = segment.endsAt;
      return merged;
    }
    merged.push({ ...segment });
    return merged;
  }, []);
}

export function summarizeAvailability(segments, startsAt = "00:00", endsAt = "24:00") {
  const start = timeToMinutes(startsAt);
  const end = timeToMinutes(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return "available";
  const matches = segments.filter(segment => segment.start < end && segment.end > start);
  if (!matches.length || matches.every(segment => segment.status === "available")) return "available";
  if (matches.every(segment => segment.status === "unavailable") && matches.reduce((minutes, segment) => {
    return minutes + Math.max(0, Math.min(end, segment.end) - Math.max(start, segment.start));
  }, 0) >= end - start) return "unavailable";
  return "limited";
}

export function availabilityAt(result, time) {
  const minute = timeToMinutes(time);
  if (!Number.isFinite(minute)) return "available";
  return result.segments.find(segment => segment.start <= minute && minute < segment.end)?.status || "available";
}

export function calculateAvailability({
  date,
  singleDay = [],
  recurringBlocks = [],
  recurringExceptions = [],
  orders = [],
  monthlyOrderLimit = null,
  monthlyOrderCount = 0,
  summaryPeriods = CALENDAR_SUMMARY_PERIODS
}) {
  const intervals = [];

  for (const block of recurringBlocks) {
    if (!recurringBlockMatchesDate(block, date) || recurringBlockHasException(block, date, recurringExceptions)) continue;
    const interval = normalizedInterval(block, "unavailable", "recurring");
    if (interval) intervals.push(interval);
  }

  for (const slot of singleDay) {
    const interval = normalizedInterval(slot, slot.availability_status, "single_day");
    if (interval) intervals.push(interval);
  }

  for (const order of orders) {
    const interval = normalizedInterval(order, "unavailable", "order");
    if (interval) intervals.push(interval);
  }

  if (Number.isFinite(Number(monthlyOrderLimit)) && Number(monthlyOrderLimit) > 0 && Number(monthlyOrderCount) >= Number(monthlyOrderLimit)) {
    intervals.push({ start: DAY_START, end: DAY_END, status: "unavailable", source: "monthly_capacity", sourceId: null });
  }

  const boundaries = [...new Set([DAY_START, DAY_END, ...intervals.flatMap(interval => [interval.start, interval.end])])]
    .filter(value => value >= DAY_START && value <= DAY_END)
    .sort((left, right) => left - right);
  const segments = mergeAdjacentSegments(boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    return {
      start,
      end,
      startsAt: minutesToTime(start),
      endsAt: minutesToTime(end),
      status: statusForSlice(intervals, start, end)
    };
  }));
  const periods = summaryPeriods.map(period => ({
    ...period,
    status: summarizeAvailability(segments, period.startsAt, period.endsAt)
  }));

  return {
    date,
    segments,
    periods,
    status: summarizeAvailability(segments),
    defaultOpen: intervals.length === 0,
    activeIntervals: intervals.map(interval => ({
      ...interval,
      startsAt: minutesToTime(interval.start),
      endsAt: minutesToTime(interval.end)
    }))
  };
}
