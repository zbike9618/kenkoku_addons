import { world} from "@minecraft/server";


world.beforeEvents.itemUse.subscribe(ev => {
    const item = ev.itemStack.typeId
    const player = ev.source
    if (item.startsWith("money:bill_")){//札
        const number = item.replace("money:bill_","")
        player.runCommandAsync(`scriptevent mc:add ${number}`);
        player.runCommandAsync(`clear @s money:bill_${number} 0 1`);
        player.sendMessage(`${number}円入金しました`);
    }
    if (item.startsWith("money:coin_")){//硬貨
        const number = item.replace("money:coin_","")
        player.runCommandAsync(`scriptevent mc:add ${number}`);
        player.runCommandAsync(`clear @s ${item} 0 1`);
        player.sendMessage(`${number}円入金しました`);
    }
})
