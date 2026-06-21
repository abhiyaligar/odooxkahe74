export function getPasswordStrength(password = '') {
  const length = password.length >= 8;
  const uppercase = /[A-Z]/.test(password);
  const lowercase = /[a-z]/.test(password);
  const number = /[0-9]/.test(password);
  const special = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;']/.test(password);

  let score = 0;
  if (length) score++;
  if (uppercase) score++;
  if (lowercase) score++;
  if (number) score++;
  if (special) score++;

  return {
    length,
    uppercase,
    lowercase,
    number,
    special,
    score
  };
}
