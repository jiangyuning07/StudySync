export function getLoginError(error) {
  if (error?.code === "auth/invalid-credential") {
    return {
      message: "",
      hint: "register",
    };
  }

  return {
    message: error?.message || "Login failed. Please try again.",
    hint: null,
  };
}

export function getRegisterError(error) {
  if (error?.code === "auth/email-already-in-use") {
    return {
      message: "",
      hint: "login",
    };
  }

  if (error?.code === "auth/weak-password") {
    return {
      message: "Password should be at least 6 characters.",
      hint: null,
    };
  }

  return {
    message: error?.message || "Registration failed. Please try again.",
    hint: null,
  };
}