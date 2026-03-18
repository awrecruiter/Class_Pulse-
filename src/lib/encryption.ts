import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;

function deriveKey(secret: string): Buffer {
	return crypto.scryptSync(secret, "portal-credentials-salt", KEY_LEN);
}

export function encrypt(plaintext: string, secret: string): string {
	const key = deriveKey(secret);
	const iv = crypto.randomBytes(IV_LEN);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(stored: string, secret: string): string {
	const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
	if (!ivHex || !authTagHex || !ciphertextHex) throw new Error("Invalid stored format");
	const key = deriveKey(secret);
	const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
	decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
	return (
		decipher.update(Buffer.from(ciphertextHex, "hex")).toString("utf8") + decipher.final("utf8")
	);
}
