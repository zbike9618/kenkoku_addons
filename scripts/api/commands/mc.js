import { CommandPermissionLevel, Player, system, world } from "@minecraft/server";
import { DynamicProperties } from "../dyp";
import { MakeCountryForm } from "../../lib/form";

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:makecountry',
            description: '国を作成します',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
            const sender = origin.sourceEntity;
            const playerDataBase = new DynamicProperties('player');
            const rawData = playerDataBase.get(`player_${sender.id}`);
            const playerData = JSON.parse(rawData);

            if (playerData?.country) {
                sender.sendMessage({ translate: `command.makecountry.error.belong.country` });
                return;
            };
            MakeCountryForm(sender);
            return;
        })
    )
});

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:mc',
            description: '国を作成します',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;
                const playerDataBase = new DynamicProperties('player');
                const rawData = playerDataBase.get(`player_${sender.id}`);
                const playerData = JSON.parse(rawData);

                if (playerData?.country) {
                    sender.sendMessage({ translate: `command.makecountry.error.belong.country` });
                    return;
                };
                MakeCountryForm(sender);
                return;
            })
        })
    )
});