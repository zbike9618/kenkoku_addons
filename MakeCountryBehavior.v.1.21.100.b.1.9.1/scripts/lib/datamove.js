/*
 *新データベースへの移行 
 */

import { world, system } from "@minecraft/server";
import { DynamicProperties } from "../api/dyp";
import * as DyProp from "./DyProp";

world.afterEvents.worldLoad.subscribe(() => {
    function* migrateData() {
        try {
            if (world.getDynamicProperty('start')) {
                console.log('v1のデータを検知、v2への移行を開始します');

                const ids = DyProp.DynamicPropertyIds().filter(id => id.includes('_'));
                for (const id of ids) {
                    const database = new DynamicProperties(`${id.split('_')[0]}`);
                    const data = DyProp.getDynamicProperty(id);
                    DyProp.setDynamicProperty(id);
                    database.set(id, data);
                    console.log(`旧データID: ${id}\n↓\n新データベース: ${id.split('_')[0]}\nデータ: ${data}`);
                    yield;
                }

                console.log('データをv2へ移行&削除完了');
                world.setDynamicProperty('start');
                world.setDynamicProperty('start2', 'true');
                console.log('v2セットアップ完了');
            }
        } catch (error) {
            console.log(`移行中にエラーが発生しました:\n${error}`);
            yield;
        }
    }

    system.runJob(migrateData());
})