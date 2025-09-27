import { Player, system, world } from "@minecraft/server";
import * as DyProp from "./DyProp";
import { FormCancelationReason } from "@minecraft/server-ui";
import { ActionForm, ModalForm } from "./form_class";
const ActionFormData = ActionForm;
const ModalFormData = ModalForm;
import config from "../config";
import { acceptAlliance, acceptApplicationRequest, acceptMergeRequest, AddHostilityByPlayer, createPlotGroup, CreateRoleToCountry, DeleteCountry, DeleteRole, denyAllianceRequest, denyApplicationRequest, denyMergeRequest, MakeCountry, playerChangeOwner, playerCountryInvite, playerCountryJoin, playerCountryKick, RemoveAlliance, RemoveFriendly, sendAllianceRequest, sendApplicationForPeace, sendFriendlyRequest, sendMergeRequest } from "./land";
import { CheckPermission, CheckPermissionFromLocation, GetAndParsePropertyData, GetPlayerChunkPropertyId, HasPermission, isDecimalNumber, isDecimalNumberZeroOK, StringifyAndSavePropertyData } from "./util";
import { nameSet } from "./nameset";
import { ChestFormData } from "./chest-ui";
import { kingdomsSettingForm, resourcePointConverter } from "./kingdoms_form";
import { country } from "../api/api";
import { RewardBuff } from "../api/rewardbuff";
import { DynamicProperties } from "../api/dyp";

/**
 * @type {DynamicProperties}
 */
let playerDataBase;
/**
 * @type {DynamicProperties}
 */
let chunkDataBase;
/**
 * @type {DynamicProperties}
 */
let countryDataBase;
/**
 * @type {DynamicProperties}
 */
let chestDataBase;
/**
 * @type {DynamicProperties}
 */
let roleDataBase;
world.afterEvents.worldLoad.subscribe(() => {
    playerDataBase = new DynamicProperties("player");
    chunkDataBase = new DynamicProperties("chunk");
    countryDataBase = new DynamicProperties("country");
    chestDataBase = new DynamicProperties("chest");
    roleDataBase = new DynamicProperties("role");
});


/**
 * 
 * @param {Player} player 
 * @param {string} id 
 */
export function chestLockForm(player, id) {
    const form = new ActionFormData();
    form.title({ translate: `form.chestlock.title` });
    /**
     * @type {{id: string,player: id}}
     */
    let chestData = GetAndParsePropertyData(id, chestDataBase);
    let lock = true;
    if (chestData) {
        form.button({ translate: `form.button.chestlock.disabled` });
        lock = false;
    } else {
        form.button({ translate: `form.button.chestlock.enabled` });
        chestData = { id: id, player: player.id };
        lock = true;
    };
    form.show(player).then((rs) => {
        if (rs.canceled) {
            return;
        };
        switch (rs.selection) {
            case 0: {
                if (lock) {
                    StringifyAndSavePropertyData(id, chestData, chestDataBase);
                } else {
                    chestDataBase.delete(id);
                };
                player.sendMessage({ translate: `updated` });
                break;
            };
        };
    });
};

/**
 * 国民一覧
 * @param {Player} player 
 */
export function settingCountryMembersForm(player) {
    const form = new ActionFormData();
    form.title({ translate: `form.setting.members.title` });
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const countryData = GetAndParsePropertyData(`country_${playerData?.country}`, countryDataBase);
    const members = [];
    countryData.members.forEach(memberId => {
        members.push(GetAndParsePropertyData(`player_${memberId}`, playerDataBase));
    });
    members.forEach(member => {
        form.button(`${member.name}\n${member.id}`);
    });
    //処理書け
    form.show(player).then(rs => {
        if (rs.canceled) {
            settingCountry(player);
            return;
        };
        memberSelectedShowForm(player, members[rs.selection], countryData);
        return;
    });
};

/**
 * 選んだメンバーを表示
 * @param {Player} player 
 * @param {{country: undefined|number,name: string,id: string}} member 
 * @param {any} countryData
 */
export function memberSelectedShowForm(player, member, countryData) {
    /**
     * @type {RawMessage}
     */
    const bodyData = [
        { translate: `` }
    ];
    const form = new ActionFormData();
    form.title({ translate: `form.memberselectedshow.title`, with: [member.name] });
    form.body({ rawtext: bodyData });
    //ボタン追加
    /*
    明日の自分へ
    設定項目考えておいて
    */

    //ロール変更(admin権限)
    //国から追い出す(kickMember)
    //オーナー権限の譲渡(owner)
    form.button({ translate: `mc.button.close` });
    if (!CheckPermission(player, `kick`)) form.button({ translate: `form.memberselectedshow.button.kick` });
    if (!CheckPermission(player, `admin`)) form.button({ translate: `form.memberselectedshow.button.role` });
    if (!CheckPermission(player, `owner`)) form.button({ translate: `form.memberselectedshow.button.owner` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            settingCountryMembersForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            case 1: {
                //国から追い出す
                if (player.id === member.id) {
                    player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `form.kick.error.same` }] });
                    return;
                };
                const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
                const countryData = GetAndParsePropertyData(`country_${playerData.country}`, countryDataBase);
                if (member.id === countryData.owner) {
                    player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `form.kick.error.owner` }] });
                    return;
                };
                /*if (player.id != countryData.owner && !CheckPermission(world.getPlayers().find(p => p.id == member.id), `admin`)) {
                    player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `form.kick.error.admin` }] });
                };*/
                playerKickCheckForm(player, member, countryData);
                break;
            };
            case 2: {
                //ロール変更
                playerRoleChangeForm(player, member, countryData);
                break;
            };
            case 3: {
                //オーナー権限の譲渡
                if (player.id === member.id) {
                    player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `form.owner.error.same` }] });
                    return;
                };
                //確認フォーム → 譲渡(countryData.owner変更,ownerロールを外して新オーナーに追加)
                playerOwnerChangeCheckForm(player, member, countryData);
                break;
            };
        };
    });
};

/**
 * 所有権譲渡チェック
 * @param {Player} player 
 * @param {Player} member 
 */
export function playerOwnerChangeCheckForm(player, member, countryData) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const form = new ActionFormData();
    form.body({ translate: `ownerchange.check.body`, with: [member.name] });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.ownerchange` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            memberSelectedShowForm(player, member, countryData);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            case 1: {
                const newCountryData = GetAndParsePropertyData(`country_${playerData.country}`, countryDataBase);
                playerChangeOwner(player, member, newCountryData);
                break;
            };
        };
    });
};

/**
 * キックチェック
 * @param {Player} player 
 * @param {Player} member 
 */
export function playerKickCheckForm(player, member, countryData) {
    const form = new ActionFormData();
    form.body({ translate: `kick.check.body`, with: [member.name] });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.kick` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            memberSelectedShowForm(player, member, countryData);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            case 1: {
                playerCountryKick(member);
                player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `kicked.finish.message.sender`, with: [member.name] }] });
                settingCountryMembersForm(player);
                break;
            };
        };
    });
};

/**
 * 
 * @param {Player} player 
 * @param {Player} member 
 * @param {any} countryData 
 */
export function playerRoleChangeForm(player, member, countryData) {
    let EnableEditRoleIds = [];
    const memberData = GetAndParsePropertyData(`player_${member.id}`, playerDataBase);
    if (countryData?.owner === player.id) {
        for (const role of countryData?.roles) {
            EnableEditRoleIds.push(role);
        };
    } else {
        const playerAdminRoles = [];
        for (const role of countryData?.roles) {
            const roleData = GetAndParsePropertyData(`role_${role}`, roleDataBase);
            if (roleData.permissions.includes(`admin`)) {
                playerAdminRoles.push(role);
            } else {
                EnableEditRoleIds.push(role);
            };
        };
    };
    if (EnableEditRoleIds.length === 0) {
        const form = new ActionFormData();
        form.title({ translate: `error.message` });
        form.body({ translate: `not.exsit.can.accessrole` });
        form.button({ translate: `mc.button.close` });
        form.show(player).then(rs => {
            if (rs.canceled) {
                memberSelectedShowForm(player, member, countryData);
                return;
            };
            //閉じる
            return;
        });
    } else {
        let memberRoleExsits = [];
        const form = new ModalFormData();
        form.title({ translate: `form.role.change.title` });
        for (const roleId of EnableEditRoleIds) {
            const role = GetAndParsePropertyData(`role_${roleId}`, roleDataBase);
            const value = memberData.roles.includes(roleId);
            if (value) memberData.roles.splice(memberData.roles.indexOf(roleId), 1);
            memberRoleExsits.push(value);
            form.toggle(role.name, value);
            form.submitButton({ translate: `mc.button.update` });
        };
        form.show(player).then(rs => {
            if (rs.canceled) {
                memberSelectedShowForm(player, member, countryData);
                return;
            };
            for (let i = 0; i < memberRoleExsits.length; i++) {
                if (rs.formValues[i]) {
                    memberData.roles.push(EnableEditRoleIds[i]);
                    const roleData = GetAndParsePropertyData(`role_${EnableEditRoleIds[i]}`, roleDataBase);
                    roleData.members.push(`${memberData.id}`);
                    StringifyAndSavePropertyData(`role_${EnableEditRoleIds[i]}`, roleData, roleDataBase);
                } else {
                    const roleData = GetAndParsePropertyData(`role_${EnableEditRoleIds[i]}`, roleDataBase);
                    roleData.members.splice(roleData.members.indexOf(memberData.id), 1);
                    StringifyAndSavePropertyData(`role_${EnableEditRoleIds[i]}`, roleData, roleDataBase);
                };
            };
            StringifyAndSavePropertyData(`player_${memberData.id}`, memberData, playerDataBase);
            memberSelectedShowForm(player, member, countryData);
            return;
        });
    };
};

/**
 * 
 * @param {Player} player 
 */
export function playerMainMenu(player) {
    const form = new ActionFormData();
    form.title({ translate: `form.mainmenu.title` });
    const rewardBuff = new RewardBuff();
    const jobsBuffs = rewardBuff.getAllBuffs();
    const keys = Object.keys(jobsBuffs);
    let body = `§b-JobsBuffList-§r\n`;
    for (const key of keys) {
        let buffLore = `[${key}]\n`
        for (const buff of jobsBuffs[key]) {
            buffLore += `§ax ${buff.multiplier} §e[${buff.remainingTime}s]§r\n`
        };
        body += buffLore;
    };
    form.body(body);
    form.button({ translate: `form.mainmenu.button.profile` });
    form.button({ translate: `form.mainmenu.button.sendmoney` });
    form.button({ translate: `form.mainmenu.button.join` });
    form.button({ translate: `form.mainmenu.button.setting` });
    form.button({ translate: `form.mainmenu.button.penname` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            if (rs.cancelationReason === FormCancelationReason.UserBusy) {
                system.runTimeout(() => {
                    playerMainMenu(player);
                }, 10);
                return;
            };
            return;
        };
        switch (rs.selection) {
            case 0: {
                showProfileForm(player);
                break;
            };
            case 1: {
                sendMoneyForm(player);
                break;
            };
            case 2: {
                const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
                if (playerData?.country) {
                    player.sendMessage({ translate: `already.country.join` });
                    return;
                };
                joinTypeSelectForm(player);
                break;
            };
            case 3: {
                playerSettingForm(player);
                break;
            };
            case 4: {
                if (config.pennameEnable) {
                    penNameMainForm(player);
                    return;
                };
                break;
            };
        };
    });
};

/**
 * 
 * @param {Player} player 
 */
function playerSettingForm(player) {
    const form = new ModalFormData();
    const uiTypes = [undefined, 'kingdoms', 'towny'];
    const index = uiTypes.indexOf(player.getDynamicProperty('uiType'));
    form.title({ translate: 'form.mainmenu.button.setting' });
    form.dropdown('UI Type', ['default', 'kingdoms', 'towny'], index);
    form.submitButton({ translate: 'mc.button.update' });
    form.show(player).then((rs) => {
        if (rs.canceled) {
            playerMainMenu(player);
            return;
        };
        player.setDynamicProperty('uiType', uiTypes[rs.formValues[0]]);
        player.sendMessage({ translate: 'updated' });
    });
};

/**
 * 二つ名メインフォーム
 * @param {Player} player 
 */
export function penNameMainForm(player) {
    const form = new ActionFormData();
    let penNameBefore = player.getDynamicProperty(`pennameBefore`) ?? config.initialPennameBefore;
    let penNameAfter = player.getDynamicProperty(`pennameAfter`) ?? config.initialPennameAfter;
    form.body(`${penNameBefore}${penNameAfter}`);
    form.button({ rawtext: [{ translate: `form.penname.button.before` }, { text: `\n${penNameBefore}` }] });
    form.button({ rawtext: [{ translate: `form.penname.button.after` }, { text: `\n${penNameAfter}` }] });
    form.show(player).then((rs) => {
        if (rs.canceled) {
            playerMainMenu(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                penNameBeforeForm(player);
                break;
            };
            case 1: {
                penNameAfterForm(player);
                break;
            };
        };
    });
};

/**
 * 二つ名(前)設定
 * @param {Player} player 
 */
export function penNameBeforeForm(player) {
    const form = new ActionFormData();
    form.title({ translate: `form.penname.button.before` });
    let tags = player.getTags().filter(tag => tag.startsWith(`mcPenNameBefore`));
    tags.unshift(`${config.initialPennameBefore}`);
    for (const penname of tags) {
        form.button(`${penname.replace(`mcPenNameBefore`, ``)}`);
    };
    form.show(player).then((rs) => {
        if (rs.canceled) {
            penNameMainForm(player);
            return;
        };
        player.setDynamicProperty(`pennameBefore`, tags[rs.selection].replace(`mcPenNameBefore`, ``));
        player.sendMessage({ translate: `updated` });
    });
};

/**
 * 二つ名(後)設定
 * @param {Player} player 
 */
export function penNameAfterForm(player) {
    const form = new ActionFormData();
    form.title({ translate: `form.penname.button.after` });
    let tags = player.getTags().filter(tag => tag.startsWith(`mcPenNameAfter`));
    tags.unshift(`${config.initialPennameAfter}`);
    for (const penname of tags) {
        form.button(`${penname.replace(`mcPenNameAfter`, ``)}`);
    };
    form.show(player).then((rs) => {
        if (rs.canceled) {
            penNameMainForm(player);
            return;
        };
        player.setDynamicProperty(`pennameAfter`, tags[rs.selection].replace(`mcPenNameAfter`, ``));
        player.sendMessage({ translate: `updated` });
    });
};

/**
 * 金を送れるプレイヤーのリスト
 * @param {Player} player 
 * @param {boolean} serch 
 * @param {string} keyword 
 */
export function sendMoneyForm(player, serch = false, keyword = ``) {
    const form = new ActionFormData();
    let players = world.getPlayers().filter(p => p.id != player.id);
    form.title({ translate: `form.sendmoney.list.title` });
    form.button({ translate: `form.sendmoney.button.serch` });
    if (serch) {
        players = players.filter(p => p.name.includes(keyword));
    };
    for (const p of players) {
        if (p.id === player.id) continue;
        form.button(`${p.name}§r\n${p.id}`);
    };
    form.show(player).then(rs => {
        if (rs.canceled) {
            playerMainMenu(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //検索form
                serchSendMoneyForm(player, keyword);
                break;
            };
            default: {
                sendMoneyCheckForm(player, players[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 送金するプレイヤーの条件絞り込み検索
 * @param {Player} player 
 * @param {string} keyword 
 */
export function serchSendMoneyForm(player, keyword) {
    const form = new ModalFormData();
    form.title({ translate: `form.serchsendmoney.title` });
    form.textField({ translate: `form.serchsendmoney.word.label` }, { translate: `form.serchsendmoney.word.input` }, keyword);
    form.submitButton({ translate: `mc.button.serch` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            sendMoneyForm(player, true, keyword);
            return;
        };
        sendMoneyForm(player, true, rs.formValues[0]);
        return;
    });
};

/**
 * 送金チェックフォーム
 * @param {Player} sendPlayer 
 * @param {Player} receivePlayer 
 */
export function sendMoneyCheckForm(sendPlayer, receivePlayer) {
    const sendPlayerData = GetAndParsePropertyData(`player_${sendPlayer.id}`, playerDataBase);
    const form = new ModalFormData();
    form.title({ translate: `form.sendmoney.check.title` });
    form.textField({ rawtext: [{ translate: `form.sendmoney.check.label` }, { text: `: ${sendPlayerData?.money}` }] }, { translate: `input.number` });
    form.submitButton({ translate: `mc.button.sendmoney` });
    form.show(sendPlayer).then(rs => {
        if (rs.canceled) {
            sendMoneyForm(sendPlayer);
            return;
        };
        const value = Number(rs.formValues[0]);;
        if (!isDecimalNumber(value)) {
            sendPlayer.sendMessage({ translate: `input.error.notnumber` });
            return;
        };
        const receivePlayerData = GetAndParsePropertyData(`player_${receivePlayer.id}`, playerDataBase);
        const sendPlayerData2 = GetAndParsePropertyData(`player_${sendPlayer.id}`, playerDataBase);
        if (sendPlayerData2.money < value) {
            sendPlayer.sendMessage({ translate: `command.error.trysend.moremoney.youhave`, with: [`${sendPlayerData2.money}`] });
            return;
        };
        receivePlayerData.money += value;
        sendPlayerData2.money -= value;
        sendPlayerData2.money = Math.floor(sendPlayerData2.money * 100) / 100;
        receivePlayerData.money = Math.floor(receivePlayerData.money * 100) / 100;
        sendPlayer.sendMessage({ translate: `command.sendmoney.result.sender`, with: [receivePlayer.name, `${config.MoneyName} ${value}`] });
        receivePlayer.sendMessage({ translate: `command.sendmoney.result.receiver`, with: [sendPlayer.name, `${config.MoneyName} ${value}`] });
        StringifyAndSavePropertyData(`player_${receivePlayer.id}`, receivePlayerData, playerDataBase);
        StringifyAndSavePropertyData(`player_${sendPlayer.id}`, sendPlayerData2, playerDataBase);
        return;
    });
};

/**
 * 招待を送れるプレイヤーのリスト
 * @param {Player} player 
 * @param {boolean} serch 
 * @param {string} keyword 
 */
export function inviteForm(player, serch = false, keyword = ``) {
    if (CheckPermission(player, `invite`)) {
        player.sendMessage({ translate: `send.invite.error.permission.message` });
        return;
    };
    const form = new ActionFormData();
    let players = world.getPlayers().filter(p => !GetAndParsePropertyData(`player_${p.id}`, playerDataBase)?.country);
    players.filter(p => p.id !== player.id);
    form.title({ translate: `form.sendinvite.list.title` })
    form.button({ translate: `form.invite.button.serch` });
    if (serch) {
        players = players.filter(p => p.name.includes(keyword));
    };
    players.forEach(p => {
        form.button(`${p.name}§r\n${p.id}`);
    });
    form.show(player).then(rs => {
        if (rs.canceled) {
            settingCountry(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //検索form
                serchInviteForm(player, keyword);
                break;
            };
            default: {
                sendInviteCheckForm(player, players[rs.selection - 1]);
                break;
            };
        };
    });
};

export function serchInviteForm(player, keyword) {
    const form = new ModalFormData();
    form.title({ translate: `form.serchinvite.title` });
    form.textField({ translate: `form.serchinvite.word.label` }, { translate: `form.serchinvite.word.input` }, keyword);
    form.submitButton({ translate: `mc.button.serch` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            inviteForm(player, true, keyword);
            return;
        };
        inviteForm(player, true, rs.formValues[0]);
        return;
    });
};

/**
 * 招待チェックフォーム
 * @param {Player} sendPlayer 
 * @param {Player} receivePlayer 
 */
export function sendInviteCheckForm(sendPlayer, receivePlayer) {
    const form = new ActionFormData();
    form.title({ translate: `form.sendinvite.check.title` });
    form.body({ translate: `form.sendinvite.check.body`, with: [receivePlayer.name] });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.send` });
    form.show(sendPlayer).then(rs => {
        if (rs.canceled) {
            inviteForm(sendPlayer);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            case 1: {
                playerCountryInvite(receivePlayer, sendPlayer);
                break;
            };
        };
    });
};

/**
 * プロフィールを表示
 * @param {Player} player 
 */
export function showProfileForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const showProfile = [
        { translate: `msg.name` }, { text: `${playerData?.name} §r\n` },
        { translate: `msg.lv` }, { text: `${player.level} §r\n` },
        { translate: `msg.havemoney` }, { text: `${playerData?.money} §r\n` },
        { translate: `msg.days` }, { text: `${playerData?.days} §r\n` },
        { translate: `msg.country` }, { text: `${playerData?.country ?? `None`} §r\n` },
        { translate: `msg.invite` }, { text: `${playerData?.invite.length ?? `None`} §r\n` },
        { translate: `msg.havechunks` }, { text: `${playerData?.chunks.length} §r` }
    ];
    const form = new ActionFormData();
    form.title({ translate: `form.profile.title` });
    form.body({ rawtext: showProfile })
    form.button({ translate: `mc.button.close` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            playerMainMenu(player);
            return;
        };
        //閉じる
        return;
    });
};

/**
 * 国に参加するときの形式選択
 * @param {Player} player 
 */
export function joinTypeSelectForm(player) {
    const form = new ActionFormData();
    form.title({ translate: `form.invite.title` });
    form.button({ translate: `form.invite.check.invite` });
    form.button({ translate: `form.invite.list.allowjoin` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            if (rs.cancelationReason === FormCancelationReason.UserBusy) {
                system.runTimeout(() => {
                    joinTypeSelectForm(player);
                }, 10);
                return;
            };
            playerMainMenu(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //招待を確認
                countryInvitesList(player);
                break;
            };
            case 1: {
                //入れる国のリスト
                allowJoinCountriesList(player);
                break;
            };
        };
    });
};

/**
 * 
 * @param {Player} player 
 * @param {any} countryData 
 */
export function joinCheckFromInviteForm(player, countryData) {
    try {
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`, playerDataBase);
        const membersId = countryData.members.filter(m => m !== ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`, playerDataBase);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`, roleDataBase).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`, roleDataBase).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.join` });
        form.button({ translate: `mc.button.close` });
        form.show(player).then(rs => {
            if (rs.canceled) {
                countryInvitesList(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    playerData.invite.filter(i => i != countryData.id);
                    StringifyAndSavePropertyData(`player_${playerData.id}`, playerData, playerDataBase);
                    playerCountryJoin(player, countryData.id);
                    return;
                };
                case 1: {
                    //閉じる
                    return;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 
 * @param {Player} player 
 * @param {any} countryData 
 */
export function joinCheckFromListForm(player, countryData) {
    try {
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`, playerDataBase);
        const membersId = countryData.members.filter(m => m !== ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`, playerDataBase);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`, roleDataBase).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`, roleDataBase).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.join` });
        form.button({ translate: `mc.button.close` });
        form.show(player).then(rs => {
            if (rs.canceled) {
                allowJoinCountriesList(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    playerCountryJoin(player, countryData.id);
                    return;
                };
                case 1: {
                    //閉じる
                    return;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};


/**
 * 
 * @param {Player} player 
 */
export function countryInvitesList(player) {
    let playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const countriesData = [];
    for (const id of playerData?.invite) {
        const d = GetAndParsePropertyData(`country_${id}`, countryDataBase);
        if (!d) {
            playerData?.invite.filter(i => i != id);
            continue;
        };
        countriesData.push(d);
    };
    StringifyAndSavePropertyData(`player_${player.id}`, playerData, playerDataBase);
    const form = new ActionFormData();
    if (countriesData.length === 0) {
        form.body({ translate: `no.invite.country` });
        form.button({ translate: `mc.button.close` });
    };
    countriesData.forEach(countryData => {
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    });
    form.show(player).then(rs => {
        if (rs.canceled) {
            joinTypeSelectForm(player);
            return;
        };
        if (countriesData.length === 0) {
            //閉じる
            return;
        };
        joinCheckFromInviteForm(player, countriesData[rs.selection]);
        return;
    });
};

/**
 * 
 * @param {Player} player 
 */
export function allowJoinCountriesList(player) {
    const countriesData = [];
    for (const id of countryDataBase.idList) {
        const d = GetAndParsePropertyData(id);
        if (!d.invite) countriesData.push(d);
    };
    const form = new ActionFormData();
    if (countriesData.length === 0) {
        form.body({ translate: `no.allowjoin.country` })
        form.button({ translate: `mc.button.close` });
    };
    countriesData.forEach(countryData => {
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    });
    form.show(player).then(rs => {
        if (rs.canceled) {
            joinTypeSelectForm(player);
            return;
        };
        if (countriesData.length === 0) {
            //閉じる
            return;
        };
        joinCheckFromListForm(player, countriesData[rs.selection]);
        return;
    });
};

/**
 * 国庫
 * @param {Player} player 
 */
export function treasuryMainForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const countryData = GetAndParsePropertyData(`country_${playerData.country}`, countryDataBase);
    const form = new ActionFormData();
    form.title({ translate: `form.treasurymain.title` });
    form.body({ rawtext: [{ translate: `treasurybudget.body` }, { text: `${config.MoneyName} ${countryData.money}\n` }, { translate: `resourcepoint.body` }, { text: `${countryData.resourcePoint}` }] });
    form.button({ translate: `treasurybudget` });
    form.button({ translate: `resourcepoint` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            settingCountry(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                treasurybudgetSelectForm(player);
                break;
            };
            case 1: {
                resourcepointSelectForm(player);
                break;
            };
        };
    });
};

/**
 * 
 * 国家予算のメインフォーム
 * @param {Player} player 
 */
export function treasurybudgetSelectForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const countryData = GetAndParsePropertyData(`country_${playerData.country}`, countryDataBase);
    const form = new ActionFormData();
    form.title({ translate: `treasurybudget` });
    form.body({ rawtext: [{ translate: `treasurybudget` }, { text: `${config.MoneyName} ${countryData.money}` }] });
    form.button({ translate: `deposit` });
    if (!CheckPermission(player, `withDrawTreasurybudget`)) form.button({ translate: `withdraw` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            treasuryMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                treasurybudgetDepositForm(player);
                break;
            };
            case 1: {
                treasurybudgetWithdrawForm(player);
                break;
            };
        };
    });
};

/**
 * 
 * 国家予算の入金フォーム
 * @param {Player} player 
 */
export function treasurybudgetDepositForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const form = new ModalFormData();
    form.title({ translate: `treasurybudget.deposit` });
    form.textField({ rawtext: [{ translate: `deposit` }, { text: `: ${playerData.money}` }] }, { translate: `input.number` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            treasurybudgetSelectForm(player);
            return;
        };
        let needMoney = Number(rs.formValues[0]);
        if (!isDecimalNumber(needMoney)) {
            player.sendMessage({ translate: `input.error.notnumber` });
            return;
        };
        const playerData2 = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
        const countryData2 = GetAndParsePropertyData(`country_${playerData2.country}`, countryDataBase);
        let hasMoney = playerData2.money;
        if (hasMoney < needMoney) {
            player.sendMessage({ translate: `error.notenough.money` });
            return;
        };
        playerData2.money = (Math.floor(playerData2.money * 100) / 100) - needMoney;
        countryData2.money = (Math.floor(countryData2.money * 100) / 100) + needMoney;
        StringifyAndSavePropertyData(`player_${player.id}`, playerData2, playerDataBase);
        StringifyAndSavePropertyData(`country_${playerData2.country}`, countryData2, countryDataBase);
        treasurybudgetSelectForm(player);
        return;
    });
};

/**
 * 
 * 国家予算の出金フォーム
 * @param {Player} player 
 */
export function treasurybudgetWithdrawForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const countryData = GetAndParsePropertyData(`country_${playerData.country}`, countryDataBase);
    const form = new ModalFormData();
    form.title({ translate: `treasurybudget.withdraw` });
    form.textField({ rawtext: [{ translate: `withdraw` }, { text: `: ${countryData.money}` }] }, { translate: `input.number` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            treasurybudgetSelectForm(player);
            return;
        };
        let needMoney = Number(rs.formValues[0]);;
        if (!isDecimalNumber(needMoney)) {
            player.sendMessage({ translate: `input.error.notnumber` });
            return;
        };
        const playerData2 = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
        const countryData2 = GetAndParsePropertyData(`country_${playerData2.country}`, countryDataBase);
        let hasMoney = countryData2.money;
        if (hasMoney < needMoney) {
            player.sendMessage({ translate: `error.notenough.treasurybudget` });
            return;
        };
        playerData2.money = (Math.floor(playerData2.money * 100) / 100) + needMoney;
        countryData2.money = (Math.floor(countryData2.money * 100) / 100) - needMoney;
        StringifyAndSavePropertyData(`player_${player.id}`, playerData2, playerDataBase);
        StringifyAndSavePropertyData(`country_${playerData2.country}`, countryData2, countryDataBase);
        treasurybudgetSelectForm(player);
        return;
    });
};

/**
 * 
 * リソースポイントのメインフォーム
 * @param {Player} player 
 */
export function resourcepointSelectForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const countryData = GetAndParsePropertyData(`country_${playerData.country}`, countryDataBase);
    const form = new ActionFormData();
    form.title({ translate: `resourcepoint` });
    form.body({ rawtext: [{ translate: `resourcepoint` }, { text: `${config.MoneyName} ${countryData.resourcePoint}` }] });
    form.button({ translate: `conversion` });
    if (!CheckPermission(player, `withDrawResourcepoint`)) form.button({ translate: `withdraw` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            treasuryMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                resourcepointDepositForm(player);
                break;
            };
            case 1: {
                resourcepointWithdrawForm(player);
                break;
            };
        };
    });
};

/**
 * 
 * リソースポイントの入金フォーム
 * @param {Player} player 
 */
export function resourcepointDepositForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const form = new ModalFormData();
    form.title({ translate: `resourcepoint.conversion` });
    form.textField({ rawtext: [{ translate: `conversion` }, { text: ` : ${playerData.money}` }] }, { translate: `input.number` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            resourcepointSelectForm(player);
            return;
        };
        let needMoney = Number(rs.formValues[0]);;
        if (!isDecimalNumber(needMoney)) {
            player.sendMessage({ translate: `input.error.notnumber` });
            return;
        };
        const playerData2 = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
        let hasMoney = playerData2.money;
        const countryData2 = GetAndParsePropertyData(`country_${playerData2.country}`, countryDataBase);
        if (hasMoney < needMoney) {
            player.sendMessage({ translate: `error.notenough.money` });
            return;
        };
        countryData2.resourcePoint += needMoney;
        playerData2.money -= needMoney;
        playerData2.money = Math.floor(playerData2.money * 100) / 100;
        countryData2.money = Math.floor(countryData2.money * 100) / 100;
        StringifyAndSavePropertyData(`player_${player.id}`, playerData2, playerDataBase);
        StringifyAndSavePropertyData(`country_${playerData2.country}`, countryData2, countryDataBase);
        resourcepointSelectForm(player);
        return;
    });
};

/**
 * 
 * リソースポイント→金フォーム
 * @param {Player} player 
 */
export function resourcepointWithdrawForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
    const countryData = GetAndParsePropertyData(`country_${playerData.country}`, countryDataBase);
    const form = new ModalFormData();
    form.title({ translate: `resourcepoint.withdraw` });
    form.textField({ rawtext: [{ translate: `withdraw` }, { text: ` : ${countryData.resourcePoint}` }] }, { translate: `input.number` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            resourcepointSelectForm(player);
            return;
        };
        let needMoney = Number(rs.formValues[0]);;
        if (!isDecimalNumber(needMoney)) {
            player.sendMessage({ translate: `input.error.notnumber` });
            return;
        };
        const playerData2 = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
        const countryData2 = GetAndParsePropertyData(`country_${playerData2.country}`, countryDataBase);
        let hasMoney = countryData2.resourcePoint;
        if (hasMoney < needMoney) {
            player.sendMessage({ translate: `error.notenough.resourcepoint` });
            return;
        };
        countryData2.resourcePoint -= needMoney;
        playerData2.money += needMoney;
        playerData2.money = Math.floor(playerData2.money * 100) / 100;
        countryData2.money = Math.floor(countryData2.money * 100) / 100;
        StringifyAndSavePropertyData(`player_${player.id}`, playerData2, playerDataBase);
        StringifyAndSavePropertyData(`country_${playerData2.country}`, countryData2, countryDataBase);
        resourcepointSelectForm(player);
        return;
    });
};

/**
 * 
 * 国の設定
 * @param {Player} player 
 */
export function settingCountry(player) {
    const uiType = player.getDynamicProperty('uiType') ?? 'default';
    switch (uiType) {
        case 'default': {
            const form = new ActionFormData();
            form.title({ translate: `form.setting.title` });
            form.body({ translate: `form.setting.body` });
            form.button({ translate: `form.setting.button.info` });
            form.button({ translate: `form.setting.button.treasury` });
            form.button({ translate: `form.setting.button.invite` });
            form.button({ translate: `form.setting.button.members` });
            form.button({ translate: `form.setting.button.role` });
            form.button({ translate: `form.setting.button.plotgroup` });
            if (!CheckPermission(player, `owner`)) form.button({ translate: `form.setting.button.delete` });

            form.show(player).then(rs => {
                if (rs.canceled) {
                    if (rs.cancelationReason === FormCancelationReason.UserBusy) {
                        system.runTimeout(() => {
                            settingCountry(player);
                            return;
                        }, 10);
                        return;
                    };
                    //player.sendMessage({ translate: `form.cancel.message` });
                    return;
                };
                switch (rs.selection) {
                    case 0: {
                        settingCountryInfoForm(player);
                        break;
                    };
                    case 1: {
                        treasuryMainForm(player);
                        break;
                    };
                    case 2: {
                        inviteForm(player);
                        break;
                    };
                    case 3: {
                        settingCountryMembersForm(player);
                        break;
                    };
                    case 4: {
                        settingCountryRoleForm(player);
                        break;
                    };
                    case 5: {
                        settingCountryPlotGroupForm(player);
                        break;
                    };
                    case 6: {
                        countryDeleteCheckForm(player);
                        break;
                    };
                };
            });
            break;
        };
        case 'kingdoms': {
            const playerData = GetAndParsePropertyData('player_' + player.id, playerDataBase);
            const countryData = GetAndParsePropertyData('country_' + playerData.country, countryDataBase);
            const form = new ChestFormData();
            form.setTitle([{ text: `§a§l<${countryData.name}§r§a§l> §6` }, { translate: 'form.setting.title' }]);
            form.setPattern([0, 0], [
                'xoxxoxxox',
                'oo  s  oo',
                'x       x',
                'x       x',
                'oo r p oo',
                'xoxxoxxox',
            ], {
                'x': { 'iconPath': 'textures/blocks/glass_black', 'name': '', 'lore': [], 'editedName': true },
                'o': { 'iconPath': 'textures/blocks/glass_red', 'name': '', 'lore': [], 'editedName': true },
                's': { 'iconPath': 'textures/items/paper', 'name': 'form.kingdoms.sc.button.setting', 'lore': ['form.kingdoms.sc.button.setting.lore'], 'editedName': true },
                'r': { 'iconPath': 'minecraft:hay_block', 'name': 'form.kingdoms.sc.button.resourcepoint', 'lore': [{ translate: 'form.kingdoms.sc.button.resourcepoint.lore', with: [String(countryData.resourcePoint)] }], 'editedName': true },
                'p': { 'iconPath': 'minecraft:bookshelf', 'name': 'form.kingdoms.sc.button.permission', 'lore': [{ translate: 'form.kingdoms.sc.button.permission.lore', with: [String(countryData.resourcePoint)] }], 'editedName': true },
            });
            form.show(player).then((rs) => {
                if (rs.canceled) {
                    if (rs.cancelationReason == FormCancelationReason.UserBusy) {
                        system.runTimeout(() => {
                            settingCountry(player);
                        }, 5);
                    };
                };
                switch (rs.selection) {
                    case 13: {
                        kingdomsSettingForm(player);
                        break;
                    };
                    case 39: {
                        resourcePointConverter(player);
                        break;
                    };
                }
                return;
            });
            break;
        };
    };
};

/**
 * 
 * 自国の情報表示
 * @param {Player} player 
 */
export function settingCountryInfoForm(player, countryData = undefined) {
    try {
        const playerData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
        if (!countryData) countryData = GetAndParsePropertyData(`country_${playerData.country}`, countryDataBase);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`, playerDataBase);
        const membersId = countryData.members.filter(m => m !== ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`, playerDataBase);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = countryData.resourcePoint;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const countryData = GetAndParsePropertyData(`country_${id}`);
            allianceCountryName.push(countryData.name);
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const countryData = GetAndParsePropertyData(`country_${id}`);
            hostilityCountryName.push(countryData.name);
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const countryData = GetAndParsePropertyData(`country_${id}`);
            warNowCountryName.push(countryData.name);
        });

        const showBody = {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };

        const form = new ActionFormData();
        form.title({ translate: `form.setting.info.title` });
        form.body(showBody);
        form.button({ translate: `form.setting.info.button.name` });
        form.button({ translate: `form.setting.info.button.lore` });
        form.button({ translate: `form.setting.info.button.peace` });
        form.button({ translate: `form.setting.info.button.invite` });
        form.button({ translate: `form.setting.info.button.tax` });
        form.button({ translate: `form.setting.info.button.external.affairs` });
        form.button({ translate: `form.setting.info.button.publicspawn` });
        form.button({ translate: `form.setting.info.button.publicsetting` });
        form.button({ translate: `form.setting.info.button.web` });

        form.show(player).then(rs => {
            if (rs.canceled) {
                settingCountry(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    if (!CheckPermission(player, `editCountryName`)) {
                        editCountryNameForm(player, countryData);
                    } else {
                        player.sendMessage({ translate: `no.permission` });
                    };
                    break;
                };
                case 1: {
                    if (!CheckPermission(player, `editCountryLore`)) {
                        editCountryLoreForm(player, countryData);
                    } else {
                        player.sendMessage({ translate: `no.permission` });
                    };
                    break;
                };
                case 2: {
                    if (!CheckPermission(player, `peaceChange`)) {
                        editCountryPeaceForm(player, countryData);
                    } else {
                        player.sendMessage({ translate: `no.permission` });
                    };
                    break;
                };
                case 3: {
                    if (!CheckPermission(player, `inviteChange`)) {
                        editCountryInviteForm(player, countryData);
                    } else {
                        player.sendMessage({ translate: `no.permission` });
                    };
                    break;
                };
                case 4: {
                    if (!CheckPermission(player, `taxAdmin`)) {
                        editTaxMainForm(player);
                    } else {
                        player.sendMessage({ translate: `no.permission` });
                    };
                    break;
                };
                case 5: {
                    externalAffairsMainForm(player);
                    break;
                };
                case 6: {
                    if (!CheckPermission(player, `publicHomeAdmin`)) {
                        publicSpawnForm(player);
                    } else {
                        player.sendMessage({ translate: `no.permission` });
                    };
                    break;
                };
                case 7: {
                    if (!CheckPermission(player, `admin`)) {
                        publicSettingForm(player);
                    } else {
                        player.sendMessage({ translate: `no.permission` });
                    };
                    break;
                };
                case 8: {
                    if (!CheckPermission(player, `admin`)) {
                        webSettingForm(player);
                    } else {
                        player.sendMessage({ translate: `no.permission` });
                    };
                    break;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * Web関連設定画面
 * @param {Player} player 
 */
export function webSettingForm(player) {
    const form = new ModalFormData();
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    let countryData = GetAndParsePropertyData(`country_${playerData.country}`);
    form.title({ translate: `form.setting.info.button.web` });
    form.textField({ translate: `web.banner.textbox.label` }, { translate: `web.banner.textbox.input` }, countryData.banner);
    form.textField({ translate: `web.color.textbox.label` }, { translate: `web.color.textbox.input` }, countryData.colorcode);
    form.show(player).then((rs) => {
        if (rs.canceled) {
            settingCountryInfoForm(player, countryData);
            return;
        };
        countryData.banner = rs.formValues[0];
        countryData.colorcode = rs.formValues[1];
        StringifyAndSavePropertyData(`country_${playerData.country}`, countryData);
        player.sendMessage({ translate: `updated` });
        return;
    });
};

/**
 * 公開設定画面
 * @param {Player} player 
 */
export function publicSettingForm(player) {
    const form = new ModalFormData();
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    let countryData = GetAndParsePropertyData(`country_${playerData.country}`);
    form.title({ translate: `form.setting.info.button.publicsetting` });
    form.toggle({ translate: `toggle.publicsetting.country.money` }, countryData.hideMoney);
    form.show(player).then((rs) => {
        if (rs.canceled) {
            settingCountryInfoForm(player, countryData);
            return;
        };
        countryData.hideMoney = rs.formValues[0];
        StringifyAndSavePropertyData(`country_${playerData.country}`, countryData);
        player.sendMessage({ translate: `updated` });
        return;
    });
};

/**
 * パブリックホーム設定画面
 * @param {Player} player 
 */
export function publicSpawnForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    let countryData = GetAndParsePropertyData(`country_${playerData.country}`);
    const toggleValue = countryData.publicSpawn;
    const form = new ModalFormData();
    form.title({ translate: `form.setting.info.button.publicspawn` });
    form.toggle({ translate: `publicspawn.button.validity` }, toggleValue);
    form.toggle({ translate: `publicspawn.button.set` });
    form.submitButton({ translate: `mc.button.update` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            settingCountry(player);
            return;
        };
        if (CheckPermission(player, `publicHomeAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.formValues[1]) {
            const chunkData = GetAndParsePropertyData(GetPlayerChunkPropertyId(player));
            if (!chunkData) {
                player.sendMessage({ translate: `publichome.set.error.within.country` });
                return;
            };
            if (!chunkData?.countryId) {
                player.sendMessage({ translate: `publichome.set.error.within.country` });
                return;
            };
            if (chunkData?.countryId != playerData?.country) {
                player.sendMessage({ translate: `publichome.set.error.within.country` });
                return;
            };
            let { x, y, z } = player.location;
            let { x: rx, y: ry } = player.getRotation();
            let spawnString = `${Math.ceil(x) - 0.5}_${Math.ceil(y)}_${Math.ceil(z) - 0.5}_${Math.ceil(rx)}_${Math.ceil(ry)}_${player.dimension.id}`;
            countryData[`spawn`] = spawnString;
        };
        countryData.publicSpawn = rs.formValues[0];
        StringifyAndSavePropertyData(`country_${playerData.country}`, countryData);
        player.sendMessage({ translate: `updated` });
        return;
    });
};

/**
 * 対外関係メインフォーム
 * @param {Player} player 
 */
export function externalAffairsMainForm(player) {
    const form = new ActionFormData();
    form.title({ translate: `form.setting.info.button.external.affairs` });
    //中立国の権限設定
    form.button({ translate: `neutrality.permission.edit` });
    //同盟国
    form.button({ translate: `alliance` });
    //友好国
    form.button({ translate: `friendly` });
    //敵対国
    form.button({ translate: `hostility` });
    //受信した同盟申請
    form.button({ translate: `received.alliance.request` });
    //受信した講和申請
    form.button({ translate: `received.application.request` });

    //受信した併合申請
    form.button({ translate: `received.merge.request` });
    //併合申請を送信
    form.button({ translate: `send.merge.request` });

    form.show(player).then((rs) => {
        if (rs.canceled) {
            settingCountryInfoForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //中立国の権限設定
                if (!CheckPermission(player, `neutralityPermission`)) {
                    //form
                    setNeutralityPermissionForm(player);
                    break;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
            };
            case 1: {
                //同盟国
                if (!CheckPermission(player, `allyAdmin`)) {
                    //form
                    AllianceMainForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
            case 2: {
                //同盟国
                if (!CheckPermission(player, `allyAdmin`)) {
                    //form
                    FriendlyMainForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
            case 3: {
                //敵対国
                if (!CheckPermission(player, `hostilityAdmin`)) {
                    //form
                    HostilityMainForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
            case 4: {
                //受信した同盟申請
                if (!CheckPermission(player, `allyAdmin`)) {
                    //form
                    ReceivedAllianceRequestForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
            case 5: {
                //受信した講和申請
                if (!CheckPermission(player, `hostilityAdmin`)) {
                    ReceivedApplicationRequestForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
            case 6: {
                //受信した併合申請
                if (!CheckPermission(player, `owner`)) {
                    ReceivedMergeRequestForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
            case 7: {
                //併合申請を送信
                if (!CheckPermission(player, `owner`)) {
                    sendMergeRequestListForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
        };
    });
};

/**
 * 受信した同盟申請
 * @param {Player} player 
 */
export function ReceivedAllianceRequestForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    let receivedAllianceRequests = playerCountryData.allianceRequestReceive
    const form = new ActionFormData();
    form.title({ translate: `received.alliance.request` });
    form.button({ translate: `mc.button.close` });
    for (const countryId of receivedAllianceRequests) {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (CheckPermission(player, `allyAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
        };
        if (rs.canceled) {
            externalAffairsMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            default: {
                allianceRequestCountryForm(player, receivedAllianceRequests[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 受信リストから選択した国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function allianceRequestCountryForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m != ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody = {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${config.MoneyName} ${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.approval` });
        form.button({ translate: `mc.button.delete` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `allyAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                ReceivedAllianceRequestForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    break;
                };
                case 1: {
                    acceptAlliance(player, countryId);
                    break;
                };
                case 2: {
                    denyAllianceRequest(player, countryId);
                    break;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 受信した講和申請
 * @param {Player} player 
 */
export function ReceivedApplicationRequestForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    let receivedApplicationRequests = playerCountryData.applicationPeaceRequestReceive
    const form = new ActionFormData();
    form.title({ translate: `received.application.request` });
    form.button({ translate: `mc.button.close` });
    for (const countryId of receivedApplicationRequests) {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (CheckPermission(player, `hostilityAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
        };
        if (rs.canceled) {
            externalAffairsMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            default: {
                applicationRequestCountryForm(player, receivedApplicationRequests[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 受信リストから選択した国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function applicationRequestCountryForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m != ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.approval` });
        form.button({ translate: `mc.button.delete` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `allyAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                ReceivedAllianceRequestForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    break;
                };
                case 1: {
                    acceptApplicationRequest(player, countryId);
                    break;
                };
                case 2: {
                    denyApplicationRequest(player, countryId);
                    break;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};


/**
 * マージ申請を送信する国のリスト
 * @param {Player} player 
 */
export function sendMergeRequestListForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    if (playerCountryData.days < config.mergeProtectionDuration) return;
    let mergeRequestSend = playerCountryData?.mergeRequestSend ?? [];
    const form = new ActionFormData();
    form.title({ translate: `form.merge.send.title` });
    let countryIds = countryDataBase.idList.filter(id => id != `country_${playerData.country}`);
    let filtered1 = countryIds.filter(id => !mergeRequestSend.includes(id) && GetAndParsePropertyData(id)?.days >= config.mergeProtectionDuration);
    form.button({ translate: `mc.button.close` });
    let lands = [];
    for (const countryId of filtered1) {
        const countryData = GetAndParsePropertyData(countryId);
        lands.push(countryData.id);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (CheckPermission(player, `allyAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            externalAffairsMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            default: {
                sendMergeRequestFromListForm(player, lands[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 同盟国候補一覧から選んだ国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function sendMergeRequestFromListForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m != ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.send` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `allyAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                sendMergeRequestListForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    return;
                };
                case 1: {
                    checkSendMergeForm(player, countryId);
                    return;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * マージ申請送信チェックフォーム
 * @param {Player} player 
 * @param {Number} countryId 
 */
export function checkSendMergeForm(player, countryId) {
    const form = new ActionFormData();
    form.title({ translate: `form.check.merge.send.title` });
    form.body({ translate: 'form.check.merge.send.body' });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.send` });
    form.show(player).then((rs) => {
        if (CheckPermission(player, `allyAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            sendMergeRequestFromListForm(player, countryId);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                return;
            };
            case 1: {
                sendMergeRequest(player, countryId);
                return;
            };
        };
    });
};

/**
 * 受信したマージ申請
 * @param {Player} player 
 */
export function ReceivedMergeRequestForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    let receivedMergeRequests = playerCountryData.mergeRequestReceive ?? [];
    const form = new ActionFormData();
    form.title({ translate: `received.merge.request` });
    form.button({ translate: `mc.button.close` });
    for (const countryId of receivedMergeRequests) {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (CheckPermission(player, `hostilityAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
        };
        if (rs.canceled) {
            externalAffairsMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            default: {
                MergeRequestCountryForm(player, receivedMergeRequests[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 受信リストから選択した国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function MergeRequestCountryForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m != ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.approval` });
        form.button({ translate: `mc.button.delete` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `allyAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                ReceivedMergeRequestForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    break;
                };
                case 1: {
                    acceptMergeRequest(player, countryId);
                    break;
                };
                case 2: {
                    denyMergeRequest(player, countryId);
                    break;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};


/**
 * 同盟国メインフォーム
 * @param {Player} player 
 */
export function AllianceMainForm(player) {
    const form = new ActionFormData();
    form.title({ translate: `form.alliance.main.title` });
    form.button({ translate: `alliance.permission.edit` });
    form.button({ translate: `form.alliance.list.title` });
    //ここに一覧ボタン
    //一覧フォームには追加ボタンも用意する
    form.show(player).then((rs) => {
        if (rs.canceled) {
            externalAffairsMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                if (!CheckPermission(player, `allyAdmin`)) {
                    //form
                    setAlliancePermissionForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
            //1 一覧フォーム
            case 1: {
                if (!CheckPermission(player, `allyAdmin`)) {
                    //form
                    AllianceListForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
        };
    });
};

/**
 * 同盟国リストフォーム
 * @param {Player} player 
 */
export function AllianceListForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    let allianceCountryIds = playerCountryData.alliance;
    const form = new ActionFormData();
    form.title({ translate: `form.alliance.list.title` });
    form.button({ translate: `form.check.alliance.send.title` });
    for (const countryId of allianceCountryIds) {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (rs.canceled) {
            AllianceMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //追加フォーム
                AddAllianceListForm(player);
                break;
            };
            default: {
                //詳細表示＆選択肢
                AllianceCountryFromListForm(player, allianceCountryIds[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 新たに同盟国にする国のリスト
 * @param {Player} player 
 */
export function AddAllianceListForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    let hostilityCountryIds = playerCountryData.hostility;
    let allianceCountryIds = playerCountryData.alliance;
    let friendlyCountryIds = playerCountryData.friendly;
    const form = new ActionFormData();
    form.title({ translate: `form.check.alliance.send.title` });
    let countryIds = countryDataBase.idList.filter(id => id.startsWith(`country_`)).filter(id => id != `country_${playerData.country}`);
    let filtered1 = countryIds.filter(id => !hostilityCountryIds.includes(Number(id.split('_')[1])));
    let filtered2 = filtered1.filter(id => !allianceCountryIds.includes(Number(id.split('_')[1])));
    let filtered3 = filtered2.filter(id => !friendlyCountryIds.includes(Number(id.split('_')[1])));
    form.button({ translate: `mc.button.close` });
    let lands = [];
    for (const countryId of filtered3) {
        const countryData = GetAndParsePropertyData(countryId);
        if (!countryData?.id) {
            console.log(countryId);
            continue;
        }
        lands.push(countryData.id);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (CheckPermission(player, `allyAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            AllianceListForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            default: {
                addAllianceCountryFromListForm(player, lands[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 同盟国候補一覧から選んだ国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function addAllianceCountryFromListForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m != ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.send` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `allyAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                AllianceListForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    return;
                };
                case 1: {
                    checkAddAllianceForm(player, countryId);
                    return;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 同盟申請送信チェックフォーム
 * @param {Player} player 
 * @param {Number} countryId 
 */
export function checkAddAllianceForm(player, countryId) {
    const form = new ActionFormData();
    form.title({ translate: `form.check.alliance.send.title` });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.send` });
    form.show(player).then((rs) => {
        if (CheckPermission(player, `allyAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            addAllianceCountryFromListForm(player, countryId);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                return;
            };
            case 1: {
                sendAllianceRequest(player, countryId);
                return;
            };
        };
    });
};

/**
 * 同盟国一覧から選んだ国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function AllianceCountryFromListForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m !== ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.remove.alliance` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `allyAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                AllianceListForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    return;
                };
                case 1: {
                    checkAllianceRemoveForm(player, countryId);
                    return;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 同盟解除チェックフォーム
 * @param {Player} player 
 * @param {Number} countryId 
 */
export function checkAllianceRemoveForm(player, countryId) {
    const form = new ActionFormData();
    form.title({ translate: `form.check.alliance.remove.title` });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.remove.alliance` });
    form.show(player).then((rs) => {
        if (CheckPermission(player, `allyAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            AllianceCountryFromListForm(player, countryId);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                return;
            };
            case 1: {
                const playerData = GetAndParsePropertyData(`player_${player.id}`);
                const countryData = GetAndParsePropertyData(`country_${countryId}`);
                RemoveAlliance(playerData.country, countryId);
                player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `remove.alliance`, with: [`${countryData.name}`] }] })
                return;
            };
        };
    });
};

/**
 * 友好国メインフォーム
 * @param {Player} player 
 */
export function FriendlyMainForm(player) {
    const form = new ActionFormData();
    form.title({ translate: `form.friendly.main.title` });
    form.button({ translate: `friendly.permission.edit` });
    form.button({ translate: `form.friendly.list.title` });
    //ここに一覧ボタン
    //一覧フォームには追加ボタンも用意する
    form.show(player).then((rs) => {
        if (rs.canceled) {
            externalAffairsMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                if (!CheckPermission(player, `allyAdmin`)) {
                    //form
                    setFriendlyPermissionForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
            //1 一覧フォーム
            case 1: {
                if (!CheckPermission(player, `allyAdmin`)) {
                    //form
                    FriendlyListForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
        };
    });
};

/**
 * 友好国リストフォーム
 * @param {Player} player 
 */
export function FriendlyListForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    let friendlyCountryIds = playerCountryData.friendly;
    const form = new ActionFormData();
    form.title({ translate: `form.friendly.list.title` });
    form.button({ translate: `form.check.friendly.send.title` });
    for (const countryId of friendlyCountryIds) {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (rs.canceled) {
            FriendlyMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //追加フォーム
                AddFriendlyListForm(player);
                break;
            };
            default: {
                //詳細表示＆選択肢
                FriendlyCountryFromListForm(player, friendlyCountryIds[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 新たに友好国にする国のリスト
 * @param {Player} player 
 */
export function AddFriendlyListForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    let hostilityCountryIds = playerCountryData.hostility;
    let allianceCountryIds = playerCountryData.alliance;
    let friendlyCountryIds = playerCountryData.friendly;
    const form = new ActionFormData();
    form.title({ translate: `form.check.alliance.send.title` });
    let countryIds = countryDataBase.idList.filter(id => id.startsWith(`country_`)).filter(id => id != `country_${playerData.country}`);
    let filtered1 = countryIds.filter(id => !hostilityCountryIds.includes(Number(id.split('_')[1])));
    let filtered2 = filtered1.filter(id => !allianceCountryIds.includes(Number(id.split('_')[1])));
    let filtered3 = filtered2.filter(id => !friendlyCountryIds.includes(Number(id.split('_')[1])));
    form.button({ translate: `mc.button.close` });
    let lands = [];
    for (const countryId of filtered3) {
        const countryData = GetAndParsePropertyData(countryId);
        if (!countryData?.id) {
            console.log(countryId);
            continue;
        }
        lands.push(countryData.id);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (CheckPermission(player, `allyAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            FriendlyListForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                break;
            };
            default: {
                addFriendlyCountryFromListForm(player, lands[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 友好国候補一覧から選んだ国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function addFriendlyCountryFromListForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m != ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.send` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `allyAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                FriendlyListForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    return;
                };
                case 1: {
                    checkAddFriendlyForm(player, countryId);
                    return;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 友好申請送信チェックフォーム
 * @param {Player} player 
 * @param {Number} countryId 
 */
export function checkAddFriendlyForm(player, countryId) {
    const form = new ActionFormData();
    form.title({ translate: `form.check.friendly.send.title` });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.send` });
    form.show(player).then((rs) => {
        if (CheckPermission(player, `allyAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            addFriendlyCountryFromListForm(player, countryId);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                return;
            };
            case 1: {
                sendFriendlyRequest(player, countryId);
                return;
            };
        };
    });
};

/**
 * 友好国一覧から選んだ国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function FriendlyCountryFromListForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m !== ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.remove.friendly` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `allyAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                FriendlyListForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    return;
                };
                case 1: {
                    checkFriendlyRemoveForm(player, countryId);
                    return;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 友好解除チェックフォーム
 * @param {Player} player 
 * @param {Number} countryId 
 */
export function checkFriendlyRemoveForm(player, countryId) {
    const form = new ActionFormData();
    form.title({ translate: `form.check.friendly.remove.title` });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.remove.friendly` });
    form.show(player).then((rs) => {
        if (CheckPermission(player, `allyAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            FriendlyCountryFromListForm(player, countryId);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                return;
            };
            case 1: {
                const playerData = GetAndParsePropertyData(`player_${player.id}`);
                const countryData = GetAndParsePropertyData(`country_${countryId}`);
                RemoveFriendly(playerData.country, countryId);
                player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `remove.friendly`, with: [`${countryData.name}`] }] })
                return;
            };
        };
    });
};

/**
 * 敵対国メインフォーム
 * @param {Player} player 
 */
export function HostilityMainForm(player) {
    const form = new ActionFormData();
    form.title({ translate: `form.hostility.main.title` });
    form.button({ translate: `hostility.permission.edit` });
    form.button({ translate: `form.hostility.list.title` });
    //ここに一覧ボタン
    //一覧フォームには追加ボタンも用意する
    form.show(player).then((rs) => {
        if (rs.canceled) {
            externalAffairsMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                if (!CheckPermission(player, `hostilityAdmin`)) {
                    //form
                    setHostilityPermissionForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
            //1 一覧フォーム
            case 1: {
                if (!CheckPermission(player, `hostilityAdmin`)) {
                    //form
                    HostilityListForm(player);
                    return;
                } else {
                    player.sendMessage({ translate: `no.permission` });
                };
                break;
            };
        };
    });
};

/**
 * 敵対国リストフォーム
 * @param {Player} player 
 */
export function HostilityListForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    let hostilityCountryIds = playerCountryData.hostility;
    const form = new ActionFormData();
    form.title({ translate: `form.hostility.list.title` });
    form.button({ translate: `form.hostility.list.button.add` });
    for (const countryId of hostilityCountryIds) {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (rs.canceled) {
            HostilityMainForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //追加フォーム
                AddHostilityListForm(player);
                break;
            };
            default: {
                //詳細表示＆選択肢
                HostilityCountryFromListForm(player, hostilityCountryIds[rs.selection - 1]);
                break;
            };
        };
    });
};

/**
 * 新たに敵対国にする国のリスト
 * @param {Player} player 
 */
export function AddHostilityListForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
    let hostilityCountryIds = playerCountryData.hostility;
    let allianceCountryIds = playerCountryData.alliance;
    const form = new ActionFormData();
    form.title({ translate: `form.hostility.add.title` });
    let countryIds = countryDataBase.idList.filter(id => id.startsWith(`country_`)).filter(id => id != `country_${playerData.country}`);
    let filtered1 = countryIds.filter(id => !hostilityCountryIds.includes(id));
    let filtered2 = filtered1.filter(id => !allianceCountryIds.includes(id));
    let lands = [];
    form.button({ translate: `mc.button.close` });
    for (const countryId of filtered2) {
        const countryData = GetAndParsePropertyData(countryId);
        lands.push(countryData.id);
        form.button(`${countryData.name}\nID: ${countryData.id}`);
    };
    form.show(player).then((rs) => {
        if (CheckPermission(player, `hostilityAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            HostilityListForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                return;
            };
            default: {
                addHostilityCountryFromListForm(player, lands[rs.selection - 1]);
                return;
            };
        };
    });
};

/**
 * 敵対国候補一覧から選んだ国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function addHostilityCountryFromListForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m !== ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.add` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `hostilityAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                HostilityListForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    return;
                };
                case 1: {
                    checkAddHostilityForm(player, countryId);
                    return;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 講和申請送信チェックフォーム
 * @param {Player} player 
 * @param {Number} countryId 
 */
export function checkAddHostilityForm(player, countryId) {
    const form = new ActionFormData();
    form.title({ translate: `form.check.hostility.add.title` });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.add` });
    form.show(player).then((rs) => {
        if (CheckPermission(player, `hostilityAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            addHostilityCountryFromListForm(player, countryId);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                return;
            };
            case 1: {
                AddHostilityByPlayer(player, countryId);
                return;
            };
        };
    });
};

/**
 * 敵対国一覧から選んだ国
 * @param {Player} player 
 * @param {number} countryId 
 */
export function HostilityCountryFromListForm(player, countryId) {
    try {
        const countryData = GetAndParsePropertyData(`country_${countryId}`);
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m !== ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.application` });
        form.show(player).then(rs => {
            if (CheckPermission(player, `hostilityAdmin`)) {
                player.sendMessage({ translate: `no.permission` });
                return;
            };
            if (rs.canceled) {
                HostilityListForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    return;
                };
                case 1: {
                    checkApplicationForPeaceSendForm(player, countryId);
                    return;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 講和申請送信チェックフォーム
 * @param {Player} player 
 * @param {Number} countryId 
 */
export function checkApplicationForPeaceSendForm(player, countryId) {
    const form = new ActionFormData();
    form.title({ translate: `form.check.application.send.title` });
    form.button({ translate: `mc.button.close` });
    form.button({ translate: `mc.button.send` });
    form.show(player).then((rs) => {
        if (CheckPermission(player, `hostilityAdmin`)) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        if (rs.canceled) {
            HostilityCountryFromListForm(player, countryId);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //閉じる
                return;
            };
            case 1: {
                //form
                sendApplicationForPeace(player, countryId);
                return;
            };
        };
    });
};

const landPermissions = [
    `place`,
    `break`,
    `openContainer`,
    `pistonPlace`,
    `setHome`,
    `blockUse`,
    `entityUse`,
    `noTarget`,
    `publicHomeUse`,
];

/**
 * 中立国の権限を編集
 * @param {Player} player 
 */
export function setNeutralityPermissionForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const countryData = GetAndParsePropertyData(`country_${playerData.country}`);
    const form = new ModalFormData();
    form.title({ translate: `neutrality.permission.edit` });
    for (const permission of landPermissions) {
        form.toggle({ translate: `permission.${permission}` }, countryData.neutralityPermission.includes(permission));
    };
    form.submitButton({ translate: `mc.button.save` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            externalAffairsMainForm(player);
            return;
        };
        const values = rs.formValues;
        let newLandPermissions = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i]) {
                newLandPermissions.push(landPermissions[i]);
            };
        };
        countryData.neutralityPermission = newLandPermissions;
        StringifyAndSavePropertyData(`country_${countryData.id}`, countryData);
        externalAffairsMainForm(player);
        return;
    });
};

/**
 * 敵対国の権限を編集
 * @param {Player} player 
 */
export function setHostilityPermissionForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const countryData = GetAndParsePropertyData(`country_${playerData.country}`);
    const form = new ModalFormData();
    form.title({ translate: `hostility.permission.edit` });
    for (const permission of landPermissions) {
        form.toggle({ translate: `permission.${permission}` }, countryData.hostilityPermission.includes(permission));
    };
    form.submitButton({ translate: `mc.button.save` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            HostilityMainForm(player);
            return;
        };
        const values = rs.formValues;
        let newLandPermissions = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i]) {
                newLandPermissions.push(landPermissions[i]);
            };
        };
        countryData.hostilityPermission = newLandPermissions;
        StringifyAndSavePropertyData(`country_${countryData.id}`, countryData);
        HostilityMainForm(player);
        return;
    });
};

/**
 * 同盟国の権限を編集
 * @param {Player} player 
 */
export function setAlliancePermissionForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const countryData = GetAndParsePropertyData(`country_${playerData.country}`);
    const form = new ModalFormData();
    form.title({ translate: `alliance.permission.edit` });
    for (const permission of landPermissions) {
        form.toggle({ translate: `permission.${permission}` }, countryData.alliancePermission.includes(permission));
    };
    form.submitButton({ translate: `mc.button.save` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            AllianceMainForm(player);
            return;
        };
        const values = rs.formValues;
        let newLandPermissions = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i]) {
                newLandPermissions.push(landPermissions[i]);
            };
        };
        countryData.alliancePermission = newLandPermissions;
        StringifyAndSavePropertyData(`country_${countryData.id}`, countryData);
        AllianceMainForm(player);
        return;
    });
};

/**
 * 友好国の権限を編集
 * @param {Player} player 
 */
export function setFriendlyPermissionForm(player) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const countryData = GetAndParsePropertyData(`country_${playerData.country}`);
    const form = new ModalFormData();
    form.title({ translate: `friendly.permission.edit` });
    for (const permission of landPermissions) {
        form.toggle({ translate: `permission.${permission}` }, countryData.friendlyPermission.includes(permission));
    };
    form.submitButton({ translate: `mc.button.save` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            FriendlyMainForm(player);
            return;
        };
        const values = rs.formValues;
        let newLandPermissions = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i]) {
                newLandPermissions.push(landPermissions[i]);
            };
        };
        countryData.friendlyPermission = newLandPermissions;
        StringifyAndSavePropertyData(`country_${countryData.id}`, countryData);
        FriendlyMainForm(player);
        return;
    });
};

/**
 * 税金管理メインフォーム
 * @param {Player} player 
 */
export function editTaxMainForm(player) {
    const form = new ModalFormData();
    const lastPlayerData = GetAndParsePropertyData(`player_${player.id}`)
    const lastountryData = GetAndParsePropertyData(`country_${lastPlayerData?.country}`);
    let taxMessageLabel = `label.input.taxnum`;
    if (lastountryData.taxInstitutionIsPer) taxMessageLabel = `label.input.taxper`;
    form.title({ translate: `form.setting.info.button.tax` })
    form.toggle({ translate: `tax.select.toggle.label` }, lastountryData.taxInstitutionIsPer);
    form.textField({ translate: taxMessageLabel }, { translate: `input.number` }, `${lastountryData.taxPer}`);
    form.show(player).then((rs) => {
        if (rs.canceled) {
            settingCountryInfoForm(player);
            return;
        };
        const cancel = CheckPermission(player, `taxAdmin`);
        if (cancel) {
            player.sendMessage({ translate: `no.permission` });
            return;
        };
        let value = rs.formValues[1];
        if (!isDecimalNumberZeroOK(value)) {
            player.sendMessage({ translate: `input.error.notnumber` });
            return;
        };
        if (100 < Number(rs.formValues[1]) && rs.formValues[0] == true) {
            player.sendMessage({ translate: `input.error.over100` });
            return;
        };
        if (Number(rs.formValues[1]) < 0) {
            player.sendMessage({ translate: `input.error.under0` });
            return;
        };
        const playerData = GetAndParsePropertyData(`player_${player.id}`);
        const countryData = GetAndParsePropertyData(`country_${playerData.country}`);
        countryData.taxInstitutionIsPer = rs.formValues[0];
        countryData.taxPer = Number(rs.formValues[1]);
        StringifyAndSavePropertyData(`country_${countryData.id}`, countryData);
        player.sendMessage({ translate: `updated` });
        return;
    });
};

export function editCountryNameForm(player, countryData) {
    const form = new ModalFormData();
    form.title({ translate: `form.editcountryname.title` });
    form.textField({ translate: `form.editcountryname.label` }, { translate: `form.editcountryname.input` }, countryData.name);
    form.submitButton({ translate: `mc.button.change` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            settingCountryInfoForm(player, countryData);
            return;
        };
        let value = rs.formValues[0];
        if (value === ``) value === `Country`;
        const beforeName = countryData.name;
        countryData.name = value;
        player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `changed.countryname` }, { text: `\n§r${beforeName} ->§r ${value}` }] });
        StringifyAndSavePropertyData(`country_${countryData.id}`, countryData);
        settingCountryInfoForm(player, countryData);
        system.runTimeout(() => {
            if (config.countryNameDisplayOnPlayerNameTag) {
                const players = world.getPlayers();
                for (const p of players) {
                    nameSet(p);
                };
            };
        }, 2);
        return;
    });
};

export function editCountryPeaceForm(player, countryData) {
    const form = new ModalFormData();
    form.title({ translate: `form.editcountrypeace.title` });
    form.toggle({ translate: `form.editcountrypeace.label` }, countryData.peace);
    form.submitButton({ translate: `mc.button.change` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            settingCountryInfoForm(player, countryData);
            return;
        };
        if (0 < countryData.peaceChangeCooltime) {
            player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `peace.cooltime` }, { text: ` (${countryData.peaceChangeCooltime})` }] });
            return;
        };
        const beforeValue = countryData.peace;
        let value = rs.formValues[0];
        if (rs.formValues[0] == beforeValue) {
            settingCountryInfoForm(player, countryData);
            return;
        };
        countryData.peace = value;
        countryData.peaceChangeCooltime = config.peaceChangeCooltime;
        player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `changed.peace` }, { text: `\n§r${beforeValue} ->§r ${value}` }] });
        StringifyAndSavePropertyData(`country_${countryData.id}`, countryData);
        return;
    });
};

/**
 * 
 * @param {Player} player 
 * @param {object} countryData 
 */
export function editCountryInviteForm(player, countryData) {
    const form = new ModalFormData();
    form.title({ translate: `form.editcountryinvite.title` });
    form.toggle({ translate: `form.editcountryinvite.label` }, countryData.invite);
    form.submitButton({ translate: `mc.button.change` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            settingCountryInfoForm(player, countryData);
            return;
        };
        const beforeValue = countryData.invite;
        let value = rs.formValues[0];
        countryData.invite = value;
        player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `changed.invite` }, { text: `\n§r${beforeValue} ->§r ${value}` }] });
        StringifyAndSavePropertyData(`country_${countryData.id}`, countryData);
        return;
    });
};

export function editCountryLoreForm(player, countryData) {
    const form = new ModalFormData();
    form.title({ translate: `form.editcountrylore.title` });
    form.textField({ translate: `form.editcountrylore.label` }, { translate: `form.editcountrylore.input` }, countryData.lore);
    form.submitButton({ translate: `mc.button.change` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            settingCountryInfoForm(player, countryData);
            return;
        };
        let value = rs.formValues[0];
        const beforeLore = countryData.lore;
        countryData.lore = value;
        player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]§r\n` }, { translate: `changed.countrylore` }, { text: `\n§r${beforeLore} ->§r ${value}` }] });
        StringifyAndSavePropertyData(`country_${countryData.id}`, countryData);
        settingCountryInfoForm(player, countryData);
        return;
    });
};

const rolePermissions = [
    `editCountryName`,
    `editCountryLore`,
    `peaceChange`,
    `inviteChange`,
    `invite`,
    `place`,
    `break`,
    `pistonPlace`,
    `setHome`,
    `kick`,
    `openContainer`,
    `blockUse`,
    `entityUse`,
    `publicHomeUse`,
    `publicHomeAdmin`,
    `noTarget`,
    `plotAdmin`,
    `buyChunk`,
    `sellChunk`,
    `taxAdmin`,
    `allyAdmin`,
    `hostilityAdmin`,
    `warAdmin`,
    `neutralityPermission`,
    `withDrawResourcepoint`,
    `withDrawTreasurybudget`
];

/**
 * 国を消す前の確認
 * @param {Player} player 
 */
export function countryDeleteCheckForm(player) {
    try {
        const playerData = GetAndParsePropertyData(`player_${player.id}`);
        const form = new ActionFormData();
        form.title({ translate: `form.dismantle.check` });
        form.body({ rawtext: [{ translate: `mc.warning` }, { text: `\n§r` }, { translate: `form.dismantle.body` }] });
        form.button({ translate: `mc.button.close` });
        form.button({ translate: `mc.button.dismantle` });
        form.show(player).then(rs => {
            if (rs.canceled) {
                settingCountry(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    break;
                };
                case 1: {
                    player.sendMessage({ translate: `form.dismantle.complete` })
                    DeleteCountry(playerData.country);
                    break;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 完成
 * 国の一覧表示
 * @param {Player} player 
 */
export function countryList(player, al = false) {
    try {
        const form = new ActionFormData();
        form.title({ translate: `form.countrylist.title` });
        let countryIds
        if (!al) countryIds = countryDataBase.idList;
        if (al) countryIds = GetAndParsePropertyData('country_' + GetAndParsePropertyData('player_' + player.id).country).alliance.map(alliance => `country_${alliance}`);
        let countries = [];
        countryIds.forEach(id => {
            countries[countries.length] = GetAndParsePropertyData(id);
        });
        if (countries.length === 0) {
            form.body({ translate: `no.countries.world` });
            form.button({ translate: `mc.button.close` });
        };
        countries.forEach(country => {
            form.button(`${country?.name} \n§rID: ${country?.id}`);
        });
        form.show(player).then(rs => {
            if (rs.canceled) {
                if (rs.cancelationReason === FormCancelationReason.UserBusy) {
                    system.runTimeout(() => {
                        countryList(player, al);
                        return;
                    }, 10);
                    return;
                };
                return;
            };
            if (countries.length === 0) {
                return;
            };
            showCountryInfo(player, countries[rs.selection], al);
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 国の情報を表示
 * @param {Player} player 
 * @param {any} countryData 
 */
export function showCountryInfo(player, countryData, al = false) {
    try {
        const ownerData = GetAndParsePropertyData(`player_${countryData.owner}`);
        const membersId = countryData.members.filter(m => m !== ownerData.id);
        let membersName = [];
        membersId.forEach(member => {
            const memberData = GetAndParsePropertyData(`player_${member}`);
            membersName.push(memberData.name);
        });
        let money = `show.private`;
        let resourcePoint = `show.private`;
        if (!countryData.hideMoney) {
            money = `${config.MoneyName} ${countryData.money}`;
            resourcePoint = `${countryData.resourcePoint}`;
        };
        const allianceIds = countryData.alliance;
        let allianceCountryName = [];
        allianceIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                allianceCountryName.push(subCountryData.name);
            };
        });
        const hostilityIds = countryData.hostility;
        let hostilityCountryName = [];
        hostilityIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                hostilityCountryName.push(subCountryData.name);
            };
        });
        const friendlyIds = countryData.friendly;
        let friendlyCountryName = [];
        friendlyIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`, countryDataBase);
            if (subCountryData) {
                friendlyCountryName.push(subCountryData.name);
            };
        });
        const warNowIds = countryData.warNowCountries;
        let warNowCountryName = [];
        warNowIds.forEach(id => {
            const subCountryData = GetAndParsePropertyData(`country_${id}`);
            if (subCountryData) {
                warNowCountryName.push(subCountryData.name);
            };
        });
        const showBody =
        {
            rawtext: [
                { translate: `form.showcountry.option.name`, with: [countryData.name] }, { text: `\n§r` },
                { translate: `form.showcountry.option.lore`, with: [countryData.lore] }, { text: `\n§r` },
                { translate: `form.showcountry.option.id`, with: [`${countryData.id}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.ownerRole}`).name}: ${ownerData.name}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.memberscount`, with: [`${countryData.members.length}`] }, { text: `\n§r` },
                { text: `${GetAndParsePropertyData(`role_${countryData.peopleRole}`).name}: ${membersName.join(`§r , `)}` }, { text: `\n§r` },
                { translate: `form.showcountry.option.territories`, with: [`${countryData.territories.length}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.money`, with: { rawtext: [{ translate: `${money}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.resourcepoint`, with: { rawtext: [{ translate: `${resourcePoint}` }] } }, { text: `\n§r` },
                { translate: `form.showcountry.option.peace`, with: [`${countryData.peace}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.invite`, with: [`${countryData.invite}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxper`, with: [`${countryData.taxPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.taxinstitutionisper`, with: [`${countryData.taxInstitutionIsPer}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.alliance`, with: [`${allianceCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.hostility`, with: [`${hostilityCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: `form.showcountry.option.friendly`, with: [`${friendlyCountryName.join(`§r , `)}`] }, { text: `\n§r` },
                { translate: 'form.showcountry.option.days', with: [`${countryData.days}`] }, { text: `\n§r` },
            ]
        };
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button({ translate: `mc.button.close` });
        if (countryData?.publicSpawn && countryData?.spawn) {
            form.button({ translate: `button.publichome.tp` });
        };
        form.show(player).then(rs => {
            if (rs.canceled) {
                countryList(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    break;
                };
                case 1: {
                    if (player.hasTag(`mc_notp`)) {
                        return;
                    };
                    if (config.invaderNoTeleportValidity && player.getTags().find(tag => tag.startsWith("war"))) {
                        player.sendMessage({ translate: "teleport.error.invader" });
                        return;
                    }
                    if (config.combatTagNoTeleportValidity) {
                        if (player.hasTag(`mc_combat`)) {
                            player.sendMessage({ translate: `teleport.error.combattag` });
                            return;
                        };
                    };
                    //パブリックホーム
                    /**
                     * @type {Array<string>}
                     */
                    let [x, y, z, rx, ry, dimensionId] = countryData?.spawn.split(`_`);
                    if (CheckPermissionFromLocation(player, Number(x), Number(z), dimensionId, `publicHomeUse`)) {
                        //権限がない！！
                        player.sendMessage({ translate: `no.permission` });
                        return
                    };
                    //tp
                    player.teleport({ x: Number(x), y: Number(y), z: Number(z) }, { dimension: world.getDimension(`${dimensionId.replace(`minecraft:`, ``)}`), rotation: { x: Number(rx), y: Number(ry) } });
                    break;
                };
            };
        });
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 完成
 * ロールの一覧表示
 * @param {Player} player 
 */
export function settingCountryRoleForm(player) {
    const cannot = CheckPermission(player, 'admin');
    if (cannot) {
        player.sendMessage({ translate: `no.permission` });
        return;
    };
    try {
        let EnableEditRoleIds = [];
        const playerData = GetAndParsePropertyData(`player_${player.id}`);
        const countryData = GetAndParsePropertyData(`country_${playerData?.country}`);
        if (countryData?.owner === player.id) {
            for (const role of countryData?.roles) {
                EnableEditRoleIds.push(role);
            };
        } else {
            const playerAdminRoles = [];
            for (const role of countryData?.roles) {
                const roleData = GetAndParsePropertyData(`role_${role}`);
                if (roleData.permissions.includes(`admin`)) {
                    playerAdminRoles.push(role);
                } else {
                    EnableEditRoleIds.push(role);
                };
            };
        };
        const form = new ActionFormData();
        if (EnableEditRoleIds.length === 0) {
            form.title({ translate: `form.setting.button.role` });
            form.body({ translate: `not.exsit.can.accessrole` });
            form.button({ translate: `mc.button.close` });
            form.show(player).then(rs => {
                if (rs.canceled) {
                    settingCountry(player);
                    return;
                };
                //閉じる
                return;
            });
        } else {
            form.title({ translate: `form.setting.button.role` });
            form.button({ translate: `mc.button.addrole` });
            let roles = [];
            EnableEditRoleIds.forEach(id => {
                roles.push(GetAndParsePropertyData(`role_${id}`));
            });
            for (const role of roles) {
                form.button(role.name, role.icon);
            };
            form.show(player).then(rs => {
                const newCountryData = GetAndParsePropertyData(`country_${playerData.country}`);
                if (rs.canceled) {
                    settingCountry(player);
                    return;
                };
                switch (rs.selection) {
                    case 0: {
                        if (config.maxRoleAmount <= newCountryData.roles.length) {
                            player.sendMessage({ translate: `error.limit.maxrole` });
                            return;
                        };
                        CreateRoleToCountry(newCountryData.id, `newRole`);
                        system.runTimeout(() => {
                            settingCountryRoleForm(player);
                            return;
                        }, 2);
                        break;
                    };
                    default: {
                        selectRoleEditType(player, roles[rs.selection - 1]);
                        break;
                    };
                };
            });
        };
    } catch (error) {
        console.warn(error);
    };
};

/**
 * 完成
 * ロールのアイコンを変更
 * @param {Player} player 
 * @param {any} roleData 
 */
export function RoleIconChange(player, roleData) {
    if (!CheckPermission(player, `admin`)) {
        const form = new ModalFormData();
        form.title({ translate: `form.role.iconchange.title`, with: [roleData.name] });
        form.textField({ translate: `form.role.iconchange.label` }, { translate: `form.role.iconchange.input` }, roleData.icon);
        form.submitButton({ translate: `mc.button.change` });
        form.show(player).then(rs => {
            if (rs.canceled) {
                selectRoleEditType(player, roleData);
                return;
            };
            roleData.icon = rs.formValues[0];
            if (rs.formValues[0] === ``) roleData.icon = undefined;
            StringifyAndSavePropertyData(`role_${roleData.id}`, roleData);
            selectRoleEditType(player, roleData);
            return;
        });
    };
};

/**
 * 完成
 * ロールの名前を変更
 * @param {Player} player 
 * @param {any} roleData 
 */
export function RoleNameChange(player, roleData) {
    if (!CheckPermission(player, `admin`)) {
        const form = new ModalFormData();
        form.title({ translate: `form.role.namechange.title`, with: [roleData.name] });
        form.textField({ translate: `form.role.namechange.label` }, { translate: `form.role.namechange.input` }, roleData.name);
        form.submitButton({ translate: `mc.button.change` });
        form.show(player).then(rs => {
            if (rs.canceled) {
                selectRoleEditType(player, roleData);
                return;
            };
            roleData.name = rs.formValues[0] ?? `None`;
            StringifyAndSavePropertyData(`role_${roleData.id}`, roleData);
            selectRoleEditType(player, roleData);
            return;
        });
    };
};

/**
 * 完成
 * ロールの詳細
 * @param {Player} player 
 * @param {any} roleData 
 */
export function selectRoleEditType(player, roleData) {
    if (!CheckPermission(player, `admin`)) {
        const playerData = GetAndParsePropertyData(`player_${player.id}`);
        const form = new ActionFormData();
        form.title({ translate: `form.role.edit.select.title`, with: [roleData.name] });
        form.button({ translate: `form.role.edit.select.button.name` });
        form.button({ translate: `form.role.edit.select.button.icon` });
        //form.button({translate: `form.role.edit.select.button.members`});
        form.button({ translate: `form.role.edit.select.button.permission` });
        form.button({ translate: `form.role.edit.select.button.delete` });
        form.show(player).then(rs => {
            if (rs.canceled) {
                settingCountryRoleForm(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //名前の変更
                    RoleNameChange(player, roleData);
                    break;
                };
                case 1: {
                    //アイコンの変更
                    RoleIconChange(player, roleData);
                    break;
                };
                case 2: {
                    //権限の編集
                    setRolePermissionForm(player, roleData);
                    break;
                };
                case 3: {
                    //ロールの削除
                    DeleteRole(player, roleData.id, playerData.country);
                    break;
                };
            };
        });
    };
};

/**
 * 完成
 * ロールの権限編集
 * @param {Player} player 
 * @param {any} roleData 
 */
export function setRolePermissionForm(player, roleData) {
    if (!CheckPermission(player, `admin`)) {
        const form = new ModalFormData();
        form.title({ translate: `role.permission.edit`, with: [roleData.name] });
        for (const permission of rolePermissions) {
            form.toggle({ translate: `permission.${permission}` }, roleData.permissions.includes(permission));
        };
        form.submitButton({ translate: `mc.button.save` });
        form.show(player).then(rs => {
            if (rs.canceled) {
                selectRoleEditType(player, roleData);
                return;
            };
            const values = rs.formValues;
            let newRolePermissions = [];
            for (let i = 0; i < values.length; i++) {
                if (values[i]) {
                    newRolePermissions.push(rolePermissions[i]);
                };
            };
            roleData.permissions = newRolePermissions;
            StringifyAndSavePropertyData(`role_${roleData.id}`, roleData);
            selectRoleEditType(player, roleData);
            return;
        });
    };
};

/**
 * 完成
 * 国を作るフォームを表示
 * @param {Player} player 
 */
export function MakeCountryForm(player) {
    const form = new ModalFormData();
    form.title({ translate: `form.makecountry.title` });
    form.textField({ translate: `form.makecountry.name.label` }, { translate: `form.makecountry.name.input` });
    form.toggle({ translate: `form.makecountry.invite` }, true);
    form.toggle({ translate: `form.makecountry.peace` }, config.defaultPeace);
    form.submitButton({ translate: `form.makecountry.submit` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            if (rs.cancelationReason === FormCancelationReason.UserBusy) {
                system.runTimeout(() => {
                    MakeCountryForm(player);
                    return;
                }, 10);
                return;
            };
            player.sendMessage({ translate: `form.cancel.message` });
            return;
        };
        if (rs.formValues) {
            const eventData = { player, countryName: rs.formValues[0], invite: rs.formValues[1], peace: rs.formValues[2], type: 'player', cancel: false };
            const isCanceled = country.beforeEvents.create.emit(eventData);
            if (isCanceled) return;
            MakeCountry(player, 'player', rs.formValues[0], rs.formValues[1], rs.formValues[2]);
            return;
        };
    });
};

/**
 * プロットのフォーム
 */

/**
 * プロットグループメインフォーム
 * @param {Player} player 
 */
export function settingCountryPlotGroupForm(player) {
    const isPlotAdmin = HasPermission(player, `plotAdmin`);
    if (!isPlotAdmin) {
        //権限がない場合
        player.sendMessage({ translate: `no.permission` });
        return;
    };
    const form = new ActionFormData();
    form.title({ translate: `form.setting.button.plotgroup` });
    form.button({ translate: `create.plotgroup.button` });
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData?.country}`);
    const plotGroupIds = playerCountryData?.plotgroup ?? [];
    let plotGroupsData = [];
    for (const pgid of plotGroupIds) {
        const data = GetAndParsePropertyData(`plotgroup_${pgid}`);
        if (data) {
            plotGroupsData.push(data);
        };
    };
    for (const plotGroupData of plotGroupsData) {
        form.button(`${plotGroupData?.name}\n§rID:${plotGroupData?.id}`);
    };
    form.show(player).then((rs) => {
        if (rs.canceled) {
            settingCountry(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //プロットグループ作成フォーム表示
                CreatePlotGroupForm(player);
                break;
            };
            default: {
                //既存のプロットグループの編集
                plotGroupEditMainFormPlotAdmin(player, plotGroupsData[rs.selection - 1]?.id);
                break;
            };
        };
    });
};

/**
 * プロットグループ作成フォーム
 * @param {Player} player  
 */
export function CreatePlotGroupForm(player) {
    const isnotPlotAdmin = CheckPermission(player, `plotAdmin`);
    if (isnotPlotAdmin) {
        //権限がない場合
        player.sendMessage({ translate: `no.permission` });
        return;
    };
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const type = ["public", "private", "embassy"];
    const typeMessges = [
        { rawtext: [{ translate: `plot.public` }] },
        { rawtext: [{ translate: `plot.private` }] },
        { rawtext: [{ translate: `plot.embassy` }] },
    ];
    const form = new ModalFormData();
    form.title({ rawtext: [{ translate: `form.plot.create` }] });
    form.textField({ rawtext: [{ translate: `plot.name` }] }, { rawtext: [{ translate: `input.plot.name` }] });
    form.dropdown({ rawtext: [{ translate: `plot.type` }] }, typeMessges);
    form.submitButton({ rawtext: [{ translate: `create.plotgroup.button` }] });
    form.show(player).then((rs) => {
        if (rs.canceled) {
            return settingCountryPlotGroupForm(player);
        };
        createPlotGroup(player, playerData?.country, rs.formValues[0], type[rs.formValues[1]]);
        return;
    });
};

/**
 * プロットアドミン用のプロットグループ編集フォーム
 * @param {Player} player 
 * @param {{is_selling: boolean,group: string|undefined,country: number|undefined,name: string|undefined,owner: string|undefined,permissions: [string],roles: [{id: number,permissions: [string]}],countries: [{id: number,permissions: [string]}],players: [{id: string,permissions: [string]}],type: "public"|"private"|"embassy",price: number|0, } | undefined} plot
 */
export function plotGroupEditMainFormPlotAdmin(player, plotGroupId) {
    const plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    const form = new ActionFormData();
    form.title({ rawtext: [{ translate: `${plot.name}` }] });
    form.button({ translate: `plot.edit.menu.button.settings` });
    form.button({ translate: `plot.edit.menu.button.permissions` });
    form.button({ translate: `plot.edit.menu.button.player` });
    form.button({ translate: `plot.edit.menu.button.country` });
    form.button({ translate: `plot.edit.menu.button.role` });
    form.button({ translate: `plot.edit.menu.button.owner` });
    form.button({ translate: `mc.button.delete` });
    form.show(player).then((rs) => {
        if (rs.canceled) {
            settingCountryPlotGroupForm(player);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //プロットグループ設定ModalForm
                plotGroupEditSettingFormPlotAdmin(player, plotGroupId, true);
                break;
            };
            case 1: {
                //プロットのデフォルト権限ModalForm
                plotGroupEditPermissionsForm(player, plotGroupId, true);
                break;
            };
            case 2: {
                //プロットのプレイヤー管理ActionForm
                plotGroupEditPlayersListForm(player, plotGroupId, true);
                break;
            };
            case 3: {
                //プロットの国管理ActionForm
                plotGroupEditCountriesListForm(player, plotGroupId, true);
                break;
            };
            case 4: {
                //プロットのロール管理ActionForm
                plotGroupEditRolesListForm(player, plotGroupId, true);
                break;
            };
            case 5: {
                //プロットの所有者管理ActionForm
                plotGroupOwnerShowForm(player, plotGroupId, true);
                break;
            };
            case 6: {
                //プロットグループの削除
                //ここに削除処理
                const playerData = GetAndParsePropertyData(`player_${player.id}`);
                const playerCountryData = GetAndParsePropertyData(`country_${playerData?.country}`);
                if (!playerCountryData) {
                    return;
                };
                if (!playerCountryData?.plotgroup) playerCountryData.plotgroup = [];
                playerCountryData?.plotgroup.splice(playerCountryData?.plotgroup.indexOf(plotGroupId), 1);
                StringifyAndSavePropertyData(`country_${playerData?.country}`, playerCountryData);
                StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`);
                settingCountryPlotGroupForm(player);
                break;
            };
        };
    });
};

/*
 * プロットグループの各種設定フォーム
 */

/**
 * 所有者用の編集フォーム
 * @param {Player} player 
 * @param {number} plotGroupId
 */
export function plotGroupEditMainFormPlotOwner(player, plotGroupId) {
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    const form = new ActionFormData();
    form.title({ rawtext: [{ translate: `${plot?.name}` }] });
    form.button({ translate: `plot.edit.menu.button.settings` });
    form.button({ translate: `plot.edit.menu.button.permissions` });
    form.button({ translate: `plot.edit.menu.button.player` });
    form.button({ translate: `plot.edit.menu.button.country` });
    form.button({ translate: `plot.edit.menu.button.role` });
    form.show(player).then((rs) => {
        if (rs.canceled) {
            if (rs.cancelationReason == FormCancelationReason.UserBusy) {
                system.runTimeout(() => {
                    plotGroupEditMainFormPlotOwner(player, plotGroupId);
                }, 10);
                return;
            };
            return;
        };
        switch (rs.selection) {
            case 0: {
                //プロット設定ModalForm
                plotGroupEditSettingFormPlotOwner(player, plotGroupId);
                break;
            };
            case 1: {
                //プロットのデフォルト権限ModalForm
                plotGroupEditPermissionsForm(player, plotGroupId);
                break;
            };
            case 2: {
                //プロットのプレイヤー管理ActionForm
                plotGroupEditPlayersListForm(player, plotGroupId);
                break;
            };
            case 3: {
                //プロットの国管理ActionForm
                plotGroupEditCountriesListForm(player, plotGroupId);
                break;
            };
            case 4: {
                //プロットのロール管理ActionForm
                plotGroupEditRolesListForm(player, plotGroupId);
                break;
            };
        };
    });
};

/*
 * 所有者用の編集フォーム
 * ----------------------------------------------
 * 所有者の管理
 */

/**
 * 所有者の管理
 * @param {Player} player 
 * @param {*} targetData 
 * @param {boolean} plotAdmin 
 */
function plotGroupOwnerShowForm(player, plotGroupId, plotAdmin = false) {
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.owner) plot.owner = null;
    const form = new ActionFormData();
    let ownerData;
    if (plot?.owner) {
        ownerData = GetAndParsePropertyData(`player_${plot?.owner}`);
        form.title({ text: `${ownerData?.name}` });
        form.body({ rawtext: [{ translate: `owner` }, { text: `: ${ownerData?.name}` }] });
    };
    if (!plot?.owner) form.title({ translate: `not.owned` });
    form.button({ translate: `mc.button.back` });
    form.button({ translate: `mc.button.close` });
    if (plot?.owner) form.button({ translate: `mc.button.delete` });
    form.show(player).then((rs) => {
        if (rs.canceled) {
            if (plotAdmin) {
                plotGroupEditMainFormPlotAdmin(player, plotGroupId);
                return;
            };
            return;
        };
        switch (rs.selection) {
            case 0: {
                if (plotAdmin) {
                    plotGroupEditMainFormPlotAdmin(player, plotGroupId);
                    return;
                };
                break;
            };
            case 1: {
                //閉じる(何もしない)
                break;
            };
            case 2: {
                //オーナーの削除
                let afterPlot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
                afterPlot.owner = null;
                StringifyAndSavePropertyData(`${chunkId}`, afterPlot);
                plotGroupEditMainFormPlotAdmin(player, plotGroupId);
                break;
            };
        };
    });
};

/*
 * 所有者の管理
 * ----------------------------------------------
 * ロールの管理
 */

/**
 * プロットロールリストフォーム
 * @param {Player} player 
 */
function plotGroupEditRolesListForm(player, plotGroupId, plotAdmin = false) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const form = new ActionFormData();
    form.title({ rawtext: [{ translate: `plot.edit.menu.button.role` }] });
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.roles) plot.roles = [];
    form.button({ translate: `mc.button.role.add` });
    const roles = [];
    for (const roleRawData of plot.roles) {
        roles.push(GetAndParsePropertyData(`role_${roleRawData.id}`));
    };
    let aliveRoles = [];
    let aliveRolesData = [];
    for (const r of roles) {
        if (r?.id) {
            aliveRoles.push(r.id);
            aliveRolesData.push(r);
            form.button(`${r?.name}\nID: ${r?.id}`);
        };
    };
    plot.roles = plot.roles.filter(d => aliveRoles.includes(d.id));
    StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);

    form.show(player).then(rs => {
        if (rs.canceled) {
            if (plotAdmin) {
                plotGroupEditMainFormPlotAdmin(player, plotGroupId);
                return;
            };
            plotGroupEditMainFormPlotOwner(player, plotGroupId);
            return;
        };
        if (rs.selection == 0) {
            roleAddPlotGroupForm(player, plotGroupId, plotAdmin);
            return;
        };
        plotGroupRoleSelectedShowForm(player, aliveRolesData[rs.selection - 1], plotGroupId, plotAdmin);
        return;
    });
};

/**
 * 
 * @param {Player} player 
 * @param {string} plotGroupId 
 * @param {boolean} plotAdmin 
 * @param {boolean} serch 
 * @param {string} keyword 
 */
export function roleAddPlotGroupForm(player, plotGroupId, plotAdmin, search = false, keyword = ``) {
    const form = new ActionFormData();
    form.title({ translate: `form.plot.addrole.list.title` });
    form.button({ translate: `form.plot.addrole.button.serch` });
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const playerCountryData = GetAndParsePropertyData(`country_${playerData?.country}`);
    const roleIds = playerCountryData?.roles ?? [];
    let roles = [];
    roleIds.forEach(id => {
        roles[roles.length] = GetAndParsePropertyData(`role_${id}`);
    });

    if (search) {
        roles = roles.filter(r => r?.name.includes(keyword));
    };
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.roles) plot.roles = [];
    let aliveRoles = [];
    for (const r of roles) {
        if (plot.roles.find(d => d?.id == r.id)) continue;
        aliveRoles.push(r)
        form.button(`${r?.name}§r\nID: ${r?.id}`);
    };
    form.show(player).then(rs => {
        if (rs.canceled) {
            plotGroupEditRolesListForm(player, plotGroupId, plotAdmin);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //検索form

                break;
            };
            default: {
                //ロール追加しよう
                const target = aliveRoles[rs.selection - 1];
                plot.roles.push({ id: target.id, permissions: [] });
                StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
                plotGroupEditRolesListForm(player, plotGroupId, plotAdmin);
                return;
            };
        };
    });
};

/**
 * 
 * @param {Player} player 
 * @param {*} targetData 
 * @param {boolean} plotAdmin 
 */
function plotGroupRoleSelectedShowForm(player, targetData, plotGroupId, plotAdmin = false) {
    const form = new ActionFormData();
    form.title({ text: `${targetData?.name}` });
    form.button({ translate: `mc.button.back` });
    form.button({ translate: `mc.button.edit.permission` });
    form.button({ translate: `mc.button.delete` });
    form.button({ translate: `mc.button.close` });
    form.show(player).then((rs) => {
        if (rs.canceled) {
            plotGroupEditRolesListForm(player, plotGroupId, plotAdmin);
            return;
        };
        switch (rs.selection) {
            case 0: {
                plotGroupEditRolesListForm(player, plotGroupId, plotAdmin);
                break;
            };
            case 1: {
                //ロールの権限編集
                plotGroupRolePermissionsEditForm(player, plotGroupId, targetData, plotAdmin);
                break;
            };
            case 2: {
                //ロールの削除
                let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
                if (!plot) {
                    return;
                };
                if (!plot?.roles) plot.roles = [];
                plot.roles.splice(plot.roles.indexOf(d => d.id == targetData.id), 1);
                StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
                plotGroupEditRolesListForm(player, plotGroupId, plotAdmin);
                break;
            };
            case 3: {
                //閉じる(何もしない)
                break;
            };
        };
    });
};

/**
 * プロットロール権限編集フォーム
 * @param {Player} player 
 */
function plotGroupRolePermissionsEditForm(player, plotGroupId, targetData, plotAdmin = false) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const form = new ModalFormData();
    form.title({ rawtext: [{ translate: `plot.edit.menu.button.permissions` }] });
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.roles) plot.roles = [];
    let target = plot.roles.find(d => d.id == targetData?.id) ?? { id: targetData?.id, permissions: [] };
    for (const permission of landPermissions) {
        form.toggle({ translate: `permission.${permission}` }, target?.permissions.includes(permission));
    };
    form.submitButton({ translate: `mc.button.save` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            if (plotAdmin) {
                plotGroupRoleSelectedShowForm(player, targetData, plotGroupId, plotAdmin);
                return;
            };
            return;
        };
        const values = rs.formValues;
        let newLandPermissions = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i]) {
                newLandPermissions.push(landPermissions[i]);
            };
        };
        target.permissions = newLandPermissions;
        const index = plot?.roles.findIndex(d => d.id == target.id);
        if (index != -1) {
            plot.roles[index] = target;
        } else {
            plot?.roles.push(target);
        };
        StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
        if (plotAdmin) {
            plotGroupRoleSelectedShowForm(player, targetData, plotGroupId, plotAdmin);
            return;
        };
        return;
    });
};

/*
 * ロールの管理
 * -----------------------------------------
 * 国の管理
 */

/**
 * プロット国リストフォーム
 * @param {Player} player 
 */
function plotGroupEditCountriesListForm(player, plotGroupId, plotAdmin = false) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const form = new ActionFormData();
    form.title({ rawtext: [{ translate: `plot.edit.menu.button.country` }] });
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.countries) plot.countries = [];
    form.button({ translate: `mc.button.country.add` });
    const countries = [];
    for (const countryRawData of plot.countries) {
        countries.push(GetAndParsePropertyData(`country_${countryRawData.id}`));
    };
    let aliveCountries = [];
    let aliveCountriesData = [];
    for (const c of countries) {
        if (c?.id) {
            aliveCountries.push(c.id);
            aliveCountriesData.push(c);
            form.button(`${c?.name}\n${c?.id}`);
        };
    };
    plot.countries = plot.countries.filter(d => aliveCountries.includes(d.id));
    StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);

    form.show(player).then(rs => {
        if (rs.canceled) {
            if (plotAdmin) {
                plotGroupEditMainFormPlotAdmin(player, plotGroupId);
                return;
            };
            plotGroupEditMainFormPlotOwner(player, plotGroupId);
            return;
        };
        if (rs.selection == 0) {
            countryAddPlotGroupForm(player, plotGroupId, plotAdmin);
            return;
        };
        plotGroupCountrySelectedShowForm(player, aliveCountriesData[rs.selection - 1], plotGroupId, plotAdmin);
        return;
    });
};

/**
 * 
 * @param {Player} player 
 * @param {string} plotGroupId 
 * @param {boolean} plotAdmin 
 * @param {boolean} serch 
 * @param {string} keyword 
 */
export function countryAddPlotGroupForm(player, plotGroupId, plotAdmin, search = false, keyword = ``) {
    const form = new ActionFormData();
    form.title({ translate: `form.plot.addcountry.list.title` });
    form.button({ translate: `form.plot.addcountry.button.serch` });
    const countryIds = countryDataBase.idList;
    let countries = [];
    countryIds.forEach(id => {
        countries[countries.length] = GetAndParsePropertyData(id);
    });

    if (search) {
        countries = countries.filter(c => c?.name.includes(keyword));
    };
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.countries) plot.countries = [];
    let aliveCountries = [];
    let aliveCountriesData = [];
    for (const c of countries) {
        if (c?.id) {
            aliveCountries.push(c.id);
            aliveCountriesData.push(c);
            form.button(`${c?.name}\nID: ${c?.id}`);
        };
    };
    plot.countries = plot.countries.filter(d => aliveCountries.includes(d.id));
    StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);

    form.show(player).then(rs => {
        if (rs.canceled) {
            plotGroupEditCountriesListForm(player, plotGroupId, plotAdmin);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //検索form

                break;
            };
            default: {
                //国追加しよう
                const target = aliveCountriesData[rs.selection - 1];
                plot.countries.push({ id: target.id, permissions: [] });
                StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
                plotGroupEditCountriesListForm(player, plotGroupId, plotAdmin);
                return;
            };
        };
    });
};

/**
 * 
 * @param {Player} player 
 * @param {*} targetData 
 * @param {boolean} plotAdmin 
 */
function plotGroupCountrySelectedShowForm(player, targetData, plotGroupId, plotAdmin = false) {
    const form = new ActionFormData();
    form.title({ text: `${targetData?.name}` });
    form.button({ translate: `mc.button.back` });
    form.button({ translate: `mc.button.edit.permission` });
    form.button({ translate: `mc.button.delete` });
    form.button({ translate: `mc.button.close` });
    form.show(player).then((rs) => {
        if (rs.canceled) {
            plotGroupEditCountriesListForm(player, plotGroupId, plotAdmin);
            return;
        };
        switch (rs.selection) {
            case 0: {
                plotGroupEditCountriesListForm(player, plotGroupId, plotAdmin);
                break;
            };
            case 1: {
                //国の権限編集
                plotGroupCountryPermissionsEditForm(player, plotGroupId, targetData, plotAdmin);
                break;
            };
            case 2: {
                //国の削除
                let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
                if (!plot) {
                    return;
                };
                if (!plot?.countries) plot.countries = [];
                plot.countries = plot.countries.filter(d => d.id != targetData.id);
                StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
                plotGroupEditCountriesListForm(player, plotGroupId, plotAdmin);
                break;
            };
            case 3: {
                //閉じる(何もしない)
                break;
            };
        };
    });
};

/**
 * プロット国権限編集フォーム
 * @param {Player} player 
 */
function plotGroupCountryPermissionsEditForm(player, plotGroupId, targetData, plotAdmin = false) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const form = new ModalFormData();
    form.title({ rawtext: [{ translate: `plot.edit.menu.button.permissions` }] });
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.countries) plot.countries = [];
    let target = plot.countries.find(d => d.id == targetData?.id) ?? { id: targetData?.id, permissions: [] };
    for (const permission of landPermissions) {
        form.toggle({ translate: `permission.${permission}` }, target?.permissions.includes(permission));
    };
    form.submitButton({ translate: `mc.button.save` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            if (plotAdmin) {
                plotGroupCountrySelectedShowForm(player, targetData, plotGroupId, plotAdmin);
                return;
            };
            return;
        };
        const values = rs.formValues;
        let newLandPermissions = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i]) {
                newLandPermissions.push(landPermissions[i]);
            };
        };
        target.permissions = newLandPermissions;
        const index = plot?.countries.findIndex(d => d.id == target.id);
        if (index != -1) {
            plot.countries[index] = target;
        } else {
            plot?.countries.push(target);
        };
        StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
        if (plotAdmin) {
            plotGroupCountrySelectedShowForm(player, targetData, plotGroupId, plotAdmin);
            return;
        };
        return;
    });
};

/*
 * 国の管理
 * ----------------------------------------------
 * プレイヤーの管理
 */

/**
 * プロットプレイヤーリストフォーム
 * @param {Player} player 
 */
function plotGroupEditPlayersListForm(player, plotGroupId, plotAdmin = false) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const form = new ActionFormData();
    form.title({ rawtext: [{ translate: `plot.edit.menu.button.player` }] });
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.players) plot.players = [];
    form.button({ translate: `mc.button.player.add` });
    const players = [];
    for (const playerRawData of plot.players) {
        players.push(GetAndParsePropertyData(`player_${playerRawData.id}`));
    };
    for (const p of players) {
        form.button(`${p?.name}\n${p?.id}`);
    };
    form.show(player).then(rs => {
        if (rs.canceled) {
            if (plotAdmin) {
                plotGroupEditMainFormPlotAdmin(player, plotGroupId);
                return;
            };
            plotGroupEditMainFormPlotOwner(player, plotGroupId);
            return;
        };
        if (rs.selection == 0) {
            playerAddPlotGroupForm(player, plotGroupId, plotAdmin);
            return;
        };
        plotGroupPlayerSelectedShowForm(player, players[rs.selection - 1], plotGroupId, plotAdmin);
        return;
    });
};

/**
 * 
 * @param {Player} player 
 * @param {string} plotGroupId 
 * @param {boolean} plotAdmin 
 * @param {boolean} serch 
 * @param {string} keyword 
 */
export function playerAddPlotGroupForm(player, plotGroupId, plotAdmin, serch = false, keyword = ``) {
    const form = new ActionFormData();
    let players = world.getPlayers();
    form.title({ translate: `form.plot.addplayer.list.title` });
    form.button({ translate: `form.plot.addplayer.button.serch` });
    if (serch) {
        players = players.filter(p => p.name.includes(keyword));
    };
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.players) plot.players = [];
    /**
     * @type {Array<Player>}
     */
    let showPlayers = [];
    for (const p of players) {
        if (plot.players.find(d => d?.id == p.id)) continue;
        form.button(`${p.name}§r\n${p.id}`);
        showPlayers.push(p);
    };
    form.show(player).then(rs => {
        if (rs.canceled) {
            plotGroupEditPlayersListForm(player, plotGroupId, plotAdmin);
            return;
        };
        switch (rs.selection) {
            case 0: {
                //検索form

                break;
            };
            default: {
                //プレイヤー追加しよう
                const target = showPlayers[rs.selection - 1];
                plot.players.push({ id: target.id, permissions: [] });
                StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
                plotGroupEditPlayersListForm(player, plotGroupId, plotAdmin);
                return;
            };
        };
    });
};

/**
 * 
 * @param {Player} player 
 * @param {*} targetData 
 * @param {boolean} plotAdmin 
 */
function plotGroupPlayerSelectedShowForm(player, targetData, plotGroupId, plotAdmin = false) {
    const form = new ActionFormData();
    form.title({ text: `${targetData?.name}` });
    form.button({ translate: `mc.button.back` });
    form.button({ translate: `mc.button.edit.permission` });
    form.button({ translate: `mc.button.delete` });
    form.button({ translate: `mc.button.close` });
    form.show(player).then((rs) => {
        if (rs.canceled) {
            plotGroupEditPlayersListForm(player, plotGroupId, plotAdmin);
            return;
        };
        switch (rs.selection) {
            case 0: {
                plotGroupEditPlayersListForm(player, plotGroupId, plotAdmin);
                break;
            };
            case 1: {
                //プレイヤーの権限編集
                plotGroupPlayerPermissionsEditForm(player, plotGroupId, targetData, plotAdmin);
                break;
            };
            case 2: {
                //プレイヤーの削除
                let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
                if (!plot) {
                    return;
                };
                if (!plot?.players) plot.players = [];
                plot.players.splice(plot.players.indexOf(d => d.id == targetData.id), 1);
                StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
                plotGroupEditPlayersListForm(player, plotGroupId, plotAdmin);
                break;
            };
            case 3: {
                //閉じる(何もしない)
                break;
            };
        };
    });
};

/**
 * プロットプレイヤー権限編集フォーム
 * @param {Player} player 
 */
function plotGroupPlayerPermissionsEditForm(player, plotGroupId, targetData, plotAdmin = false) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const form = new ModalFormData();
    form.title({ rawtext: [{ translate: `plot.edit.menu.button.permissions` }] });
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.players) plot.players = [];
    let target = plot.players.find(d => d.id == targetData?.id) ?? { id: targetData?.id, permissions: [] };
    for (const permission of landPermissions) {
        form.toggle({ translate: `permission.${permission}` }, target?.permissions.includes(permission));
    };
    form.submitButton({ translate: `mc.button.save` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            if (plotAdmin) {
                plotGroupPlayerSelectedShowForm(player, targetData, plotGroupId, plotAdmin);
                return;
            };
            return;
        };
        const values = rs.formValues;
        let newLandPermissions = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i]) {
                newLandPermissions.push(landPermissions[i]);
            };
        };
        target.permissions = newLandPermissions;
        const index = plot?.players.findIndex(d => d.id == target.id);
        if (index != -1) {
            plot.players[index] = target;
        } else {
            plot?.players.push(target);
        };
        StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
        if (plotAdmin) {
            plotGroupPlayerSelectedShowForm(player, targetData, plotGroupId, plotAdmin);
            return;
        };
        return;
    });
};

/*
 * プレイヤー管理
 * -----------------------------------------
 * デフォルト権限
 */

/**
 * プロットデフォルト権限編集フォーム
 * @param {Player} player 
 */
function plotGroupEditPermissionsForm(player, plotGroupId, plotAdmin = false) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const form = new ModalFormData();
    form.title({ rawtext: [{ translate: `plot.edit.menu.button.permissions` }] });
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    if (!plot?.permissions) plot.permissions = [];
    for (const permission of landPermissions) {
        form.toggle({ translate: `permission.${permission}` }, plot?.permissions.includes(permission));
    };
    form.submitButton({ translate: `mc.button.save` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            if (plotAdmin) {
                plotGroupEditMainFormPlotAdmin(player, plot, plotGroupId);
                return;
            };
            plotGroupEditMainFormPlotOwner(player, plot, plotGroupId);
            return;
        };
        const values = rs.formValues;
        let newLandPermissions = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i]) {
                newLandPermissions.push(landPermissions[i]);
            };
        };
        plot.permissions = newLandPermissions;
        StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
        if (plotAdmin) {
            plotGroupEditMainFormPlotAdmin(player, plotGroupId);
            return;
        };
        return;
    });
};

/*
 * デフォルト権限
 * --------------------------------------
 * プロットアドミンプロット設定フォーム
 */

/**
 * プロットアドミンプロット設定フォーム
 * @param {Player} player 
 */
function plotGroupEditSettingFormPlotAdmin(player, plotGroupId) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const form = new ModalFormData();
    form.title({ rawtext: [{ translate: `plot.edit.menu.button.settings` }] });
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };

    const type = ["public", "private", "embassy"];
    const typeMessges = [
        { rawtext: [{ translate: `plot.public` }] },
        { rawtext: [{ translate: `plot.private` }] },
        { rawtext: [{ translate: `plot.embassy` }] },
    ];
    form.textField({ rawtext: [{ translate: `plot.name` }] }, { rawtext: [{ translate: `input.plot.name` }] }, plot?.name ?? `new Plot`);
    form.dropdown({ rawtext: [{ translate: `plot.type` }] }, typeMessges, type.indexOf(plot?.type ?? `public`));
    form.textField({ translate: `plot.price`, with: [`${config.MoneyName} ${plot?.price ?? 0}`] }, { translate: `plot.price.input` }, `${plot?.price ?? 0}`);
    form.toggle({ translate: `plot.selling` }, plot?.is_selling);
    form.toggle({ translate: `plot.enable` }, plot?.enable);
    form.show(player).then((rs) => {
        if (rs.canceled) {
            plotGroupEditMainFormPlotAdmin(player, plotGroupId);
            return;
        };
        let newPlotName = rs.formValues[0];
        if (newPlotName == ``) {
            newPlotName = `new Plot`;
        };
        //値段チェック
        let price = rs.formValues[2];
        if (isDecimalNumberZeroOK(price)) {
            price = `0`;
        };
        if (Number(price) < 0) {
            price = `0`;
        };
        plot.name = newPlotName;
        plot.price = Math.floor(Number(price));
        plot.type = type[rs.formValues[1]];
        plot.is_selling = rs.formValues[3];
        plot.enable = rs.formValues[4];
        StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
        plotGroupEditMainFormPlotAdmin(player, plotGroupId);
        return;
    });
};

/*
 * プロットアドミンプロット設定フォーム
 * --------------------------------------
 * プロット所有者プロット設定フォーム
 */

/**
 * プロット所有者プロット設定フォーム
 * @param {Player} player 
 */
function plotGroupEditSettingFormPlotOwner(player, plotGroupId) {
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    if (!playerData?.country) return;
    const form = new ModalFormData();
    form.title({ rawtext: [{ translate: `plot.edit.menu.button.settings` }] });
    let plot = GetAndParsePropertyData(`plotgroup_${plotGroupId}`);
    if (!plot) {
        return;
    };
    form.textField({ rawtext: [{ translate: `plot.name` }] }, { rawtext: [{ translate: `input.plot.name` }] }, plot?.name ?? `new Plot`);
    form.textField({ translate: `plot.price`, with: [`${config.MoneyName} ${plot?.price ?? 0}`] }, { translate: `plot.price.input` }, `${plot?.price ?? 0}`);
    form.toggle({ translate: `plot.selling` }, plot?.is_selling);
    form.toggle({ translate: `plot.enable` }, plot?.enable);
    form.show(player).then((rs) => {
        if (rs.canceled) {
            plotGroupEditMainFormPlotOwner(player, plotGroupId);
            return;
        };
        //名前チェック
        let newPlotName = rs.formValues[0];
        if (newPlotName == ``) {
            newPlotName = `new Plot`;
        };
        //値段チェック
        let price = rs.formValues[1];
        if (isDecimalNumberZeroOK(price)) {
            price = `0`;
        };
        if (Number(price) < 0) {
            price = `0`;
        };
        plot.name = newPlotName;
        plot.price = Math.floor(Number(price));
        plot.is_selling = rs.formValues[2];
        plot.enable = rs.formValues[3];
        StringifyAndSavePropertyData(`plotgroup_${plotGroupId}`, plot);
        plotGroupEditMainFormPlotOwner(player, plotGroupId);
        return;
    });
};