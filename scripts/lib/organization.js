import { world } from "@minecraft/server";
import { ModalForm} from "./form_class";
const ModalFormData = ModalForm;
import { GetAndParsePropertyData } from "./util";

export function createOrganizationForm(player) {
    const form = new ModalFormData();
    form.title({ translate: `form.title.createorganization` });
    form.textField({ translate: `form.input.label.organization.name` }, { translate: `form.input.organization.name` });
    form.submitButton({ translate: `form.submit.createorganization` });
    form.show(player).then(rs => {
        if (rs.canceled) {
            if (rs.cancelationReason == "UserBusy") {
                createOrganizationForm(player);
            };
            return;
        };
    });
};

/**
 * 
 * @param {Player} player 
 * @param {string} organizationName 
 */
export function createorganization(player, organizationName) {
    const rawOrganizationId = world.getDynamicProperty(`organizationId`) || "1";
    const playerData = GetAndParsePropertyData(`player_${player.id}`);
    const organizationId = Number(rawOrganizationId);
    const organizationData = {
        name: organizationName,
        id: organizationId,
        owner: playerData?.country,
        signatory: [playerData?.country],
        money: 0,
    };
    StringifyAndSavePropertyData(`organization_${organizationId}`, organizationData);
    world.setDynamicProperty(`organizationId`, `${organizationId + 1}`);
    player.sendMessage({ rawtext: [{ text: `§a[MakeCountry]\n§f` }, { translate: `complete.create.organization` }] });
};