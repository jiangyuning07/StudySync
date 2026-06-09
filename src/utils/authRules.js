export function isValidNusEmail(email) {
  return /^e\d{7}@u\.nus\.edu$/i.test(email.trim());
}

export function isFullyVerifiedNusUser(user) {
  return Boolean(user?.email && isValidNusEmail(user.email) && user.emailVerified);
}