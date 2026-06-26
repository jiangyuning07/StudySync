import {describe, expect, it} from "vitest";
import {getLoginError, getRegisterError} from "./authErrors";

describe("getLoginError", () => {
  it("shows register hint for invalid Firebase credentials", () => {
    expect(getLoginError({code: "auth/invalid-credential"})).toEqual({
      message: "",
      hint: "register",
    });
  });

  it("returns Firebase message for unknown login errors", () => {
    expect(getLoginError({message: "Network error"})).toEqual({
      message: "Network error",
      hint: null,
    });
  });

  it("returns fallback login message when error has no message", () => {
    expect(getLoginError({})).toEqual({
      message: "Login failed. Please try again.",
      hint: null,
    });
  });
});

describe("getRegisterError", () => {
  it("shows login hint when email is already registered", () => {
    expect(getRegisterError({code: "auth/email-already-in-use"})).toEqual({
      message: "",
      hint: "login",
    });
  });

  it("returns friendly message for weak passwords", () => {
    expect(getRegisterError({code: "auth/weak-password"})).toEqual({
      message: "Password should be at least 6 characters.",
      hint: null,
    });
  });

  it("returns Firebase message for unknown register errors", () => {
    expect(getRegisterError({message: "Something broke"})).toEqual({
      message: "Something broke",
      hint: null,
    });
  });

  it("returns fallback register message when error has no message", () => {
    expect(getRegisterError({})).toEqual({
      message: "Registration failed. Please try again.",
      hint: null,
    });
  });
});