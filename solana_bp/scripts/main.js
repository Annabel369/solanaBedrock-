import { world, system, EquipmentSlot } from "@minecraft/server";
import { http, HttpRequest, HttpRequestMethod } from "@minecraft/server-net";

// Suas configurações do Docker
const CONFIG = {
    dockerHost: "debian.tail561849.ts.net",
    apiKey: "b493d48364afe44d",
    solanaCommand: "heysolana",
    solanaUrl: "https://api.devnet.solana.com",
    bankWallet: "dadhcDXHiHDrWkT2Z4pSZyF6HWmHwQMG3HtGciwccVP",
    coinConversionRate: 1000, // 1 SOL = 1000 moedas
    storePrices: {
        apple: 500,
        emerald: 250,
        nether_relic: 1000,
        boot_relic: 1000,
        wing_relic: 1000,
        leg_relic: 1000,
        thor_axe: 60000
    }
};

const PREFIX = "/";


world.beforeEvents.chatSend.subscribe((event) => {
    const message = event.message;
    const player = event.sender;

    if (message.startsWith(PREFIX)) {
        event.cancel = true; // Impede a mensagem de aparecer no chat
        const args = message.slice(PREFIX.length).trim().split(/\s+/);
        const command = args.shift().toLowerCase();

        // system.run garante que o comando rode com segurança na thread do servidor
        system.run(() => {
            handleCommand(player, command, args);
        });
    }
});

async function handleCommand(player, command, args) {
    if (command === "solbalance" || command === "solsaldo") {
        // No Bedrock não temos conexão direta JDBC com o MySQL.
        // Portanto, a carteira do jogador precisa estar salva internamente no Add-on (Dynamic Properties)
        // Ou o seu PHP (consulta.php) precisa buscar do banco de dados pra você.
        
        let walletAddress = player.getDynamicProperty("solana_wallet");
        
        // Se para testar você quiser usar uma carteira fixa, comente a linha acima e use:
        // let walletAddress = "dadhcDXHiHDrWkT2Z4pSZyF6HWmHwQMG3HtGciwccVP"; // Carteira admin do config

        if (!walletAddress) {
            player.sendMessage("§c[Solana]§f Você não tem uma carteira vinculada. Use /setwallet <endereco> para testar.");
            return;
        }

        player.sendMessage("§e[Solana]§f Consultando saldo na rede Solana...");

        // Montando o comando igual no seu Java: "heysolana balance <carteira> --url ..."
        const solanaCmd = `${CONFIG.solanaCommand} balance ${walletAddress} --url ${CONFIG.solanaUrl}`;
        
        // URL da sua API no Docker
        const url = `http://${CONFIG.dockerHost}/consulta.php?apikey=${CONFIG.apiKey}&comando=${encodeURIComponent(solanaCmd)}`;
        
        const request = new HttpRequest(url);
        request.method = HttpRequestMethod.Get;

        try {
            const response = await http.request(request);
            if (response.status === 200) {
                // response.body contém o retorno do seu PHP
                player.sendMessage(`§e[Solana]§f Saldo: §b${response.body.trim()} SOL`);
            } else {
                player.sendMessage(`§c[Solana]§f Erro na API. Código: ${response.status}`);
            }
        } catch (error) {
            player.sendMessage("§c[Solana]§f Erro ao conectar com o servidor Docker.");
        }
    }
    else if (command === "setwallet") {
        if (args.length === 0) {
            player.sendMessage("§cUso correto: /setwallet <endereco_da_carteira>");
            return;
        }
        
        const wallet = args[0];
        player.setDynamicProperty("solana_wallet", wallet);
        player.sendMessage(`§a[Solana]§f Carteira vinculada com sucesso: §e${wallet}`);
    }
    else if (command === "saldo" || command === "balance") {
        let balance = player.getDynamicProperty("internal_balance") ?? 0;
        player.sendMessage(`§a[Store]§f Seu saldo interno é: §e$${balance}`);
    }
    else if (command === "comprarmoedas" || command === "buycoins") {
        if (args.length === 0) {
            player.sendMessage("§cUso correto: /comprarmoedas <quantidade_de_sol>");
            return;
        }

        const solAmount = parseFloat(args[0]);
        if (isNaN(solAmount) || solAmount <= 0) {
            player.sendMessage("§cQuantidade inválida.");
            return;
        }

        const effectiveName = player.name.replace(/ /g, "_");
        
        // Verifica se a carteira está vinculada, caso o script ou backend exija
        let walletAddress = player.getDynamicProperty("solana_wallet");
        if (!walletAddress) {
            player.sendMessage(`§c[Solana]§f Você não tem uma carteira vinculada.`);
            return;
        }

        const gameCurrencyAmount = Math.floor(solAmount * CONFIG.coinConversionRate);
        const formattedAmount = solAmount.toFixed(8).replace(/0+$/, "").replace(/\.$/, ""); // 0.001

        player.sendMessage(`§e[Loja]§f Processando a transferência de ${formattedAmount} SOL para ${gameCurrencyAmount} moedas...`);

        const solanaCmd = `${CONFIG.solanaCommand} transfer ${CONFIG.bankWallet} ${formattedAmount} --keypair /solana-token/wallets/${effectiveName}_wallet.json --allow-unfunded-recipient --url ${CONFIG.solanaUrl}`;
        const url = `http://${CONFIG.dockerHost}/consulta.php?apikey=${CONFIG.apiKey}&comando=${encodeURIComponent(solanaCmd)}`;

        const request = new HttpRequest(url);
        request.method = HttpRequestMethod.Get;

        try {
            const response = await http.request(request);
            if (response.status === 200) {
                // Como não temos SQL aqui, vamos analisar a resposta em JSON, igual no seu Java
                try {
                    const json = JSON.parse(response.body);
                    if (json.status && json.status.toLowerCase() === "success") {
                        const output = json.output;
                        const match = output.match(/Signature: ([A-Za-z0-9]+)/);
                        const signature = match ? match[1] : "desconhecida";

                        // Adiciona saldo na economia interna (já que não temos o BD MySQL direto aqui)
                        let currentBalance = player.getDynamicProperty("internal_balance") ?? 0;
                        player.setDynamicProperty("internal_balance", currentBalance + gameCurrencyAmount);

                        player.sendMessage(`§a[Loja]§f Compra aprovada! Você recebeu §e$${gameCurrencyAmount} moedas. §f(Assinatura: ${signature})`);
                    } else {
                        player.sendMessage(`§c[Loja]§f Erro na transação: ${json.output}`);
                    }
                } catch (e) {
                    player.sendMessage(`§c[Loja]§f Erro ao ler resposta do Docker: ${response.body}`);
                }
            } else {
                player.sendMessage(`§c[Loja]§f Erro na API do servidor. Código: ${response.status}`);
            }
        } catch (error) {
            player.sendMessage("§c[Loja]§f Erro ao conectar com o servidor Docker.");
        }
    }
    else if (command === "comprar_maca" || command === "buy_apple") {
        buyItem(player, "apple", "minecraft:golden_apple", CONFIG.storePrices.apple);
    }
    else if (command === "comprar_esmeralda" || command === "buy_emerald") {
        buyItem(player, "emerald", "minecraft:emerald", CONFIG.storePrices.emerald);
    }
    else if (command === "comprar_reliquia_nether" || command === "buy_nether_relic") {
        buyItem(player, "nether_relic", "solana:nether_relic", CONFIG.storePrices.nether_relic);
    }
    else if (command === "comprar_botas" || command === "buy_boots") {
        buyItem(player, "boot_relic", "solana:boot_relic", CONFIG.storePrices.boot_relic);
    }
    else if (command === "comprar_asas" || command === "buy_wings") {
        buyItem(player, "wing_relic", "solana:wing_relic", CONFIG.storePrices.wing_relic);
    }
    else if (command === "comprar_calca" || command === "buy_pants") {
        buyItem(player, "leg_relic", "solana:leg_relic", CONFIG.storePrices.leg_relic);
    }
    else if (command === "comprar_thor" || command === "buy_thor") {
        buyItem(player, "thor_axe", "solana:thor_axe", CONFIG.storePrices.thor_axe);
    }
    else if (command === "lockchest" || command === "trancarbau") {
        if (args.length === 0) {
            player.sendMessage("§cUso: /lockchest <senha>");
            return;
        }
        lockChest(player, args[0]);
    }
    else if (command === "unlockchest" || command === "destrancarbau") {
        if (args.length === 0) {
            player.sendMessage("§cUso: /unlockchest <senha>");
            return;
        }
        unlockChest(player, args[0]);
    }
    else if (command === "sethome") {
        const homeName = args.length > 0 ? args[0] : "default";
        setHome(player, homeName);
    }
    else if (command === "home") {
        const homeName = args.length > 0 ? args[0] : "default";
        teleportHome(player, homeName);
    }
    else if (command === "back") {
        teleportBack(player);
    }
    else if (command === "tpa") {
        if (args.length === 0) {
            player.sendMessage("§cUso: /tpa <jogador>");
            return;
        }
        sendTpaRequest(player, args[0]);
    }
    else if (command === "tpaccept" || command === "tpaceitar") {
        acceptTpa(player);
    }
    else if (command === "tpdeny" || command === "tprecusar") {
        denyTpa(player);
    }
    else {
        player.sendMessage("§cComando não reconhecido.");
    }
}

function buyItem(player, itemName, itemIdentifier, price) {
    if (price === undefined) {
        player.sendMessage(`§c[Loja]§f Preço não configurado para: ${itemName}`);
        return;
    }

    let currentBalance = player.getDynamicProperty("internal_balance") ?? 0;
    
    if (currentBalance < price) {
        player.sendMessage(`§c[Loja]§f Você precisa de §e$${price} moedas§f para comprar este item. Saldo atual: §c$${currentBalance}`);
        return;
    }

    // Desconta o valor
    player.setDynamicProperty("internal_balance", currentBalance - price);
    
    // Entrega o item ao jogador usando comando (maneira simples no Bedrock)
    system.run(() => {
        player.runCommandAsync(`give @s ${itemIdentifier} 1`).then((result) => {
            if (result.successCount > 0) {
                player.sendMessage(`§a[Loja]§f Você comprou §b${itemName}§f por §e$${price} moedas§f!`);
            } else {
                // Devolve o dinheiro caso dê erro (exemplo: inventário lotado, mas /give normalmente dropa no chão)
                player.setDynamicProperty("internal_balance", currentBalance);
                player.sendMessage(`§c[Loja]§f Ocorreu um erro ao entregar o item.`);
            }
        }).catch(() => {
            player.setDynamicProperty("internal_balance", currentBalance);
            player.sendMessage(`§c[Loja]§f Erro ao tentar dar o item.`);
        });
    });
}

// === SISTEMA DE PODERES DAS RELÍQUIAS ===
const activeLights = [];

system.runInterval(() => {
    const currentTick = system.currentTick;
    
    for (const player of world.getPlayers()) {
        const equipment = player.getComponent("equippable");
        if (!equipment) continue;

        const helmet = equipment.getEquipment(EquipmentSlot.Head || "head");
        const chest = equipment.getEquipment(EquipmentSlot.Chest || "chest");
        const legs = equipment.getEquipment(EquipmentSlot.Legs || "legs");
        const boots = equipment.getEquipment(EquipmentSlot.Feet || "feet");

        let hasFlight = false;

        // 1. Relíquia do Nether (Elmo) -> Resistência ao Fogo
        if (helmet && helmet.typeId === "solana:nether_relic") {
            player.addEffect("fire_resistance", 210, { amplifier: 0, showParticles: false });
        }

        // 2. Relíquia das Asas (Peitoral) -> Voo, Fogo e Foguetes
        if (chest && chest.typeId === "solana:wing_relic") {
            player.addEffect("fire_resistance", 210, { amplifier: 0, showParticles: false });
            // Ativa o voo (Requer recursos do Education Edition ativados no mundo para funcionar perfeitamente)
            player.runCommandAsync("ability @s mayfly true").catch(() => {});
            hasFlight = true;
            
            // Foguetes a cada 5 segundos (100 ticks)
            if (currentTick % 100 === 0) {
                const inv = player.getComponent("inventory").container;
                let rockets = 0;
                for (let i = 0; i < inv.size; i++) {
                    const item = inv.getItem(i);
                    if (item && item.typeId === "minecraft:firework_rocket") {
                        rockets += item.amount;
                    }
                }
                if (rockets < 3) {
                    player.runCommandAsync(`give @s firework_rocket ${3 - rockets}`);
                }
            }
        }
        
        // Remove voo se tirar a armadura
        if (!hasFlight) {
            // Em Bedrock é mais seguro rodar isso sem verificar gameMode para evitar travamentos de script se a API mudar
            player.runCommandAsync("ability @s mayfly false").catch(() => {});
        }

        // 3. Relíquia das Botas (Trilha de luz)
        if (boots && boots.typeId === "solana:boot_relic") {
            const pos = player.location;
            const blockPos = { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) };
            const block = player.dimension.getBlock(blockPos);
            
            if (block && block.isAir) {
                // Coloca o bloco de luz
                player.runCommandAsync(`setblock ${blockPos.x} ${blockPos.y} ${blockPos.z} light_block ["block_light_level"=15]`).catch(()=>{});
                
                // Agenda para remover
                activeLights.push({
                    dimension: player.dimension,
                    pos: blockPos,
                    removeAt: currentTick + 40
                });
            }
        }
    }

    // Limpeza da Trilha de Luz (40 ticks depois)
    for (let i = activeLights.length - 1; i >= 0; i--) {
        const light = activeLights[i];
        if (currentTick >= light.removeAt) {
            const block = light.dimension.getBlock(light.pos);
            if (block && block.typeId === "minecraft:light_block") {
                light.dimension.runCommandAsync(`setblock ${light.pos.x} ${light.pos.y} ${light.pos.z} air`).catch(()=>{});
            }
            activeLights.splice(i, 1);
        }
    }
});

// === SISTEMA DE TRANCAR BAÚS ===

function getLockedChests() {
    const data = world.getDynamicProperty("locked_chests");
    return data ? JSON.parse(data) : [];
}

function saveLockedChests(chests) {
    world.setDynamicProperty("locked_chests", JSON.stringify(chests));
}

function getChestPassword(dimensionId, x, y, z) {
    const chests = getLockedChests();
    // Checa o bloco e os blocos adjacentes (para baús duplos)
    const offsets = [
        {dx: 0, dz: 0},
        {dx: 1, dz: 0}, {dx: -1, dz: 0},
        {dx: 0, dz: 1}, {dx: 0, dz: -1}
    ];

    for (const c of chests) {
        if (c.dimension === dimensionId && c.y === y) {
            for (const off of offsets) {
                if (c.x === x + off.dx && c.z === z + off.dz) {
                    return c.password;
                }
            }
        }
    }
    return null;
}

function lockChest(player, password) {
    const blockRef = player.getBlockFromViewDirection();
    if (!blockRef) {
        player.sendMessage("§c[Baú]§f Olhe para um baú para trancá-lo.");
        return;
    }
    
    const block = blockRef.block;
    if (block.typeId !== "minecraft:chest" && block.typeId !== "minecraft:trapped_chest" && block.typeId !== "minecraft:barrel") {
        player.sendMessage("§c[Baú]§f Olhe para um baú ou barril para trancá-lo.");
        return;
    }

    const pos = block.location;
    const dim = player.dimension.id;

    const chests = getLockedChests();
    
    // Verifica se já está trancado
    if (getChestPassword(dim, pos.x, pos.y, pos.z)) {
        player.sendMessage("§c[Baú]§f Este baú já está trancado.");
        return;
    }

    chests.push({
        dimension: dim,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        password: password
    });
    saveLockedChests(chests);

    player.sendMessage("§a[Baú]§f Baú trancado com sucesso!");
    
    // Entrega a Name Tag como chave
    player.runCommandAsync(`give @s name_tag 1 0 {"minecraft:item_name":{"value":"${password}"}}`).catch(()=>{
        // Se a engine for mais antiga, usa rename normal ou o name_tag com nome é complicado via comando simples
        // Em versões muito novas, o /give suporta item_name. Caso falhe, daremos a nametag pura.
        player.runCommandAsync(`give @s name_tag 1`);
    });
    player.sendMessage("§e[Baú]§f Uma etiqueta foi entregue. Renomeie-a se necessário para acessar o baú.");
}

function unlockChest(player, password) {
    const blockRef = player.getBlockFromViewDirection();
    if (!blockRef) {
        player.sendMessage("§c[Baú]§f Olhe para um baú para destrancá-lo.");
        return;
    }

    const pos = blockRef.block.location;
    const dim = player.dimension.id;
    
    const chests = getLockedChests();
    let foundIndex = -1;

    for (let i = 0; i < chests.length; i++) {
        const c = chests[i];
        if (c.dimension === dim && c.x === pos.x && c.y === pos.y && c.z === pos.z) {
            if (c.password === password) {
                foundIndex = i;
            } else {
                player.sendMessage("§c[Baú]§f Senha incorreta.");
                return;
            }
            break;
        }
    }

    if (foundIndex !== -1) {
        chests.splice(foundIndex, 1);
        saveLockedChests(chests);
        player.sendMessage("§a[Baú]§f Baú destrancado com sucesso!");
    } else {
        player.sendMessage("§c[Baú]§f Este baú não está trancado (ou você deve destrancar olhando para o lado certo do baú duplo).");
    }
}

// Bloqueia a interação
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const block = event.block;
    if (block.typeId === "minecraft:chest" || block.typeId === "minecraft:trapped_chest" || block.typeId === "minecraft:barrel") {
        const pos = block.location;
        const password = getChestPassword(block.dimension.id, pos.x, pos.y, pos.z);

        if (password) {
            const player = event.player;
            const equipment = player.getComponent("equippable");
            const heldItem = equipment ? equipment.getEquipment(EquipmentSlot.Mainhand) : null;

            // No Bedrock, verificar o name_tag renomeado
            if (heldItem && heldItem.typeId === "minecraft:name_tag" && heldItem.nameTag === password) {
                // Acesso permitido
                return;
            }

            event.cancel = true;
            
            system.run(() => {
                player.sendMessage("§c[Baú]§f Baú trancado! Você não tem a chave correta.");
                // ZAP! Raio no jogador
                block.dimension.spawnEntity("minecraft:lightning_bolt", player.location);
            });
        }
    }
});

// Bloqueia a quebra
world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;
    if (block.typeId === "minecraft:chest" || block.typeId === "minecraft:trapped_chest" || block.typeId === "minecraft:barrel") {
        const pos = block.location;
        const password = getChestPassword(block.dimension.id, pos.x, pos.y, pos.z);

        if (password) {
            event.cancel = true;
            system.run(() => {
                event.player.sendMessage("§c[Baú]§f Você não pode quebrar um baú trancado!");
            });
        }
    }
});

// === SISTEMA DE HOME E TELETRANSPORTE ===

// Memória temporária para pedidos de TPA
const activeTpaRequests = new Map(); // key: targetId, value: senderId

function saveLastLocation(player) {
    const loc = player.location;
    const dim = player.dimension.id;
    const data = { x: loc.x, y: loc.y, z: loc.z, dimension: dim };
    player.setDynamicProperty("last_location", JSON.stringify(data));
}

function setHome(player, homeName) {
    const loc = player.location;
    const dim = player.dimension.id;
    
    let homesStr = player.getDynamicProperty("homes");
    let homes = homesStr ? JSON.parse(homesStr) : {};
    
    homes[homeName] = { x: loc.x, y: loc.y, z: loc.z, dimension: dim };
    
    player.setDynamicProperty("homes", JSON.stringify(homes));
    player.sendMessage(`§a[Teleporte]§f Casa '§e${homeName}§f' definida com sucesso!`);
}

function teleportHome(player, homeName) {
    let homesStr = player.getDynamicProperty("homes");
    if (!homesStr) {
        player.sendMessage("§c[Teleporte]§f Você não tem nenhuma casa definida.");
        return;
    }
    
    let homes = JSON.parse(homesStr);
    const home = homes[homeName];
    
    if (!home) {
        player.sendMessage(`§c[Teleporte]§f A casa '§e${homeName}§f' não existe.`);
        return;
    }
    
    saveLastLocation(player);
    const dimension = world.getDimension(home.dimension);
    player.teleport({ x: home.x, y: home.y, z: home.z }, { dimension: dimension });
    player.sendMessage(`§a[Teleporte]§f Teletransportado para a casa '§e${homeName}§f'.`);
}

function teleportBack(player) {
    let lastLocStr = player.getDynamicProperty("last_location");
    if (!lastLocStr) {
        player.sendMessage("§c[Teleporte]§f Não há local anterior para retornar.");
        return;
    }
    
    let loc = JSON.parse(lastLocStr);
    // Salva o local atual antes de voltar
    saveLastLocation(player);
    
    const dimension = world.getDimension(loc.dimension);
    player.teleport({ x: loc.x, y: loc.y, z: loc.z }, { dimension: dimension });
    player.sendMessage(`§a[Teleporte]§f Você voltou ao último local.`);
}

function sendTpaRequest(sender, targetName) {
    // Busca o jogador alvo no servidor
    const players = world.getPlayers();
    let target = null;
    for (const p of players) {
        if (p.name.toLowerCase() === targetName.toLowerCase()) {
            target = p;
            break;
        }
    }
    
    if (!target) {
        sender.sendMessage(`§c[Teleporte]§f O jogador '§e${targetName}§f' não foi encontrado ou está offline.`);
        return;
    }
    
    if (sender.id === target.id) {
        sender.sendMessage("§c[Teleporte]§f Você não pode mandar TPA para si mesmo.");
        return;
    }
    
    activeTpaRequests.set(target.id, sender.id);
    sender.sendMessage(`§a[Teleporte]§f Pedido de TPA enviado para §e${target.name}§f.`);
    target.sendMessage(`§e[Teleporte]§f O jogador §a${sender.name}§f quer se teletransportar até você.`);
    target.sendMessage(`§fDigite §a/tpaccept§f para aceitar ou §c/tpdeny§f para recusar.`);
    
    // Opcional: remover o pedido automaticamente após X segundos
    system.runTimeout(() => {
        if (activeTpaRequests.get(target.id) === sender.id) {
            activeTpaRequests.delete(target.id);
            sender.sendMessage(`§c[Teleporte]§f O pedido de TPA para §e${target.name}§f expirou.`);
        }
    }, 1200); // 1200 ticks = 60 segundos
}

function acceptTpa(player) {
    const senderId = activeTpaRequests.get(player.id);
    if (!senderId) {
        player.sendMessage("§c[Teleporte]§f Você não tem pedidos de TPA pendentes.");
        return;
    }
    
    // Busca o sender
    const players = world.getPlayers();
    let sender = null;
    for (const p of players) {
        if (p.id === senderId) {
            sender = p;
            break;
        }
    }
    
    if (!sender) {
        player.sendMessage("§c[Teleporte]§f O jogador que enviou o pedido não está mais online.");
        activeTpaRequests.delete(player.id);
        return;
    }
    
    // Teletransporta o sender até o player
    saveLastLocation(sender);
    sender.teleport(player.location, { dimension: player.dimension });
    
    sender.sendMessage(`§a[Teleporte]§f O jogador §e${player.name}§f aceitou seu pedido.`);
    player.sendMessage(`§a[Teleporte]§f Você aceitou o pedido de §e${sender.name}§f.`);
    
    activeTpaRequests.delete(player.id);
}

function denyTpa(player) {
    const senderId = activeTpaRequests.get(player.id);
    if (!senderId) {
        player.sendMessage("§c[Teleporte]§f Você não tem pedidos de TPA pendentes.");
        return;
    }
    
    activeTpaRequests.delete(player.id);
    player.sendMessage("§c[Teleporte]§f Pedido recusado.");
    
    // Busca o sender para avisar
    const players = world.getPlayers();
    for (const p of players) {
        if (p.id === senderId) {
            p.sendMessage(`§c[Teleporte]§f O jogador §e${player.name}§f recusou seu pedido.`);
            break;
        }
    }
}
