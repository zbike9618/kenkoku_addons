
import { world ,system} from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { GetAndParsePropertyData,StringifyAndSavePropertyData } from "../../lib/util"
import { DynamicProperties } from "../../api/dyp";
import {deletecompany,companysort,worldchat,getpermission,setpermission,makepermission,getAllPlayers,IdtoName,invite} from "./land"
import { sendDataForPlayers } from "../sendData";
const allperm = ["setting","role","invite","interview","playersetting","money","acquisition","delete"];
const companyKind = ["建設","金融","商業"]
export async function companymenu(player)
{
  const form = new ModalFormData();
  form.title("Config");
  form.textField({text:"会社名"},{text:"ゼットデビルス銀行"},{text:""});
  form.textField({text:"会社の説明"},{text:"アットホームな会社です。"},{text:""});
  form.dropdown({text:"会社の種類"},companyKind,{defaultValueIndex:0});
  const res = await form.show(player);
  if (res.canceled) return;
  const name = res.formValues[0]//名前
    const idString = world.getDynamicProperty(`companyId`) ?? "1"
    let id = Number(idString);
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    world.setDynamicProperty(`companyId`, `${id + 1}`);
  const companyData = 
  {
   name,//会社名
   id,//会社のID
   lore:res.formValues[1],
   owner: player.id,
   members: [player.id],
   money:0,
   returntime:{},//借金の返却時間
   permission:{"社長":allperm,
    "一般社員":[],"副社長":["invite",]},
   permissionm:{},//player.id:"権限の名前"
   hope_jcp:[],//player.id
   companyKind:res.formValues[2],//会社の種類
   financesetting:{//金融会社の設定
    minterest:0.0005,//金利
    withdrawfee:0.0001,//引き出すときの手数料
    maxlendable:10000,//最大貸出可能額
    debtinterest:0.001,//借金の利息(%)
    debtinteresttime:1,//借金の利息の発生時間(何時間ごと)
    maxdebtrepaymenttime:24//借金の最大返済設定時間(h)
   },
   depositmember:[]
  }
  StringifyAndSavePropertyData(`company_${id}`,companyData)
 StringifyAndSavePropertyData(`player_${player.id}`, playerData);
 setpermission(player.id,companyData,"社長")
 companysort()//整理
 worldchat(`${name}§6が設立された`)
}

const companyDataBase = new DynamicProperties("company");

/**
 * 完成
 * 国の一覧表示
 * @param {Player} player 
 */
export async function companyList(player) {
    try {
        const form = new ActionFormData();
        form.title("会社リスト");
        const companyIds = companyDataBase.idList;
        let countries = [];
        companyIds.forEach(id => {
            countries[countries.length] = GetAndParsePropertyData(id);
        });
        if (countries.length === 0) {
            form.body("会社はありません");
            form.button("閉じる");
        };
        countries.forEach(company => {
            form.button(`${company?.name} \n§rID: ${company?.id}`);
        });
            const res = await form.show(player);            
            companycontrol(player, countries[res.selection]);
    }
     catch (error) {
        console.warn(error);
    };
};
export async function companycontrol(player,companyData)
{
 const financeData = new FinanceControl()
        const form = new ActionFormData();
        form.title("会社")
        form.body(`${companyData.name}の設定`)
        form.button("会社情報")
        const kind = companyData.companyKind
        if(kind===1)//金融
        form.button("借りる");
        form.button("預ける");
        form.button("返済")
        form.button("引き出し")
        const res = await form.show(player);
        if(res.selection === 0)
        {
            showCompanyInfo(player,companyData)
        }
        if(res.selection === 1)
        {
            financeData.borrowmoneyForm(player,companyData)
        }
        if(res.selection === 2)
        {
            financeData.depositmoneyForm(player,companyData)
        }
        if(res.selection === 3)
        {
            //返済
            financeData.repaymoneyForm(player,companyData)
        }
        if(res.selection === 4)
        {
            financeData.returnmoney(player,companyData)
        }

}

system.runInterval(() => {

  const companyIds = companyDataBase.idList;

  companyIds.forEach(id => {
    let companyData = GetAndParsePropertyData(id);

    if (!companyData) {
      return;
    }

    if (!companyData.financesetting) {
      return;
    }

    if (!companyData.depositmember) {
      return;
    }

    for (const playerId of companyData.depositmember) {
      const playerData = GetAndParsePropertyData(`player_${playerId}`);

      if (!playerData) {
        continue;
      }

      if (!playerData.deposittime || playerData.deposittime[companyData.id] === undefined) {
        continue;
      }

      const depositStart = Number(playerData.deposittime[companyData.id]);
      const now = world.getAbsoluteTime();
      const maxTime =  1 * 20 * 60 * 60
      const depositAmount = Number(playerData.depositmoney?.[companyData.id] ?? 0);


      if (now >= depositStart + maxTime) {
        // 利息計算
        const rate = Number(companyData.financesetting.minterest ?? 0);
        const interest = Math.floor(rate * depositAmount);

        playerData.depositmoney ??= {};
        playerData.deposittime ??= {};
        playerData.depositmoney[companyData.id] += interest;
        playerData.deposittime[companyData.id] = now;

        // 保存
        StringifyAndSavePropertyData(`player_${playerId}`, playerData);

        // ログ出力
        world.sendMessage(`§a預金${depositAmount}円に利息${interest}円を追加。合計=${playerData.depositmoney[companyData.id]}`);
      }
    }

  });

}, 1200);
system.runInterval(() => {

  const companyIds = companyDataBase.idList;

  companyIds.forEach(id => {
    let companyData = GetAndParsePropertyData(id);
    if (!companyData) {
      return;
    }

    // 金融設定がない場合スキップ
    if (!companyData.financesetting) {
      return;
    }

    if (!companyData.returntime) {
      return;
    }

    // 会社処理開始

    for (const playerId in companyData.returntime) {
      const playerData = GetAndParsePropertyData(`player_${playerId}`);

      if (!playerData) {
        continue;
      }

      if (!playerData.borrowtime || playerData.borrowtime[companyData.id] === undefined) {
        continue;
      }

      const borrowStart = Number(playerData.borrowtime[companyData.id]);
      const maxTime = Number(companyData.financesetting.debtinteresttime) * 20 * 60 * 60;
      const now = world.getAbsoluteTime();

      // 時間経過チェック
      if (now >= borrowStart + maxTime) {
        const debt = playerData.debt[companyData.id];
        if (debt > 0) {
          const rate = companyData.financesetting.debtinterest ?? 0;
          const interest = Math.floor(debt * (rate));
          playerData.debt[companyData.id] += interest;

          // メッセージ

            const code = `world.getEntity('${playerId}').sendMessage('§c${companyData.name}の借金の利息が発生しました。現在の借金は ${playerData.debt[companyData.id]} 円です。');`
            sendDataForPlayers(code,playerId)

        }

        // 次の利息発生時間を設定
        playerData.borrowtime[companyData.id] = now;
        StringifyAndSavePropertyData(`player_${playerId}`, playerData);
      }
    }

  });

},1200);

export class FinanceControl{
    async borrowmoneyForm(player,companyData)
    {
        //借りる
        const form = new ModalFormData();
        form.title("借りる");
        form.textField({text:"借りる金額"},{text:"1000"},{text:""});
        form.textField({text:"借りる時間(h)"},{text:"1"},{text:""});
        const res = await form.show(player);
        if (res.canceled) return;
        const money = Number(res.formValues[0])//借りる金額
        const time = Number(res.formValues[1])//借りる時間
        if(isNaN(money) || isNaN(time) || money <= 0 || time <= 0)
        {
            const form = new ActionFormData();
            form.title("エラー");
            form.body("正しい数字を入力してください");
            form.button("閉じる");
            await form.show(player);
            return;
        }
        if(money > companyData.financesetting.maxlendable)
        {
            const form = new ActionFormData();
            form.title("エラー");
            form.body(`最大貸出可能額は${companyData.financesetting.maxlendable}円です`);
            form.button("閉じる");
            await form.show(player);
            return;
        }
        //借りる処理
        if(companyData.money < money)
        {
            const form = new ActionFormData();

            form.title("エラー");
            form.body("会社の資本金が足りません");
            form.button("閉じる");
            await form.show(player);
            return;
        }
        player.sendMessage(`§a${money}円§r§eを借りました。返済期限は${time}時間後です。`);
        companyData.money -= money;
        if(!(player.id in companyData.returntime))
        {
            companyData.returntime[player.id] = world.getAbsoluteTime() + time * 20 * 60 * 60;
        }
        StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
        const playerData = GetAndParsePropertyData(`player_${player.id}`);
        playerData.borrowtime = playerData.borrowtime ?? {};
        playerData.borrowtime[companyData.id] = world.getAbsoluteTime() || 0;
        playerData.debt = playerData.debt ?? {};
        playerData.debt[companyData.id] = money;
        world.sendMessage(`${playerData.debt[companyData.id]}`)
        playerData.money = (playerData.money ?? 0) + money;
        StringifyAndSavePropertyData(`player_${player.id}`, playerData);
        //返済の処理は別途実装
    }
    async depositmoneyForm(player,companyData)
    {
        //預ける
        const playerData = GetAndParsePropertyData(`player_${player.id}`);
        const form = new ModalFormData();
        form.title(`預ける(所持金:${playerData.money})`);
        form.textField({text:`預ける金額(現在の預け額${playerData.depositmoney[companyData.id]})`},{text:"1000"},{text:""});
        const res = await form.show(player);
        if (res.canceled) return;
        const money = Number(res.formValues[0])//預ける金額
        if(isNaN(money) || money <= 0)
        {
            const form = new ActionFormData();
            form.title("エラー");
            form.body("正しい数字を入力してください");
            form.button("閉じる");
            await form.show(player);
            return;
        }
        //預ける処理
        if((playerData.money ?? 0) < money)
        {
            const form = new ActionFormData();
            form.title("エラー");
            form.body("所持金が足りません");
            form.button("閉じる");
            await form.show(player);
            return;
        }
        player.sendMessage(`§e${companyData.name}に§a${money}円§r§eを預けました。`);
        companyData.money += money;
        companyData.depositmember.push(player.id)
        StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
        playerData.money -= money;
        playerData.depositmoney = playerData.depositmoney ?? {};
        playerData.depositmoney[companyData.id] = money;
        playerData.deposittime = playerData.deposittime ?? {};
        playerData.deposittime[companyData.id] = world.getAbsoluteTime() || 0;
        StringifyAndSavePropertyData(`player_${player.id}`, playerData);
        //利息の処理は別途実装
    }
    async repaymoneyForm(player,companyData)
    {
        //返済
        const form = new ModalFormData();
        form.title("返済(現在のお金:"+((GetAndParsePropertyData(`player_${player.id}`).money) ?? 0)+"円");
        form.textField({text:"返済する金額(現在の借金:"+((GetAndParsePropertyData(`player_${player.id}`).debt && GetAndParsePropertyData(`player_${player.id}`).debt[companyData.id]) ?? 0)+"円)"},{text:"1000"},{text:""});
        const res = await form.show(player);
        if (res.canceled) return;
        const money = Number(res.formValues[0])//返済する金額
        if(isNaN(money) || money <= 0)
        {
            const form = new ActionFormData();
            form.title("エラー");
            form.body("正しい数字を入力してください");
            form.button("閉じる");
            await form.show(player);
            return;
        }
        //返済処理
        const playerData = GetAndParsePropertyData(`player_${player.id}`);
        if((playerData.money ?? 0) < money)
        {
            const form = new ActionFormData();
            form.title("エラー");
            form.body("所持金が足りません");
            form.button("閉じる");
            await form.show(player);
            return;
        }
        if(!playerData.debt || !playerData.debt[companyData.id] || playerData.debt[companyData.id] <= 0)
        {
            const form = new ActionFormData();
            form.title("エラー");
            form.body("返済する借金がありません");
            form.button("閉じる");
            await form.show(player);
            return;
        }
        if(money >= playerData.debt[companyData.id])
        {
            player.sendMessage(`§e${companyData.name}への借金を全て返済しました。`);
            playerData.money -= playerData.debt[companyData.id];
            delete playerData.debt[companyData.id];
            delete playerData.borrowtime[companyData.id];
            delete companyData.returntime[player.id];
            StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
            StringifyAndSavePropertyData(`player_${player.id}`, playerData);
            return;
        }
        player.sendMessage(`§e${companyData.name}への借金を§a${money}円§r§e返済しました。`);
        playerData.debt[companyData.id] -= money;
        playerData.money -= money;
        StringifyAndSavePropertyData(`player_${player.id}`, playerData);
        companyData.money += money;
        StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
    }
    async returnmoney(player,companyData)
    {
                //返済
        const form = new ModalFormData();
        form.title("引き出し(現在のお金:"+((GetAndParsePropertyData(`player_${player.id}`).money) ?? 0)+"円");
        form.textField({text:"引き出しする金額(現在の預け額:"+((GetAndParsePropertyData(`player_${player.id}`).depositmoney && GetAndParsePropertyData(`player_${player.id}`).depositmoney[companyData.id]) ?? 0)+"円)"},{text:"1000"},{text:""});
        const res = await form.show(player);
        if (res.canceled) return;
        const money = Number(res.formValues[0])//返済する金額
        if(isNaN(money) || money <= 0)
        {
            const form = new ActionFormData();
            form.title("エラー");
            form.body("正しい数字を入力してください");
            form.button("閉じる");
            await form.show(player);
            return;
        }
        //返済処理
        const playerData = GetAndParsePropertyData(`player_${player.id}`);
        if((playerData.depositmoney[companyData.id] ?? 0) < money)
        {
            const form = new ActionFormData();
            form.title("エラー");
            form.body("預け額よりも多い金額は取れません");
            form.button("閉じる");
            await form.show(player);
            return;
        }
        delete companyData.depositmember[player.id]
        const interest = money * companyData.financesetting.withdrawfee
        playerData.money += (money-interest);
        playerData.depositmoney[companyData] -= money
        StringifyAndSavePropertyData(`player_${player.id}`, playerData);
        StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
        world.sendMessage(`§e${companyData.name}から§a${money}§e円引き出しました`)
        world.sendMessage(`§e手数料として§a${interest}§e円徴収しました`)

    }
}

/**
 * 国の情報を表示
 * @param {Player} player 
 * @param {any} countryData 
 */
export async function showCompanyInfo(player, countryData) {
    try {
        let show = []
        show.push(`会社名:${countryData.name}`)//会社名
        show.push(`説明:${countryData.lore}`)//説明
        show.push(`会社の種類:${companyKind[countryData.companyKind]}`)//会社の種類
        const owner = countryData.owner

        show.push(`\n社長: ${GetAndParsePropertyData(`player_${owner}`).name}`)
        let member = []
        for(const p of countryData.members)
        {
            member.push(GetAndParsePropertyData(`player_${p}`).name)
        }
        show.push(`\n社員:${member}`)

        if(countryData.companyKind === 1)//金融
        {
            show.push(`\n<金融会社の設定>`)
            show.push(`金利: ${countryData.financesetting.minterest*100}％`)
            show.push(`引き出すときの手数料: ${countryData.financesetting.withdrawfee*100}％`)
            show.push(`貸すときに許可が必要か？: ${countryData.financesetting.needpermissiontolend ? "はい" : "いいえ"}`)
            show.push(`最大貸出可能額: ${countryData.financesetting.maxlendable}円`)
            show.push(`借金の利息: ${countryData.financesetting.debtinterest*100}％`)
            show.push(`借金の利息の発生時間: ${countryData.financesetting.debtinteresttime}時間ごと`)
            show.push(`借金の最大返済設定時間: ${countryData.financesetting.maxdebtrepaymenttime}時間`)
        }



        let showBody = "";
        for(const text of show)
        {
            showBody += `\n${text}`
        }
        const form = new ActionFormData();
        form.title(countryData.name);
        form.body(showBody);
        form.button("閉じる");
        const res = await form.show(player);          
    } catch (error) {
        console.warn(error);
    };
};
export async function deletecompanyForm(player)
{
    try {
        const form = new ActionFormData();
        form.title("削除");
        const companyIds = companyDataBase.idList;
        let countries = [];
        for(const id of companyIds.filter(c => GetAndParsePropertyData(c).owner == player.id))
        {
            countries.push(GetAndParsePropertyData(id));
        }
        /*companyIds.forEach(id => {
            countries[countries.length] = GetAndParsePropertyData(id);
        });*/
        if (countries.length === 0) {
            form.body("どの会社の社長でもありません");
            form.button("閉じる");
        };
        countries.forEach(company => {
            form.button(`${company?.name} \n§rID: ${company?.id}`);
        });
            const res = await form.show(player);
            const newform = new MessageFormData();
            newform.title("確認");
            newform.body(`本当に削除してよろしいですか？(${countries[res.selection].name})`);
            newform.button1("やめる");
            newform.button2("解体する");
            const resp = await newform.show(player);
            if(resp.selection === 1)
            {
             deletecompany(player, countries[res.selection]);
            }
            
    }
     catch (error) {
        console.warn(error);
    };
}
async function roleForm(player,companyData)
{
    try {
        const form = new ActionFormData();
        form.title("ロール");
        const permissionsData = companyData.permission
        let roles = [];
        if(getpermission(player,companyData,"role"))
            {
                form.button("ロールの作成")
            }
        for(const role in permissionsData)
        {
            roles.push(role)
            form.button(role)
        }
        
            const res = await form.show(player);  
            if(res.selection === 0)
            {
                makeroleForm(player,companyData)
                return;
            }
            const newform = new ActionFormData();
            newform.title(roles[res.selection - 1]);
            const perm = permissionsData[roles[res.selection-1]]
            
            if(perm.length === 0)
            {
             newform.body("権限はありません")
            }
            else
            {
             newform.body(`権限:\n${perm}`)   
            }
            if(getpermission(player,companyData,"role"))
            {
             newform.button("権限の編集")   
            }
            
            const resp = await newform.show(player);
            if(resp.selection === 0) 
            {
              editroleForm(player,companyData,roles[res.selection-1])  
            }
            
    } catch (error) {
        console.warn(error);
    };
}
async function makeroleForm(player, companyData) {
    const form = new ModalFormData();
    form.title("ロールの作成");
    form.textField({text:"ロール名"},{text:"新しいロール"},{text:""});
    // トグルで権限を選択
    form.toggle({text:"設定の変更"},{defaultValue: false});
    form.toggle({text:"ロールの変更"},{defaultValue: false});
    form.toggle({text:"社員の招待"},{defaultValue: false});
    form.toggle({text:"社員の入社許可"},{defaultValue: false});
    form.toggle({text:"社員設定"},{defaultValue: false});
    form.toggle({text:"資本金の管理"},{defaultValue: false});
    form.toggle({text:"会社の買収"},{defaultValue: false});
    form.toggle({text:"会社の解体"},{defaultValue: false});
    const permissionsData = companyData.permission;
    const res = await form.show(player);
    if (res.canceled) return;
    const roleName = res.formValues[0]; // 名前
    if(roleName in permissionsData) {
        const form = new ActionFormData();
        form.title("エラー");
        form.body("その名前のロールは既に存在します");
        form.button("閉じる");
        await form.show(player);
        roleForm(player, companyData);
        return;
    }
    // 2番目以降のformValuesがトグルの値
    const selectedPerms = allperm.filter((perm, idx) => res.formValues[idx + 1]);
    let roleData = { [roleName]: selectedPerms };
    makepermission(player,companyData, roleData);
    roleForm(player, companyData);
}
async function editroleForm(player, companyData, role) {
    const form = new ModalFormData();
    form.title("権限の編集");
    // 修正: 実際のcompanyData.permissionを参照
    const permissionsData = companyData.permission;
    const perm = Object.assign(permissionsData[role]) ?? [];
    form.toggle("設定の変更",{defaultValue: perm.includes("setting")});
    form.toggle("ロールの変更", {defaultValue: perm.includes("role")});
    form.toggle("社員の招待",{defaultValue:perm.includes("invite")});
    form.toggle("社員の入社許可",{defaultValue: perm.includes("interview")});
    form.toggle("社員設定",{defaultValue: perm.includes("playersetting")});
    form.toggle("資本金の管理",{defaultValue: perm.includes("money")});
    form.toggle("会社の買収",{defaultValue: perm.includes("acquisition")});
    form.toggle("会社の解体",{defaultValue: perm.includes("delete")});
    const res = await form.show(player);
    // ここも修正: トグルの状態から新しい配列を作る
    const newPerm = allperm.filter((p, idx) => res.formValues[idx]);
    permissionsData[role] = newPerm;
    StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
}
export async function decidescp(player)
{
    try {
        const form = new ActionFormData();
        form.title("会社リスト");
        const companyIds = companyDataBase.idList;
        let countries = [];
        for(const id of companyIds.filter(c => GetAndParsePropertyData(c).members.includes(player.id)))
        {
            countries.push(GetAndParsePropertyData(id));
        }
        /*companyIds.forEach(id => {
            countries[countries.length] = GetAndParsePropertyData(id);
        });*/
        if (countries.length === 0) {
            form.body("会社はありません");
            form.button("閉じる");
        };
        countries.forEach(company => {
            form.button(`${company?.name} \n§rID: ${company?.id}`);
        });
            const res = await form.show(player);            
            scp(player, countries[res.selection]);
    }
     catch (error) {
        console.warn(error);
    };
}
async function setPlayersRole(player,companyData)
{
    try {
        const form = new ActionFormData();
        form.title("社員設定");
        let members = []
        for(const p of companyData.members)
        {
            members.push(p)
            form.button(IdtoName(p))
        }
            const res = await form.show(player);  
            if(res.canceled) 
                {
                    scp(player,companyData)
                    return;
                }
            setPlayerSettingForm(player,companyData, members[res.selection])
    } catch (error) {
        console.warn(error);
    };
}
async function setPlayerSettingForm(player,companyData, memberId)
{
    try {
        const form = new ActionFormData();
        form.title("社員設定");
        if(memberId === companyData.owner)
                {
                    const form = new ActionFormData();
                    form.title("エラー");
                    form.body("社長は設定できません");
                    form.button("閉じる");
                    await form.show(player);
                    setPlayersRole(player,companyData)
                    return;
                }
        form.button("役職設定")
        form.button("解雇")
            const res = await form.show(player);  
            if(res.selection === 0)
            {
             setPlayerRoleForm(player,companyData, memberId)   
            }
            if(res.selection === 1)
            {
                dismissalForm(player,companyData,memberId)
            }
    } catch (error) {
        console.warn(error);
    };
}
async function setPlayerRoleForm(player,companyData, memberId)
{
    try {
        const form = new ActionFormData();
        form.title("役職設定");
        const permissionsData = Object.keys(companyData.permission)
        let roles = [];
        for(const role of permissionsData)
        {
            roles.push(role)
            form.button(role)
        }
            const res = await form.show(player);
            if(res.canceled)
                {
                    setPlayersRole(player,companyData)
                    return;
                }  
            setpermission(memberId,companyData, roles[res.selection])
            player.sendMessage(`${IdtoName(memberId)}§aの役職を${roles[res.selection]}に設定しました`)
            setPlayersRole(player,companyData)
    } catch (error) {
        console.warn(error);
    };
}
export async function jcpForm(player)
{
    //会社に入るとき　入社希望か招待受けるか決めれる

        const form = new ActionFormData();
        form.title("入社");
        form.button("招待を受諾する")
        form.button("面接を受ける")
            const res = await form.show(player);  
            if(res.selection === 0)
            {
                const companyIds = companyDataBase.idList;
                let countries = [];
                //招待されてる会社一覧
                const invitedCompanies = GetAndParsePropertyData(`player_${player.id}`).invite_company || [];
                for(const id of companyIds.filter(c => invitedCompanies.includes(GetAndParsePropertyData(c).id)))
                {
                    countries.push(GetAndParsePropertyData(id));
                }
                if(countries.length === 0)
                {
                 const form = new ActionFormData();
                 form.title("エラー");
                 form.body("招待がありません");
                 form.button("閉じる");
                 await form.show(player);
                 return;
                }
                const form2 = new ActionFormData();
                form2.title("招待リスト");
                countries.forEach(company => {
                    form2.button(`${company?.name} \n§rID: ${company?.id}`);
                });
                const res2 = await form2.show(player);  
                if(res2.canceled) return;
                const companyData = countries[res2.selection]
                const form3 = new MessageFormData();
                form3.title("確認");
                form3.body(`本当に入社してよろしいですか？(${companyData.name})`);
                form3.button1("やめる");
                form3.button2("入社する");
                const resp = await form3.show(player);
                if(resp.selection === 1)
                {
                    const playerData = GetAndParsePropertyData(`player_${player.id}`);
                    playerData.invite_company = playerData.invite_company.filter(c => c !== companyData.id);
                    StringifyAndSavePropertyData(`player_${player.id}`, playerData);
                    companyData.members.push(player.id);
                    StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
                    setpermission(player.id,companyData,"一般社員")
                    player.sendMessage(`§a${companyData.name}§r§eに入社しました。`)
                }
                return;
            }
            if(res.selection === 1)
            {
                const companyIds = companyDataBase.idList;
                let countries = [];
                for(const id of companyIds)
                {
                    countries.push(GetAndParsePropertyData(id));
                }
                if(countries.length === 0)
                {
                 const form = new ActionFormData();
                 form.title("エラー");
                 form.body("会社がないです");
                 form.button("閉じる");
                 await form.show(player);
                 return;
                }
                const form2 = new ActionFormData();
                form2.title("面接リスト");
                countries.forEach(company => {
                    form2.button(`${company?.name} \n§rID: ${company?.id}`);
                });
                const res2 = await form2.show(player);  
                if(res2.canceled) return;
                const companyData = countries[res2.selection]
                
                const form3 = new MessageFormData();
                form3.title("確認");
                form3.body(`本当に面接を受けてよろしいですか？(${companyData.name})`);
                form3.button1("やめる");
                form3.button2("面接を受ける");
                const resp = await form3.show(player);
                if(resp.selection === 1)
                {
                    companyData.hope_jcp.push(player.id);
                    StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
                    const code = `world.getEntity('${companyData.owner}').sendMessage('§e${companyData.name}§r§aの面接希望を受け付けました');`
                    sendDataForPlayers(code,companyData.owner)
                    player.sendMessage(`§a${companyData.name}§r§eの面接希望を送りました。`)
                }
                return;
            }

}
async function dismissalForm(player,companyData,memberId)
{
    try {
        if(memberId === companyData.owner)
                {
                    const form = new ActionFormData();
                    form.title("エラー");
                    form.body("社長は解雇できません");
                    form.button("閉じる");
                    await form.show(player);
                    setPlayersRole(player,companyData)
                    return;
                }
                const newform = new MessageFormData();
                newform.title("確認");
                newform.body(`本当に解雇してよろしいですか？(${IdtoName(memberId)})`);
                newform.button1("やめる");
                newform.button2("解雇する");
                const resp = await newform.show(player);
                if(resp.selection === 1)
                {
                    companyData.permissionm[memberId]//役職削除
                    companyData.members = companyData.members.filter(m => m !== memberId);
                    StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
                    setPlayersRole(player,companyData)
                    player.sendMessage(`${IdtoName(memberId)}§cを解雇しました`)
                    const code = `world.getEntity('${memberId}').sendMessage('§c${companyData.name}§r§eから解雇されました。');`
                    sendDataForPlayers(code,memberId)
                }
            } catch (error) {
        console.warn(error);
    };
}
async function inviteorinterview(player,companyData)
{
    try {
        const form = new ActionFormData();
        form.title("招待/面接");
        form.button("招待")
        form.button("面接")
            const res = await form.show(player);  
            if(res.selection === 0)
            {
             inviteForm(player,companyData)   
            }
            if(res.selection === 1)
            {
                interviewForm(player,companyData)
            }
    } catch (error) {
        console.warn(error);
    };
}
async function inviteForm(player,companyData)
{
        const form = new ActionFormData();
        form.title("招待");
        const players = getAllPlayers().filter(p => !companyData.members.includes(p.id) && !GetAndParsePropertyData(`player_${p.id}`).invite_company?.includes(companyData.id))
        if(players.length === 0)
        {
         const form = new ActionFormData();
         form.title("エラー");
         form.body("招待できるプレイヤーがいません");
         form.button("閉じる");
         await form.show(player);
         inviteorinterview(player,companyData)
         return;
        }
        let playerIds = []
        for(const p of players)
        {
            playerIds.push(p.id)
            form.button(p.name)
        }
            const res = await form.show(player);  
            if(res.canceled) 
                {
                    inviteorinterview(player,companyData)
                    return;
                }
            const invitedPlayer = players[res.selection]
            //招待メッセージ確認なし
            invite(invitedPlayer.id,companyData)
            player.sendMessage(`§a${invitedPlayer.name}§r§eに招待メッセージを送りました。`)
            inviteorinterview(player,companyData)

    
}
async function interviewForm(player,companyData)
{

        const form = new ActionFormData();
        form.title("面接");
        const players = getAllPlayers().filter(p => !companyData.members.includes(p.id) && companyData.hope_jcp.includes(p.id))
        if(players.length === 0)
        {
         const form = new ActionFormData();
         form.title("エラー");
         form.body("面接できるプレイヤーがいません");
         form.button("閉じる");
         await form.show(player);
         inviteorinterview(player,companyData)
         return;
        }
        let playerIds = []
        for(const p of players)
        {
            playerIds.push(p.id)
            form.button(p.name)
        }
            const res = await form.show(player);  
            if(res.canceled) 
                {
                    inviteorinterview(player,companyData)
                    return;
                }
            const interviewedPlayer = players[res.selection]
            const newform = new MessageFormData();
            newform.title("確認");
            newform.body(`本当に面接を許可してよろしいですか？(${interviewedPlayer.name})`);
            newform.button1("やめる");
            newform.button2("面接を許可する");
            const resp = await newform.show(player);
            if(resp.selection !== 1)
            {
                inviteorinterview(player,companyData)
                return;
            }
            companyData.hope_jcp = companyData.hope_jcp.filter(id => id !== interviewedPlayer.id);
            companyData.members.push(interviewedPlayer.id);            
            StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
            const code = `world.getEntity('${interviewedPlayer.id}').sendMessage('§e${companyData.name}§r§aに入社しました。');`
            sendDataForPlayers(code,interviewedPlayer.id)
            player.sendMessage(`§a${interviewedPlayer.name}§r§eに面接希望許可しました。`)
            inviteorinterview(player,companyData)

}
async function scp(player, companyData) {
    const form = new ActionFormData();
    form.title("会社設定等");

    // ボタンと処理の対応リスト
    const actions = [
        { label: "会社情報", action: () => showCompanyInfo(player, companyData) }
    ];
    if (getpermission(player, companyData, "setting")) {
        actions.push({ label: "設定", action: () => {settingcompany(player,companyData)} });
    }
    if (getpermission(player, companyData, "role")) {
        actions.push({ label: "ロール", action: () => roleForm(player, companyData) });
    }
    if (getpermission(player, companyData, "invite")) {
        actions.push({ label: "招待/面接", action: () => inviteorinterview(player, companyData) });
    }
    if (getpermission(player, companyData, "playersetting")) {
        actions.push({ label: "社員設定", action: () => setPlayersRole(player, companyData) });
    }
    if (getpermission(player, companyData, "money")) {
        actions.push({ label: "資本金", action: () =>   moneysetting(player,companyData) });
    }
    if (getpermission(player, companyData, "acquisition")) {
        actions.push({ label: "買収", action: () => {/* 買収処理 */} });
    }
    if (getpermission(player, companyData, "delete")) {
        actions.push({
            label: "解体",
            action: async () => {
                const newform = new MessageFormData();
                newform.title("確認");
                newform.body(`本当に削除してよろしいですか？(${companyData.name})`);
                newform.button1("やめる");
                newform.button2("解体する");
                const resp = await newform.show(player);
                if (resp.selection === 1) {
                    deletecompany(player, companyData);
                }
            }
        });
    }

    // ボタンを追加
    actions.forEach(a => form.button(a.label));
    const res = await form.show(player);
    if (res.canceled) return;

    // 選択されたボタンに対応する処理を実行
    const selected = actions[res.selection];
    if (selected && typeof selected.action === "function") {
        await selected.action();
    }
}
async function moneysetting(player,companyData)
{
    const form = new ActionFormData();
    form.title("資本金設定");
    form.button("資本金の確認")
    form.button("資本金の引き出し")
    form.button("資本金の預け入れ")
    const res = await form.show(player)
    if (res.canceled) return;
    if(res.selection === 0)
    {
     const form = new ActionFormData();
     form.title("資本金の確認");
     form.body(`会社の資本金は${companyData.money}円です`);
     form.button("閉じる");
     await form.show(player);
     moneysetting(player,companyData)
    }
    if(res.selection === 1)
    {
     const playerData = GetAndParsePropertyData(`player_${player.id}`);
     const form = new ModalFormData();
     form.title(`資本金の引き出し(所持金:${playerData.money})`);
     form.textField({text:`引き出す金額(現在の資本金:${companyData.money})`},{text:"1000"},{text:""});
     const res = await form.show(player)
     if (res.canceled) return;
     const money = Number(res.formValues[0])
     if(isNaN(money) || money <= 0)
     {
      const form = new ActionFormData();
      form.title("エラー");
      form.body("正しい数字を入力してください");
      form.button("閉じる");
      await form.show(player);
      moneysetting(player,companyData)
      return;
     }
     if(companyData.money < money)
     {
      const form = new ActionFormData();
      form.title("エラー");
      form.body("会社の資本金が足りません\n追加してください");
      form.button("閉じる");
      await form.show(player);
      moneysetting(player,companyData)
      return;
     }
     companyData.money -= money;
     StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
     playerData.money = (playerData.money ?? 0) + money;
     StringifyAndSavePropertyData(`player_${player.id}`, playerData);
     player.sendMessage(`§a${money}円§r§eを引き出しました。`);
     moneysetting(player,companyData)
    }
    if(res.selection === 2)
    {
     const playerData = GetAndParsePropertyData(`player_${player.id}`);
     const form = new ModalFormData();
     form.title(`資本金の預け入れ(所持金:${playerData.money})`);
     form.textField({text:`預ける金額(現在の資本金:${companyData.money})`},{text:"1000"},{text:""});
     const res = await form.show(player)
     if (res.canceled) return;
     const money = Number(res.formValues[0])
     if(isNaN(money) || money <= 0)
     {
      const form = new ActionFormData();
      form.title("エラー");
      form.body("正しい数字を入力してください");
      form.button("閉じる");
      await form.show(player);
      moneysetting(player,companyData)
      return;
     }
     if((playerData.money ?? 0) < money)
     {
      const form = new ActionFormData();
      form.title("エラー");
      form.body("所持金が足りません");
      form.button("閉じる");
      await form.show(player);
      moneysetting(player,companyData)
      return;
     }
     companyData.money += money;
     StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
     playerData.money -= money;
     StringifyAndSavePropertyData(`player_${player.id}`, playerData);
     player.sendMessage(`§e${money}円§r§eを預けました。`);
     moneysetting(player,companyData)
    }
}
async function settingcompany(player,companyData)
{
    const form = new ActionFormData();
    form.title("会社設定");
    form.button("会社情報の編集")
    if(companyData.companyKind === 0)//建設
    {
     form.button("建設会社の詳細設定")   
    }
    if(companyData.companyKind === 1)//金融
    {
     form.button("金融会社の詳細設定")   
    }
    if(companyData.companyKind === 2)//商業
    {
     form.button("商業会社の詳細設定")   
    }
    const res = await form.show(player)
    if (res.canceled) return;
    if(res.selection === 0)
    {
     detailsettingcompany(player,companyData)   
    }
    if(res.selection === 1)
    {
     detailcompanyKind(player,companyData,companyData.companyKind)   
    }
}
async function detailcompanyKind(player,companyData,kind)
{
    if(kind === 0)//建設
    {
     const form = new ModalFormData();
     form.title("建設会社の詳細設定");
     form.textField({text:""},{text:""},{text:""});
     form.textField({text:"建設会社の詳細設定2"},{text:""},{text:""});
     const res = await form.show(player)
     if (res.canceled) return;
     //companyData.??? = res.formValues[0]
     //companyData.??? = res.formValues[1]
    }
    if(kind === 1)//金融
    {
     const form = new ModalFormData();
     form.title("金融会社の詳細設定(書き込むと変更)");
     form.textField({text:`金利(${companyData.financesetting.minterest*100}％)`},{text:"半角英数字"});
     form.textField({text:`引き出すときの手数料(${companyData.financesetting.withdrawfee*100}％)`},{text:"半角英数字"});
     form.textField({text:`最大貸出可能額(${companyData.financesetting.maxlendable})`},{text:"半角英数字"});
     form.textField({text:`借金の利息(${companyData.financesetting.debtinterest*100}％)`},{text:"半角英数字"});
     form.textField({text:`借金の利息の発生時間(何時間ごと)(${companyData.financesetting.debtinteresttime}時間)`},{text:"半角英数字"});
     form.textField({text:`借金の最大返済設定時間(${companyData.financesetting.maxdebtrepaymenttime}時間)`},{text:"半角英数字/h"});

     const res = await form.show(player)
     if (res.canceled) return;
        // 金融会社の詳細設定（未入力なら変更なし）
companyData.financesetting.minterest = (res.formValues[0] !== undefined && res.formValues[0] !== "") ? parseFloat(res.formValues[0]*0.01) : companyData.financesetting.minterest; //金利
companyData.financesetting.withdrawfee = (res.formValues[1] !== undefined && res.formValues[1] !== "") ? parseFloat(res.formValues[1]*0.01) : companyData.financesetting.withdrawfee; //引き出すときの手数料
companyData.financesetting.maxlendable = (res.formValues[2] !== undefined && res.formValues[2] !== "") ? parseInt(res.formValues[2]) : companyData.financesetting.maxlendable; //最大貸出可能額
companyData.financesetting.debtinterest = (res.formValues[3] !== undefined && res.formValues[3] !== "") ? parseFloat(res.formValues[3]*0.01) : companyData.financesetting.debtinterest; //借金の利息(%)
companyData.financesetting.debtinteresttime = (res.formValues[4] !== undefined && res.formValues[4] !== "") ? parseInt(res.formValues[4]) : companyData.financesetting.debtinteresttime; //借金の利息の発生時間(何時間ごと)
companyData.financesetting.maxdebtrepaymenttime = (res.formValues[5] !== undefined && res.formValues[5] !== "") ? parseInt(res.formValues[5]) : companyData.financesetting.maxdebtrepaymenttime; //借金の最大返済設定時間(h)

    }
    if(kind === 2)//商業
    {
     const form = new ModalFormData();
     form.title("商業会社の詳細設定");
     form.textField({text:"商業会社の詳細設定1"},{text:""},{text:""});
     form.textField({text:"商業会社の詳細設定2"},{text:""},{text:""});
     const res = await form.show(player)
     if (res.canceled) return;
     //companyData.??? = res.formValues[0]
     //companyData.??? = res.formValues[1]
    }
    StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
     player.sendMessage("会社情報を更新しました")
}
async function detailsettingcompany(player,companyData)
{
    const form = new ModalFormData();
    form.title("会社設定");
    form.textField({text:"会社名(書き込むと変更)"},{text:companyData.name},{text:""});
    form.textField({text:"会社の説明(書き込むと変更)"},{text:companyData.lore},{text:""});
    form.dropdown({text:"会社の種類"},companyKind,{defaultValueIndex:companyData.companyKind});
    const res = await form.show(player)
    if (res.canceled) return;
    companyData.name = res.formValues[0] ? res.formValues[0] :companyData.name//名前
    companyData.lore = res.formValues[1] ? res.formValues[1] :companyData.lore//名前
    companyData.companyKind = res.formValues[2]//会社の種類
    StringifyAndSavePropertyData(`company_${companyData.id}`, companyData);
    player.sendMessage("会社情報を更新しました")
}
export async function mailForm(player)
{
  const form = new ModalFormData();
  form.title("メール");
  let playersname = []
    let players = []
  for(const sender of getAllPlayers().filter(p => p.id !== player.id))
  {
   playersname.push(GetAndParsePropertyData(`player_${sender.id}`).name)
    players.push(GetAndParsePropertyData(`player_${sender.id}`))
  }
  form.dropdown({text:"送る対象"},playersname,{defaultValueIndex:0});
  form.textField({text:"メール"},{text:"丸石1stとってきて"},{text:""});
  const res = await form.show(player);
  if (res.canceled) return;
  const mail = res.formValues[1]//メール
  const code = `world.getEntity('${players[res.formValues[0]].id}').sendMessage('${player.name}からのメッセージ: §l${mail}');`
  sendDataForPlayers(code,players[res.formValues[0]].id)
}
