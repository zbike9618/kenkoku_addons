import { system, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import config from "../config";
import { KayKayApp } from "./app/bank";
import { KarcariApp } from "./app/karcari";
import { MapApp } from "./app/map";
import { KarozonApp } from "./app/karozon";
import { CountryApp } from "./app/country";
import { TeleportApp } from "./app/teleport";

let smartphoneId = "mc:smartphone";

world.afterEvents.itemUse.subscribe((ev) => {
    if (ev.itemStack.typeId != smartphoneId) return;
    const player = ev.source;
    SmartPhoneHomeScreen(player);
})

export function SmartPhoneHomeScreen(player) {
    const time = new Date();
    const form = new ActionFormData();
    form.title('§s§m§a§r§t§p§h§o§n§e');
    let m = time.getMinutes();
    form.body(`${time.getUTCHours() + config.timeDifference}:${m < 10 ? `0${m}` : m}`)
    form.button("KayKay");
    form.button("Karcari");
    form.button("Map");
    form.button("Karozon");
    form.button("Country");
    form.button("Teleport");
    form.show(player).then((rs) => {
        if (rs.canceled) {
            if (rs.cancelationReason == FormCancelationReason.UserBusy) {
                system.runTimeout(() => {
                    SmartPhoneHomeScreen(player);
                }, 10)
            }
        }
        switch (rs.selection) {
            case 0: {
                KayKayApp(player);
                break;
            }
            case 1: {
                KarcariApp(player);
                break;
            }
            case 2: {
                MapApp(player);
                break;
            }
            case 3: {
                KarozonApp(player);
                break;
            }
            case 4: {
                CountryApp(player);
                break;
            }
            case 5: {
                TeleportApp(player);
                break;
            }
        }
    })
}