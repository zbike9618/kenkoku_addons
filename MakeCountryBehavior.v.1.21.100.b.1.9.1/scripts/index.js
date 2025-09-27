import { system, world } from "@minecraft/server";

import "./lib/commands";

import "./lib/events";

import "./lib/interval";

import "./lib/jobs";

import "./lib/scripteventCommand";

import "./lib/combattag";

import "./lib/test";

import "./lib/item";

import "./lib/custom_component";

import "./lib/war";

import "./lib/penname";

import "./lib/chest_shop";

import "./lib/ranking";

import "./lib/fixdata";

import "./lib/datamove";

import "./api/command";

import "./lib/smartphone";

import "./plugin_config";

const version = "ver.1.21.100 β.1.9.0"

world.afterEvents.worldLoad.subscribe(() => {
    world.sendMessage({ translate: `world.message.addon`, with: [version] });
});

world.afterEvents.playerSpawn.subscribe((ev) => {
    const { player, initialSpawn } = ev;
    if (!initialSpawn) return;
    player.sendMessage({
        rawtext: [
            { text: `§6------------------------------------------------------------------------------------------\n\n` },
            { translate: `world.message.addon`, with: [version] },
            { text: `\n\n§9Support Discord Server\n§ahttps://discord.gg/8S9YhNaHjD\n\n§cYoutube\n§ahttps://youtube.com/@KaronDAAA\n\n§bTwitter\n§ahttps://twitter.com/KaronDAAA\n\n§6------------------------------------------------------------------------------------------\n` }
        ]
    });
});

system.beforeEvents.watchdogTerminate.subscribe((ev) => {
    ev.cancel = true;
})