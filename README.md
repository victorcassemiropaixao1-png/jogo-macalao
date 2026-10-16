# Meu Claude na Alexa

Skill da Alexa que responde perguntas abertas usando o Claude.
Uso: **"Alexa, peça ao meu claude para explicar como funciona a chuva"**.

As luzes e o clima continuam com a própria Alexa (ela faz isso melhor). Esta skill é só para conversar com o Claude.

## O que você precisa

1. Conta no [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) (grátis, use o mesmo e-mail da sua Alexa).
2. Uma chave da API da Anthropic, em https://console.anthropic.com (tem custo por uso, baixo para uso doméstico).

## Publicar (modo "Alexa-hosted", sem conta AWS)

1. No Developer Console, clique em **Create Skill**.
   - Nome: `Meu Claude` · Idioma: **Portuguese (BR)** · Tipo: **Other** → **Custom**
   - Hosting: **Alexa-hosted (Node.js)** · Template: **Start from scratch**
2. Aba **Build** → **JSON Editor** → cole o conteúdo de `skill-package/interactionModels/custom/pt-BR.json`.
   Clique em **Save** e depois em **Build Skill**.
3. Aba **Code** → substitua o `index.js` pelo de `lambda/index.js` e o `package.json` pelo de `lambda/package.json`.
4. Ainda na aba **Code**, crie um arquivo `secrets.js` (copie de `lambda/secrets.example.js`) e coloque a sua chave da API.
   **Nunca** coloque a chave em arquivo que vá para o GitHub.
5. Clique em **Deploy**.
6. Aba **Test** → mude para **Development**. Se o seu Echo usa a mesma conta, a skill já funciona nele.

## Como falar

- "Alexa, abrir meu claude" (abre a conversa; dá para fazer várias perguntas seguidas)
- "Alexa, peça ao meu claude para explicar …"
- "Alexa, pergunte ao meu claude o que posso cozinhar com ovo e tomate"
- Dentro da skill: "pergunte …", "me explique …", "quero saber …". Para sair: "tchau".

## Limites conhecidos

- A Alexa corta a skill se a resposta passar de ~8 segundos. Por isso as respostas são curtas e o modelo padrão é o mais rápido (`claude-haiku-5-5`). Dá para trocar com a variável `CLAUDE_MODEL`.
- O Claude aqui não tem dados em tempo real nem controla dispositivos.
- O nome de invocação ("meu claude") é editável em `pt-BR.json`; precisa ter duas palavras ou mais.

## Testar localmente

```bash
cd lambda && npm install && npm test
```
O teste usa a API simulada e não gasta chave.
