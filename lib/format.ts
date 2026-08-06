// Platform-wide time formatting. Business users always read times in China Standard Time.
const chinaDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const chinaDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
  day: "numeric",
});

function parseTime(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = typeof value === "number" || /^\d{11,13}$/.test(String(value))
    ? Number(value)
    : value;
  const date = new Date(numeric);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(value: string | number | undefined | null): string {
  const date = parseTime(value);
  if (!date) return "—";
  const parts = Object.fromEntries(
    chinaDateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}`;
}

export function formatDateShort(value: string | number | undefined | null): string {
  const date = parseTime(value);
  if (!date) return "—";
  return chinaDateFormatter.format(date);
}
