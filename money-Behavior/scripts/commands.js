import { world} from "@minecraft/server";

server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name:"mc:lobby",
        description:"ロビーへ帰還する",
        permissionLevel : server.CommandPermissionLevel.Any,
        mandatoryParameters:[
        ],
        optionalParameters:[
        ]
    },(origin, arg) => {
        server.system.runTimeout(() => {
            origin.sourceEntity.runCommand("tp 7 63 7")
        },1)
    })
})