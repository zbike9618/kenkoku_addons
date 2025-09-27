import { Player, PlayerPermissionLevel, system, world } from "@minecraft/server";
import * as DyProp from "./DyProp";
import { DynamicProperties } from "../api/dyp";
import { CheckPermission, CheckPermissionFromLocation, GetAndParsePropertyData, GetPlayerChunkPropertyId, isNumber, StringifyAndSavePropertyData } from "./util";
import { GenerateChunkData, playerCountryLeave } from "./land";
import { MakeCountryForm, countryList, joinTypeSelectForm, playerMainMenu, settingCountry } from "./form";
import { jobsForm } from "./jobs";
import jobs_config from "../jobs_config";
import config from "../config";
import { PlayerMarketMainMenu } from "./player_market";
import { teleportRequest, tpaMainForm } from "./tpa";
import { ShopCommonsMenu } from "./shop";
import { Invade } from "./war";
import { plotMainForm } from "./plot_from";
import { country, playerHandler } from "../api/api";
import { HomeManager } from "../api/home";

class ChatHandler {
    constructor(event, isScript) {
        this.event = event;
        /**
         * @type {string}
         */
        this.message = isScript ? event.id + ' ' + event.message : event.message;
        /**
         * @type {Player}
         */
        this.sender = event.sender;
        /**
         * @type {string}
         */
        this.prefix = config.prefix;
        const playerDataBase = new DynamicProperties("player");
        const countryDataBase = new DynamicProperties("country");
        this.playerData = GetAndParsePropertyData(`player_${this.sender.id}`, playerDataBase);
        this.playerCountryData = GetAndParsePropertyData(`country_${this.playerData.country}`, countryDataBase);
        this.script = isScript;
    }

    isCommand() {
        return this.message.startsWith(this.prefix);
    }

    handleChat() {
        const chatType = this.sender.getDynamicProperty(`chatType`) || `general`;
        let landId = this.playerData?.country;
        let land = `chat.player.no.join.any.country`;
        let penname = ``;
        if (config.pennameEnable) {
            let penNameBefore = this.sender.getDynamicProperty(`pennameBefore`) ?? config.initialPennameBefore;
            let penNameAfter = this.sender.getDynamicProperty(`pennameAfter`) ?? config.initialPennameAfter;
            penname = `§r|${penNameBefore}§r${penNameAfter}`;
        };
        if (landId) land = this.playerCountryData?.name;
        /*if (!/^[a-z]$/.test(this.message.charAt(0))) {
            this.event.cancel = true;
            world.sendMessage([{ text: `<§${this.playerCountryData?.color ?? `a`}` }, { translate: land }, { text: ` §r| ${this.sender.name}> ${this.message}` }]);
        };*/
        this.event.cancel = true;
        const eventData = {
            player: this.sender,
            message: this.message,
            type: chatType,
            cancel: false
        };
        const isCanceled = playerHandler.beforeEvents.chat.emit(eventData);
        if (isCanceled) return;
        eventData.cancel = undefined;
        playerHandler.afterEvents.chat.emit(eventData);
        const playerDataBase = new DynamicProperties("player");
        switch (chatType) {
            case `general`: {
                world.sendMessage([{ text: `[§${this.playerCountryData?.color ?? `a`}` }, { translate: land }, { text: `${penname}§r] §7${this.sender.name}§f: ${this.message}` }]);
                break;
            };
            case `country`: {
                if (!land || land.country < 1) {
                    this.sender.sendMessage({ rawtext: [{ rawtext: `cannnot.use.nojoin.country` }] });
                    return;
                };
                const players = world.getPlayers();
                for (const player of players) {
                    const pData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
                    if (pData?.country == this.playerData?.country) {
                        player.sendMessage([{ text: `[§aCC§r] §7${this.sender.name}§f: §a${this.message}` }]);
                    };
                };
                break;
            };
            case `alliance`: {
                if (!land || land.country < 1) {
                    this.sender.sendMessage({ rawtext: [{ rawtext: `cannnot.use.nojoin.country` }] })
                    return;
                };
                const players = world.getPlayers();
                for (const player of players) {
                    const pData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
                    const alliance = this.playerCountryData.alliance ?? [];
                    if (alliance.includes(pData?.country ?? 0) || pData?.country == this.playerData.country) {
                        player.sendMessage([{ text: `[§2AC§r] §7${this.sender.name}§f: §a${this.message}` }]);
                    };
                };
                break;
            };
            case `friendly`: {
                if (!land || land.country < 1) {
                    this.sender.sendMessage({ rawtext: [{ rawtext: `cannnot.use.nojoin.country` }] })
                    return;
                };
                const players = world.getPlayers();
                for (const player of players) {
                    const pData = GetAndParsePropertyData(`player_${player.id}`, playerDataBase);
                    const friendly = this.playerCountryData.friendly ?? [];
                    if (friendly.includes(pData?.country ?? 0) || pData?.country == this.playerData.country) {
                        player.sendMessage([{ text: `[§6FC§r] §7${this.sender.name}§f: §a${this.message}` }]);
                    };
                };
                break;
            };
            case `local`: {
                const players = this.sender.dimension.getPlayers({ location: this.sender.location, maxDistance: 100 });
                for (const player of players) {
                    player.sendMessage([{ text: `[§sLC§r] §7${this.sender.name}§f: ${this.message}` }]);
                };
                break;
            };
        };
    };

    handleCommand() {
        let commandName = '';
        let args;
        if (this.script) {
            args = this.message.split(/ +/).slice(1);
            commandName = this.message.replace(`mc_cmd:`, ``).split(' ')[0];
        } else {
            this.event.cancel = true;
            const [commandNameCmd, ...argsCmd] = this.message.slice(this.prefix.length).trim().split(/ +/);
            commandName = commandNameCmd;
            args = argsCmd;
        }
        const eventData = {
            player: this.sender,
            args: args ?? [],
            commandName,
            cancel: false
        };
        const isCanceled = playerHandler.beforeEvents.command.emit(eventData);
        if (isCanceled) return;
        eventData.cancel = undefined;
        playerHandler.afterEvents.command.emit(eventData);
        system.runTimeout(() => {
            switch (commandName) {
                case "money":
                    this.Money();
                    break;
                case "setup":
                    this.setup();
                    break;
                case "msend":
                    this.sendMoney(args);
                    break;
                case "checkchunk":
                    this.checkChunk();
                    break;
                case "cc":
                    this.checkChunk();
                    break;
                case "sethome":
                    this.setHome(args);
                    break;
                case "home":
                    this.teleportHome(args);
                    break;
                case "deletehome":
                    this.deleteHome(args);
                    break;
                case "checkhome":
                    this.homeList();
                    break;
                case "adminchunk":
                    this.setAdminChunk(args);
                    break;
                case "adminc":
                    this.setAdminChunk(args);
                    break;
                case "resetchunk":
                    this.resetChunk();
                    break;
                case "resetc":
                    this.resetChunk(args);
                    break;
                case "buychunk":
                    this.buyChunk(args);
                    break;
                case "buyc":
                    this.buyChunk(args);
                    break;
                case "sellchunk":
                    this.sellChunk(args);
                    break;
                case "sellc":
                    this.sellChunk(args);
                    break;
                case "help":
                    this.sendHelp();
                    break;
                case "makecountry":
                    this.makeCountry();
                    break;
                case "mc":
                    this.makeCountry();
                    break;
                case "settingcountry":
                    this.settingCountry();
                    break;
                case "sc":
                    this.settingCountry();
                    break;
                case "joincountry":
                    this.joinCountry();
                    break;
                case "jc":
                    this.joinCountry();
                    break;
                case "leavecountry":
                    this.leaveCountry();
                    break;
                case "kill":
                    this.kill();
                    break;
                case "selfkill":
                    this.kill();
                    break;
                case "countrylist":
                    this.CountryList();
                    break;
                case "cl":
                    this.CountryList();
                    break;
                case "al":
                    this.AllianceCountryList();
                    break;
                case "chome":
                    this.chome();
                    break;
                case "menu":
                    this.mainMenu();
                    break;
                case "jobs":
                    this.jobs();
                    break;
                case "playermarket":
                    this.playermarket();
                    break;
                case "pm":
                    this.playermarket();
                    break;
                case "tpa":
                    this.tpa(args);
                    break;
                case "shop":
                    this.shop();
                    break;
                case "camera":
                    this.camera();
                    break;
                case "map":
                    this.map();
                    break;
                case "invade":
                    this.invade();
                    break;
                case "cr":
                    this.copyright();
                    break;
                case "copyright":
                    this.copyright();
                    break;
                case "setcamera":
                    this.camera();
                    break;
                case "cchat":
                    this.countryChat();
                    break;
                case "g":
                    this.generalChat();
                    break;
                case "ac":
                    this.allianceChat();
                    break;
                case "lc":
                    this.localChat();
                    break;
                case "plot":
                    this.plot();
                    break;
                case "kingdoms": {
                    switch (this.message) {
                        case "spawn":
                            this.chome();
                            break;
                        case "home":
                            this.chome();
                            break;
                        case "create":
                            this.makeCountry();
                            break;
                        case "spawn":
                            this.chome();
                            break;
                        case "menu":
                            this.settingCountry();
                            break;
                        case "gui":
                            this.settingCountry();
                            break;
                        case "chat":
                            this.countryChat();
                            break;
                        case "leave":
                            this.leaveCountry();
                            break;
                        case "join":
                            this.joinCountry();
                            break;
                        case "claim":
                            this.buyChunk(args);
                            break;
                        case "unclaim":
                            this.sellChunk(args);
                            break;
                        case "visualize":
                            this.checkChunk();
                            break;
                        case "invade":
                            this.invade();
                            break;
                        case "map":
                            this.map();
                            break;
                        case "list":
                            this.CountryList();
                            break;
                        case "here":
                            this.checkChunk();
                            break;
                        default:
                            this.sender.sendMessage({ translate: `command.unknown.error`, with: [commandName] });
                            break;
                    };
                    break;
                };
                case 'al': {
                    this.AllianceCountryList();
                    break;
                };
                default:
                    this.sender.sendMessage({ translate: `command.unknown.error`, with: [commandName] });
                    break;
            };
        }, 0);
    };

    Money() {
        this.sender.sendMessage({ translate: `command.money.result.message`, with: [`${config.MoneyName} ${this.playerData.money}`] });
    };

    setup() {
        system.runTimeout(() => {
            if (this.sender.playerPermissionLevel != PlayerPermissionLevel.Operator) {
                this.sender.sendMessage({ translate: `command.permission.error` });
                return;
            }
            this.sender.sendMessage({ rawtext: [{ text: `§a[MakeCountry]\n` }, { translate: `system.setup.complete` }] });
            this.sender.addTag("mc_admin");
            world.setDynamicProperty(`start2`, `true`)
            return;
        }, 1);
    };

    sendMoney(args) {
        if (args.length < 2 || isNaN(args[0]) || !args[1]) {
            this.sender.sendMessage({ translate: `command.sendmoney.error.name`, with: [config.prefix] });
            return;
        }

        const amount = Number(args[0]);
        const targetName = args[1].replaceAll('"', '');
        /**
         * @type {Player}
         */
        const targetPlayer = world.getDimension(this.sender.dimension.id).getEntities({ type: "minecraft:player", name: targetName })[0];

        if (!targetPlayer) {
            this.sender.sendMessage({ translate: `command.error.notarget.this.dimension` });
            return;
        };
        if (targetPlayer.id == this.sender.id) {
            this.sender.sendMessage({ translate: `command.error.trysend.moremoney.yourself` })
            return;
        };
        if (amount < 1) {
            this.sender.sendMessage({ translate: `command.error.canuse.number.more`, with: [`1`] });
            return;
        };
        if (this.playerData.money < amount) {
            this.sender.sendMessage({ translate: `command.error.trysend.moremoney.youhave`, with: [`${this.playerData.money}`] });
            return;
        };
        const targetData = GetAndParsePropertyData(`player_${targetPlayer.id}`);
        targetData.money += Math.floor(amount);
        this.playerData.money -= Math.floor(amount);
        StringifyAndSavePropertyData(`player_${targetPlayer.id}`, targetData);
        StringifyAndSavePropertyData(`player_${this.sender.id}`, this.playerData);
        this.sender.sendMessage({ translate: `command.sendmoney.result.sender`, with: [targetName, `${config.MoneyName} ${Math.floor(amount)}`] });
        targetPlayer.sendMessage({ translate: `command.sendmoney.result.receiver`, with: [this.sender.name, `${config.MoneyName} ${Math.floor(amount)}`] });
    };

    checkChunk() {
        const chunkDataBase = new DynamicProperties("chunk");
        const chunkData = GetAndParsePropertyData(GetPlayerChunkPropertyId(this.sender));
        if (!chunkData || (!chunkData.special && !chunkData.countryId)) {
            this.sender.sendMessage({ translate: `command.checkchunk.result.wilderness`, with: { rawtext: [{ translate: `wilderness.name` }] } });
            return;
        } else if (chunkData.special) {
            this.sender.sendMessage({ translate: `command.checkchunk.result.special`, with: { rawtext: [{ translate: `special.name` }] } });
            return;
        } else {
            if (chunkData.owner) {
                this.sender.sendMessage({ translate: `command.checkchunk.result.ownerland`, with: [`${chunkCountryData.owner}`] });
                return;
            };
            const chunkCountryData = GetAndParsePropertyData(`country_${chunkData.countryId}`)
            this.sender.sendMessage({ translate: `command.checkchunk.result.territory`, with: [`${chunkCountryData.name}`] });
            return;
        };
    };

    setHome(args) {
        const home = new HomeManager(this.sender);
        const name = args.length == 0 ? 'default' : args[0];
        home.setHome(name);
        return;
    };

    teleportHome(args) {
        const home = new HomeManager(this.sender);
        const name = args.length == 0 ? 'default' : args[0];
        home.teleportHome(name);
        return;
    };

    deleteHome(args) {
        const home = new HomeManager(this.sender);
        const name = args.length == 0 ? 'default' : args[0];
        home.deleteHome(name);
        return;
    };

    homeList() {
        const home = new HomeManager(this.sender);
        home.listHomes();
        return;
    };

    setAdminChunk(args) {
        const chunkDataBase = new DynamicProperties("chunk")
        if (!this.sender.hasTag("mc_admin")) {
            this.sender.sendMessage({ translate: `command.permission.error` });
            return;
        };
        if (args.length == 2) {
            const [ix, iz] = args.map(str => Math.floor(Number(str)));
            const { x, z } = this.sender.location;
            const chunks = getChunksInRange(Math.floor(x), Math.floor(z), ix, iz);
            if (!isNumber(ix) || !isNumber(iz)) {
                this.sender.sendMessage({ translate: '§c座標が間違っています' });
                return;
            };
            if (chunks.length > 100) {
                this.sender.sendMessage({ translate: '1度に特別区にできるチャンクは100チャンクまでです' });
                return;
            };
            for (let i = 0; i < chunks.length; i++) {
                system.runTimeout(() => {
                    this.sender.sendMessage({ translate: `command.setadminchunk.result`, with: { rawtext: [{ translate: `special.name` }] } });
                    const chunk = GenerateChunkData(chunks[i].chunkX, chunks[i].chunkZ, this.sender.dimension.id, undefined, undefined, 10000, true);
                    StringifyAndSavePropertyData(chunk.id, chunk, chunkDataBase);
                    return;
                }, i)
            }
            return;
        }
        const { x, z } = this.sender.location;
        this.sender.sendMessage({ translate: `command.setadminchunk.result`, with: { rawtext: [{ translate: `special.name` }] } });
        const chunk = GenerateChunkData(x, z, this.sender.dimension.id, undefined, undefined, 10000, true);
        StringifyAndSavePropertyData(chunk.id, chunk, chunkDataBase);
        return;
    };

    resetChunk(args) {
        const chunkDataBase = new DynamicProperties("chunk");
        const countryDataBase = new DynamicProperties("country");
        if (!this.sender.hasTag("mc_admin")) {
            this.sender.sendMessage({ translate: `command.permission.error` });
            return;
        };
        const dimension = this.sender.dimension.id;
        if (args.length == 2) {
            const [ix, iz] = args.map(str => Math.floor(Number(str)));
            const { x, z } = this.sender.location;
            const chunks = getChunksInRange(Math.floor(x), Math.floor(z), ix, iz);
            if (!isNumber(ix) || !isNumber(iz)) {
                this.sender.sendMessage({ translate: '§c座標が間違っています' });
                return;
            };
            if (chunks.length > 100) {
                this.sender.sendMessage({ translate: '1度にリセット可能なチャンクは100チャンクまでです' });
                return;
            };
            for (let i = 0; i < chunks.length; i++) {
                system.runTimeout(() => {
                    const chunkId = `chunk_${chunks[i].chunkX}_${chunks[i].chunkZ}_${dimension.replace(`minecraft:`, ``)}`;
                    let chunkData = GetAndParsePropertyData(chunkId, chunkDataBase);
                    if (chunkData) {
                        if (chunkData?.countryId) {
                            const countryData = GetAndParsePropertyData(`country_${chunkData?.countryId}`, countryDataBase);
                            if (countryData) {
                                countryData.territories.splice(countryData.territories.indexOf(chunkId), 1);
                                let chunkPrice = config.defaultChunkPrice / 2;
                                if (chunkData && chunkData.price) chunkPrice = chunkData.price / 2;
                                countryData.money += chunkPrice;
                                StringifyAndSavePropertyData(`country_${chunkData?.countryId}`, countryData, countryDataBase);
                            };
                        };
                    };
                    chunkDataBase.delete(chunkId);
                    this.sender.sendMessage({ translate: `command.resetchunk.result`, with: { rawtext: [{ translate: `wilderness.name` }] } });
                }, i)
            }
            return;
        }
        const chunkId = GetPlayerChunkPropertyId(this.sender);
        const chunkData = GetAndParsePropertyData(chunkId, chunkDataBase);
        if (chunkData) {
            if (chunkData?.countryId) {
                const countryData = GetAndParsePropertyData(`country_${chunkData?.countryId}`, countryDataBase);
                if (countryData) {
                    countryData.territories.splice(countryData.territories.indexOf(chunkId), 1);
                    let chunkPrice = config.defaultChunkPrice / 2;
                    if (chunkData && chunkData.price) chunkPrice = chunkData.price / 2;
                    countryData.money += chunkPrice;
                    StringifyAndSavePropertyData(`country_${chunkData?.countryId}`, countryData, countryDataBase);
                };
            };
        };
        chunkDataBase.delete(chunkId);
        this.sender.sendMessage({ translate: `command.resetchunk.result`, with: { rawtext: [{ translate: `wilderness.name` }] } });
    };

    /**
     * 
     * @param {Array<string>} args 
     * @returns 
     */
    buyChunk(args) {
        const chunkDataBase = new DynamicProperties("chunk");
        const playerDataBase = new DynamicProperties("player");
        const countryDataBase = new DynamicProperties("country");
        if (!this.playerData?.country) {
            this.sender.sendMessage({ translate: `command.buychunk.error.notjoin.country` });
            return;
        };
        const dimension = this.sender.dimension.id;
        if (args.length == 2) {
            const [ix, iz] = args.map(str => Math.floor(Number(str)));
            const { x, z } = this.sender.location;
            const chunks = getChunksInRange(Math.floor(x), Math.floor(z), ix, iz);
            if (!isNumber(ix) || !isNumber(iz)) {
                this.sender.sendMessage({ translate: '§c座標が間違っています' });
                return;
            };
            if (chunks.length > 100) {
                this.sender.sendMessage({ translate: '1度に買えるチャンクは100チャンクまでです' });
                return;
            };
            let chunkPrice = config.defaultChunkPrice;
            for (let i = 0; i < chunks.length; i++) {
                system.runTimeout(() => {
                    let chunkData = GetAndParsePropertyData(`chunk_${chunks[i].chunkX}_${chunks[i].chunkZ}_${dimension.replace(`minecraft:`, ``)}`, chunkDataBase);
                    if (!chunkData) chunkData = GenerateChunkData(chunks[i].chunkX * 16, chunks[i].chunkZ * 16, dimension);
                    if (chunkData && chunkData.price) chunkPrice = chunkData.price;
                    const cannotBuy = CheckPermission(this.sender, `buyChunk`);
                    if (cannotBuy) {
                        this.sender.sendMessage({ translate: `command.permission.error` });
                        return;
                    };
                    if (!chunkData) {
                        this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.wilderness`, with: { rawtext: [{ translate: `wilderness.name` }] } });
                        return;
                    };
                    if (chunkData.special) {
                        this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.special`, with: { rawtext: [{ translate: `special.name` }] } });
                        return;
                    };
                    if (chunkData.owner) {
                        const ownerData = GetAndParsePropertyData(`player_${chunkData.owner}`, playerDataBase);
                        this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.hasowner`, with: [ownerData.name] });
                        return;
                    };
                    if (chunkData.countryId) {
                        if (chunkData.countryId === this.playerData.country) {
                            this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.yourcountry` });
                            return;
                        };
                        this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.othercountry`, with: { rawtext: [{ translate: `${chunkData.countryId}` }] } });
                        return;
                    };
                    if (chunkData?.countryId) {
                        if (chunkData.countryId === this.playerData.country) {
                            this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.yourcountry` });
                            return;
                        };
                        this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.othercountry`, with: { rawtext: [{ translate: `${chunkData.countryId}` }] } });
                        return;
                    };
                    const playerCountryData = GetAndParsePropertyData(`country_${this.playerData.country}`, countryDataBase);
                    const limit = config.chunkLimit || 3200;
                    if (playerCountryData?.territories.length >= limit) {
                        this.sender.sendMessage({ translate: 'chunk.limit', with: [`${limit}`] });
                        return;
                    };
                    const eventData = {
                        player: this.sender,
                        cancel: false,
                        type: 'player',
                        territoryCount: playerCountryData.territories.length,
                        countryName: playerCountryData.name
                    };
                    const isCanceled = country.beforeEvents.chunkbuy.emit(eventData);
                    if (isCanceled) return;
                    eventData.cancel = undefined;
                    country.afterEvents.chunkbuy.emit(eventData);
                    if (playerCountryData.resourcePoint < chunkPrice) {
                        this.sender.sendMessage({ translate: `command.buychunk.error.not.enough.money`, with: [`${chunkPrice}`] });
                        return;
                    };

                    chunkData.countryId = this.playerData.country;
                    playerCountryData.resourcePoint -= chunkPrice;
                    playerCountryData.territories.push(chunkData.id);
                    StringifyAndSavePropertyData(chunkData.id, chunkData, chunkDataBase);
                    StringifyAndSavePropertyData(`country_${playerCountryData.id}`, playerCountryData, countryDataBase);
                    this.sender.sendMessage({ translate: `command.buychunk.result`, with: [`${playerCountryData.resourcePoint}`] });

                    return;
                }, i);
            };
            return;
        };
        let chunkData = GetAndParsePropertyData(GetPlayerChunkPropertyId(this.sender), chunkDataBase);
        const { x, z } = this.sender.location;
        if (!chunkData) chunkData = GenerateChunkData(x, z, dimension);
        let chunkPrice = config.defaultChunkPrice;
        if (chunkData && chunkData.price) chunkPrice = chunkData.price;
        const cannotBuy = CheckPermission(this.sender, `buyChunk`);
        if (cannotBuy) {
            this.sender.sendMessage({ translate: `command.permission.error` });
            return;
        };
        if (!chunkData) {
            this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.wilderness`, with: { rawtext: [{ translate: `wilderness.name` }] } });
            return;
        };
        if (chunkData.special) {
            this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.special`, with: { rawtext: [{ translate: `special.name` }] } });
            return;
        };
        if (chunkData.owner) {
            const ownerData = GetAndParsePropertyData(`player_${chunkData.owner}`, playerDataBase);
            this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.hasowner`, with: [ownerData.name] });
            return;
        };
        if (chunkData.countryId) {
            if (chunkData.countryId === this.playerData.country) {
                this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.yourcountry` });
                return;
            };
            this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.othercountry`, with: { rawtext: [{ translate: `${chunkData.countryId}` }] } });
            return;
        };
        if (chunkData?.countryId) {
            if (chunkData.countryId === this.playerData.country) {
                this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.yourcountry` });
                return;
            };
            this.sender.sendMessage({ translate: `command.buychunk.error.thischunk.othercountry`, with: { rawtext: [{ translate: `${chunkData.countryId}` }] } });
            return;
        };
        const playerCountryData = GetAndParsePropertyData(`country_${this.playerData.country}`, countryDataBase);
        const limit = config.chunkLimit || 3200;
        if (playerCountryData?.territories.length >= limit) {
            this.sender.sendMessage({ translate: 'chunk.limit', with: [`${limit}`] });
            return;
        };
        const eventData = {
            player: this.sender,
            cancel: false,
            type: 'player',
            territoryCount: playerCountryData.territories.length,
            countryName: playerCountryData.name
        };
        const isCanceled = country.beforeEvents.chunkbuy.emit(eventData);
        if (isCanceled) return;
        eventData.cancel = undefined;
        country.afterEvents.chunkbuy.emit(eventData);
        if (playerCountryData.resourcePoint < chunkPrice) {
            this.sender.sendMessage({ translate: `command.buychunk.error.not.enough.money`, with: [`${chunkPrice}`] });
            return;
        };

        chunkData.countryId = this.playerData.country;
        playerCountryData.resourcePoint -= chunkPrice;
        playerCountryData.territories.push(chunkData.id);
        StringifyAndSavePropertyData(chunkData.id, chunkData, chunkDataBase);
        StringifyAndSavePropertyData(`country_${playerCountryData.id}`, playerCountryData, countryDataBase);
        this.sender.sendMessage({ translate: `command.buychunk.result`, with: [`${playerCountryData.resourcePoint}`] });
        return;
    };

    sellChunk(args) {
        const chunkDataBase = new DynamicProperties("chunk");
        const playerDataBase = new DynamicProperties("player");
        const countryDataBase = new DynamicProperties("country");
        if (!this.playerData.country) {
            this.sender.sendMessage({ translate: `command.sellchunk.error.notjoin.country` });
            return;
        };
        const dimension = this.sender.dimension.id;
        if (args.length == 2) {
            const [ix, iz] = args.map(str => Math.floor(Number(str)));
            const { x, z } = this.sender.location;
            const chunks = getChunksInRange(Math.floor(x), Math.floor(z), ix, iz);
            if (!isNumber(ix) || !isNumber(iz)) {
                this.sender.sendMessage({ translate: '§c座標が間違っています' });
                return;
            };
            if (chunks.length > 100) {
                this.sender.sendMessage({ translate: '1度に売れるチャンクは100チャンクまでです' });
                return;
            };
            let chunkPrice = config.defaultChunkPrice / 2;
            for (let i = 0; i < chunks.length; i++) {
                system.runTimeout(() => {
                    let chunkData = GetAndParsePropertyData(`chunk_${chunks[i].chunkX}_${chunks[i].chunkZ}_${dimension.replace(`minecraft:`, ``)}`, chunkDataBase);
                    if (!chunkData) chunkData = GenerateChunkData(chunks[i].chunkX * 16, chunks[i].chunkZ * 16, dimension);
                    if (chunkData && chunkData.price) chunkPrice = chunkData.price / 2;
                    const cannotSell = CheckPermission(this.sender, `sellChunk`);
                    if (!chunkData || !chunkData.countryId) {
                        this.sender.sendMessage({ translate: `command.sellchunk.error.thischunk.notterritory` });
                        return;
                    };
                    if (chunkData && chunkData.countryId && chunkData.countryId != this.playerData.country) {
                        this.sender.sendMessage({ translate: `command.sellchunk.error.thischunk.notterritory` });
                        return;
                    };
                    if (cannotSell) {
                        this.sender.sendMessage({ translate: `command.permission.error` });
                        return;
                    };
                    const cores = this.sender.dimension.getEntities({ type: `mc:core` });
                    let coresChunks = [];
                    for (let i = 0; i < cores.length; i++) {
                        coresChunks[coresChunks.length] = GetPlayerChunkPropertyId(cores[i]);
                    };
                    if (coresChunks.includes(GetPlayerChunkPropertyId(this.sender))) {
                        this.sender.sendMessage({ rawtext: [{ text: `§a[MakeCountry]\n` }, { translate: `invade.error.already` }] });
                        return;
                    };
                    const playerCountryData = GetAndParsePropertyData(`country_${this.playerData.country}`, countryDataBase);
                    if (playerCountryData.territories.length < 2) {
                        this.sender.sendMessage({ translate: `command.sellchunk.error.morechunk`, with: [`${chunkPrice}`] });
                        return;
                    };

                    chunkData.countryId = undefined;
                    playerCountryData.resourcePoint += chunkPrice;
                    playerCountryData.territories.splice(playerCountryData.territories.indexOf(chunkData.id), 1);
                    StringifyAndSavePropertyData(chunkData.id, chunkData, chunkDataBase);
                    StringifyAndSavePropertyData(`country_${playerCountryData.id}`, playerCountryData, countryDataBase);
                    this.sender.sendMessage({ translate: `command.sellchunk.result`, with: [`${playerCountryData.resourcePoint}`] });

                    return;
                }, i)
            }
            return;
        }
        const chunkData = GetAndParsePropertyData(GetPlayerChunkPropertyId(this.sender));
        let chunkPrice = config.defaultChunkPrice / 2;
        if (chunkData && chunkData.price) chunkPrice = chunkData.price / 2;
        const cannotSell = CheckPermission(this.sender, `sellChunk`);
        if (!chunkData || !chunkData.countryId) {
            this.sender.sendMessage({ translate: `command.sellchunk.error.thischunk.notterritory` });
            return;
        };
        if (chunkData && chunkData.countryId && chunkData.countryId != this.playerData.country) {
            this.sender.sendMessage({ translate: `command.sellchunk.error.thischunk.notterritory` });
            return;
        };
        if (cannotSell) {
            this.sender.sendMessage({ translate: `command.permission.error` });
            return;
        };
        const cores = this.sender.dimension.getEntities({ type: `mc:core` });
        let coresChunks = [];
        for (let i = 0; i < cores.length; i++) {
            coresChunks[coresChunks.length] = GetPlayerChunkPropertyId(cores[i]);
        };
        if (coresChunks.includes(GetPlayerChunkPropertyId(this.sender))) {
            this.sender.sendMessage({ rawtext: [{ text: `§a[MakeCountry]\n` }, { translate: `invade.error.already` }] });
            return;
        };
        const playerCountryData = GetAndParsePropertyData(`country_${this.playerData.country}`, countryDataBase);
        if (playerCountryData.territories.length < 2) {
            this.sender.sendMessage({ translate: `command.sellchunk.error.morechunk`, with: [`${chunkPrice}`] });
            return;
        };

        chunkData.countryId = undefined;
        playerCountryData.resourcePoint += chunkPrice;
        playerCountryData.territories.splice(playerCountryData.territories.indexOf(chunkData.id), 1);
        StringifyAndSavePropertyData(chunkData.id, chunkData, chunkDataBase);
        StringifyAndSavePropertyData(`country_${playerCountryData.id}`, playerCountryData, countryDataBase);
        this.sender.sendMessage({ translate: `command.sellchunk.result`, with: [`${playerCountryData.resourcePoint}`] });

        return;
    };

    jobs() {
        if (!jobs_config.validity) {
            this.sender.sendMessage({ translate: `command.error.jobs.novalidity` });
            return;
        };
        jobsForm(this.sender);
        return;
    };

    shop() {
        if (!config.shopValidity) {
            this.sender.sendMessage({ translate: `no.available.shop` });
            return;
        };
        ShopCommonsMenu(this.sender);
        return;
    };

    playermarket() {
        if (!config.playerMarketValidity) {
            this.sender.sendMessage({ translate: `command.error.playermarket.novalidity` });
            return;
        };
        PlayerMarketMainMenu(this.sender);
        return;
    };

    /**
     * 
     * @param {Array<string>} args 
     * @returns 
     */
    tpa(args) {
        if (!config.tpaValidity) {
            this.sender.sendMessage({ translate: `command.error.tpa.novalidity` });
            return;
        };
        if (this.sender.hasTag(`mc_notp`)) {
            return;
        };
        if (config.combatTagNoTeleportValidity) {
            if (this.sender.hasTag(`mc_combat`)) {
                this.sender.sendMessage({ translate: `teleport.error.combattag` });
                return;
            };
        };
        if (config.invaderNoTeleportValidity) {
            if (this.sender.getTags().find(tag => tag.startsWith(`war`))) {
                this.sender.sendMessage({ translate: `teleport.error.invader` });
                return;
            };
        };
        if (args.length != 0 && args.join(` `) != `` && args.join(` `).length != 0) {
            teleportRequest(this.sender, args.join(` `));
            return;
        };
        tpaMainForm(this.sender);
        return;
    };

    sendHelp() {
        /** 
         * @type {import("@minecraft/server").RawMessage}
         */
        const helpMessage = [{ text: `§a------------------------------------\n` },
        { translate: `command.help.money` }, { text: `\n` },
        { translate: `command.help.setup` }, { text: `\n` },
        { translate: `command.help.msend` }, { text: `\n` },
        { translate: `command.help.checkchunk` }, { text: `\n` },
        { translate: `command.help.cc` }, { text: `\n` },
        { translate: `command.help.sethome` }, { text: `\n` },
        { translate: `command.help.home` }, { text: `\n` },
        { translate: `command.help.deletehome` }, { text: `\n` },
        { translate: `command.help.checkhome` }, { text: `\n` },
        { translate: `command.help.adminchunk` }, { text: `\n` },
        { translate: `command.help.adminc` }, { text: `\n` },
        { translate: `command.help.resetchunk`, with: { rawtext: [{ translate: `special.name` }] } }, { text: `\n` },
        { translate: `command.help.resetc`, with: { rawtext: [{ translate: `special.name` }] } }, { text: `\n` },
        { translate: `command.help.buychunk` }, { text: `\n` },
        { translate: `command.help.buyc` }, { text: `\n` },
        { translate: `command.help.sellchunk` }, { text: `\n` },
        { translate: `command.help.sellc` }, { text: `\n` },
        { translate: `command.help.makecountry` }, { text: `\n` },
        { translate: `command.help.mc` }, { text: `\n` },
        { translate: `command.help.settingcountry` }, { text: `\n` },
        { translate: `command.help.sc` }, { text: `\n` },
        { translate: `command.help.leavecountry` }, { text: `\n` },
        { translate: `command.help.kill` }, { text: `\n` },
        { translate: `command.help.countrylist` }, { text: `\n` },
        { translate: `command.help.cl` }, { text: `\n` },
        { translate: `command.help.al` }, { text: `\n` },
        { translate: `command.help.joincountry` }, { text: `\n` },
        { translate: `command.help.jc` }, { text: `\n` },
        { translate: `command.help.chome` }, { text: `\n` },
        { translate: `command.help.menu` }, { text: `\n` },
        { translate: `command.help.jobs` }, { text: `\n` },
        { translate: `command.help.playermarket` }, { text: `\n` },
        { translate: `command.help.pm` }, { text: `\n` },
        { translate: `command.help.shop` }, { text: `\n` },
        { translate: `command.help.tpa` }, { text: `\n` },
        { translate: `command.help.camera` }, { text: `\n` },
        { translate: `command.help.map` }, { text: `\n` },
        { translate: `command.help.invade` }, { text: `\n` },
        { translate: `command.help.copyright` }, { text: `\n` },
        { translate: `command.help.lc` }, { text: `\n` },
        { translate: `command.help.g` }, { text: `\n` },
        { translate: `command.help.cchat` }, { text: `\n` },
        { translate: `command.help.ac` }, { text: `\n` },
        { translate: `command.help.plot` }, { text: `\n` },
        { text: `§a------------------------------------` }];
        this.sender.sendMessage({ rawtext: helpMessage });
    };

    makeCountry() {
        if (this.playerData?.country) {
            this.sender.sendMessage({ translate: `command.makecountry.error.belong.country` });
            return;
        };
        MakeCountryForm(this.sender);
        return;
    };

    settingCountry() {
        if (!this.playerData?.country) {
            this.sender.sendMessage({ translate: `command.settingcountry.error.nobelong.country` });
            return;
        };
        settingCountry(this.sender);
        return;
    };

    joinCountry() {
        if (this.playerData?.country) {
            this.sender.sendMessage({ translate: `already.country.join` });
            return;
        };
        joinTypeSelectForm(this.sender);
        return;
    };

    leaveCountry() {
        const countryDataBase = new DynamicProperties("country");
        if (!this.playerData?.country) {
            this.sender.sendMessage({ translate: `command.leavecountry.error.no.belong.country` })
            return;
        };
        const countryData = GetAndParsePropertyData(`country_${this.playerData?.country}`, countryDataBase);
        if (this.playerData.id === countryData?.owner) {
            this.sender.sendMessage({ translate: `command.leavecountry.error.your.owner` })
            return;
        };
        playerCountryLeave(this.sender);
        return;
    };

    kill() {
        if (!config.killValidity) {
            this.sender.sendMessage({ translate: `command.error.kill.novalidity` });
            return;
        };
        if (this.sender.hasTag(`mc_notp`)) {
            return;
        };
        this.sender.runCommand(`kill @s`);
        return;
    };

    CountryList() {
        countryList(this.sender);
        return;
    };

    AllianceCountryList() {
        if (!this.playerData?.country) {
            this.sender.sendMessage({ translate: 'cannnot.use.nojoin.country' });
            return;
        };
        countryList(this.sender, true);
        return;
    };

    chome() {
        const countryDataBase = new DynamicProperties("country");
        if (config.combatTagNoTeleportValidity && this.sender.hasTag("mc_combat")) {
            this.sender.sendMessage({ translate: "teleport.error.combattag" });
            return;
        }
        if (config.invaderNoTeleportValidity && this.sender.getTags().find(tag => tag.startsWith("war"))) {
            this.sender.sendMessage({ translate: "teleport.error.invader" });
            return;
        }
        if (this.sender.hasTag(`mc_notp`)) {
            return;
        };
        if (!this.playerData?.country) {
            this.sender.sendMessage({ translate: `command.chome.error.notjoin.country` });
            return;
        };
        const countryData = GetAndParsePropertyData(`country_${this.playerData.country}`, countryDataBase);
        if (!countryData?.spawn || !countryData?.publicSpawn) {
            return;
        };
        let [x, y, z, rx, ry, dimensionId] = countryData?.spawn.split(`_`);
        if (CheckPermissionFromLocation(this.sender, Number(x), Number(z), dimensionId, `publicHomeUse`)) {
            //権限がない！！
            this.sender.sendMessage({ translate: `no.permission` });
            return
        };
        //tp
        this.sender.teleport({ x: Number(x), y: Number(y), z: Number(z) }, { dimension: world.getDimension(`${dimensionId.replace(`minecraft:`, ``)}`), rotation: { x: Number(rx), y: Number(ry) } });
        this.sender.sendMessage({ translate: `command.chome.result` })
        return;
    };

    mainMenu() {
        playerMainMenu(this.sender);
        return;
    };

    camera() {
        if (!config.cameraValidity) {
            this.sender.sendMessage({ translate: `command.error.camera.novalidity` });
            return;
        };
        if (this.sender.hasTag(`mc_notp`)) {
            return;
        };
        const isCamera = this.sender.hasTag(`mc_camera`);
        if (isCamera) {
            this.sender.camera.clear();
            this.sender.removeTag(`mc_camera`);
            return;
        };
        if (!isCamera) {
            this.sender.addTag(`mc_camera`);
            this.sender.camera.setCamera(`minecraft:free`, { location: this.sender.getHeadLocation(), rotation: this.sender.getRotation() });
            return;
        };
        return;
    };
    map() {
        const chunkDataBase = new DynamicProperties("chunk");
        const playerCurrentChunk = GetPlayerChunkPropertyId(this.sender);
        const alliance = this.playerCountryData?.alliance ?? [];
        const hostility = this.playerCountryData?.hostility ?? [];
        const friendly = this.playerCountryData?.friendly ?? [];
        let [chunk, currentX, currentZ, dimension] = playerCurrentChunk.split(`_`);
        let currentXNum = Number(currentX);
        let currentZNum = Number(currentZ);
        let playerCountryId = this.playerData?.country ?? -10;
        let result = [];
        for (let i = 10; i > -11; i--) {
            let jResult = [];
            for (let j = -10; j < 11; j++) {
                let chunkX = currentXNum + i;
                let chunkZ = currentZNum + j;
                let chunkId = `${chunk}_${chunkX}_${chunkZ}_${dimension}`;
                let chunkData = GetAndParsePropertyData(`${chunkId}`, chunkDataBase);
                let colorCode = "f"
                if (chunkData?.countryId) {
                    colorCode = "e";
                    if (chunkData?.countryId === playerCountryId && playerCountryId != 0) {
                        colorCode = "a";
                    };
                    if (alliance.includes(chunkData?.countryId)) {
                        colorCode = "b";
                    };
                    if (hostility.includes(chunkData?.countryId)) {
                        colorCode = "c";
                    };
                    if (friendly.includes(chunkData?.countryId)) {
                        colorCode = "d";
                    };
                };
                if (i === 0 && j === 0) {
                    colorCode = "4"
                };
                jResult.push(`§${colorCode}O`);
            };
            result.push(jResult.join(``));
        };
        this.sender.sendMessage(`§c----------------------------------------------------\n${result.join(`\n`)}\n§c----------------------------------------------------`);
        this.sender.teleport(this.sender.location, { rotation: { x: 0, y: -90 } });
        return;
    };
    invade() {
        if (!config.invadeValidity) {
            this.sender.sendMessage({ translate: `command.error.invade.novalidity` });
            return;
        };
        if (!this.playerData?.country) {
            this.sender.sendMessage({ translate: `command.sellchunk.error.notjoin.country` });
            return;
        };
        const cancel = CheckPermission(this.sender, `warAdmin`);
        if (cancel) {
            this.sender.sendMessage({ translate: `command.error.permission` });
            return;
        };
        Invade(this.sender);
        return;
    };
    copyright() {
        const container = this.sender.getComponent(`inventory`).container;
        const item = container.getItem(this.sender.selectedSlotIndex);
        if (item) {
            if (item.typeId == "mc:penname_after" || item.typeId == "mc:penname_before") {
                return;
            };
            const loreArray = item.getLore();
            if (loreArray.includes(`§c§r§d${this.sender.name}(${this.sender.id})`)) {
                item.setLore(loreArray.filter(lore => lore != `§c§r§d${this.sender.name}(${this.sender.id})`));
                container.setItem(this.sender.selectedSlotIndex, item);
                return;
            };
            if (loreArray.find(lore => lore.includes(`§c§r§d`))) {
                //item.setLore(loreArray.filter(lore => !lore.includes(`§c§r§d`)));
                //container.setItem(this.sender.selectedSlotIndex, item);
                return;
            };
            loreArray.unshift(`§c§r§d${this.sender.name}(${this.sender.id})`);
            item.setLore(loreArray);
            container.setItem(this.sender.selectedSlotIndex, item);
        };
        return;
    };
    countryChat() {
        if (!this.playerData?.country || this.playerData.country < 1) {
            this.sender.sendMessage({ rawtext: [{ rawtext: `cannnot.use.nojoin.country` }] })
            return;
        };
        this.sender.setDynamicProperty(`chatType`, `country`);
        this.sender.sendMessage({ rawtext: [{ translate: `chattype.changed`, with: { rawtext: [{ translate: `country.chat` }] } }] })
    };
    generalChat() {
        this.sender.setDynamicProperty(`chatType`, `general`);
        this.sender.sendMessage({ rawtext: [{ translate: `chattype.changed`, with: { rawtext: [{ translate: `general.chat` }] } }] })
    };
    allianceChat() {
        if (!this.playerData?.country || this.playerData.country < 1) {
            this.sender.sendMessage({ rawtext: [{ rawtext: `cannnot.use.nojoin.country` }] })
            return;
        };
        this.sender.setDynamicProperty(`chatType`, `alliance`);
        this.sender.sendMessage({ rawtext: [{ translate: `chattype.changed`, with: { rawtext: [{ translate: `alliance.chat` }] } }] })
    };
    localChat() {
        this.sender.setDynamicProperty(`chatType`, `local`);
        this.sender.sendMessage({ rawtext: [{ translate: `chattype.changed`, with: { rawtext: [{ translate: `local.chat` }] } }] })
        return;
    };
    plot() {
        plotMainForm(this.sender);
        return;
    };
};

world.beforeEvents.chatSend.subscribe(event => {
    const chatHandler = new ChatHandler(event, false);
    if (chatHandler.isCommand()) {
        chatHandler.handleCommand();
    } else {
        chatHandler.handleChat();
    };
});

system.afterEvents.scriptEventReceive.subscribe(event => {
    if (!event?.sourceEntity) return;
    if (!(event?.sourceEntity instanceof Player)) return;
    if (!event.id.startsWith(`mc_cmd`)) return;
    event.sender = event.sourceEntity;
    const scriptCommandHandler = new ChatHandler(event, true);
    scriptCommandHandler.handleCommand();
});

/*
system.beforeEvents.startup.subscribe(event => {
    const customCommandNames = ["setup",""];
    for (const customCommandName of customCommandNames) {
        event.customCommandRegistry.registerCommand(
            {
                name: `mc:${customCommandName}`,
                permissionLevel: CommandPermissionLevel.Any,
            },
            (origin, ...args) => {
                if (origin.sourceType != CustomCommandSource.Entity) return;
                ev.sender = origin.sourceEntity;
                ev.id = `mc_cmd:${customCommandName}`;
                ev.message = args.join(" ");
                const customCommandHandler = new ChatHandler(ev, true);
                customCommandHandler.handleCommand();
            }
        )
    }
});
*/

/**
 * 
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {Array<{chunkX: number,chunkZ: number}>}
 * @returns 
 */
function getChunksInRange(x1, z1, x2, z2) {
    // 小さい座標を開始点にする
    let startX = Math.floor(Math.min(x1, x2) / 16);
    let endX = Math.floor(Math.max(x1, x2) / 16);
    let startZ = Math.floor(Math.min(z1, z2) / 16);
    let endZ = Math.floor(Math.max(z1, z2) / 16);

    let chunks = [];

    // 範囲内のすべてのチャンク座標を取得
    for (let cx = startX; cx <= endX; cx++) {
        for (let cz = startZ; cz <= endZ; cz++) {
            if (chunks.length > 101) return chunks;
            chunks.push({ chunkX: cx, chunkZ: cz });
        }
    }
    return chunks;
}
