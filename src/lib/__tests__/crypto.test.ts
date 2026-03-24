import { encrypt, decrypt } from "../crypto";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
beforeAll(() => { process.env.ENCRYPTION_KEY = TEST_KEY; });

describe("crypto", () => {
  it("encrypts and decrypts correctly", () => {
    const plaintext = "sensitive patient data";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertexts for same input (random IV)", () => {
    const plaintext = "test";
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it("throws on missing ENCRYPTION_KEY", () => {
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
    process.env.ENCRYPTION_KEY = original;
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles unicode", () => {
    const text = "日本語テスト 🏥";
    expect(decrypt(encrypt(text))).toBe(text);
  });
});
