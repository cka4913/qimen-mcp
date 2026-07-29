declare module "lunar-javascript" {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    static fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): Solar;
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getHour(): number;
    getMinute(): number;
    getSecond(): number;
    toYmdHms(): string;
  }

  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getSolar(): Solar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    /** Solar-term name if this solar day *is* a solar-term day, else "". */
    getJieQi(): string;
    /** name → Solar (with time) for every solar term around this date. */
    getJieQiTable(): Record<string, Solar>;
    /** The table's keys in date order, including the ALL_CAPS wrap-around ones. */
    getJieQiList(): string[];
    getYearInGanZhi(): string;
    getYearInGanZhiByLiChun(): string;
    getYearInGanZhiExact(): string;
    getMonthInGanZhi(): string;
    getMonthInGanZhiExact(): string;
    getDayInGanZhi(): string;
    getDayInGanZhiExact(): string;
    getTimeInGanZhi(): string;
  }
}
