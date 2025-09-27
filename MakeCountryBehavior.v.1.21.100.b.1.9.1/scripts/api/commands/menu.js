import { CommandPermissionLevel, Player, system, world } from "@minecraft/server";
import { playerMainMenu } from "../../lib/form";

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:menu',
            description: 'メニューを開きます',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;
    
                playerMainMenu(sender);    
            })
        })
    )
});