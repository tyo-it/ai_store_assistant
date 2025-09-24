import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

export async function setupCounter(element: HTMLButtonElement) {
  let counter = 0
  const setCounter = (count: number) => {
    counter = count
    element.innerHTML = `count is ${counter}`
  }
  element.addEventListener('click', () => setCounter(counter + 1))
  setCounter(0)

  const agent = new RealtimeAgent({
    name: 'Assistant',
    instructions: 'You are a helpful assistant.',
  });
  const session = new RealtimeSession(agent);
  // Automatically connects your microphone and audio output in the browser via WebRTC.
  try {
    await session.connect({
      // To get this ephemeral key string, you can run the following command or implement the equivalent on the server side:
      // curl -s -X POST https://api.openai.com/v1/realtime/client_secrets -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" -d '{"session": {"type": "realtime", "model": "gpt-realtime"}}' | jq .value
      apiKey: 'ek_68d3bd177ae081919e4179a8d020f33a',
    });
    console.log('You are connected!');
  } catch (e) {
    console.error(e);
  }
}
