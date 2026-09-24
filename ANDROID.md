# App Android: como publicar, instalar e testar

O site continua no GitHub Pages igual. O app Android é o mesmo site
empacotado com o Capacitor, mais um serviço nativo que toca os avisos com
a tela apagada.

## 1. Cadastrar a chave de assinatura (uma vez só)

O Android só aceita atualizar um app se a nova versão tiver a mesma
"assinatura" da anterior. A chave fica guardada nos segredos do GitHub,
nunca no código.

Você recebeu dois arquivos de texto: `KEYSTORE_BASE64.txt` e
`KEYSTORE_SENHA.txt` (e o arquivo `treino-corrida.jks`, que é a chave em si).

1. No computador, abra o repositório no GitHub.
2. Vá em **Settings** (aba no topo) > **Secrets and variables** > **Actions**.
3. Clique em **New repository secret**.
   - Name: `KEYSTORE_BASE64`
   - Secret: abra `KEYSTORE_BASE64.txt`, copie **todo** o conteúdo e cole.
   - Clique em **Add secret**.
4. Clique de novo em **New repository secret**.
   - Name: `KEYSTORE_SENHA`
   - Secret: o conteúdo de `KEYSTORE_SENHA.txt`.
   - Clique em **Add secret**.
5. Guarde os três arquivos num lugar seguro (ex.: uma pasta privada do
   Google Drive). Se a chave se perder, o app novo não instala por cima
   do antigo: seria preciso exportar o progresso, desinstalar e instalar
   de novo.

## 2. Gerar o APK

A cada push na `main` (por exemplo, ao aprovar um pull request), o GitHub
Actions gera o APK assinado e publica uma **Release**. Leva uns 5 minutos.
Para acompanhar: aba **Actions** do repositório, fluxo "App Android".

## 3. Instalar no Pixel 8 (primeira vez)

1. No celular, abra o Chrome e entre em
   `github.com/Ianzik/corrida/releases/latest`.
2. Em **Assets**, toque em `treino-corrida.apk` para baixar.
3. Quando o download terminar, toque em **Abrir**.
4. O Android avisa que o Chrome não tem permissão para instalar apps:
   toque em **Configurações**, ligue **Permitir desta fonte** e volte.
5. Toque em **Instalar**. Se o Play Protect perguntar, toque em
   **Mais detalhes** > **Instalar mesmo assim** (é normal para apps que não
   vêm da Play Store).
6. Abra o app. No primeiro treino ele pede as permissões explicando para
   que servem.

## 4. Levar seu progresso do Chrome para o app

1. No site (Chrome), role até o fim e toque em **Exportar progresso** >
   **Copiar texto**.
2. No app, toque em **Importar progresso**, cole o texto e toque em
   **Continuar** > **Importar**.

Os dois progressos são juntados: fica o maior avanço e nada é apagado.
Funciona também no sentido contrário.

## 5. Atualizar depois

Repita os passos 1 a 3 da instalação com a Release mais nova e toque em
**Atualizar**. O progresso fica, porque a assinatura é a mesma.

## 6. Roteiro de teste no celular

Faça cada item e anote o que acontecer. Se algo falhar, diga qual item,
o que esperava e o que aconteceu.

**A. Preparação**
- [ ] Abrir o app, importar o progresso e escolher uma sessão da Semana 1
      (use "‹ Anterior" se precisar).
- [ ] Tocar em Iniciar: aparece a explicação das notificações; permitir.
- [ ] Aparece o pedido de bateria; responder **Permitir**.
- [ ] A notificação "Treino em andamento" aparece com o bloco, a contagem
      regressiva e os botões Pausar e Encerrar.

**B. Sessão inteira da Semana 1, tela apagada, no bolso, com Spotify**
- [ ] Dar play numa playlist no Spotify, voltar ao app e iniciar a sessão.
- [ ] Apertar o botão lateral para apagar a tela e guardar no bolso.
- [ ] Em cada troca: 3 bipes (3, 2, 1) com vibração curta, depois o som da
      troca, a vibração da troca e a voz ("Corra, 1 de 6", "Caminhe"...).
- [ ] A música **abaixa** durante o aviso e **volta sozinha**. Não pausa.
- [ ] Os avisos chegam na hora (compare com o relógio da notificação).
- [ ] No início do desaquecimento: "Últimos 5 minutos de desaquecimento".
- [ ] No fim: som de conclusão e "Sessão concluída".
- [ ] Abrir o app: a sessão aparece como concluída e o app já está na
      próxima.

**C. Pausar pela notificação**
- [ ] Com o treino rodando e a tela apagada, puxar as notificações na tela
      de bloqueio e tocar em **Pausar**. Os avisos param.
- [ ] Abrir o app: está pausado, com o mesmo tempo que a notificação mostra.
- [ ] Tocar em **Continuar** na notificação: os avisos voltam no ritmo certo.

**D. Pular bloco pelo app**
- [ ] Com o treino rodando, tocar em › no app: o aviso do novo bloco toca
      uma vez (não duas) e os próximos avisos seguem o novo horário.

**E. Fechar o app no meio da sessão**
- [ ] Deslizar o app para fora da tela de apps recentes (fechar). Os
      avisos **continuam**.
- [ ] "Forçar parada" (Configurações > Apps > Treino de Corrida > Forçar
      parada): os avisos **param**. Isso é uma regra do Android e nenhum
      app sobrevive a ela. Ao abrir o app de novo, ele corrige a posição
      pelo relógio e volta a avisar.

**F. Modo economia de bateria**
- [ ] Ligar a Economia de bateria (puxar as configurações rápidas) e
      repetir um trecho do teste B com a tela apagada por pelo menos 10
      minutos. Os avisos devem chegar na hora.

**G. Site continua igual**
- [ ] Abrir o site no Chrome: funciona como antes, com bipes e tela acesa.
