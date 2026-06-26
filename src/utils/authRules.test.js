import {describe, it, expect} from "vitest";
import {isValidNusEmail, isFullyVerifiedNusUser} from "./authRules";

describe("isValidNusEmail", () => {
  it("accepts valid NUS student emails", () => {
    expect(isValidNusEmail("e1234567@u.nus.edu")).toBe(true);
    expect(isValidNusEmail("E1234567@u.nus.edu")).toBe(true);
    expect(isValidNusEmail("  e1234567@u.nus.edu  ")).toBe(true);
  });

  it("rejects invalid or non-NUS emails", () => {
    expect(isValidNusEmail("student@gmail.com")).toBe(false);
    expect(isValidNusEmail("abc@u.nus.edu")).toBe(false);
    expect(isValidNusEmail("e123@u.nus.edu")).toBe(false);
    expect(isValidNusEmail("e12345678@u.nus.edu")).toBe(false);
    expect(isValidNusEmail("")).toBe(false);
    expect(isValidNusEmail(null)).toBe(false);
    expect(isValidNusEmail(undefined)).toBe(false);
  });
});

describe("isFullyVerifiedNusUser", () => {
  it("returns true for a verified user with valid NUS email", () => {
    const user = {
      email: "e1234567@u.nus.edu",
      emailVerified: true,
    };

    expect(isFullyVerifiedNusUser(user)).toBe(true);
  });

  it("returns false for invalid, unverified, or missing users", () => {
    expect(
      isFullyVerifiedNusUser({
        email: "e1234567@u.nus.edu",
        emailVerified: false,
      })
    ).toBe(false);

    expect(
      isFullyVerifiedNusUser({
        email: "student@gmail.com",
        emailVerified: true,
      })
    ).toBe(false);

    expect(isFullyVerifiedNusUser(null)).toBe(false);
    expect(isFullyVerifiedNusUser(undefined)).toBe(false);
  });
});