// Teste local com a API do Claude simulada: node test.js
const assert = require('assert');
process.env.ANTHROPIC_API_KEY = 'chave-falsa';

let calls = [];
global.fetch = async (url, opts) => {
  calls.push(JSON.parse(opts.body));
  return {
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: '**Resposta** com & símbolos.' }] }),
  };
};

const { handler, _toSpeech } = require('./index');

function envelope(request, attributes = {}) {
  return {
    version: '1.0',
    session: {
      new: false,
      sessionId: 's1',
      application: { applicationId: 'app' },
      attributes,
      user: { userId: 'u1' },
    },
    context: { System: { application: { applicationId: 'app' }, user: { userId: 'u1' }, device: { deviceId: 'd' } } },
    request: { requestId: 'r1', timestamp: new Date().toISOString(), locale: 'pt-BR', ...request },
  };
}

const invoke = (e) => new Promise((res, rej) => handler(e, {}, (err, out) => (err ? rej(err) : res(out))));

(async () => {
  const launch = await invoke(envelope({ type: 'LaunchRequest' }));
  assert(launch.response.outputSpeech.ssml.includes('Sou o Claude'));

  const ask = await invoke(
    envelope({
      type: 'IntentRequest',
      intent: { name: 'AskIntent', confirmationStatus: 'NONE', slots: { query: { name: 'query', value: 'como funciona a chuva', confirmationStatus: 'NONE' } } },
    })
  );
  assert(ask.response.outputSpeech.ssml.includes('Resposta com e símbolos'), ask.response.outputSpeech.ssml);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].messages[0].content, 'como funciona a chuva');
  assert.strictEqual(ask.sessionAttributes.history.length, 2);

  // segunda pergunta na mesma sessão carrega o histórico
  await invoke(
    envelope(
      {
        type: 'IntentRequest',
        intent: { name: 'AskIntent', confirmationStatus: 'NONE', slots: { query: { name: 'query', value: 'e a neve', confirmationStatus: 'NONE' } } },
      },
      ask.sessionAttributes
    )
  );
  assert.strictEqual(calls[1].messages.length, 3);

  // falha da API vira fala amigável
  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'erro' });
  const fail = await invoke(
    envelope({
      type: 'IntentRequest',
      intent: { name: 'AskIntent', confirmationStatus: 'NONE', slots: { query: { name: 'query', value: 'oi', confirmationStatus: 'NONE' } } },
    })
  );
  assert(fail.response.outputSpeech.ssml.includes('Não consegui falar com o Claude'));

  assert.strictEqual(_toSpeech('- item <b> & c'), 'item menor que b maior que e c');
  console.log('OK: todos os testes passaram');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
