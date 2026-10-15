# Avisos no celular e no tablet (notificação push)

Quando a cliente marca um horário pelo link ou envia a ficha, a equipe recebe um aviso no aparelho, mesmo com o painel fechado.

## Como funciona
1. A cliente grava a reserva (ou a ficha) no banco, como sempre.
2. A página dela chama `/api/avisar`, que **confere no banco** que a reserva/ficha existe e é recente, e manda o aviso (um por reserva).
3. Quem recebe: aparelhos que ativaram em *Ativar avisos*. A administradora recebe das duas unidades; a funcionária, só da Maison. O aviso do Florença só vai para a Tháriga.
4. O aviso mostra só o primeiro nome, o serviço, o dia e a hora (ou "ficha recebida"), nunca dado de saúde.
5. Ao tocar, abre o painel; ao abrir, a reserva vira agendamento.

## Configuração (uma vez), na Vercel do painel (projeto da pasta `maison`) → Settings → Environment Variables
- `FIREBASE_SERVICE_ACCOUNT`: o arquivo JSON da conta de serviço (Firebase → Configurações do projeto → Contas de serviço → Gerar nova chave privada), colado inteiro. **Nunca vai para o GitHub nem para o chat.**
- `VAPID_PUBLICA`: a mesma chave que está em `VAPID_PUBLICA` no `index.html`.
- `VAPID_PRIVADA`: a chave privada correspondente.
- Depois, **Redeploy** para valer.

## Cada aparelho
- Android: Chrome, tocar em **Ativar avisos** e permitir.
- iPhone/iPad (iOS 16.4+): abrir no Safari, **Compartilhar → Adicionar à Tela de Início**, abrir pelo ícone novo e tocar em **Ativar avisos**.

## Limites
- O aviso pode atrasar alguns segundos, e o celular em economia de bateria pode adiar.
- Aparelho que desinstala o painel ou revoga a permissão é esquecido sozinho no próximo aviso.
