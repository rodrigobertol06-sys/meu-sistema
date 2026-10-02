# Meu Sistema Financeiro

Sistema pessoal de finanças, aquisições, investimentos, carros e mercado,
baseado na planilha original (abas "Superior a 10M", "Ate 10M", "Lista Carros"
e "Investimentos Poupança").

## Abas

- **Painel**: valores, saldo disponível, fluxo mensal, projeção dos investimentos e alertas.
- **Renda & Gastos**: valor a receber, % para consumo, renda mensal e gastos fixos (os gastos com carros entram sozinhos).
- **Aquisições**: dívidas, imóveis (com % de taxas de compra), casa, doações, reserva etc.
- **Investimentos**: quantos investimentos quiser (poupança, Tesouro, CDB, LCI, LCA...), com valor fixo, % do saldo ou "o que sobrar"; mostra quanto rende por mês, o salário e a sobra. O botão "Renovar no vencimento" simula os próximos períodos: resgata o saldo, separa o salário do novo período e reaplica o restante.
- **Carros**: garagem, custos (combustível, IPVA, seguro, manutenção), estimativa de km e catálogo de modelos.
- **Mercado**: Selic, CDI e IPCA atuais (BrasilAPI) e consulta à tabela FIPE.
- **Ajustes**: cenários, login Google (sincronização), backup.

## Como abrir

O sistema é só HTML/CSS/JS, sem instalação. Precisa ser aberto por um endereço
`http(s)://` (não funciona abrindo o arquivo direto):

- **GitHub Pages** (recomendado): no repositório, *Settings → Pages → Branch: main → / (root)*.
- No computador: `npx serve .` ou `python3 -m http.server` e abrir `http://localhost:8000`.

Os dados ficam salvos no navegador. Para guardar na nuvem e usar em vários aparelhos:

1. No [console do Firebase](https://console.firebase.google.com/), em *Authentication → Sign-in method*, ative **Google**.
2. Em *Authentication → Settings → Authorized domains*, adicione o domínio do site (ex.: `seuusuario.github.io`).
3. Em *Firestore → Rules*, cole o conteúdo de `firestore.rules` e publique (assim só você acessa seus dados).
4. No sistema, aba **Ajustes → Entrar com Google**.

## Testes

`npm test` confere os cálculos contra os valores da planilha.
