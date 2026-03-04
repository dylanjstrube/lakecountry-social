import type { DailyContext, Season, ProductLine } from "./types.js";

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

const WEATHER_NOTES: Record<Season, string> = {
  winter:
    "Wisconsin winters are tough on wood decks — spring is the perfect time to plan your resurface",
  spring:
    "Spring is peak deck season in Lake Country — book now before summer fills up",
  summer:
    "Enjoy your deck all summer long with zero maintenance, thanks to Trex composite",
  fall:
    "Fall is the best time to plan next year's deck project and beat the spring rush",
};

// Approximate US/WI holidays by month + day range
interface Holiday {
  name: string;
  month: number;
  day: number;
}

const HOLIDAYS: Holiday[] = [
  { name: "New Year's Day", month: 1, day: 1 },
  { name: "Valentine's Day", month: 2, day: 14 },
  { name: "St. Patrick's Day", month: 3, day: 17 },
  { name: "Easter", month: 4, day: 20 }, // approximate
  { name: "Mother's Day", month: 5, day: 11 }, // 2nd Sunday, approximate
  { name: "Memorial Day", month: 5, day: 26 }, // last Monday, approximate
  { name: "Father's Day", month: 6, day: 15 }, // 3rd Sunday, approximate
  { name: "Fourth of July", month: 7, day: 4 },
  { name: "Labor Day", month: 9, day: 1 }, // 1st Monday, approximate
  { name: "Halloween", month: 10, day: 31 },
  { name: "Thanksgiving", month: 11, day: 27 }, // 4th Thursday, approximate
  { name: "Christmas", month: 12, day: 25 },
];

function getUpcomingHoliday(date: Date): string | undefined {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  for (const holiday of HOLIDAYS) {
    // Check if holiday is within the next 21 days
    const holidayDate = new Date(date.getFullYear(), holiday.month - 1, holiday.day);
    const diffMs = holidayDate.getTime() - date.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0 && diffDays <= 21) {
      if (diffDays === 1) return `${holiday.name} is tomorrow`;
      if (diffDays <= 7) return `${holiday.name} is in ${diffDays} days`;
      return `${holiday.name} is coming up in ${diffDays} days`;
    }
  }

  return undefined;
}

const PRODUCT_LINES: ProductLine[] = ["enhance", "select", "transcend"];

export function buildDailyContext(date: Date): DailyContext {
  const month = date.getMonth() + 1;
  const season = getSeason(month);
  const dayOfYear = getDayOfYear(date);
  const productSpotlight = PRODUCT_LINES[dayOfYear % 3];
  const upcomingHoliday = getUpcomingHoliday(date);

  return {
    date: date.toISOString().split("T")[0],
    season,
    productSpotlight,
    weatherNote: WEATHER_NOTES[season],
    upcomingHoliday,
  };
}
