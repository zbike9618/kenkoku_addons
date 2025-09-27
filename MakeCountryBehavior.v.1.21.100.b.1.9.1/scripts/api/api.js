/**
 * 許容されるイベント名を列挙
 * @typedef {keyof EventPayloads} EventName
 */

/**
 * 個別イベントを管理するクラス
 * @template T
 */
class EventManager {
    constructor() {
        /** @type {((payload: T) => void)[]} */
        this.listeners = [];
    }

    /**
     * イベントを購読します。
     * @param {(payload: T) => void} listener - イベント発生時に呼び出される関数
     * @returns {Function} 購読解除用の関数
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * イベントを発火します。
     * @param {T} payload - イベントリスナーに渡される引数
     * @returns {boolean} イベントがキャンセルされた場合は `true` を返す
     */
    emit(payload) {
        for (let listener of this.listeners) {
            listener(payload);
            if (payload.cancel) {
                return true; // キャンセルされた場合、イベントの発火を終了
            }
        }
        return false;
    }
}

/**
 * makecountryオブジェクト
 */
export const country = {
    afterEvents: {
        /** @type {EventManager<{countryName: string, type: 'player'|'system' player?: Player, peace?: boolean, invite?: boolean, id: number}>} */
        create: new EventManager(),
        /** @type {EventManager<{countryName: string, type: 'player'|'system' player?: Player, territoryCount: number }>} */
        chunkbuy: new EventManager(),
        /** @type {EventManager<{countryName: string,type: 'player'|'delete'|'system' ,player?: Player}>} */
        delete: new EventManager(),
        /** @type {EventManager<{ oldName: string, type: 'player'|'system', newName: string ,player?: Player }>} */
        rename: new EventManager(),
        /** @type {EventManager<{invaderCountryName: string,invadedCountryName: string ,invader: Player, locationString: string}>} */
        startInvade: new EventManager(),
    },
    beforeEvents: {
        /** @type {EventManager<{countryName: string, type: 'player'|'system' player?: Player,cancel: boolean, peace?: boolean, invite?: boolean }>} */
        create: new EventManager(),
        /** @type {EventManager<{countryName: string, type: 'player'|'system' player?: Player,cancel: boolean, territoryCount: number }>} */
        chunkbuy: new EventManager(),
        /** @type {EventManager<{countryName: string,type: 'player'|'delete'|'system' ,player?: Player,cancel: boolean}>} */
        delete: new EventManager(),
        /** @type {EventManager<{ oldName: string, type: 'player'|'system', newName: string,cancel: boolean ,player?: Player}>} */
        rename: new EventManager(),
        /** @type {EventManager<{invaderCountryName: string,invadedCountryName: string ,invader: Player, locationString: string ,cancel: boolean}>} */
        startInvade: new EventManager(),
    }
};

export const playerHandler = {
    afterEvents: {
        /** @type {EventManager<{player: Player, message: string, type: 'general'|'country'|'alliance'|'local'}>} */
        chat: new EventManager(),
        /** @type {EventManager<{player: Player, args: Array<string>, commandName: string}>} */
        command: new EventManager(),
    },
    beforeEvents: {
        /** @type {EventManager<{player: Player, message: string, type: 'general'|'country'|'alliance'|'local',cancel: boolean}>} */
        chat: new EventManager(),
        /** @type {EventManager<{player: Player, args: Array<string>, commandName: string,cancel: boolean}>} */
        command: new EventManager(),
    }
};