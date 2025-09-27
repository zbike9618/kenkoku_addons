import { Player, system, world } from "@minecraft/server";
import { ActionForm } from "../form_class";
import { SmartPhoneHomeScreen } from "../smartphone";
import { CheckPermissionFromLocation, GetAndParsePropertyData } from "../util";
import { DynamicProperties } from "../../api/dyp";
import { FormCancelationReason } from "@minecraft/server-ui";
const ActionFormData = ActionForm;

/**
 * @type {DynamicProperties}
 */
let countryDataBase;

world.afterEvents.worldLoad.subscribe(() => {
    countryDataBase = new DynamicProperties("country")
})

/**
 * @param {Player} player 
 */
export function CountryApp(player, al = false) {
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
                        CountryApp(player, al);
                        return;
                    }, 10);
                    return;
                };
                SmartPhoneHomeScreen(player);
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
function showCountryInfo(player, countryData, al = false) {
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
                CountryApp(player);
                return;
            };
            switch (rs.selection) {
                case 0: {
                    //閉じる
                    break;
                };
                case 1: {
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
