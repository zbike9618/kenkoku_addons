import { CommandPermissionLevel, CustomCommandParamType, Player, system, world } from "@minecraft/server";
import config from "../../config";

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:fixcamera',
            description: '視点を固定します',
            permissionLevel: CommandPermissionLevel.Any,
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;
                
                if (!config.cameraValidity) {
                    sender.sendMessage({ translate: `command.error.camera.novalidity` });
                    return;
                };
                if (sender.hasTag(`mc_notp`)) {
                    return;
                };
                const isCamera = sender.hasTag(`mc_camera`);
                if (isCamera) {
                    sender.camera.clear();
                    sender.removeTag(`mc_camera`);
                    return;
                };
                if (!isCamera) {
                    sender.addTag(`mc_camera`);
                    sender.camera.setCamera(`minecraft:free`, { location: sender.getHeadLocation(), rotation: sender.getRotation() });
                    return;
                };

            })
        })
    )
});