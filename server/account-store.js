import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const HASH_BYTES = 64;
const FAKE_SALT = 'eft-account-login-protection';

export class AccountStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.accounts = new Map();
    this.writeQueue = Promise.resolve();
    this.ready = this._load();
  }

  async _load() {
    let content;
    try {
      content = await fs.readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }

    const data = JSON.parse(content);
    if (!data || !Array.isArray(data.accounts)) {
      throw new Error('Account database has an invalid format');
    }

    for (const account of data.accounts) {
      if (account && typeof account.usernameKey === 'string') {
        this.accounts.set(account.usernameKey, account);
      }
    }
  }

  async createAccount(username, password, profile) {
    await this.ready;
    const usernameKey = username.toLowerCase();
    if (this.accounts.has(usernameKey)) {
      const error = new Error('An account with that username already exists');
      error.code = 'ACCOUNT_EXISTS';
      throw error;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = (await scrypt(password, salt, HASH_BYTES)).toString('hex');
    if (this.accounts.has(usernameKey)) {
      const error = new Error('An account with that username already exists');
      error.code = 'ACCOUNT_EXISTS';
      throw error;
    }
    const account = { username, usernameKey, salt, passwordHash, profile };
    this.accounts.set(usernameKey, account);
    try {
      await this._persist();
    } catch (error) {
      this.accounts.delete(usernameKey);
      throw error;
    }
    return account;
  }

  async authenticate(username, password) {
    await this.ready;
    const account = this.accounts.get(username.toLowerCase());
    const salt = account ? account.salt : FAKE_SALT;
    const expectedHash = account ? account.passwordHash : '0'.repeat(HASH_BYTES * 2);
    const candidateHash = (await scrypt(password, salt, HASH_BYTES)).toString('hex');
    const matches = crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
    return account && matches ? account : null;
  }

  async saveProfile(usernameKey, profile) {
    await this.ready;
    const account = this.accounts.get(usernameKey);
    if (!account) return false;
    const previousProfile = account.profile;
    account.profile = profile;
    try {
      await this._persist();
    } catch (error) {
      account.profile = previousProfile;
      throw error;
    }
    return true;
  }

  _persist() {
    const operation = this.writeQueue.catch(() => {}).then(async () => {
      const directory = path.dirname(this.filePath);
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(temporaryPath, JSON.stringify({
        version: 1,
        accounts: Array.from(this.accounts.values())
      }), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temporaryPath, this.filePath);
    });
    this.writeQueue = operation;
    return operation;
  }
}
