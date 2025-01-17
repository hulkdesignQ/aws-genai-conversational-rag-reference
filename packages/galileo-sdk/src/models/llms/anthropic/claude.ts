/*! Copyright [Amazon.com](http://amazon.com/), Inc. or its affiliates. All Rights Reserved.
PDX-License-Identifier: Apache-2.0 */
import { CHAT_PROMPT_TEMPLATES } from '../../../prompt/index.js';
import type { IModelAdapter } from '../../adapter.js';
import { DEFAULT_MAX_NEW_TOKENS } from '../../constants.js';
import type { Kwargs } from '../../types.js';

// https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-templates-and-examples.html#qa-with-context
export const CLAUDE_ADAPTER: IModelAdapter = {
  prompt: {
    chat: {
      base: {
        // \n\nHuman: is stop sequence in Claude so override default
        HumanMessage: 'H: {{content}}',
        AIMessage: 'A: {{content}}',
      },
      QA: {
        template: `\n\nHuman: Read the follow text inside <text></text> XML tags, and then answer the question based on the provided rules inside <rules></rules>:

<text>
{{context}}
</text>
<rules>
1. only use knowledge from the provided corpus to answer the question
2. always be truthful, honest, unbiased, and unharmful
3. be concise, do not repeat the question or yourself in the answer
</rules>
Based on the text above, {{question}}

Assistant: `,
      },
      CONDENSE_QUESTION: {
        template: `\n\nHuman: Read the following chat history inside <history></history> XML tags, and then rephrase the "Followup Question" below to be a concise standalone question in its original language. Without answering the question, return only the standalone question:

<history>
{{>ChatHistory}}
</history>
Followup Question: {{question}}

Assistant: `,
      },
      CLASSIFY: {
        template: '\n\nHuman: ' + CHAT_PROMPT_TEMPLATES.CLASSIFY.template.replace(/Classification: /g, 'Assistant: '),
      },
    },
  },
  contentHandler: {
    input: {
      promptKey: 'prompt',
    },
    output: {
      jsonpath: 'completion',
    },
  },
};

export const CLAUDE_KWARGS: Kwargs = {
  temperature: 0,
  max_tokens_to_sample: DEFAULT_MAX_NEW_TOKENS,
  stop_sequences: ['\n\nHuman:'],
};
