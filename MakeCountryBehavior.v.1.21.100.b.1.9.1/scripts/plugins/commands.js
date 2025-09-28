import * as server from "@minecraft/server"
import { world ,system,CommandPermissionLevel, CustomCommandStatus, CustomCommandOrigin} from "@minecraft/server";
import { companymenu } from "./company/form";
import { companyList } from "./company/form";
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const Ctplobby = {
        name: "makecountry:lobby", // コマンド名
        description: "ロビーへtpする", // コマンド説明
        permissionLevel: CommandPermissionLevel.Any, // 権限レベル: 誰でも
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ], 
    }

    // helloコマンドを登録
    ev.customCommandRegistry.registerCommand(Ctplobby, tplobby);
});

/**
 * saba:helloコマンドの処理関数
 * @param {CustomCommandOrigin} origin 
 * @returns {import("@minecraft/server").CustomCommandResult}
 */
function tplobby(origin) {
    // origin には実行者エンティティやブロックが入る

    // もし実行者エンティティの種族がプレイヤーではないなら
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        // コマンド結果を返す
        return {
            status: CustomCommandStatus.Failure, // 失敗
            message: "実行者はプレイヤーである必要があります",
        }
    }
    //tpする
    origin.sourceEntity.teleport({x:7,y:64,z:7})
    // コマンド結果を返す
    return {
        status: CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const cmcp = {
        name: "makecountry:makecompany", // コマンド名
        description: "会社を作る", // コマンド説明
        permissionLevel: CommandPermissionLevel.Any, // 権限レベル: 誰でも
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ], 
    }
    const csmcp = {
        name: "makecountry:mcp", // コマンド名
        description: "会社を作る", // コマンド説明
        permissionLevel: CommandPermissionLevel.Any, // 権限レベル: 誰でも
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ], 
    }

    // helloコマンドを登録
    ev.customCommandRegistry.registerCommand(cmcp, makeComp);
    ev.customCommandRegistry.registerCommand(csmcp, makeComp);

});

function makeComp(origin) {
    // origin には実行者エンティティやブロックが入る

    // もし実行者エンティティの種族がプレイヤーではないなら
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        // コマンド結果を返す
        return {
            status: CustomCommandStatus.Failure, // 失敗
            message: "実行者はプレイヤーである必要があります",
        }
    }
    companymenu(origin.sourceEntity)//player
    // コマンド結果を返す
    return {
        status: CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const ccpl = {
        name: "makecountry:companylist", // コマンド名
        description: "会社のリストを見る", // コマンド説明
        permissionLevel: CommandPermissionLevel.Any, // 権限レベル: 誰でも
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ], 
    }
    const cscpl = {
        name: "makecountry:cpl", // コマンド名
        description: "会社のリストを見る", // コマンド説明
        permissionLevel: CommandPermissionLevel.Any, // 権限レベル: 誰でも
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ], 
    }

    // helloコマンドを登録
    ev.customCommandRegistry.registerCommand(ccpl, cpl);
    ev.customCommandRegistry.registerCommand(cscpl, cpl);

});

function cpl(origin) {
    // origin には実行者エンティティやブロックが入る

    // もし実行者エンティティの種族がプレイヤーではないなら
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        // コマンド結果を返す
        return {
            status: CustomCommandStatus.Failure, // 失敗
            message: "実行者はプレイヤーである必要があります",
        }
    }
    companyList(origin.sourceEntity)//player
    // コマンド結果を返す
    return {
        status: CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}