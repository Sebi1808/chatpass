
// This is a server-side file.
'use server';

/**
 * @fileOverview Generates messages for AI bots based on the scenario and bot personality.
 *
 * - generateBotMessage - A function that generates a message for a bot.
 * - BotMessageInput - The input type for the generateBotMessage function.
 * - BotMessageOutput - The return type for the generateBotMessage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BotMessageInputSchema = z.object({
  scenarioContext: z.string().describe('The context of the current chat scenario.'),
  botPersonality: z.enum(['provokateur', 'verteidiger', 'informant', 'standard']).describe('The personality of the bot.'),
  chatHistory: z.string().optional().describe('Previous chat history to maintain context.'),
  escalationLevel: z.number().min(0).max(3).default(0).describe('The current escalation level of the bot (0-3).'),
  currentMission: z.string().optional().describe('A specific mission or instruction for the bot for the next message.'),
});
export type BotMessageInput = z.infer<typeof BotMessageInputSchema>;

const BotMessageOutputSchema = z.object({
  message: z.string().describe('The generated message for the bot.'),
  bot_flag: z.string().optional().describe('A flag indicating a specific bot behavior or characteristic.'),
  escalationLevel: z.number().min(0).max(3).default(0).describe('The escalation level of the bot after this message.'),
});
export type BotMessageOutput = z.infer<typeof BotMessageOutputSchema>;

export async function generateBotMessage(input: BotMessageInput): Promise<BotMessageOutput> {
  return generateBotMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'botMessagePrompt',
  input: {schema: BotMessageInputSchema},
  output: {schema: BotMessageOutputSchema},
  prompt: `You are an AI bot participating in a chat simulation.
Your personality is: {{{botPersonality}}}
The scenario context is: {{{scenarioContext}}}

{{#if chatHistory}}
Here is the recent chat history:
{{chatHistory}}
{{/if}}

Your current escalation level is: {{{escalationLevel}}}. Adjust your message accordingly to escalate or de-escalate the conversation, if appropriate.
{{#if currentMission}}
Your specific instruction for this message is: "{{currentMission}}". Please try to incorporate this into your response.
{{/if}}

Your task is to generate a message that is relevant to the scenario and reflects your personality.
Format your response as a JSON object with the following keys:
- message: The generated message for the bot.
- bot_flag: (Optional) A flag indicating a specific bot behavior or characteristic. Use if helpful, but it is not required.
- escalationLevel: The escalation level of the bot after this message (0-3). This should be the same as the input escalation level unless the bot takes an action that changes the escalation level.

Ensure the message is appropriate for a school setting and adheres to ethical guidelines.
Keep the message under 300 characters.

{
  "message": "...",
  "bot_flag": "...",
  "escalationLevel": ...
}`,
});

const generateBotMessageFlow = ai.defineFlow(
  {
    name: 'generateBotMessageFlow',
    inputSchema: BotMessageInputSchema,
    outputSchema: BotMessageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
