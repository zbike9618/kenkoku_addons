
import { world ,system} from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { GetAndParsePropertyData,StringifyAndSavePropertyData } from "../../lib/util"
import { DynamicProperties } from "../../api/dyp";

export async function companymenu(player)
{
  const form = new ModalFormData();
  form.title("Config");
  form.textField("会社名","ゼットデビルス銀行","");
  form.textField("会社の説明","アットホームな会社です。","");
  const res = await form.show(player);
  if (res.canceled) return;
  const name = res.formValues[0]//名前
    const idString = world.getDynamicProperty(`companyId`) ?? "1"
    let id = Number(idString);
    world.setDynamicProperty(`companyId`, `${id + 1}`);
  const companyData = 
  {
   name,//会社名
   id,//会社のID
   lore: formValues[1],
   owner: player.id,
   members: [owner.id],
   salary:{},//給料
   salaryminute:60,//分給
   money:0,

  }
  StringifyAndSavePropertyData(`company_${id}`,companyData)
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
            showCompanyInfo(player, countries[res.selection]);
    }
     catch (error) {
        console.warn(error);
    };
};

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
        const owner = countryData.owner

        show.push(`\n社長: ${GetAndParsePropertyData(`player_${owner}`).name}`)
        let member = []
        for(const p of countryData.members)
        {
            member.push(GetAndParsePropertyData(`player_${p}`).name)
        }
        show.push(`\n社員:${member}`)
        let showBody = show[0];
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
