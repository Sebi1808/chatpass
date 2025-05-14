// use server'

/**
 * @fileOverview This file defines a Genkit flow for analyzing the chat context and determining
 * whether an AI bot should escalate the discussion.
 *
 * - analyzeEscalation - Analyzes the chat context and determines if escalation is needed.
 * - AnalyzeEscalationInput - The input type for the analyzeEscalation function.
 * - AnalyzeEscalationOutput - The return type for the analyzeEscalation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeEscalationInputSchema = z.object({
  chatContext: z.string().describe('The current chat context, including recent messages.'),
  botFlag: z.string().describe('The current bot flag.'),
  escalationLevel: z.number().describe('The current escalation level of the bot (0-3).'),
  scenarioRules: z.string().describe('The rules for the current scenario.'),
});
export type AnalyzeEscalationInput = z.infer<typeof AnalyzeEscalationInputSchema>;

const AnalyzeEscalationOutputSchema = z.object({
  shouldEscalate: z
    .boolean()
    .describe('Whether the bot should escalate the discussion based on the analysis.'),
  newEscalationLevel: z
    .number()
    .describe('The new escalation level of the bot, should escalation be required.'),
  reason: z.string().describe('The reasoning behind the escalation decision.'),
});
export type AnalyzeEscalationOutput = z.infer<typeof AnalyzeEscalationOutputSchema>;

export async function analyzeEscalation(input: AnalyzeEscalationInput): Promise<AnalyzeEscalationOutput> {
  return analyzeEscalationFlow(input);
}

const analyzeEscalationPrompt = ai.definePrompt({
  name: 'analyzeEscalationPrompt',
  input: {schema: AnalyzeEscalationInputSchema},
  output: {schema: AnalyzeEscalationOutputSchema},
  prompt: `You are an AI bot analyzing a chat context to determine if you should escalate the discussion.

  Here's the current chat context:
  {{chatContext}}

  Your current bot flag is: {{botFlag}}
  Your current escalation level is: {{escalationLevel}}

  Here are the rules for the current scenario:
  {{scenarioRules}}

  Based on the context, your bot flag, the current escalation level, and the scenario rules, determine whether you should escalate the discussion.
  If you should escalate, determine what your new escalation level should be. The escalation level is a number between 0 and 3.
  Explain your reasoning for the escalation decision.

  Return a JSON object with the following format:
  {
    "shouldEscalate": boolean,
    "newEscalationLevel": number,
    "reason": string
  }`,
});

const analyzeEscalationFlow = ai.defineFlow(
  {
    name: 'analyzeEscalationFlow',
    inputSchema: AnalyzeEscalationInputSchema,
    outputSchema: AnalyzeEscalationOutputSchema,
  },
  async input => {
    const {output} = await analyzeEscalationPrompt(input);
    return output!;
  }
);
