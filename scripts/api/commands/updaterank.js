import { CommandPermissionLevel, CustomCommandParamType, Player, system, world } from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:updaterank',
            description: 'ランキングを更新します',
            permissionLevel: CommandPermissionLevel.Admin,
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                if (!sender.hasTag("mc_admin")) {
                    sender.sendMessage({ translate: `command.permission.error` });
                    return;
                };

                sender.runCommand(`scriptevent karo:updaterank`)

            })
        })
    )
});