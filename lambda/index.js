const Alexa = require('ask-sdk-core');

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
// A Alexa desiste da skill após ~8s; deixamos folga para montar a resposta.
const TIMEOUT_MS = 6500;
const MAX_HISTORY = 6;

const SYSTEM_PROMPT = [
  'Você é o Claude, falando por uma caixa de som Alexa em português do Brasil.',
  'Suas respostas serão LIDAS EM VOZ ALTA: use no máximo 3 frases curtas, tom natural e direto.',
  'Nunca use markdown, listas, emojis, tabelas ou símbolos; escreva números e unidades por extenso quando soar melhor.',
  'Você não controla luzes nem dispositivos e não tem dados em tempo real (clima, notícias, horário).',
  'Se pedirem isso, diga em uma frase que a Alexa faz isso melhor e sugira pedir diretamente a ela, sem usar o nome da skill.',
  'Se a pergunta for ambígua, faça uma única pergunta curta de esclarecimento.',
].join(' ');

function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    return require('./secrets').ANTHROPIC_API_KEY;
  } catch (e) {
    return undefined;
  }
}

// Texto vira SSML: remove restos de markdown e escapa caracteres especiais.
function toSpeech(text) {
  return text
    .replace(/[*_`#~]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/&/g, ' e ')
    .replace(/</g, ' menor que ')
    .replace(/>/g, ' maior que ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function askClaude(history) {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'COLE_SUA_CHAVE_AQUI') {
    throw Object.assign(new Error('Chave da API ausente'), { code: 'NO_KEY' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: history,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw Object.assign(new Error(`API ${res.status}: ${body}`), { code: 'API_ERROR' });
    }
    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ');
    if (!text) throw Object.assign(new Error('Resposta vazia'), { code: 'EMPTY' });
    return text;
  } catch (e) {
    if (e.name === 'AbortError') throw Object.assign(new Error('Timeout'), { code: 'TIMEOUT' });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const LaunchRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle(h) {
    const speech = 'Oi! Sou o Claude. Pode perguntar o que quiser. Por exemplo: pergunte como funciona a fotossíntese.';
    return h.responseBuilder.speak(speech).reprompt('Qual é a sua pergunta?').getResponse();
  },
};

const AskIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'AskIntent',
  async handle(h) {
    const query = Alexa.getSlotValue(h.requestEnvelope, 'query');
    if (!query) {
      return h.responseBuilder.speak('Não entendi a pergunta. Pode repetir?').reprompt('Qual é a sua pergunta?').getResponse();
    }

    const attrs = h.attributesManager.getSessionAttributes();
    const history = (attrs.history || []).concat({ role: 'user', content: query });

    let answer;
    try {
      answer = await askClaude(history);
    } catch (e) {
      console.error('Falha ao consultar o Claude:', e.code, e.message);
      const msgs = {
        NO_KEY: 'A chave da API ainda não foi configurada.',
        TIMEOUT: 'O Claude demorou demais para responder. Tente de novo.',
      };
      return h.responseBuilder
        .speak(msgs[e.code] || 'Não consegui falar com o Claude agora. Tente de novo em instantes.')
        .getResponse();
    }

    attrs.history = history.concat({ role: 'assistant', content: answer }).slice(-MAX_HISTORY);
    h.attributesManager.setSessionAttributes(attrs);

    return h.responseBuilder
      .speak(toSpeech(answer))
      .reprompt('Quer saber mais alguma coisa?')
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent',
  handle: (h) =>
    h.responseBuilder
      .speak('Comece a frase com pergunte, me explique ou quero saber. Por exemplo: me explique como funciona um buraco negro. O que você quer saber?')
      .reprompt('O que você quer saber?')
      .getResponse(),
};

const StopHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    ['AMAZON.CancelIntent', 'AMAZON.StopIntent', 'AMAZON.NavigateHomeIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: (h) => h.responseBuilder.speak('Até logo!').withShouldEndSession(true).getResponse(),
};

const FallbackHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.FallbackIntent',
  handle: (h) =>
    h.responseBuilder
      .speak('Não entendi. Comece a frase com pergunte ou me explique. O que você quer saber?')
      .reprompt('O que você quer saber?')
      .getResponse(),
};

const SessionEndedHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
  handle: (h) => h.responseBuilder.getResponse(),
};

const ErrorHandler = {
  canHandle: () => true,
  handle(h, error) {
    console.error('Erro não tratado:', error);
    return h.responseBuilder.speak('Algo deu errado. Tente de novo.').getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AskIntentHandler,
    HelpIntentHandler,
    StopHandler,
    FallbackHandler,
    SessionEndedHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();

exports._toSpeech = toSpeech;
