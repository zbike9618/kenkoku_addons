import * as server from '@minecraft/server' 


server.world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId == "money:bill_1000"){
        ev.source.runCommandAsync("scriptevent mc:add 1000");
        ev.source.runCommandAsync("clear @s money:bill_1000 0 1");
        ev.source.runCommandAsync('tellraw @s {"rawtext":[{"text":"1000円入金しました"}]}');
    }
})

server.world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId == "money:bill_5000"){
        ev.source.runCommandAsync("scriptevent mc:add 5000");
        ev.source.runCommandAsync("clear @s money:bill_5000 0 1");
        ev.source.runCommandAsync('tellraw @s {"rawtext":[{"text":"5000円入金しました"}]}');
    }
})

server.world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId == "money:bill_10000"){
        ev.source.runCommandAsync("scriptevent mc:add 10000");
        ev.source.runCommandAsync("clear @s money:bill_10000 0 1");
        ev.source.runCommandAsync('tellraw @s {"rawtext":[{"text":"10000円入金しました"}]}');
    }
})

server.world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId == "money:coin_1"){
        ev.source.runCommandAsync("scriptevent mc:add 1");
        ev.source.runCommandAsync("clear @s money:coin_1 0 1");
        ev.source.runCommandAsync('tellraw @s {"rawtext":[{"text":"1円入金しました"}]}');
    }
})

server.world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId == "money:coin_10"){
        ev.source.runCommandAsync("scriptevent mc:add 10");
        ev.source.runCommandAsync("clear @s money:coin_10 0 1");
        ev.source.runCommandAsync('tellraw @s {"rawtext":[{"text":"10円入金しました"}]}');
    }
})

server.world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId == "money:coin_50"){
        ev.source.runCommandAsync("scriptevent mc:add 50");
        ev.source.runCommandAsync("clear @s money:coin_50 0 1");
        ev.source.runCommandAsync('tellraw @s {"rawtext":[{"text":"50円入金しました"}]}');
    }
})

server.world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId == "money:coin_100"){
        ev.source.runCommandAsync("scriptevent mc:add 100");
        ev.source.runCommandAsync("clear @s money:coin_100 0 1");
        ev.source.runCommandAsync('tellraw @s {"rawtext":[{"text":"100円入金しました"}]}');
    }
})

server.world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId == "money:coin_500"){
        ev.source.runCommandAsync("scriptevent mc:add 500");
        ev.source.runCommandAsync("clear @s money:coin_500 0 1");
        ev.source.runCommandAsync('tellraw @s {"rawtext":[{"text":"500円入金しました"}]}');
    }
})