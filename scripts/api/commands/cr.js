import { CommandPermissionLevel, Player, system, world } from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:cr',
            description: 'アイテムにコピーライト(自分の名前とID)を付けます',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                const container = sender.getComponent(`inventory`).container;
                const item = container.getItem(sender.selectedSlotIndex);
                if (item) {
                    if (item.typeId == "mc:penname_after" || item.typeId == "mc:penname_before") {
                        return;
                    };
                    const loreArray = item.getLore();
                    if (loreArray.includes(`§c§r§d${sender.name}(${sender.id})`)) {
                        item.setLore(loreArray.filter(lore => lore != `§c§r§d${sender.name}(${sender.id})`));
                        container.setItem(sender.selectedSlotIndex, item);
                        return;
                    };
                    if (loreArray.find(lore => lore.includes(`§c§r§d`))) {
                        //item.setLore(loreArray.filter(lore => !lore.includes(`§c§r§d`)));
                        //container.setItem(sender.selectedSlotIndex, item);
                        return;
                    };
                    loreArray.unshift(`§c§r§d${sender.name}(${sender.id})`);
                    item.setLore(loreArray);
                    container.setItem(sender.selectedSlotIndex, item);
                };
            })
        })
    )
});

system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerCommand(
        {
            name: 'makecountry:ic',
            description: 'アイテムにコピーライト(自分の名前とID)を付けます',
            permissionLevel: CommandPermissionLevel.Any
        },
        ((origin, ...args) => {
            system.runTimeout(() => {
                if (!origin?.sourceEntity || !(origin?.sourceEntity instanceof Player)) return;
                const sender = origin.sourceEntity;

                const container = sender.getComponent(`inventory`).container;
                const item = container.getItem(sender.selectedSlotIndex);
                if (item) {
                    if (item.typeId == "mc:penname_after" || item.typeId == "mc:penname_before") {
                        return;
                    };
                    const loreArray = item.getLore();
                    if (loreArray.includes(`§c§r§d${sender.name}(${sender.id})`)) {
                        item.setLore(loreArray.filter(lore => lore != `§c§r§d${sender.name}(${sender.id})`));
                        container.setItem(sender.selectedSlotIndex, item);
                        return;
                    };
                    if (loreArray.find(lore => lore.includes(`§c§r§d`))) {
                        //item.setLore(loreArray.filter(lore => !lore.includes(`§c§r§d`)));
                        //container.setItem(sender.selectedSlotIndex, item);
                        return;
                    };
                    loreArray.unshift(`§c§r§d${sender.name}(${sender.id})`);
                    item.setLore(loreArray);
                    container.setItem(sender.selectedSlotIndex, item);
                };
            })
        })
    )
});