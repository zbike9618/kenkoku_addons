import { CommandPermissionLevel, Player, system, world } from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:localchat',
            description: 'ローカルチャット(近くの人にしか見えないチャット)に切り替えます',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                sender.setDynamicProperty(`chatType`, `local`);
                sender.sendMessage({ rawtext: [{ translate: `chattype.changed`, with: { rawtext: [{ translate: `local.chat` }] } }] })
            })
        })
    )
});

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:lc',
            description: 'ローカルチャット(近くの人にしか見えないチャット)に切り替えます',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                sender.setDynamicProperty(`chatType`, `local`);
                sender.sendMessage({ rawtext: [{ translate: `chattype.changed`, with: { rawtext: [{ translate: `local.chat` }] } }] })
            })
        })
    )
});