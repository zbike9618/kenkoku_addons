import { CommandPermissionLevel, CustomCommandParamType, Player, system, world } from "@minecraft/server";
import config from "../../config";
import { AcceptTeleportRequest, teleportRequest, tpaMainForm } from "../../lib/tpa";

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:tpa',
            description: 'テレポートリクエストを送ります',
            permissionLevel: CommandPermissionLevel.Any,
            optionalParameters: [{ name: "player", type: CustomCommandParamType.PlayerSelector }]
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                if (!config.tpaValidity) {
                    sender.sendMessage({ translate: `command.error.tpa.novalidity` });
                    return;
                };
                if (sender.hasTag(`mc_notp`)) {
                    return;
                };
                if (config.combatTagNoTeleportValidity) {
                    if (sender.hasTag(`mc_combat`)) {
                        sender.sendMessage({ translate: `teleport.error.combattag` });
                        return;
                    };
                };
                if (config.invaderNoTeleportValidity) {
                    if (sender.getTags().find(tag => tag.startsWith(`war`))) {
                        sender.sendMessage({ translate: `teleport.error.invader` });
                        return;
                    };
                };
                if (args.length != 0) {
                    if (args[0].length == 0) return;
                    teleportRequest(sender, args[0][0].name);
                    return;
                };
                tpaMainForm(sender);
            })
        })
    )
});

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:tpaccept',
            description: '直近のテレポートリクエストを承認',
            permissionLevel: CommandPermissionLevel.Any,
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                if (!config.tpaValidity) {
                    sender.sendMessage({ translate: `command.error.tpa.novalidity` });
                    return;
                };

                AcceptTeleportRequest(sender);
            })
        })
    )
});