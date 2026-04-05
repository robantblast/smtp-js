export function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomString(length: number, charset: string): string {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * charset.length);
    result += charset[index];
  }
  return result;
}

export function generateInvoiceCode(): string {
  const letterCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digitCharset = "0123456789";

  let letters = "";
  do {
    letters = randomString(2, letterCharset);
  } while (letters === "XX" || letters === "ZZ" || letters === "XXX" || letters === "ZZZ");

  const digits = randomString(6, digitCharset);
  return `${letters}${digits}`;
}

export function generateRandomNumber(length = 1): string {
  return randomString(length, "0123456789");
}
