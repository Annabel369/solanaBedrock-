# solanaBedrock-
Solana Bedrock (Add-on)!

Bedrock.

Para instalar e testar o que fizemos, siga este passo a passo final:

1. Instalar as Pastas no Minecraft
Se você estiver jogando no Windows 10/11, copie as pastas que criamos para as pastas de desenvolvimento do jogo:

Aperte as teclas Windows + R, cole o caminho abaixo e dê Enter: %localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang
Copie a pasta solana_bp para dentro da pasta development_behavior_packs.
Copie a pasta solana_rp para dentro da pasta development_resource_packs.
(Se você estiver enviando para um servidor dedicado (BDS), basta colocar essas pastas nas pastas behavior_packs e resource_packs do servidor).

2. Criar o Mundo de Teste
Abra o Minecraft Bedrock, vá em Criar Novo Mundo e configure exatamente assim:

Pacotes de Recurso (Resource Packs): Ative o "Solana Mod RP".
Pacotes de Comportamento (Behavior Packs): Ative o "Solana Mod BP" (aceite o aviso de conquistas).
Experimentos (Experiments): Desça nas configurações do mundo e ative a opção "APIs Beta" (Beta APIs). (Isso é obrigatório para que os nossos scripts em JavaScript e a conexão HTTP funcionem).
Se quiser que as asas funcionem perfeitamente, ative também os "Recursos do Education Edition".
Deixe os Cheats (Trapaças) ativados.
3. Teste os comandos!
Entre no mundo e teste tudo no chat:

Para simular sua carteira: /setwallet SUA_CARTEIRA_AQUI
Ver saldo da rede Solana: /solbalance
Comprar moedas com crypto: /comprarmoedas 0.5
Comprar itens da loja virtual: /comprar_thor
Salvar sua base: /sethome base
Teletransporte de volta: /home base ou /back
