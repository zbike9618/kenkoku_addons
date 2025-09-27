import { DynamicProperties } from "./dyp";
const buffData = new DynamicProperties("rewardBuff");

export class RewardBuff {
  constructor() {
    this.dyProp = buffData;
    this.key = "rewardBuffs";
    this.buffs = this._loadBuffs(); // 初回のみ DyProp からロード
  }

  _loadBuffs() {
    const data = this.dyProp.get(this.key);
    return data ? JSON.parse(data) : {}; // { job: [{ multiplier, expireTime }, ...] }
  }

  _saveBuffs() {
    this.dyProp.set(this.key, JSON.stringify(this.buffs));
  }

  addBuff(job, multiplier, durationMinutes) {
    const now = Date.now();
    const expireTime = now + durationMinutes * 60 * 1000;

    if (!this.buffs[job]) {
      this.buffs[job] = [];
    }
    this.buffs[job].push({ multiplier, expireTime });

    this._saveBuffs();
  }

  getMultiplier(job) {
    const now = Date.now();
    if (!this.buffs[job]) return 1;

    this.buffs[job] = this.buffs[job].filter(buff => buff.expireTime > now);
    this._saveBuffs();

    return this.buffs[job].reduce((total, buff) => total + (buff.multiplier - 1), 1);
  }

  removeBuff(job, multiplier) {
    if (!this.buffs[job]) return;

    const index = this.buffs[job].findIndex(buff => buff.multiplier === multiplier);
    if (index !== -1) {
      this.buffs[job].splice(index, 1);
      if (this.buffs[job].length === 0) {
        delete this.buffs[job];
      }
      this._saveBuffs();
    }
  }

  clearBuffs(job) {
    if (this.buffs[job]) {
      delete this.buffs[job];
      this._saveBuffs();
    }
  }

  getBuffList(job) {
    const now = Date.now();
    if (!this.buffs[job]) return [];

    this.buffs[job] = this.buffs[job].filter(buff => buff.expireTime > now);
    this._saveBuffs();

    return this.buffs[job].map(buff => ({
      multiplier: buff.multiplier,
      remainingTime: Math.max(0, Math.floor((buff.expireTime - now) / 1000)) // 秒単位
    }));
  }

  getAllBuffs() {
    const now = Date.now();
    const allBuffs = {};

    for (const job in this.buffs) {
      this.buffs[job] = this.buffs[job].filter(buff => buff.expireTime > now);
      if (this.buffs[job].length > 0) {
        allBuffs[job] = this.buffs[job].map(buff => ({
          multiplier: buff.multiplier,
          remainingTime: Math.max(0, Math.floor((buff.expireTime - now) / 1000)) // 秒単位
        }));
      }
    }

    this._saveBuffs();
    return allBuffs;
  }
}