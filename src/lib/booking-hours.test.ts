import { describe, expect, it } from "vitest";
import {
  BOOKING_CLOSE_HOUR_24,
  bookingHourColumns,
  formatBookingHoursRange,
  is24HourBooking,
  normalizeBookingHours,
  parseBookingHoursForm,
  validateBookingHours,
} from "./booking-hours";

describe("validateBookingHours", () => {
  it("accepts the default window and 24-hour booking", () => {
    expect(validateBookingHours(6, 22)).toBe(true);
    expect(validateBookingHours(0, BOOKING_CLOSE_HOUR_24)).toBe(true);
  });

  it("rejects equal or inverted windows", () => {
    expect(validateBookingHours(10, 10)).toBe(false);
    expect(validateBookingHours(18, 8)).toBe(false);
  });
});

describe("parseBookingHoursForm", () => {
  it("maps the 24-hour toggle to midnight–midnight", () => {
    expect(parseBookingHoursForm(null, null, true)).toEqual({
      openHour: 0,
      closeHour: BOOKING_CLOSE_HOUR_24,
    });
  });

  it("parses explicit hour fields", () => {
    expect(parseBookingHoursForm("8", "20", false)).toEqual({
      openHour: 8,
      closeHour: 20,
    });
  });

  it("rejects invalid input", () => {
    expect(parseBookingHoursForm("", "20", false)).toBe("invalid");
    expect(parseBookingHoursForm("8", "8", false)).toBe("invalid");
  });
});

describe("bookingHourColumns", () => {
  it("lists each bookable hour through exclusive close", () => {
    expect(bookingHourColumns(6, 9)).toEqual([6, 7, 8]);
    expect(bookingHourColumns(0, BOOKING_CLOSE_HOUR_24)).toHaveLength(24);
  });
});

describe("formatBookingHoursRange", () => {
  it("labels 24-hour availability plainly", () => {
    expect(
      formatBookingHoursRange({
        openHour: 0,
        closeHour: BOOKING_CLOSE_HOUR_24,
      }),
    ).toBe("24 hours (midnight – midnight)");
  });

  it("falls back to defaults for invalid stored values", () => {
    expect(normalizeBookingHours({ openHour: 99, closeHour: 1 })).toEqual({
      openHour: 6,
      closeHour: 22,
    });
  });

  it("detects 24-hour mode", () => {
    expect(
      is24HourBooking({ openHour: 0, closeHour: BOOKING_CLOSE_HOUR_24 }),
    ).toBe(true);
    expect(is24HourBooking({ openHour: 6, closeHour: 22 })).toBe(false);
  });
});
