import { CommandPermissionLevel, Player, system, world } from "@minecraft/server";
import { GetAndParsePropertyData, GetPlayerChunkPropertyId } from "../../lib/util";

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:checkchunk',
            description: '現在のチャンクの状態を確認します',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                const chunkData = GetAndParsePropertyData(GetPlayerChunkPropertyId(sender));
                if (!chunkData || (!chunkData.special && !chunkData.countryId)) {
                    sender.sendMessage({ translate: `command.checkchunk.result.wilderness`, with: { rawtext: [{ translate: `wilderness.name` }] } });
                    return;
                } else if (chunkData.special) {
                    sender.sendMessage({ translate: `command.checkchunk.result.special`, with: { rawtext: [{ translate: `special.name` }] } });
                    return;
                } else {
                    if (chunkData.owner) {
                        sender.sendMessage({ translate: `command.checkchunk.result.ownerland`, with: [`${chunkCountryData.owner}`] });
                        return;
                    };
                    const chunkCountryData = GetAndParsePropertyData(`country_${chunkData.countryId}`)
                    sender.sendMessage({ translate: `command.checkchunk.result.territory`, with: [`${chunkCountryData.name}`] });
                    return;
                };
            })
        })
    )
});

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:cc',
            description: '現在のチャンクの状態を確認します',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                const chunkData = GetAndParsePropertyData(GetPlayerChunkPropertyId(sender));
                if (!chunkData || (!chunkData.special && !chunkData.countryId)) {
                    sender.sendMessage({ translate: `command.checkchunk.result.wilderness`, with: { rawtext: [{ translate: `wilderness.name` }] } });
                    return;
                } else if (chunkData.special) {
                    sender.sendMessage({ translate: `command.checkchunk.result.special`, with: { rawtext: [{ translate: `special.name` }] } });
                    return;
                } else {
                    if (chunkData.owner) {
                        sender.sendMessage({ translate: `command.checkchunk.result.ownerland`, with: [`${chunkCountryData.owner}`] });
                        return;
                    };
                    const chunkCountryData = GetAndParsePropertyData(`country_${chunkData.countryId}`)
                    sender.sendMessage({ translate: `command.checkchunk.result.territory`, with: [`${chunkCountryData.name}`] });
                    return;
                };
            })
        })
    )
});