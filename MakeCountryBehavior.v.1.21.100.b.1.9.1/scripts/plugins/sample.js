import { world } from "@minecraft/server";

world.afterEvents.playerSpawn.subscribe((ev) => {
    if (ev.initialSpawn) {
        ev.player.sendMessage('§l§aサンプルプラグイン導入中\nscripts/plugins_config.jsでimportをコメントアウトすることで無効化できます');
    };
});