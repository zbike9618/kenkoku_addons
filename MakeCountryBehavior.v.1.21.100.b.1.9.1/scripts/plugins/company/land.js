import { world ,system} from "@minecraft/server";
import { DynamicProperties } from "../../api/dyp";
import { GetAndParsePropertyData,StringifyAndSavePropertyData } from "../../lib/util"
import { sendDataForPlayers } from "../sendData";
const companyDataBase = new DynamicProperties("company");
const playerDataBase = new DynamicProperties("player");
/**
 * 会社を解体する関数
 * @param {*} player 
 * @param {*} companyData 
 */
export function deletecompany(player,companyData)
{
 companyDataBase.delete(`company_${companyData.id}`)
 companysort()
 worldchat(`${companyData.name}§6が解体された...`)
}
/**
 * 会社の順番を整理する関数
 */
export function companysort() {
  const companyIds = companyDataBase.idList;
  let data = [];
  for(const id of companyIds)
  {
    data.push(GetAndParsePropertyData(id))
  }
  // IDで昇順ソート（元のidは使わない）
  data.sort((a, b) => a.id - b.id);

  // 1から順番に新しいIDを振り直す
  data.forEach((company, index) => {
    const oldId = company.id
    const newId = index + 1; // 1,2,3...
    company.id = newId
    StringifyAndSavePropertyData(`company_${company.id}`, company); // データ保存
    if(newId != oldId)
    companyDataBase.delete(`company_${oldId}`)
  });
}
export function worldchat(text)
{
 world.sendMessage(`§a[MakeCompany]\n§f ${text}`)
}
/**
 * 権限を持っているか確かめる関数
 * 持っていたらtrueを返す
 * @param {*} player 
 * @param {*} companyData 
 * @param {*} permission
 * @returns 
 */
export function getpermission(player, companyData, permission) {
    // playerの役職を取得
    const role = companyData.permissionm?.[player.id];
    if (!role) return false;

    // companyData.permissionからその役職の権限配列を取得
    const permArray = companyData.permission?.[role];

    // 権限配列にpermissionが含まれているか判定
    return Array.isArray(permArray) && permArray.includes(permission);
}
export function makepermission(player,companyData, permissionsData) {
  // 既存の権限データをコピー（なければ空オブジェクト）
  let permission = companyData.permission ? JSON.parse(JSON.stringify(companyData.permission)) : {};

  for (const [key, value] of Object.entries(permissionsData)) {
    if (!permission[key]) permission[key] = [];
    for (const v of value) {
      if (!permission[key].includes(v)) {
        permission[key].push(v);
      }
    }
  }
  companyData.permission = permission;
  StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
  //メッセージ
  player.sendMessage(`§a[MakeCompany]\n§f 権限データを更新しました。(${Object.keys(permissionsData).join(", ")})`);
}
/**
 * 
 * @param {*} player 
 * @param {*} companyData 
 * @param {*} permission 
 */
export function setpermission(playerId, companyData, permission) {
  const companyId = companyData.id;

  const perm = permission;

  if (!companyId || !playerId || !perm) {
    world.sendMessage(`[setpermission] companyId, playerId, permission のいずれかが無効です: companyId=${companyId}, playerId=${playerId}, permission=${perm}`);
    return;
  }

  // GetAndParsePropertyDataを使ってデータ取得
  const code = `
    const companyData = GetAndParsePropertyData("company_${companyId}");
    if (!companyData.permissionm) companyData.permissionm = {};
    companyData.permissionm["${playerId}"] = "${perm}";
    StringifyAndSavePropertyData("company_${companyId}", companyData);
  `;
  sendDataForPlayers(code, playerId);
}
export function getAllPlayers() {
  let players = [];
  for(const id of playerDataBase.idList)
  {
    players.push(GetAndParsePropertyData(id))
  }
  return players;
}
export function IdtoName(playerId) {
  const playerData = GetAndParsePropertyData(`player_${playerId}`);
  return playerData ? playerData.name : "不明なプレイヤー";
}
export function invite(playerId, companyData) {
  const companyId = companyData.id;
  const companyName = companyData.name;

  const code = `
    const companyData = GetAndParsePropertyData("company_${companyId}");
    let playerData = GetAndParsePropertyData("player_${playerId}");
    if (!playerData.invite_company) playerData.invite_company = [];
    if (!playerData.invite_company.includes(${companyId})) {
      playerData.invite_company.push(${companyId});
    }
    StringifyAndSavePropertyData("player_${playerId}", playerData);
    world.getEntity("${playerId}").sendMessage("§f ${companyName}§eから会社の招待を受けました。/jcp で確認できます。");
  `;
  sendDataForPlayers(code, playerId);
}
