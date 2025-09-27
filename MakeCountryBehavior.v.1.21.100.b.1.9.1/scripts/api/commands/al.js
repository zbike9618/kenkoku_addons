import { CommandPermissionLevel, Player, system } from "@minecraft/server";
import { countryList } from "../../lib/form";
import { DynamicProperties } from "../dyp";

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:alliancelist',
            description: '同盟リストを開きます',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                const playerDataBase = new DynamicProperties('player');
                const rawData = playerDataBase.get(`player_${sender.id}`);
                const playerData = JSON.parse(rawData);

                if (!playerData?.country) {
                    sender.sendMessage({ translate: 'cannnot.use.nojoin.country' });
                    return;
                };
                countryList(sender, true);
            })
        })
    )
});

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:al',
            description: '同盟リストを開きます',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                const playerDataBase = new DynamicProperties('player');
                const rawData = playerDataBase.get(`player_${sender.id}`);
                const playerData = JSON.parse(rawData);

                if (!playerData?.country) {
                    sender.sendMessage({ translate: 'cannnot.use.nojoin.country' });
                    return;
                };
                countryList(sender, true);
            })
        })
    )
});